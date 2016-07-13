'use strict';

/**
 * Charon DNS server module.
 * @module charon:server
 * @author Ryan Sandor Richards
 */

require('loadenv')('charon:env');

var dns = require('native-dns');
var ErrorCat = require('error-cat');
var isString = require('101/is-string');
var monitor = require('monitor-dog');
var Promise = require('bluebird');
var rcodes = require('dns-rcodes');
var hasKeypaths = require('101/has-keypaths');
var pluck = require('101/pluck');
var os = require('os');

var apiClient = require('./api-client');
var cache = require('./cache');
var log = require('./logger').child({ module: 'server' }, true);
var EmptyHost = require('./errors/empty-hosts');

/**
 * The UDP server.
 * @type {native-dns~UDPServer}
 */
var server = dns.createServer();

/**
 * The UDP Server for Charon DNS.
 * @module charon:server
 */
module.exports = {
  instance: server,
  _setEvents: _setEvents,
  _removeEvents: _removeEvents,
  _getInternalNames: _getInternalNames,
  _getHostIp: _getHostIp,
  _clearIpCache: _clearIpCache,
  start: start,
  requestHandler: requestHandler,
  errorHandler: errorHandler
};

/**
 * Sets the events for the UDP server instance. This method is called by the
 * start method defined below.
 */
function _setEvents() {
  // Setup the eventing for the server
  // NOTE Setting the module methods explicitly so we can unit test eventing
  server.on('request', module.exports.requestHandler);
  server.on('error', module.exports.errorHandler);
  server.on('socketError', module.exports.errorHandler);
}

/**
 * Removes all events from the server instance.
 */
function _removeEvents() {
  server.removeAllListeners('request');
  server.removeAllListeners('error');
  server.removeAllListeners('socketError');
}

var hostIp = null;

/**
 * Basically only for testing.  The cache should never need to be invalidated in production since
 * it's just the IP
 */
function _clearIpCache() {
  hostIp = null;
}

/**
 * returns the IP address of THIS machine, whatever is running this code
 * - The return value is cached for instant access later
 * @returns {String} IP address of this machine
 * @throws Error
 */
function _getHostIp() {
  if (!hostIp) {
    // If there is no eth0 network interface, error out
    var interfaces = os.networkInterfaces();
    if (!interfaces.eth0) {
      throw new Error('No external network interface found');
    }

    // Determine the internal VPC eth0 ip for the dock on which we are running
    var ipAddress = interfaces.eth0
      .filter(hasKeypaths({ family: 'IPv4' })).pop().address;

    // Verify it's a valid ipAddress
    if (!ipAddress || !ipAddress.length) {
      throw new Error('IP returned by Self is empty');
    }
    if (ipAddress.split('.').length !== 4) {
      throw new Error('IP returned by Self is invalid: ' + ipAddress);
    }
    hostIp = 'http://' + ipAddress + ':4242';
  }
  return hostIp;
}

/**
 * Trims and filters out non-internal domains from the given list of
 * names.
 * @param {Array} req Incoming DNS request.
 * @return {Array} Filtered domain name list.
 */
function _getInternalNames(req) {
  var regexFilter = new RegExp('^.*' + process.env.DOMAIN_FILTER + '$');
  return req.question
    .map(function (question) { return question.name.trim(); })
    .filter(function (name) { return name.match(regexFilter); });
}

/**
 * Starts the DNS server.
 * @return {Promise} Resolves when the server has started.
 */
function start() {
  // Login and start serving
  return apiClient.login()
    .then(function () {
      // Attempt to fetch the ip here in case there is an error
      // This will also cache the result, so all future calls to _getHostIp are instant
      _getHostIp();

      return new Promise(function (resolve, reject) {
        // Note: with native-dns server, this is the only way to ensure the
        // callback is executed after the server is listening (events, pfft).
        // TODO Rewrite simple promisified UDP server to make it less crappy.
        function onListening() {
          try {
            monitor.histogram('status', 1);
            log.info({
              host: process.env.HOST,
              port: process.env.PORT
            }, 'Charon DNS Listening port ' + process.env.PORT);
            cache.initialize();
            resolve();
          }
          catch (err) {
            reject(err);
          }
        }

        try {
          module.exports._setEvents();
          server.once('listening', onListening);
          server.serve(process.env.PORT, process.env.HOST);
        }
        catch (err) {
          server.removeListener('listening', onListening);
          reject(err);
        }
      });
    })
    .catch(function (err) {
      ErrorCat.report(err);
      log.fatal({ err: err }, 'Server errored while starting');
    });
}

/**
 * Handles requests to the DNS server.
 * @param {object} req Request to the server.
 * @param {object} res Response object to modify.
 */
function requestHandler(req, res) {
  var queryTimer = monitor.timer('query.time');
  return Promise
    .try(function () {
      var localDockHost = _getHostIp();
      var address = req.address.address;
      var names = module.exports._getInternalNames(req);

      monitor.increment('query');
      monitor.histogram('lookups.per.query', names.length);
      log.info({ address: address, names: names }, 'Incoming DNS Query');

      // Refuse all non-internal domains
      if (names.length === 0) {
        log.debug({
          address: address,
          questions: req.question
        },'No internal container domain names given, skipping.');
        res.header.rcode = rcodes.Refused;
        monitor.increment('query.refused');
        return;
      }

      // Ignore internal AAAA request (IPv6)
      // See: https://www.ietf.org/rfc/rfc4074.txt
      if (req.question.some(hasKeypaths({ type: 28 }))) {
        log.debug({
          address: address,
          questions: req.question
        },'IPv6 requested, skipping.');
        res.header.rcode = rcodes.NoError;
        monitor.increment('query.ipv6');
        return;
      }

      // Attempt to resolve IPv4 requests
      return Promise
        .map(names, function (name) {
          return apiClient.resolveName(name, address, localDockHost);
        })
        .then(function (records) {
          res.answer = records.map(dns.A);
          res.header.rcode = rcodes.NoError;
        })
        .catch(EmptyHost, function (err) {
          // if no host we want to stop resolution here so we do not hit navi
          res.answer = [];
          res.header.rcode = rcodes.NameError;
        });
    })
    .then(function () {
      queryTimer.stop();
      res.header.aa = true;
      res.send();
    })
    .catch(function (err) {
      ErrorCat.report(err);
      monitor.increment('query.error');
      log.error({ err: err }, 'Error encountered resolving domain names');
      res.header.rcode = err.rcode ? err.rcode : rcodes.ServerFailure;
      res.answer = [];
      res.send();
    });
}

/**
 * Handles errors on the DNS server.
 * @param err Error to handle.
 * @param {object} req Request object being processed with the error occurred.
 * @param {object} res Response object when the error occurred.
 */
function errorHandler(err, buff, req, res) {
  if (!isString(err.message)) {
    err.message = 'Unknown: error did not provide a message';
    err.report = true;
  }

  if (err.message.match(/socket hang up/i)) {
    err.report = false;
  }
  ErrorCat.report(err);
  log.error({ err: err }, 'Server error encountered.');
}
