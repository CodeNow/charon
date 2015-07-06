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
    sinon.spy(cache, 'itemCount');
    monitorStub.stubAll();

    cache.clearReportItemCountInterval();
    clock = sinon.useFakeTimers();
    cache.setReportItemCountInterval();



    done();
  });

  afterEach(function (done) {
    apiClient.user.fetchInternalIpForHostname.restore();
    monitorStub.restoreAll();
    cache.itemCount.restore();
    cache.reset();
    clock.restore();
    done();
  });

  describe('monitoring', function() {
    it('should periodically report cache usage statistics', function(done) {
      clock.tick(process.env.CACHE_REPORT_INTERVAL);
      expect(cache.itemCount.calledOnce).to.be.true();
      expect(monitor.histogram.calledWith('cache.entries')).to.be.true();
      done();
    });

    it('should monitor cache invalidations', function(done) {
      pubsub.emit(process.env.REDIS_INVALIDATION_KEY, '127.0.0.3');
      expect(monitor.increment.calledWith('cache.invalidate')).to.be.true();
      done();
    });
  }); // end 'monitoring'

  describe('pubsub', function() {
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
});
