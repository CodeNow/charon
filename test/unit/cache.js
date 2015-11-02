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
var pubsub = require('../../lib/pubsub');
var cache = require('../../lib/cache');
var apiClient = require('../../lib/api-client');
var monitorStub = require('../fixtures/monitor');

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

  describe('options', function() {
    it('should pass correct options', function(done) {
      expect(cache.cache._max).to.equal(process.env.CACHE_MAX_ENTRIES);
      expect(cache.cache._maxAge).to.equal(process.env.CACHE_MAX_AGE);
      done();
    });
  });

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

  describe('getRedisInvalidationChannel', function() {
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

    beforeEach(function (done) {
      sinon.stub(os, 'networkInterfaces').returns(networkInterfacesMock);
      done();
    });

    afterEach(function (done) {
      os.networkInterfaces.restore();
      done();
    });

    it('should correctly determine the channel', function(done) {
      var expectedChannel = [
        process.env.REDIS_INVALIDATION_KEY,
        networkInterfacesMock['eth0'][1].address
      ].join(':');
      expect(cache.getRedisInvalidationChannel()).to.equal(expectedChannel);
      done();
    });

    it('should use the global channel without `eth0`', function(done) {
      os.networkInterfaces.returns({});
      expect(cache.getRedisInvalidationChannel())
        .to.equal(process.env.REDIS_INVALIDATION_KEY);
      done();
    });
  }); // end 'getRedisInvalidationChannel'

  describe('invalidate', function() {
    beforeEach(function (done) {
      sinon.spy(cache, 'purge');
      done();
    });

    afterEach(function (done) {
      cache.purge.restore();
      done();
    });

    it('should purge cache entries with the given local ip', function(done) {
      var localIp = '172.0.0.0';
      cache.invalidate(localIp);
      expect(cache.purge.calledOnce).to.be.true();
      expect(cache.purge.firstCall.args[0]).to.deep.equal({
        address: localIp
      });
      done();
    });
  }); // end 'invalidate'

  describe('expire', function() {
    var ctx = {};
    beforeEach(function (done) {
      ctx.originalMaxAge = process.env.CACHE_MAX_AGE;
      process.env.CACHE_MAX_AGE = 100;
      ctx.cache = cache._create();
      done();
    });
    afterEach(function (done) {
      process.env.CACHE_MAX_AGE = ctx.originalMaxAge;
      done();
    });
    it('shouild expire after max age', function(done) {
      var name = 'funky.runnableapp.com';
      var record = {
        name: name,
        address: '192.20.128.1',
        ttl: process.env.DEFAULT_TTL
      };
      ctx.cache.set({ name: name, address: '10.20.128.45' }, record);
      var cachedRecord = ctx.cache.get({
        name: name,
        address: '10.20.128.45'
      });
      expect(cachedRecord).to.exist();
      expect(cachedRecord).to.deep.equal(record);
      clock.tick(110);
      var cachedRecordAfterTimeout = ctx.cache.get({
        name: name,
        address: '10.20.128.45'
      });
      console.log('aaatick', cachedRecordAfterTimeout);
      expect(cachedRecordAfterTimeout).to.not.exist();
      done();
    });
  });

}); // end 'cache'
