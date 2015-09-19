'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.it;
var before = lab.before;
var beforeEach = lab.beforeEach;
var after = lab.after;
var afterEach = lab.afterEach;
var Code = require('code');
var expect = Code.expect;
var sinon = require('sinon');
var createCount = require('callback-count');

require('loadenv')('charon:env');
var server = require('../../lib/server');
var rcodes = require('dns-rcodes');
var query = require('../../lib/query');
var apiClient = require('../../lib/api-client');
var monitor = require('monitor-dog');
var monitorStub = require('../fixtures/monitor');
var dnsRequest = require('../fixtures/dns-request');
var cache = require('../../lib/cache');
var pubsub = require('../../lib/pubsub');

describe('functional', function() {
  before(function (done) {
    sinon.stub(apiClient, 'login').yields();
    server.start(function() {
      apiClient.login.restore();
      done();
    });
  });

  after(function (done) {
    sinon.stub(apiClient, 'logout').yields();
    server.stop(function() {
      apiClient.logout.restore();
      done();
    });
  });

  beforeEach(function (done) {
    sinon.stub(apiClient.user, 'fetchInternalIpForHostname')
      .yields(null, '127.0.0.1');
    done();
  });

  afterEach(function (done) {
    apiClient.user.fetchInternalIpForHostname.restore();
    done();
  });

  describe('server', function() {
    it('should resolve internal domain name requests', function (done) {
      dnsRequest('example.runnableapp.com', function (err, resp) {
        if (err) { return done(err); }
        expect(resp.answer).to.not.be.empty();
        expect(resp.header.rcode).to.equal(rcodes.NoError);
        done();
      });
    });

    it('should deny external domain name requests', function (done) {
      dnsRequest('www.google.com', function (err, resp) {
        if (err) { return done(err); }
        expect(resp.answer).to.be.empty();
        expect(resp.header.rcode).to.equal(rcodes.Refused);
        done();
      });
    });

    it('should handle server errors appropriately', function (done) {
      sinon.stub(query, 'resolve').yields(new Error('Server error'));
      dnsRequest('example.runnableapp.com', function (err, resp) {
        if (err) { return done(err); }
        expect(resp.answer).to.be.empty();
        expect(resp.header.rcode).to.equal(rcodes.ServerFailure);
        query.resolve.restore();
        done();
      });
    });

    it('should report server errors', function (done) {
      sinon.stub(query, 'resolve', function () {
        server.instance.emit('error', new Error('Server Error'));
      });
      dnsRequest('example.runnableapp.com', function (err, resp) {
        query.resolve.restore();
        done();
      });
    });

    it('should report socket errors', function(done) {
      sinon.stub(query, 'resolve', function () {
        server.instance.emit('socketError', new Error('Socket Error'));
      });
      dnsRequest('example.runnableapp.com', function (err, resp) {
        query.resolve.restore();
        done();
      });
    });

    it('should not crash after many repeated requests', function (done) {
      var numRequests = 200;
      var count = createCount(numRequests, done);
      for (var i = 0; i < numRequests; i++) {
        dnsRequest('example.runnableapp.com', count.next);
      }
    });

    it('should handle cache hits', function(done) {
      var numRequests = 500;
      var count = createCount(numRequests, function (err) {
        if (err) { return done(err); }
        expect(apiClient.user.fetchInternalIpForHostname.callCount)
          .to.equal(1);
        done();
      });

      var name = 'cache-hit.runnableapp.com';
      dnsRequest(name, function (err) {
        for (var i = 0; i < numRequests; i++) {
          dnsRequest(name, count.next);
        }
      });
    });
  }); // end 'server'

  describe('monitoring', function () {
    beforeEach(function (done) {
      monitorStub.stubAll();
      done();
    });

    afterEach(function (done) {
      monitorStub.restoreAll();
      done();
    });

    it('should monitor incoming dns requests', function (done) {
      dnsRequest('example.runnableapp.com', function (err, resp) {
        if (err) { return done(err); }
        expect(monitor.increment.calledWith('query')).to.be.true();
        done();
      });
    });

    it('should monitor total query time', function (done) {
      dnsRequest('example.runnableapp.com', function (err, resp) {
        if (err) { return done(err); }
        expect(monitor.histogram.calledWith('query.time')).to.be.true();
        done();
      });
    });

    it('should monitor invalid queries', function (done) {
      dnsRequest('www.google.com', function (err, resp) {
        if (err) { return done(err); }
        expect(monitor.increment.calledWith('query.refused')).to.be.true();
        done();
      });
    });

    it('should monitor queries that error', function (done) {
      sinon.stub(query, 'resolve').yields(new Error('Server error'));
      dnsRequest('example.runnableapp.com', function (err, resp) {
        if (err) { return done(err); }
        expect(monitor.increment.calledWith('query.error')).to.be.true();
        query.resolve.restore();
        done();
      });
    });

    it('should monitor server errors', function (done) {
      sinon.stub(query, 'resolve', function () {
        server.instance.emit('error', new Error('Server Error'));
      });
      dnsRequest('example.runnableapp.com', function (err, resp) {
        query.resolve.restore();
        expect(monitor.increment.calledWith('error.server')).to.be.true();
        done();
      });
    });

    it('should monitor socket errors', function (done) {
      sinon.stub(query, 'resolve', function () {
        server.instance.emit('socketError', new Error('Socket Error'));
      });
      dnsRequest('example.runnableapp.com', function (err, resp) {
        query.resolve.restore();
        expect(monitor.increment.calledWith('error.socket')).to.be.true();
        done();
      });
    });
  }); // end 'monitoring'

  describe('cache', function() {
    it('should invalidate correct cache entries on pubsub event', function(done) {
      var address = '127.0.0.3';
      var hostIps = ['10.0.0.1', '10.0.0.2', '10.0.0.3'];
      var names = ['cache-inv1.com', 'cache-inv2.com', 'cache-inv3.com'];

      // Set fake entries directly into the cache
      names.forEach(function (name, index) {
        var cacheKey = { name: name, address: address };
        var cacheValue = { name: name, address: hostIps[index] };
        cache.set(cacheKey, cacheValue);
      });

      // Ensure cache values are set before the invalidate
      names.forEach(function (name) {
        var cacheKey = { name: name, address: address };
        expect(cache.get(cacheKey), "name=" + name)
          .to.not.be.undefined();
      });

      pubsub.emit(process.env.REDIS_INVALIDATION_KEY, '127.0.0.3');

      // Check if they are gone after the invalidate
      names.forEach(function (name) {
        expect(cache.get({ address: address, name: name }), "name=" + name)
          .to.be.undefined();
      });

      done();
    });
  }); // end 'pubsub'
}); // end 'functional'
