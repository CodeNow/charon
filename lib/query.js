'use strict';

/** @module charon:query */

require('./loadenv.js')();
var debug = require('debug');
var warning = debug('charon:query:warning');

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

  // TODO Implement me
  // BELOW IS FOR TESTING ONLY
  var records = names.map(function(name) {
    return {
      name: name,
      address: '127.0.0.1',
      ttl: process.env.DEFAULT_TTL
    };
  });
  cb(null, records);
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
