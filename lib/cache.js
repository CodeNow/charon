'use strict';

require('loadenv')('charon:env');

var monitor = require('monitor-dog');
var MultiKeyCache = require('mkc');
var pubsub = require('./pubsub');
var log = require('./logger');

var reportInterval = null;

/**
 * Memory LRU cache for name mappings.
 * @module charon:cache
 */
var cache = module.exports = new MultiKeyCache({
  max: process.env.CACHE_MAX_ENTRIES,
  maxAge: process.env.CACHE_MAX_AGE
});

// Setup pubsub for cache invalidations
pubsub.on(process.env.REDIS_INVALIDATION_KEY, invalidateCache);

/**
 * Instructs the cache to begin reporting item counts to datadog.
 */
cache.setReportItemCountInterval = function () {
  if (reportInterval !== null) {
    return;
  }
  log.info({
    delay: process.env.CACHE_REPORT_INTERVAL
  }, "Periodically reporting item counts to datadog.");
  reportInterval = setInterval(function () {
    monitor.histogram('cache.entries', cache.itemCount());
  }, process.env.CACHE_REPORT_INTERVAL);
};

/**
 * Instructs the cache to stop reporting item counts to datadog.
 */
cache.clearReportItemCountInterval = function () {
  if (reportInterval === null) {
    return;
  }
  log.info("Clearing periodic item count report interval.");
  clearInterval(reportInterval);
  reportInterval = null;
};

/**
 * Invalidates cache entries in the LRU cache.
 * @param address Address to invalidate in the cache.
 */
function invalidateCache(address) {
  log.trace({ address: address }, 'Cache invalidation');
  monitor.increment('cache.invalidate');
  cache.purge({ address: address });
}
