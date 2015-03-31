'use strict';

/** @module charon:server */

require('./loadenv.js')();
var dns = require('native-dns');
var debug = require('debug');
var query = require('./query');
var dnsUtil = require('./dns-util');

var info = debug('charon:server:info');
var warn = debug('charon:server:warning');
var error = debug('charon:server:error');

var server = dns.createServer();

// server.on('request', enhance(request));
server.on('request', request);
server.on('error', error);

/**
 * Handles requests to the DNS server.
 * @param  {object} req Request to the server.
 * @param  {object} res Response object to modify.
 */
function request(req, res) {
  var address = getRequestAddress(req);
  var names = getNames(req);

  info("DNS query from address: " + address + ", given names: " + names);

  query.resolve(address, names, function(err, records) {
    if (err) {
      error('Error encountered, setting rcode "ServerFailure": ' + err);
      dnsUtil.setRcode(res, 'ServerFailure');
      return res.send();
    }

    if (records === null) {
      warn('Resolver did not returned no records, setting RCODE "refused".');
      dnsUtil.setRcode(res, 'Refused');
      return res.send();
    }

    records.forEach(function(record) {
      res.answer.push(dns.A(record));
    });
    res.send();
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
function error(err, buff, req, res) {
  error(err.stack);
}

/**
 * Starts the DNS server.
 * @param {function} cb Callback to execute once the server has started.
 */
function start(cb) {
  server.serve(process.env.PORT, process.env.HOST);
  info('DNS Running on Port', process.env.PORT);
  if (cb) { cb(null); }
}

/**
 * Stops the DNS server.
 * @param {function} cb Callback to execute once the server has been stopped.
 */
function stop(cb) {
  server.close();
  if (cb) { cb(null); }
}

module.exports = {
  start: start,
  stop: stop
};
