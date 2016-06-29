'use strict';

require('loadenv')('charon:env');

var log = require('./logger');
var monitor = require('monitor-dog');
var MultiKeyCache = require('mkc');
var redisPubSub = require('redis-pubsub-emitter');

/**
 * Interval reference for the cache statistics reporter.
 * @type {Integer}
 */
var reportInterval = null;

/**
 * Memory LRU cache for name mappings.
 * Singleton
 * @module charon:cache
 */
var cache = module.exports = new MultiKeyCache({
  max: process.env.CACHE_MAX_ENTRIES,
  maxAge: process.env.CACHE_MAX_AGE,
});

/**
 * Initializes the cache and sets up pubsub invalidation.
 */
cache.initialize = function () {
  cache.pubsub = redisPubSub.createClient(
    process.env.REDIS_PORT,
    process.env.REDIS_HOST
  );
  var channel = process.env.REDIS_INVALIDATION_KEY;
  cache.pubsub.on(channel, cache.invalidate);
  cache.setReportItemCountInterval();
};

/**
 * Instructs the cache to begin reporting item counts to datadog.
 */
cache.setReportItemCountInterval = function () {
  if (reportInterval !== null) {
    return;
  }
  log.info({
    delay: process.env.CACHE_REPORT_INTERVAL
  }, 'Periodically reporting item counts to datadog.');
  reportInterval = setInterval(function () {
    monitor.histogram('cache.entries', cache.itemCount());
  }, process.env.CACHE_REPORT_INTERVAL);
};

/**
 * Instructs the cache to stop reporting item counts to datadog.
 */
cache.clearReportItemCountInterval = function () {
  log.info('Clearing periodic item count report interval.');
  clearInterval(reportInterval);
  reportInterval = null;
};

/**
 * Invalidates cache entries in the LRU cache for a given local container ip
 * address.
 * @param {string} event format: elasticURL:dockerIp.
 *                       dockerIp is the ip of the host the old container was on
 */
cache.invalidate = function (event) {
  log.info({ event: event }, 'Cache invalidation');
  try {
    var parts = event.split(':');
    var name = parts[0];
    var address = parts[1];

    monitor.increment('cache.invalidate');
    cache.purge({ name: name, address: address });
  } catch (err) {
    log.error({ event: event, err: err }, 'Cache invalidation error');
  }
};
