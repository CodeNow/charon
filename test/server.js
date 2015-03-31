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
var sinon = require('sinon');

require('../lib/loadenv.js')();
var server = require('../lib/server');
var rcode = require('../lib/dns-util').rcode;
var query = require('../lib/query');

function request(domain, cb) {
  var req = dns.Request({
    question: dns.Question({ name: domain, type: 'A' }),
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

describe('server', function() {
  before(server.start);
  after(server.stop);

  it('should resolve internal domain name requests', function (done) {
    request('example.runnableapp.com', function (err, resp) {
      if (err) { return done(err); }
      expect(resp.answer).to.not.be.empty();
      expect(resp.header.rcode).to.equal(rcode.NoError);
      done();
    });
  });

  it('should deny external domain name requests', function (done) {
    request('www.google.com', function (err, resp) {
      if (err) { return done(err); }
      expect(resp.answer).to.be.empty();
      expect(resp.header.rcode).to.equal(rcode.Refused);
      done();
    });
  });

  it('should handle server errors appropriately', function (done) {
    sinon.stub(query, 'resolve', function(addr, domain, cb) {
      cb(new Error('Server error'), null);
    });
    request('example.runnableapp.com', function(err, resp) {
      if (err) { return done(err); }
      expect(resp.answer).to.be.empty();
      expect(resp.header.rcode).to.equal(rcode.ServerFailure);
      query.resolve.restore();
      done();
    });
  });
});
