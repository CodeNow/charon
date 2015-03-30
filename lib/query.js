'use strict';

require('./loadenv.js')();

/**
 * Resolves a given domain name.
 * @param {Array} domainNames Domain names to resolve.
 * @param {Function} cb Callback to execute once the name has been resolved.
 */
function resolve(ip, domainNames, cb) {
  // Bypass lookup if the domain names set is empty
  if (domainNames.length === 0) {
    return cb(null, []);
  }

  // TODO Implement me
  // BELOW IS FOR TESTING ONLY
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
