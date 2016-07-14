'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.it;
var before = lab.before;
var after = lab.after;
var afterEach = lab.afterEach;
var beforeEach = lab.beforeEach;
var Code = require('code');
var expect = Code.expect;
var dns = require('native-dns');
var sinon = require('sinon');
var debug = require('debug');
var error = debug('charon:server:error');

require('loadenv')('charon:env');
var client = require('../../lib/api-client');
var cache = require('../../lib/cache');
var rcodes = require('dns-rcodes');

describe('api-client', function() {
  var user = client.user;

  describe('interface', function() {
    it('should expose the api user', function (done) {
      expect(user).to.exist();
      done();
    });
  }); // end 'interface'

  describe('login', function() {
    beforeEach(function (done) {
      sinon.stub(user, 'githubLogin').yields();
      done();
    });

    afterEach(function (done) {
      user.githubLogin.restore();
      done();
    });

    it('should login correctly', function (done) {
      client.login().asCallback(function (err) {
        if (err) { return done(err); }
        expect(user.githubLogin.calledOnce).to.be.true();
        expect(user.githubLogin.calledWith(process.env.API_TOKEN)).to.be.true();
        done();
      });
    });

    it('should correctly handle login errors', function (done) {
      var loginError = new Error('API Error');
      user.githubLogin.yields(loginError);
      client.login().asCallback(function (err) {
        expect(err).to.equal(loginError);
        done();
      });
    })
  }); // end 'login'

  describe('resolveName', function () {
    var hostIP = '10.0.0.1';
    var localDockHost = '10.12.0.1';

    beforeEach(function (done) {
      sinon.stub(client.user, 'fetchInternalIpForHostname')
        .yieldsAsync(null, hostIP);
      sinon.stub(cache, 'has').returns(false);
      sinon.stub(cache, 'get');
      sinon.stub(cache, 'set');
      done();
    });

    afterEach(function (done) {
      client.user.fetchInternalIpForHostname.restore();
      cache.has.restore();
      cache.get.restore();
      cache.set.restore();
      done();
    });

    it('should returned cached records', function (done) {
      var name = 'name.com';
      var address = '172.0.0.1';
      var key = { name: name, address: address };
      var cachedRecord = { cached: true };
      cache.has.returns(true);
      cache.get.returns(cachedRecord);
      client.resolveName(name, address, localDockHost).asCallback(function (err, record) {
        expect(err).to.not.exist();
        expect(cache.has.calledOnce).to.be.true();
        expect(cache.has.firstCall.args[0]).to.deep.equal(key);
        expect(cache.get.calledOnce).to.be.true();
        expect(cache.get.firstCall.args[0]).to.deep.equal(key);
        expect(record).to.equal(cachedRecord);
        done();
      });
    });

    it('should reject if an error occurs before the lookup', function (done) {
      var unexpectedError = new Error('This is error sparta, sucka');
      cache.has.throws(unexpectedError);
      client.resolveName('name', 'address', localDockHost).asCallback(function (err) {
        expect(err).to.equal(unexpectedError);
        done();
      });
    });

    it('should lookup records via the API', function (done) {
      var name = 'name.com';
      var address = '172.0.0.0';
      client.resolveName(name, address, localDockHost).asCallback(function (err, record) {
        expect(err).to.not.exist();
        expect(client.user.fetchInternalIpForHostname.calledOnce).to.be.true();
        expect(client.user.fetchInternalIpForHostname.calledWith(
          name, address
        )).to.be.true();
        done();
      });
    });

    it('should reject on API errors', function (done) {
      var apiError = new Error('go figure');
      client.user.fetchInternalIpForHostname.yields(apiError);
      client.resolveName('name', 'address', localDockHost).asCallback(function (err) {
        expect(err.cause).to.equal(apiError);
        done();
      });
    });

    describe('on empty host IP', function () {
      var name = 'some-domain.com';

      beforeEach(function (done) {
        client.user.fetchInternalIpForHostname.yieldsAsync(null, '');
        done();
      });

      it('should reject with EmptyHost', function (done) {
        client.resolveName(name, 'address', localDockHost).asCallback(function (err) {
          expect(err).to.exist();
          expect(err.message).to.match(/IP returned by API is empty./);
          done();
        })
      });

      it('should not report', function (done) {
        client.resolveName(name, 'address', localDockHost).asCallback(function (err) {
          expect(err).to.exist();
          expect(err.report).to.be.false();
          done();
        });
      });
    });

    describe('on null/undefined host IP', function () {
      var name = 'some-domain.com';

      beforeEach(function (done) {
        client.user.fetchInternalIpForHostname.yieldsAsync(null, null);
        done();
      });

      it('should reject with EmptyHost', function (done) {
        client.resolveName(name, 'address', localDockHost).asCallback(function (err) {
          expect(err).to.exist();
          expect(err.message).to.match(/IP returned by API is empty./);
          done();
        })
      });

      it('should not report', function (done) {
        client.resolveName(name, 'address', localDockHost).asCallback(function (err) {
          expect(err).to.exist();
          expect(err.report).to.be.false();
          done();
        });
      });
    });

    describe('on invalid host IP', function () {
      var name = 'some-domain.com';
      var hostIP = 'not-good.2@@@';

      beforeEach(function (done) {
        client.user.fetchInternalIpForHostname.yieldsAsync(null, hostIP);
        done();
      });

      it('should reject', function (done) {
        client.resolveName(name, 'address').asCallback(function (err) {
          expect(err).to.exist();
          expect(err.message).to.match(/Invalid Ip Return by API/);
          done();
        });
      });

      it('should set RCODE to "Refused"', function (done) {
        client.resolveName(name, 'address').asCallback(function (err) {
          expect(err).to.exist();
          expect(err.rcode).to.equal(rcodes.Refused);
          done();
        });
      });

      it('should set the correct error data', function (done) {
        client.resolveName(name, 'address').asCallback(function (err) {
          expect(err).to.exist();
          expect(err.data).to.exist();
          expect(err.data.name).to.equal(name);
          expect(err.data.hostIP).to.equal(hostIP);
          done()
        });
      });
    });

    it('should set the cache entry', function (done) {
      var name = 'name.com';
      var address = '172.0.0.1';
      var key = { name: name, address: address };
      client.resolveName(name, address).asCallback(function (err, record) {
        expect(err).to.not.exist();
        expect(cache.set.calledOnce).to.be.true();
        expect(cache.set.firstCall.args[0]).to.deep.equal(key);
        expect(cache.set.firstCall.args[1]).to.deep.equal(record);
        done();
      });
    });

    it('should resolve with the record', function (done) {
      var name = 'name.com';
      var address = '172.0.0.0';
      client.resolveName(name, address).asCallback(function (err, record) {
        expect(err).to.not.exist();
        expect(record).to.deep.equal({
          name: name,
          address: hostIP,
          ttl: process.env.DEFAULT_TTL
        });
        done();
      });
    });
  }); // end 'resolveName'
}); // end 'api-client'
