'use strict';

require('./loadenv.js')();
var dns = require('native-dns');
var debug = require('debug');
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
  console.log(req);
  /*
  // Example response
  res.answer.push(dns.A({
    name: req.question[0].name,
    address: '127.0.0.1',
    ttl: 600,
  }));
  // Example additional section
  res.additional.push(dns.A({
    name: 'hostA.example.org',
    address: '127.0.0.3',
    ttl: 600,
  }));
  */
  res.send();
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
