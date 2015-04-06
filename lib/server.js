'use strict';

/**
 * Charon DNS server module.
 * @module charon:server
 * @author Ryan Sandor Richards
 */

require('loadenv')('charon:env');
var dns = require('native-dns');
var debug = require('debug');
var query = require('./query');
var dnsUtil = require('./dns-util');
var apiClient = require('./api-client');
var monitor = require('./monitor');

var info = debug('charon:server:info');
var warn = debug('charon:server:warning');
var error = debug('charon:server:error');

var server = dns.createServer();
server.on('request', request);
server.on('error', serverError);
server.on('socketError', socketError);

/**
 * Handles requests to the DNS server.
 * @param  {object} req Request to the server.
 * @param  {object} res Response object to modify.
 */
function request(req, res) {
  var address = getRequestAddress(req);
  var names = getNames(req);

  info("DNS query from address: " + address + ", given names: " + names);
  monitor.increment('charon.query');
  var queryTimer = monitor.timer('charon.query.time');

  query.resolve(address, names, function(err, records) {
    if (err) {
      monitor.increment('charon.query.error');
      error('Error encountered, setting rcode "ServerFailure": ' + err);
      dnsUtil.setRcode(res, 'ServerFailure');
      return res.send();
    }

    if (records === null) {
      monitor.increment('charon.query.refused');
      warn('Resolver did not return any records, setting RCODE "refused".');
      dnsUtil.setRcode(res, 'Refused');
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
  monitor.increment('charon.error.server');
  error(err.stack);
}

/**
 * Handles socket errors.
 * @param  {Error} err Error emitted by the socket.
 */
function socketError(err) {
  monitor.increment('charon.error.socket');
  error(err.stack);
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
    info('DNS Running on Port', process.env.PORT);
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
    info('Server Shutdown');
    cb(null);
  });

  apiClient.logout(function (err) {
    if (err) { return cb(err); }
    server.close();
  });
}

module.exports = {
  instance: server,
  start: start,
  stop: stop
};
