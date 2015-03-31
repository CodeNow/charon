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
var client = require('../lib/api-client.js');
var user = client.user;

describe('api-client', function() {
  describe('interface', function() {
    it('should expose the api user', function (done) {
      expect(client.user).to.exist();
      done();
    });

    it('should expose a login method', function (done) {
      expect(client.login).to.exist();
      expect(typeof client.login).to.equal('function');
      done();
    });

    it('should expose a logout method', function (done) {
      expect(client.logout).to.exist();
      expect(typeof client.logout).to.equal('function');
      done();
    });
  }); // end 'interface'

  describe('behaviors', function() {
    afterEach(function (done) {
      if (typeof user.githubLogin.restore === 'function') {
        user.githubLogin.restore();
      }
      if (typeof user.logout.restore === 'function') {
        client.logout(function() {
          user.logout.restore();
          done();
        });
      }
      else {
        done();
      }
    });

    describe('.login()', function() {
      it('should login correctly', function (done) {
        sinon.stub(user, 'githubLogin', function (token, cb) {
          expect(token).to.equal(process.env.API_TOKEN);
          cb();
        });
        sinon.stub(user, 'logout', function (cb) {
          cb();
        });
        client.login(function (err) {
          if (err) { return done(err); }
          expect(user.githubLogin.calledOnce).to.be.true;
          done();
        })
      });

      it('should ignore login if already logged in', function (done) {
        sinon.stub(user, 'githubLogin', function (token, cb) {
          cb();
        });
        sinon.stub(user, 'logout', function (cb) {
          cb();
        });
        client.login(function (err) {
          if (err) { return done(err); }
          client.login(function (err) {
            if (err) { return done(err); }
            expect(user.githubLogin.calledOnce).to.be.true;
            done();
          })
        });
      });

      it('should correctly handle login errors', function (done) {
        sinon.stub(user, 'githubLogin', function (token, cb) {
          cb(new Error('API Error'));
        });
        sinon.stub(user, 'logout', function (cb) {
          cb();
        });
        client.login(function (err) {
          expect(err).to.exist();
          user.githubLogin.restore();
          sinon.stub(user, 'githubLogin', function (token, cb) {
            cb();
          });
          client.login(function (err) {
            if (err) { return done(err); }
            expect(user.githubLogin.calledOnce).to.be.true;
            done();
          });
        });
      })
    }); // end 'login'

    describe('.logout()', function() {
      it('should ignore logout if not logged in', function (done) {
        sinon.stub(user, 'logout', function() {
          done(new Error('user.logout called even though client is not logged in.'));
        });
        client.logout(function (err) {
          if (err) { return done(err); }
          expect(user.logout.callCount).to.equal(0);
          done();
        });
      });

      it('should logout correctly', function (done) {
        sinon.stub(user, 'githubLogin', function (token, cb) {
          cb();
        });
        sinon.stub(user, 'logout', function (cb) {
          cb();
        });
        client.login(function (err) {
          if (err) { return done(err); }
          client.logout(function (err) {
            if (err) { return done(err); }
            expect(user.logout.calledOnce).to.be.true;
            done();
          })
        });
      });

      it('should correctly handle logout errors', function (done) {
        sinon.stub(user, 'githubLogin', function (token, cb) {
          cb();
        });
        sinon.stub(user, 'logout', function (cb) {
          cb(new Error('API Error'));
        });
        client.login(function (err) {
          if (err) { return done(err); }
          client.logout(function (err) {
            expect(err).to.exist();
            user.logout.restore();
            sinon.stub(user, 'logout', function (cb) {
              cb();
            });
            client.logout(function (err) {
              if (err) { return done(err); }
              expect(user.logout.calledOnce).to.be.true;
              done();
            });
          });
        });
      });
    }); // end 'logout'
  }); // end 'behaviors'
}); // end 'api-client'
