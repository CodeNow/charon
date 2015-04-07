'use strict';

require('loadenv')('charon:env');
var dns = require('native-dns');

module.exports = function dnsRequest(domain, cb) {
  var req = dns.Request({
    question: dns.Question({ name: domain, type: 'A' }),
    server: {
      address: process.env.HOST,
      port: process.env.PORT,
      type: 'udp'
    },
    timeout: 1000
  });
  req.on('timeout', function () {
    cb(new Error('DNS Server Timeout'));
  });
  req.on('message', cb);
  req.send();
};
