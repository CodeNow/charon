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

require('loadenv')('charon:env');
var apiClient = require('../../lib/api-client');
var cache = require('../../lib/cache');
var dns = require('native-dns');
var ErrorCat = require('error-cat');
var monitor = require('monitor-dog');
var monitorStub = require('../fixtures/monitor');
var noop = require('101/noop');
var Promise = require('bluebird');
var rcodes = require('dns-rcodes');
var server = require('../../lib/server');

describe('server', function() {
  beforeEach(function (done) {
    sinon.stub(ErrorCat, 'report');
    done();
  });

  afterEach(function (done) {
    ErrorCat.report.restore();
    done();
  });

  describe('interface', function() {
    it('should expose the server instance', function (done) {
      expect(server.instance).to.exist();
      done();
    });
  }); // end 'interface'

  describe('_setEvents', function () {
    beforeEach(function (done) {
      sinon.stub(server.instance, 'on');
      done();
    });

    afterEach(function (done) {
      server.instance.on.restore();
      done();
    });

    it('should set the `request` event handler', function (done) {
      server._setEvents();
      expect(server.instance.on.calledWith('request')).to.be.true();
      done();
    });

    it('should set the `error` event handler', function (done) {
      server._setEvents();
      expect(server.instance.on.calledWith('error')).to.be.true();
      done();
    });

    it('should set the `socketError` event handler', function (done) {
      server._setEvents();
      expect(server.instance.on.calledWith('socketError')).to.be.true();
      done();
    });
  }); // end '_setEvents'

  describe('_removeEvents', function () {
    beforeEach(function (done) {
      sinon.stub(server.instance, 'removeAllListeners');
      done();
    });

    afterEach(function (done) {
      server.instance.removeAllListeners.restore();
      done();
    });

    it('should remove all `request` event handlers', function (done) {
      server._removeEvents();
      expect(server.instance.removeAllListeners.calledWith('request'))
        .to.be.true();
      done();
    });

    it('should remove all `error` event handlers', function (done) {
      server._removeEvents();
      expect(server.instance.removeAllListeners.calledWith('error'))
        .to.be.true();
      done();
    });

    it('should remove all `socketError` event handlers', function (done) {
      server._removeEvents();
      expect(server.instance.removeAllListeners.calledWith('socketError'))
        .to.be.true();
      done();
    });
  }); // end '_removeEvents'

  describe('_getInternalNames', function () {
    var oldDomainFilter;
    var domainFilter = 'wowza.com';

    before(function (done) {
      oldDomainFilter = process.env.DOMAIN_FILTER;
      process.env.DOMAIN_FILTER = domainFilter;
      done();
    });

    after(function (done) {
      process.env.DOMAIN_FILTER = oldDomainFilter;
      done();
    });

    it('should find names from the request question', function (done) {
      var req = {
        question: [ { name: domainFilter } ]
      };
      var result = server._getInternalNames(req);
      expect(result).to.deep.equal([ domainFilter ]);
      done();
    });

    it('should trim domain names', function (done) {
      var req = {
        question: [ { name: '   ' + domainFilter + '      ' } ]
      };
      var result = server._getInternalNames(req);
      expect(result).to.deep.equal([ domainFilter ]);
      done();
    });

    it('should filter non-internal domain names', function (done) {
      var req = {
        question: [
          { name: domainFilter },
          { name: 'cool.com' },
          { name: 'beta.' + domainFilter }
        ]
      };
      var expected = [
        domainFilter,
        'beta.' + domainFilter
      ]
      var result = server._getInternalNames(req);
      expect(result).to.deep.equal(expected);
      done();
    });
  }); // end '_getInternalNames'

  describe('on event', function () {
    beforeEach(function (done) {
      sinon.stub(server, 'errorHandler');
      sinon.stub(server, 'requestHandler');
      server._setEvents();
      done();
    });

    afterEach(function (done) {
      server.errorHandler.restore();
      server.requestHandler.restore();
      server._removeEvents();
      done();
    });

    describe('request', function () {
      it('should call the request handler', function (done) {
        var req = { request: true };
        var res = { response: true };
        server.instance.emit('request', req, res);
        expect(server.requestHandler.calledOnce).to.be.true();
        expect(server.requestHandler.calledWith(req, res)).to.be.true();
        done();
      });
    }); // end 'request'

    describe('error', function () {
      it('should call the error handler', function (done) {
        var regularError = new Error('Plain old error, yay!');
        server.instance.emit('error', regularError);
        expect(server.errorHandler.calledOnce).to.be.true();
        expect(server.errorHandler.calledWith(regularError)).to.be.true();
        done();
      });
    }); // end 'error'

    describe('socketError', function (done) {
      it('should call the error handler', function (done) {
        var socketError = new Error('The socket be bad, yo.');
        server.instance.emit('socketError', socketError);
        expect(server.errorHandler.calledOnce).to.be.true();
        expect(server.errorHandler.calledWith(socketError)).to.be.true();
        done();
      });
    }); // end 'socketError'
  }); // end 'on event'

  describe('start', function () {
    afterEach(function (done) {
      server._removeEvents();
      done();
    });

    beforeEach(function (done) {
      sinon.stub(server.instance, 'serve', function() {
        server.instance.emit('listening');
      });
      sinon.stub(cache, 'initialize');
      sinon.stub(monitor, 'histogram');
      sinon.stub(apiClient, 'login').returns(Promise.resolve());
      done();
    });

    afterEach(function (done) {
      server.instance.serve.restore();
      cache.initialize.restore();
      monitor.histogram.restore();
      apiClient.login.restore();
      done();
    });

    it('should login to the API', function (done) {
      server.start().asCallback(function (err) {
        expect(err).to.not.exist();
        expect(apiClient.login.calledOnce).to.be.true();
        done();
      });
    });

    it('should report API login errors', function (done) {
      var loginError = new Error('API is being naughty');
      apiClient.login.returns(Promise.reject(loginError));
      server.start().then(function () {
        expect(ErrorCat.report.calledOnce).to.be.true();
        expect(ErrorCat.report.calledWith(loginError)).to.be.true();
        done();
      });
    });

    it('should start the UDP server', function (done) {
      server.start().asCallback(function (err) {
        expect(server.instance.serve.calledOnce).to.be.true();
        expect(server.instance.serve.calledWith(
          process.env.PORT, process.env.HOST
        )).to.be.true();
        done();
      })
    });

    it('should report server start errors', function (done) {
      var serveError = new Error('Could not serve: feeling lazy.');
      server.instance.serve.restore();
      sinon.stub(server.instance, 'serve').throws(serveError);
      server.start().then(function () {
        expect(ErrorCat.report.calledOnce).to.be.true();
        expect(ErrorCat.report.calledWith(serveError)).to.be.true();
        done();
      });
    });

    it('should initialize the cache', function (done) {
      server.start().asCallback(function (err) {
        expect(err).to.not.exist();
        expect(cache.initialize.calledOnce).to.be.true();
        done();
      });
    });

    it('should report cache initialization errors', function (done) {
      var initError = new Error('Did something terribly bad');
      cache.initialize.throws(initError);
      server.start().then(function () {
        expect(ErrorCat.report.calledOnce).to.be.true();
        expect(ErrorCat.report.calledWith(initError)).to.be.true();
        done();
      });
    });

    it('should set the datadog server status', function (done) {
      server.start().asCallback(function (err) {
        expect(err).to.not.exist();
        expect(monitor.histogram.calledOnce).to.be.true();
        expect(monitor.histogram.calledWith('status', 1)).to.be.true();
        done();
      });
    });
  }); // end 'start'

  describe('requestHandler', function () {
    var res;
    var timer;
    var req = { question: [], address: { address: '172.0.0.1' } };

    beforeEach(function (done) {
      res = {
        header: { rcode: -1 },
        answer: [],
        send: noop
      };
      sinon.stub(res, 'send');
      sinon.stub(server, '_getInternalNames');
      sinon.stub(apiClient, 'resolveName');
      sinon.stub(dns, 'A');
      done();
    });

    afterEach(function (done) {
      server._getInternalNames.restore();
      apiClient.resolveName.restore();
      dns.A.restore();
      done();
    });

    it('should refuse non-internal domain names', function (done) {
      server._getInternalNames.returns([]);
      server.requestHandler(req, res).asCallback(function (err) {
        expect(err).to.not.exist();
        expect(res.header.rcode).to.equal(rcodes.Refused);
        expect(res.answer).to.deep.equal([]);
        expect(res.send.calledOnce).to.be.true();
        done();
      });
    });

    it('should resolve all internal domain names', function (done) {
      var aRecord = { a: 'totes' };
      server._getInternalNames.returns([
        'example.com',
        'wow.example.com'
      ]);
      apiClient.resolveName
        .onFirstCall().returns('first')
        .onSecondCall().returns('second');
      dns.A.returns(aRecord);

      server.requestHandler(req, res).asCallback(function (err) {
        expect(err).to.not.exist();
        expect(res.header.rcode).to.equal(rcodes.NoError);
        expect(res.answer).to.deep.equal([ aRecord, aRecord ]);
        expect(dns.A.calledTwice).to.be.true();
        expect(dns.A.calledWith('first')).to.be.true();
        expect(dns.A.calledWith('second')).to.be.true();
        done();
      });
    });

    describe('on error', function () {
      it('should report to rollbar', function (done) {
        var error = new Error('This is Error, you are Sparta');
        server._getInternalNames.throws(error);
        server.requestHandler(req, res).asCallback(function (err) {
          expect(err).to.not.exist();
          expect(ErrorCat.report.calledOnce).to.be.true();
          expect(ErrorCat.report.calledWith(error)).to.be.true();
          done();
        })
      });

      it('should set the default server failure rcode', function (done) {
        var error = new Error('This is Error, you are Sparta');
        server._getInternalNames.throws(error);
        server.requestHandler(req, res).asCallback(function (err) {
          expect(res.header.rcode).to.equal(rcodes.ServerFailure);
          done();
        });
      });

      it('should set the error\'s rcode', function (done) {
        var error = new Error('This is Error, you are Sparta');
        error.rcode = rcodes.NotZone;
        server._getInternalNames.throws(error);
        server.requestHandler(req, res).asCallback(function (err) {
          expect(res.header.rcode).to.equal(rcodes.NotZone);
          done();
        });
      });

      it('should send the response', function (done) {
        var error = new Error('This is Error, you are Sparta');
        server._getInternalNames.throws(error);
        server.requestHandler(req, res).asCallback(function (err) {
          expect(res.send.calledOnce).to.be.true();
          done();
        });
      });
    });
  }); // end 'requestHandler'

  describe('errorHandler', function () {
    it('should report errors to rollbar', function (done) {
      var error = new Error('Something borked hard');
      server.errorHandler(error);
      expect(ErrorCat.report.calledOnce).to.be.true();
      expect(ErrorCat.report.calledWith(error)).to.be.true();
      done();
    });
  }); // end 'errorHandler'
}); // end 'server'
