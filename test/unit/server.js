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

require('loadenv')('charon:env');
var server = require('../../lib/server');
var rcode = require('../../lib/dns-util').rcode;
var query = require('../../lib/query');
var apiClient = require('../../lib/api-client');

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
      sinon.stub(server.instance, 'serve', function() {
        this.emit('listening');
      });
      sinon.stub(server.instance, 'close', function() {
        this.emit('close');
      });
      done();
    });

    afterEach(function (done) {
      server.instance.serve.restore();
      server.instance.close.restore();
      done();
    });

    it('should login to the api on start', function (done) {
      sinon.stub(apiClient, 'login').yields();
      server.start(function (err) {
        if (err) { return done(err); }
        expect(apiClient.login.calledOnce).to.be.true();
        apiClient.login.restore();
        done();
      });
    });

    it('should logout from the api on stop', function (done) {
      sinon.stub(apiClient, 'logout').yields();
      server.stop(function (err) {
        if (err) { return done(err); }
        expect(apiClient.logout.calledOnce).to.be.true();
        apiClient.logout.restore();
        done();
      });
    });

    it('should not start the server if unable to login to the api', function (done) {
      sinon.stub(apiClient, 'login').yields(new Error('Login Error'));
      server.start(function (err) {
        expect(err).to.exist();
        expect(server.instance.serve.callCount).to.equal(0);
        apiClient.login.restore();
        done();
      });
    });

    it('should not stop the server if unable to logout of the api', function (done) {
      sinon.stub(apiClient, 'logout').yields(new Error('Logout Error'));
      server.stop(function (err) {
        expect(err).to.exist();
        expect(server.instance.close.callCount).to.equal(0);
        apiClient.logout.restore();
        done();
      });
    });
  }); // end 'api integration'
}); // end 'server'
