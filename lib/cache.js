'use strict';

require('loadenv')('charon:env');

var monitor = require('monitor-dog');
var MultiKeyCache = require('mkc');
var os = require('os');

var pubsub = require('./pubsub');
var log = require('./logger');

var reportInterval = null;

/**
 * Memory LRU cache for name mappings.
 * @module charon:cache
 */
var cache = module.exports = new MultiKeyCache({
  max: process.env.CACHE_MAX_ENTRIES,
  maxAge: process.env.CACHE_MAX_AGE,
});

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
  log.info("Clearing periodic item count report interval.");
  clearInterval(reportInterval);
  reportInterval = null;
};

/**
 * Constructs the channel string for redis cache invalidation events specific
 * for the dock upon which charon is running.
 *
 * @example
 * // returns: `dns.invalidate.localIp:10.20.128.1`
 * cache.getRedisInvalidationChannel();
 *
 * @return The channel string for this instance of charon.
 */
cache.getRedisInvalidationChannel = function () {
  // If there is no eth0 network interface, use the global purge namespace
  var interfaces = os.networkInterfaces();
  if (!interfaces.eth0) {
    return process.env.REDIS_INVALIDATION_KEY;
  }

  // Determine the internal VPC eth0 ip for the dock on which we are running
  var dockIp = interfaces.eth0
    .filter(function (entry) {
      return entry.family === 'IPv4';
    })
    .pop().address;

  // Construct the correct channel string
  return [process.env.REDIS_INVALIDATION_KEY, dockIp].join(':');
};

/**
 * Invalidates cache entries in the LRU cache for a given local container ip
 * address.
 * @param {string} localIp The local IP address for the container.
 */
cache.invalidate = function (localIp) {
  log.trace({ localIp: localIp }, 'Cache invalidation');
  monitor.increment('cache.invalidate');
  cache.purge({ address: localIp });
};

// Setup pubsub for cache invalidations
pubsub.on(cache.getRedisInvalidationChannel(), cache.invalidate);
