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
var debug = require('debug');
var error = debug('charon:server:error');

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
  describe('interface', function() {
    it('should expose a `start` method', function (done) {
      expect(server.start).to.exist();
      expect(typeof server.start).to.equal('function');
      done();
    });

    it('should expose a `stop` method', function (done) {
      expect(server.stop).to.exist();
      expect(typeof server.stop).to.equal('function');
      done();
    });
  });

  describe('DNS Requests', function() {
    var serverInstance;

    before(function (done) {
      serverInstance = server.start();
      done();
    });

    after(function (done) {
      server.stop();
      done();
    });

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
      sinon.stub(query, 'resolve', function (addr, domain, cb) {
        cb(new Error('Server error'), null);
      });
      request('example.runnableapp.com', function (err, resp) {
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
          serverInstance.emit('error', new Error('ERROR'));
        });
        request('example.runnableapp.com', function (err, resp) {
          query.resolve.restore();
          done();
        });
      });

      it ('should report socket errors', function(done) {
        sinon.stub(query, 'resolve', function () {
          serverInstance.emit('socketError', new Error('ERROR'));
        });
        request('example.runnableapp.com', function (err, resp) {
          query.resolve.restore();
          done();
        });
      });
    }); // end 'errors'
  }); // end 'DNS'
}); // end 'server'
