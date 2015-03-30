'use strict';

require('./loadenv.js')();

/**
 * Resolves a given domain name.
 * @param {Array} domainNames Domain names to resolve.
 * @param {Function} cb Callback to execute once the name has been resolved.
 */
function resolve(domainNames, cb) {
  // TODO Implement me
  var records = domainNames.map(function(name) {
    return {
      name: name,
      address: '127.0.0.1',
      ttl: process.env.DEFAULT_TTL
    };
  });
  cb(null, records);
}

module.exports = {
  resolve: resolve
};
