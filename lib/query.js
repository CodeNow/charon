'use strict';

/**
 * Queries the API to resolve domain names.
 * @module charon:query
 * @author Ryan Sandor Richards
 */

require('./loadenv.js')();
var debug = require('debug');
var createCounter = require('callback-count');

var warning = debug('charon:query:warning');
var apiClient = require('./api-client');
var user = apiClient.user;

/**
 * Resolves a given domain name.
 * @param {String} address Address of the requestor.
 * @param {Array} domainNames Domain names to resolve.
 * @param {Resolve~Callback} cb Callback to execute once the name has been resolved.
 */
function resolve(address, domainNames, cb) {
  var names = filterNames(domainNames);

  // Bypass lookup if the domain names set is empty
  if (names.length === 0) {
    warning('No internal container domain names given, skipping.');
    return cb(null, null);
  }

  var records = [];
  var errors = [];
  var count = createCounter(names.length, done);

  // TODO Need to reduce the number of requests here, requires API to accept
  //  multiple domains at once. Let's keep an eye on this for potential
  //  bottlenecks.
  names.forEach(function(name) {
    user.fetchInternalIpForHostname(name, address, function (err, hostIP) {
      if (err) {
        warning('Error encountered while resolving "' + name + '": ' + err);
        errors.push(err);
      }
      else {
        records.push({
          name: name,
          address: hostIP.trim(),
          ttl: process.env.DEFAULT_TTL
        });
      }
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
 * Filters out non-internal domains from the given list of names.
 * @param {Array} names List of domain names to filter.
 * @return {Array} Filtered domain name list.
 */
function filterNames(names) {
  return names.filter(function (name) {
    return ~name.indexOf(process.env.DOMAIN_FILTER);
  });
}

// Callback documentation

/**
 * @callback Resolve~Callback
 * @param {object} err Error, if applicable.
 * @param {array} records Records if valid domains were given, `null` on
 *   error of if no valid records were supplied in the question section.
 */

// Exports

module.exports = {
  resolve: resolve
};
