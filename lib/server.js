'use strict';

/** @module charon:server */

require('./loadenv.js')();
var dns = require('native-dns');
var debug = require('debug');
var query = require('./query');

var info = debug('charon:server:info');
var error = debug('charon:server:error');

var server = dns.createServer();
server.on('request', request);
server.on('error', error);

/**
 * Handles requests to the DNS server.
 * @param  {object} req Request to the server.
 * @param  {object} res Response object to modify.
 */
function request(req, res) {
  var ip = getRequestIP(req);
  var names = getNames(req);

  info("DNS query from ip: " + ip + ", resolving names: " + names);

  query.resolve(ip, names, function(err, records) {
    if (err) { return error(err); }
    records.forEach(function(record) {
      res.answer.push(dns.A(record));
    });
    res.send();
  });
}

/**
 * Determines the remote ip for an address.
 * @param {object} req Request object.
 * @return {string} The remote ip address for the request.
 */
function getRequestIP(req) {
  return req._socket._remote.address;
}

/**
 * Determines a list of domain names from the question
 * section of a request. Domain names are filtered so
 * that only internal names are resolved.
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
  server.serve(process.env.PORT, '127.0.0.1');
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
