'use strict';

require('loadenv')('charon:env');

var cache = require('./cache');
var log = require('./logger').child({ module: 'api-client' }, true);
var monitor = require('monitor-dog');
var Promise = require('bluebird');
var rcodes = require('dns-rcodes');
var User = require('runnable');
var ip = require('ip');

/**
 * API client user.
 * @type {runnable~User}
 */
var user = new User('https://' + process.env.API_HOST);

/**
 * Interface for connecting to the runnable api.
 * @module charon:api-client
 * @author Ryan Sandor Richards
 */
module.exports = {
  /**
   * The API client user.
   * @type {runnable~User}
   */
  user: user,

  /**
   * Connects and logs the API client in.
   * @return {Promise} Resolves upon login.
   */
  login: function login() {
    return new Promise(function (resolve, reject) {
      log.info({
        host: process.env.API_HOST,
        token: process.env.API_TOKEN
      }, 'API Client Login');

      user.githubLogin(process.env.API_TOKEN, function(err) {
        if (err) {
          // NOTE Rollbar Reporting is handled by the Server
          log.error({ err: err }, 'Error occured during API Login');
          return reject(err);
        }
        resolve();
      });
    });
  },

  /**
   * Checks the cache, and if missing uses the API to resolve a given domain
   * name at the given address.
   * @param {string} name Domain name to resolve.
   * @param {string} address Address of the container requesting the resolution.
   * @return {Promise} Resolves with the the weave ip for the domain name.
   */
  resolveName: function resolveName(name, address) {
    return Promise
      .try(function () {
        var key = { name: name, address: address };
        if (cache.has(key)) {
          log.trace({ key: key }, 'Cache hit');
          monitor.increment('cache.hit');
          return cache.get(key);
        }

        log.trace({ name: name, address: address }, 'Cache miss');
        monitor.increment('cache.miss');
        monitor.increment('lookup');
        var lookupTimer = monitor.timer('lookup.time');
        var startTime = new Date();

        return Promise
          .fromCallback(function (cb) {
            user.fetchInternalIpForHostname(name, address, cb);
          })
          .then(function (hostIP) {
            lookupTimer.stop();
            var lookupTime = ((new Date() - startTime) / 1000).toFixed(2);
            log.trace({
              name: name,
              hostIP: hostIP,
              lookupTime: lookupTime
            }, 'IP lookup completed in ' + lookupTime + 's');

            if (!ip.isV4Format(hostIP)) {
              var errorData = {
                name: name,
                hostIP: hostIP
              };
              log.debug(errorData, 'Invalid IP returned by API.');
              var noHostError = new Error('Invalid Ip Return by API');
              noHostError.rcode = rcodes.Refused;
              noHostError.data = errorData;
              throw noHostError;
            }
            var record = {
              name: name,
              address: hostIP,
              ttl: process.env.DEFAULT_TTL
            };

            log.trace({ key: key, record: record }, 'Cache set');
            monitor.increment('cache.set');
            cache.set(key, record);

            return record;
          });
      });
  }
};
