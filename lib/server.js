'use strict';

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
  var requestIP = getRequestIP(req);
  var names = getQuestionNames(req);

  info("DNS query from ip: " + requestIP + " resolving names: " + names);

  query.resolve(names, function(err, records) {
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
 * section of a request.
 * @param  {Object} req Request object.
 * @return {Array} List of names to resolve.
 */
function getQuestionNames(req) {
  return req.question.map(function (question) {
    return question.name;
  });
}

/**
 * Handles errors on the DNS server.
 * @param err Error to handle.
 * @param buff ???
 * @param {object} req Request object being processed with the error occurred.
 * @param {object} res Response object when the error occurred.
 */
function error(err, buff, req, res) {
  error(err.stack);
}

/**
 * Starts the DNS server.
 */
function start() {
  server.serve(process.env.PORT, '127.0.0.1');
  info('DNS Running on Port', process.env.PORT);
}

/**
 * Stops the DNS server.
 */
function stop() {
  server.close();
}

module.exports = {
  start: start,
  stop: stop
};
