'use strict';

require('loadenv')('charon:env');

var monitor = require('monitor-dog');
var createCounter = require('callback-count');
var MultiKeyCache = require('mkc');

var apiClient = require('./api-client');
var user = apiClient.user;
var log = require('./logger').child({ module: 'query' }, true);
var cache = require('./cache');

/**
 * Queries the API to resolve domain names.
 * @module charon:query
 * @author Ryan Sandor Richards
 */
module.exports = {
  resolve: resolve
};

/**
 * Resolves a given domain name.
 * @param {String} address Address of the requestor.
 * @param {Array} domainNames Domain names to resolve.
 * @param {Resolve~Callback} cb Callback to execute once the name has been
 *   resolved.
 */
function resolve(address, domainNames, cb) {
  var names = filterNames(domainNames);

  // Bypass lookup if the domain names set is empty
  if (names.length === 0) {
    log.debug('No internal container domain names given, skipping.');
    return cb(null, null);
  }

  var records = [];
  var errors = [];
  var count = createCounter(names.length, done);

  // TODO Need to reduce the number of requests here, requires API to accept
  //  multiple domains at once. Let's keep an eye on this for potential
  //  bottlenecks.
  monitor.histogram('lookups.per.query', names.length);

  names.forEach(function(name) {
    // Check the cache
    var cachedRecord = cache.get({
      name: name,
      address: address
    });

    // Cache hit
    if (cachedRecord !== undefined) {
      log.trace({ name: name, address: address }, 'Cache hit');
      monitor.increment('cache.hit');
      records.push(cachedRecord);
      count.next();
      return;
    }

    // Cache miss, lookup via the API
    log.trace({ name: name, address: address }, 'Cache miss');
    monitor.increment('cache.miss');
    monitor.increment('lookup');
    var lookupTimer = monitor.timer('lookup.time');
    var startTime = new Date();

    user.fetchInternalIpForHostname(name, address, function (err, hostIP) {
      lookupTimer.stop();
      var lookupTime = new Date() - startTime;

      if (err) {
        monitor.increment('error.lookup');
        log.warn({
          name: name,
          err: err,
          lookupTime: lookupTime
        }, 'Error encountered resolving name.');
        errors.push(err);
      }
      else if (hostIP) {
        log.debug({
          name: name,
          hostIP: hostIP,
          lookupTime: lookupTime
        }, 'Host Found in ' + (lookupTime / 1000).toFixed(2) + 's');
        var record = {
          name: name,
          address: hostIP,
          ttl: process.env.DEFAULT_TTL
        };
        log.trace({
          name: name,
          address: address,
          record: record,
          lookupTime: lookupTime
        }, 'Cache set');
        monitor.increment('cache.set');
        cache.set({ name: name, address: address }, record);
        records.push(record);
      } else {
        log.debug({ name: name }, 'No host found.');
      }
      // else no hostIP returned, so callback no records
      count.next();
    });
  });

  /**
   * Executes the callback after all names have been resolved.
   */
  function done() {
    if (records.length === 0 && errors.length > 0) {
      return cb(errors[0], null);
    }
    cb(null, records);
  }
}

/**
 * Trims and filters out non-internal domains from the given list of
 * names.
 * @param {Array} names List of domain names to filter.
 * @return {Array} Filtered domain name list.
 */
function filterNames(names) {
  var regexFilter = new RegExp('^.*' + process.env.DOMAIN_FILTER + '$');
  return names.map(function(name) {
    return name.trim();
  }).filter(function (name) {
    return name.match(regexFilter);
  });
}

// Callback documentation

/**
 * @callback Resolve~Callback
 * @param {object} err Error, if applicable.
 * @param {array} records Records if valid domains were given, `null` on
 *   error of if no valid records were supplied in the question section.
 */
