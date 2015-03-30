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
var query = require('../lib/query');

describe('query', function() {
  it('should resolve internal dns names', function (done) {
    var names = [
      'web-codenow.runnableapp.com',
      'api-codenow.runnableapp.com',
      'example.runnableapp.com'
    ];
    query.resolve('127.0.0.1', names, function (err, records) {
      if (err) { return done(err); }
      expect(records.length).to.equal(3);
      names.forEach(function (name, index) {
        expect(records[index].name).to.equal(name);
      });
      done();
    });
  });

  it('should not resolve external dns names', function (done) {
    var names = [
      'www.google.com',
      'www.wikipedia.org',
      'www.ign.com'
    ];
    query.resolve('127.0.0.1', names, function (err, records) {
      if (err) { return done(err); }
      expect(records).to.be.empty();
      done();
    });
  });

  it('should be able to resolve a mix of external and internal names', function (done) {
    var names = [
      'valid.runnableapp.com',
      'invalid.google.com'
    ];
    query.resolve('127.0.0.1', names, function (err, records) {
      if (err) { return done(err); }
      expect(records.length).to.equal(1);
      expect(records[0].name).to.equal('valid.runnableapp.com');
      done();
    });
  });

  it('should appropriately resolves names given referrer ip', function (done) {
    done(new Error('Not tested.'));
  });
});
