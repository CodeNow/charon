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
var dns = require('native-dns');
var sinon = require('sinon');
var debug = require('debug');
var error = debug('charon:server:error');

require('../lib/loadenv.js')();
var server = require('../lib/server');
var rcode = require('../lib/dns-util').rcode;
var query = require('../lib/query');
var apiClient = require('../lib/api-client');

function dnsRequest(domain, cb) {
  var req = dns.Request({
    question: dns.Question({ name: domain, type: 'A' }),
    server: {
      address: '127.0.0.1',
      port: process.env.PORT,
      type: 'udp'
    },
    timeout: 1000
  });
  req.on('timeout', function () {
    cb(new Error('DNS Server Timeout'));
  });
  req.on('message', cb);
  req.send();
}

describe('server', function() {
  describe('interface', function() {
    it('should expose the server instance', function (done) {
      expect(server.instance).to.exist();
      done();
    });

    it('should expose a `start` method', function (done) {
      expect(server.start).to.exist();
      expect(typeof server.start).to.equal('function');
      done();
    });

    it('should expose a `stop` method', function (done) {
      expect(server.stop).to.exist();
      expect(typeof server.stop).to.equal('function');
      done();
    });
  }); // end 'interface'

  describe('api integration', function() {
    beforeEach(function (done) {
      sinon.stub(server.instance, 'serve', function() {});
      sinon.stub(server.instance, 'close', function() {});
      done();
    });

    afterEach(function (done) {
      server.instance.serve.restore();
      server.instance.close.restore();
      done();
    });

    it('should login to the api on start', function (done) {
      sinon.stub(apiClient, 'login', function (cb) {
        cb();
      });
      server.start(function (err) {
        if (err) { return done(err); }
        expect(apiClient.login.calledOnce).to.be.true;
        apiClient.login.restore();
        done();
      });
    });

    it('should logout from the api on stop', function (done) {
      sinon.stub(apiClient, 'logout', function(cb) {
        cb();
      });
      server.stop(function (err) {
        if (err) { return done(err); }
        expect(apiClient.logout.calledOnce).to.be.true;
        apiClient.logout.restore();
        done();
      });
    });

    it('should not start the server if unable to login to the api', function (done) {
      sinon.stub(apiClient, 'login', function (cb) {
        cb(new Error('Login Error'));
      });
      server.start(function (err) {
        expect(err).to.exist();
        expect(server.instance.serve.callCount).to.equal(0);
        apiClient.login.restore();
        done();
      });
    });

    it('should not stop the server if unable to logout of the api', function (done) {
      sinon.stub(apiClient, 'logout', function (cb) {
        cb(new Error('Logout Error'));
      });
      server.stop(function (err) {
        expect(err).to.exist();
        expect(server.instance.close.callCount).to.equal(0);
        apiClient.logout.restore();
        done();
      });
    });
  }); // end 'api integration'

  describe('DNS Requests', function() {
    before(function (done) {
      sinon.stub(apiClient, 'login', function(cb) { cb(); });
      server.start(function() {
        apiClient.login.restore();
        done();
      });
    });

    after(function (done) {
      sinon.stub(apiClient, 'logout', function(cb) { cb(); })
      server.stop(function() {
        apiClient.logout.restore();
        done();
      });
    });

    it('should resolve internal domain name requests', function (done) {
      dnsRequest('example.runnableapp.com', function (err, resp) {
        if (err) { return done(err); }
        expect(resp.answer).to.not.be.empty();
        expect(resp.header.rcode).to.equal(rcode.NoError);
        done();
      });
    });

    it('should deny external domain name requests', function (done) {
      dnsRequest('www.google.com', function (err, resp) {
        if (err) { return done(err); }
        expect(resp.answer).to.be.empty();
        expect(resp.header.rcode).to.equal(rcode.Refused);
        done();
      });
    });

    it('should handle server errors appropriately', function (done) {
      sinon.stub(query, 'resolve', function (addr, domain, cb) {
        cb(new Error('Server error'), null);
      });
      dnsRequest('example.runnableapp.com', function (err, resp) {
        if (err) { return done(err); }
        expect(resp.answer).to.be.empty();
        expect(resp.header.rcode).to.equal(rcode.ServerFailure);
        query.resolve.restore();
        done();
      });
    });

    describe('error handling', function() {
      it('should report server errors', function (done) {
        sinon.stub(query, 'resolve', function () {
          server.instance.emit('error', new Error('ERROR'));
        });
        dnsRequest('example.runnableapp.com', function (err, resp) {
          query.resolve.restore();
          done();
        });
      });

      it ('should report socket errors', function(done) {
        sinon.stub(query, 'resolve', function () {
          server.instance.emit('socketError', new Error('ERROR'));
        });
        dnsRequest('example.runnableapp.com', function (err, resp) {
          query.resolve.restore();
          done();
        });
      });
    }); // end 'errors'
  }); // end 'DNS'
}); // end 'server'
