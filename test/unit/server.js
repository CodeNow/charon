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
var query = require('../../lib/query');
var apiClient = require('../../lib/api-client');
var monitor = require('monitor-dog');
var monitorStub = require('../fixtures/monitor');
var errorCat = require('error-cat');

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

  describe('domains', function() {
    var testError = new Error();

    beforeEach(function (done) {
      monitorStub.stubAll();
      var exitStub = sinon.stub(process, 'exit');
      sinon.stub(errorCat, 'report');
      done();
    });

    afterEach(function (done) {
      monitorStub.restoreAll();
      process.exit.restore();
      errorCat.report.restore();
      done();
    });

    it('should use domains to catch unhandled `start` exceptions', function (done) {
      expect(server.start.domain).to.exist();
      sinon.stub(apiClient, 'login', function(cb) {
        throw testError;
        cb();
      });
      server.start.domain.on('error', function errorListener(err) {
        expect(err).to.equal(testError);
        server.start.domain.removeListener('error', errorListener);
        apiClient.login.restore();
        done();
      });
      server.start();
    });

    it('should use domains to catch unhandled `stop` exceptions', function (done) {
      expect(server.stop.domain).to.exist();
      sinon.stub(server.instance, 'close', function() {
        throw testError;
      });
      server.stop.domain.on('error', function errorListener(err) {
        expect(err).to.equal(testError);
        server.instance.close.restore();
        server.stop.domain.removeListener('error', errorListener);
        done();
      });
      server.start(function() {
        server.stop();
      });
    });

    describe('unhandledError', function() {
      var domain = server.start.domain;

      beforeEach(function (done) {
        sinon.stub(apiClient, 'login', function (cb) {
          throw new Error();
        });
        done();
      });

      afterEach(function (done) {
        apiClient.login.restore();
        done();
      });

      it('should exit the process', function (done) {
        domain.on('error', function errorListener() {
          expect(process.exit.calledOnce).to.be.true();
          expect(process.exit.calledWith(1)).to.be.true();
          domain.removeListener('error', errorListener);
          done();
        });
        server.start();
      });

      it('should monitor unhandled errors', function (done) {
        domain.on('error', function errorListener() {
          expect(monitor.increment.calledWith('error.unhandled')).to.be.true();
          domain.removeListener('error', errorListener);
          done();
        });
        server.start();
      });

      it('should set server status monitor to "down" (0)', function (done) {
        domain.on('error', function errorListener() {
          expect(monitor.histogram.calledWith('status', 0)).to.be.true();
          domain.removeListener('error', errorListener);
          done();
        });
        server.start();
      });

      it('should report the error to rollbar', function(done) {
        domain.on('error', function errorListener() {
          expect(errorCat.report.calledOnce).to.be.true();
          domain.removeListener('error', errorListener);
          done();
        });
        server.start();
      });
    });
  }); // end 'domains'
}); // end 'server'
