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
var createCount = require('callback-count');

require('loadenv')('charon:env');
var os = require('os');
var monitor = require('monitor-dog');
var cache = require('../../lib/cache');
var apiClient = require('../../lib/api-client');
var monitorStub = require('../fixtures/monitor');
var redisPubSub = require('redis-pubsub-emitter');
var noop = require('101/noop');

describe('cache', function() {
  var clock;

  beforeEach(function (done) {
    sinon.stub(apiClient.user, 'fetchInternalIpForHostname')
      .yields(null, '10.0.0.1');
    monitorStub.stubAll();
    clock = sinon.useFakeTimers();
    done();
  });

  afterEach(function (done) {
    apiClient.user.fetchInternalIpForHostname.restore();
    monitorStub.restoreAll();
    cache.reset();
    clock.restore();
    done();
  });

  describe('caching options', function() {
    it('should pass correct options', function(done) {
      expect(cache.cache._max).to.equal(process.env.CACHE_MAX_ENTRIES);
      expect(cache.cache._maxAge).to.equal(process.env.CACHE_MAX_AGE);
      done();
    });
  }); // end 'caching options'

  describe('initialize', function () {
    var pubsubMock = { on: noop };

    beforeEach(function (done) {
      sinon.spy(pubsubMock, 'on');
      sinon.stub(redisPubSub, 'createClient').returns(pubsubMock);
      sinon.stub(cache, 'setReportItemCountInterval');
      done();
    });

    afterEach(function (done) {
      pubsubMock.on.restore();
      redisPubSub.createClient.restore();
      cache.setReportItemCountInterval.restore();
      cache.pubsub = undefined;
      done();
    });

    it('should create the pubsub client', function (done) {
      cache.initialize();
      expect(redisPubSub.createClient.calledOnce).to.be.true();
      expect(redisPubSub.createClient.calledWith(
        process.env.REDIS_PORT,
        process.env.REDIS_HOST
      )).to.be.true();
      expect(cache.pubsub).to.equal(pubsubMock);
      done();
    });

    it('should set the invalidation listener', function (done) {
      cache.initialize();
      expect(pubsubMock.on.calledOnce).to.be.true();
      expect(pubsubMock.on.calledWith(
        process.env.REDIS_INVALIDATION_KEY,
        cache.invalidate
      )).to.be.true();
      done();
    });

    it('should set the item count reporting interval', function (done) {
      cache.initialize();
      expect(cache.setReportItemCountInterval.calledOnce).to.be.true();
      done();
    });
  }); // end 'initialize'

  describe('setReportItemCountInterval', function() {
    var itemCount = 1337;

    beforeEach(function (done) {
      cache.setReportItemCountInterval();
      sinon.stub(cache, 'itemCount').returns(itemCount);
      done();
    });

    afterEach(function (done) {
      cache.clearReportItemCountInterval();
      cache.itemCount.restore();
      done();
    });

    it('should set the cache entries report interval', function(done) {
      clock.tick(process.env.CACHE_REPORT_INTERVAL);
      expect(monitor.histogram.calledOnce).to.be.true();
      done();
    });

    it('should not set the interval if already set', function(done) {
      cache.setReportItemCountInterval();
      clock.tick(process.env.CACHE_REPORT_INTERVAL);
      expect(monitor.histogram.calledOnce).to.be.true();
      done();
    });

    it('should report the correct number of entries', function(done) {
      clock.tick(process.env.CACHE_REPORT_INTERVAL);
      expect(monitor.histogram.firstCall.args[1]).to.equal(itemCount);
      done();
    });
  }); // end 'setReportItemCountInterval'

  describe('clearReportItemCountInterval', function() {
    it('should clear the cache entries report interval', function(done) {
      cache.clearReportItemCountInterval();
      clock.tick(process.env.CACHE_REPORT_INTERVAL);
      expect(monitor.histogram.calledOnce).to.be.false();
      done();
    });
  }); // end 'clearReportItemCountInterval'

  describe('invalidate', function() {
    beforeEach(function (done) {
      sinon.stub(cache, 'purge').returns();
      done();
    });

    afterEach(function (done) {
      cache.purge.restore();
      done();
    });

    it('should purge cache entries with the given local ip', function(done) {
      var name = 'mavis-staging-runnable.io';
      var address = '10.0.0.2';
      cache.invalidate(name + ':' + address);
      sinon.assert.calledOnce(cache.purge);
      sinon.assert.calledWith(cache.purge, {
        name: name,
        address: address
      });
      done();
    });

    it('should not throw if invalid string', function(done) {
      expect(function () {
        cache.invalidate();
      }).to.not.throw();
      sinon.assert.notCalled(cache.purge);
      done();
    });
  }); // end 'invalidate'
}); // end 'cache'
