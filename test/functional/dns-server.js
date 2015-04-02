'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.it;
var before = lab.before;
var beforeEach = lab.beforeEach;
var after = lab.after;
var afterEach = lab.afterEach;
var Code = require('code');
var expect = Code.expect;
var dns = require('native-dns');
var sinon = require('sinon');
var debug = require('debug');
var error = debug('charon:server:error');

require('../../lib/loadenv.js')();

var server = require('../../lib/server');
var rcode = require('../../lib/dns-util').rcode;
var query = require('../../lib/query');
var apiClient = require('../../lib/api-client');

function dnsRequest(domain, cb) {
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

describe('DNS Server (functional)', function() {
  before(function (done) {
    sinon.stub(apiClient.user, 'fetchInternalIpForHostname')
      .yields(null, '127.0.0.1');
    sinon.stub(apiClient, 'login').yields();
    server.start(function() {
      apiClient.login.restore();
      done();
    });
  });

  after(function (done) {
    apiClient.user.fetchInternalIpForHostname.restore();
    sinon.stub(apiClient, 'logout').yields();
    server.stop(function() {
      apiClient.logout.restore();
      done();
    });
  });

  it('should resolve internal domain name requests', function (done) {
    dnsRequest('example.runnableapp.com', function (err, resp) {
      if (err) { return done(err); }
      expect(resp.answer).to.not.be.empty();
      expect(resp.header.rcode).to.equal(rcode.NoError);
      done();
    });
  });

  it('should deny external domain name requests', function (done) {
    dnsRequest('www.google.com', function (err, resp) {
      if (err) { return done(err); }
      expect(resp.answer).to.be.empty();
      expect(resp.header.rcode).to.equal(rcode.Refused);
      done();
    });
  });

  it('should handle server errors appropriately', function (done) {
    sinon.stub(query, 'resolve').yields(new Error('Server error'));
    dnsRequest('example.runnableapp.com', function (err, resp) {
      if (err) { return done(err); }
      expect(resp.answer).to.be.empty();
      expect(resp.header.rcode).to.equal(rcode.ServerFailure);
      query.resolve.restore();
      done();
    });
  });

  describe('error handling', function() {
    it('should report server errors', function (done) {
      sinon.stub(query, 'resolve', function () {
        server.instance.emit('error', new Error('Server Error'));
      });
      dnsRequest('example.runnableapp.com', function (err, resp) {
        query.resolve.restore();
        done();
      });
    });

    it ('should report socket errors', function(done) {
      sinon.stub(query, 'resolve', function () {
        server.instance.emit('socketError', new Error('Socket Error'));
      });
      dnsRequest('example.runnableapp.com', function (err, resp) {
        query.resolve.restore();
        done();
      });
    });
  }); // end 'errors'
}); // end 'DNS Requests (Functional)'