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
var os = require('os');

require('loadenv')('charon:env');
var server = require('../../lib/server');
var rcodes = require('dns-rcodes');
var apiClient = require('../../lib/api-client');
var monitor = require('monitor-dog');
var monitorStub = require('../fixtures/monitor');
var dnsRequest = require('../fixtures/dns-request');
var cache = require('../../lib/cache');
var Promise = require('bluebird');

describe('functional', function() {
  var networkInterfacesMock = {
    'eth0': [
      {
        address: 'fe80::3636:3bff:fec9:69ac',
        family: 'IPv6'
      },
      {
        address: '10.20.128.45',
        family: 'IPv4'
      }
    ]
  };
  before(function (done) {
    sinon.stub(os, 'networkInterfaces').returns(networkInterfacesMock);
    sinon.stub(apiClient, 'login').returns(Promise.resolve());
    server.start().then(done);
  });

  after(function (done) {
    os.networkInterfaces.restore();
    apiClient.login.restore();
    done();
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

    it('should deny domain name requests that are not allowed', function (done) {
      dnsRequest('s3-us-west-2.amazonaws.com', function (err, resp) {
        if (err) { return done(err); }
        expect(resp.answer).to.be.empty();
        expect(resp.header.rcode).to.equal(rcodes.Refused);
        done();
      });
    });

    it('should handle server errors appropriately', function (done) {
      sinon.stub(apiClient, 'resolveName', function () {
        return Promise.reject(new Error('Server error'));
      });
      dnsRequest('example.runnableapp.com', function (err, resp) {
        if (err) { return done(err); }
        expect(resp.answer).to.be.empty();
        expect(resp.header.rcode).to.equal(rcodes.NameError);
        apiClient.resolveName.restore();
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

    it('should monitor queries that error', function (done) {
      sinon.stub(apiClient, 'resolveName', function () {
        return Promise.reject(new Error('Server error'));
      });
      dnsRequest('example.runnableapp.com', function (err, resp) {
        if (err) { return done(err); }
        expect(monitor.increment.calledWith('query.error')).to.be.true();
        apiClient.resolveName.restore();
        done();
      });
    });

    it('should monitor queries that error', function (done) {
      sinon.stub(server, '_getInternalNames').throws(new Error('Server error'));
      dnsRequest('example.runnableapp.com', function (err, resp) {
        if (err) { return done(err); }
        expect(monitor.increment.calledWith('query.error')).to.be.true();
        server._getInternalNames.restore();
        done();
      });
    });
  }); // end 'monitoring'

  describe('cache', function() {
    it('should invalidate correct cache entries on pubsub event', function(done) {
      var hostIps = ['10.0.0.1', '10.0.0.2', '10.0.0.3'];
      var names = ['cache-inv1.com', 'cache-inv2.com', 'cache-inv3.com'];

      // Set fake entries directly into the cache
      names.forEach(function (name, index) {
        var cacheKey = { address: hostIps[index], name: name };
        var cacheValue = { address: hostIps[index], name: name };
        cache.set(cacheKey, cacheValue);
      });

      // Ensure cache values are set before the invalidate
      names.forEach(function (name, index) {
        var cacheKey = { address: hostIps[index], name: name };
        expect(cache.get(cacheKey), "name=" + name)
          .to.deep.equal({ address: hostIps[index], name: name });
      });

      cache.pubsub.emit(process.env.REDIS_INVALIDATION_KEY, names[1]);

      // Check if they are gone after the invalidate
      expect(cache.get({ address: hostIps[0], name: names[0] }), "name=" + names[0])
        .to.deep.equal({ address: hostIps[0], name: names[0] });
      expect(cache.get({ address: hostIps[1], name: names[1] }), "name=" + names[1])
        .to.be.undefined();
      expect(cache.get({ address: hostIps[2], name: names[2] }), "name=" + names[2])
        .to.deep.equal({ address: hostIps[2], name: names[2] });

      done();
    });
  }); // end 'pubsub'
}); // end 'functional'
