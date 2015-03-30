'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.it;
var before = lab.before;
var after = lab.after;
var afterEach = lab.afterEach;
var Code = require('code');
var expect = Code.expect;
var dns = require('native-dns');

require('../lib/loadenv.js')();
var server = require('../lib/server');

describe('server', function() {
  before(server.start);
  after(server.stop);

  function request(domain, cb) {
    var req = dns.Request({
      question: dns.Question({
        name: domain,
        type: 'A'
      }),
      server: {
        address: '127.0.0.1',
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
  }

  it('should handle internal domain names requests', function (done) {
    request('example.runnableapp.com', function (err, resp) {
      expect(resp.answer).to.not.be.empty();
      // TODO Need more detailed tests here
      done();
    });
  });

  it('should handle external domain names requests', function (done) {
    request('www.google.com', function (err, resp) {
      expect(resp.answer).to.be.empty();
      done();
    });
  });
});
