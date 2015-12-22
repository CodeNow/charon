'use strict';

/**
 * Charon DNS server module.
 * @module charon:server
 * @author Ryan Sandor Richards
 */

require('loadenv')('charon:env');
var dns = require('native-dns');
var rcodes = require('dns-rcodes');
var domain = require('domain');
var monitor = require('monitor-dog');

var query = require('./query');
var apiClient = require('./api-client');
var cache = require('./cache');
var log = require('./logger').child({ module: 'server' }, true);
var errorCat = require('error-cat');

var server = dns.createServer();
server.on('request', request);
server.on('error', serverError);
server.on('socketError', socketError);

var serverDomain = domain.create();
serverDomain.add(server);
serverDomain.on('error', unhandledError);

/**
 * Handles requests to the DNS server.
 * @param  {object} req Request to the server.
 * @param  {object} res Response object to modify.
 */
function request(req, res) {
  var address = getRequestAddress(req);
  var names = getNames(req);

  log.info({
    address: address,
    names: names
  }, 'DNS query from address: ' + address + ', given names: ' + names);

  monitor.increment('query');
  var queryTimer = monitor.timer('query.time');

  query.resolve(address, names, function(err, records) {
    if (err) {
      monitor.increment('query.error');
      log.error({
        err: err
      }, 'Error encountered, setting rcode "ServerFailure"');
      errorCat.report(err);
      res.header.rcode = rcodes.ServerFailure;
      return res.send();
    }

    if (records === null) {
      monitor.increment('query.refused');
      log.warn('Resolver did not return any records, setting RCODE "refused".');
      res.header.rcode = rcodes.Refused;
      return res.send();
    }

    records.forEach(function(record) {
      res.answer.push(dns.A(record));
    });

    res.send();
    queryTimer.stop();
  });
}

/**
 * Determines the remote ip for a request.
 * @param {object} req Request object.
 * @return {string} The remote ip address for the request.
 */
function getRequestAddress(req) {
  return req.address.address;
}

/**
 * Determines a list of domain names from the question
 * section of a request.
 * @param  {Object} req Request object.
 * @return {Array} List of filtered names to resolve.
 */
function getNames(req) {
  return req.question.map(function (question) {
    return question.name;
  });
}

/**
 * Handles errors on the DNS server.
 * @param err Error to handle.
 * @param {object} req Request object being processed with the error occurred.
 * @param {object} res Response object when the error occurred.
 */
function serverError(err, buff, req, res) {
  monitor.increment('error.server');
  log.error({ err: err }, 'Server error encountered.');
  errorCat.report(err);
}

/**
 * Handles socket errors.
 * @param  {Error} err Error emitted by the socket.
 */
function socketError(err) {
  monitor.increment('error.socket');
  log.error({ err: err }, 'Socket error encountered.');
  errorCat.report(err);
}

/**
 * Domain error handler. If, for some reason, an error is not handled by the
 * server or any of its callbacks, then it will end up here.
 * @param {Error} err Unhandled error.
 */
function unhandledError(err) {
  monitor.increment('error.unhandled');
  monitor.histogram('status', 0);
  log.error({ err: err }, 'Unhandled error encountered.');
  errorCat.report(err);
  process.exit(1);
}

/**
 * Starts the DNS server.
 * @param {function} cb Callback to execute once the server has started.
 */
function start(cb) {
  // Note: with native-dns server, this is the only way to ensure the
  // callback is executed after the server is listening (events, pfft).
  // TODO Rewrite simple UDP server to make it more robust (later).
  server.once('listening', function() {
    monitor.histogram('status', 1);
    log.info({
      port: process.env.PORT
    }, 'DNS Running on port: ' + process.env.PORT);
    cache.setReportItemCountInterval();
    cb(null);
  });

  apiClient.login(function (err) {
    if (err) { return cb(err); }
    server.serve(process.env.PORT, process.env.HOST);
  });
}

/**
 * Stops the DNS server.
 * @param {function} cb Callback to execute once the server has been stopped.
 */
function stop(cb) {
  // Note: with native-dns server, this is the only way to ensure the
  // callback is executed after the server is listening (events, pfft).
  // TODO Rewrite simple UDP server to make it more robust (later).
  server.once('close', function() {
    monitor.histogram('status', 0);
    log.info('Server Shutdown');
    cache.clearReportItemCountInterval();
    cb(null);
  });

  apiClient.logout(function (err) {
    if (err) { return cb(err); }
    server.close();
  });
}

module.exports = {
  instance: server,
  start: serverDomain.bind(start),
  stop: serverDomain.bind(stop)
};
