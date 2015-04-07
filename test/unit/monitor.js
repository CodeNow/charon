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
var sinon = require('sinon');

require('loadenv')('charon:env');
var monitor = require('../../lib/monitor');
var dogstatsd = require('../fixtures/dogstatsd');

describe('monitor', function() {
  describe('interface', function() {
    it('should expose a `createMonitor` factory method', function (done) {
      expect(monitor.createMonitor).to.exist();
      expect(typeof monitor.createMonitor).to.equal('function');
      done();
    });

    it('should expose a `set` method', function (done) {
      expect(monitor.set).to.exist();
      expect(typeof monitor.set).to.equal('function');
      done();
    });

    it('should expose a `increment` method', function (done) {
      expect(monitor.increment).to.exist();
      expect(typeof monitor.increment).to.equal('function');
      done();
    });

    it('should expose a `histogram` method', function (done) {
      expect(monitor.histogram).to.exist();
      expect(typeof monitor.histogram).to.equal('function');
      done();
    });

    it('should epose a `gauge` method', function (done) {
      expect(monitor.gauge).to.exist();
      expect(typeof monitor.gauge).to.equal('function');
      done();
    });

    it('should epose a `timer` method', function (done) {
      expect(monitor.timer).to.exist();
      expect(typeof monitor.timer).to.equal('function');
      done();
    });

    describe('timer', function () {
      it('should expose a `start` method', function (done) {
        var timer = monitor.timer('timer');
        expect(timer.start).to.exist();
        expect(typeof timer.start).to.equal('function');
        done();
      });

      it('should expose a `stop` method', function (done) {
        var timer = monitor.timer('timer');
        expect(timer.stop).to.exist();
        expect(typeof timer.stop).to.equal('function');
        done();
      });
    });
  });

  describe('behavior', function() {
    beforeEach(function (done) {
      dogstatsd.stubAll();
      done();
    });

    afterEach(function (done) {
      dogstatsd.restoreAll();
      done();
    })

    describe('constructor & factory', function () {
      it('should use environment host and port by default', function (done) {
        expect(monitor.host).to.equal(process.env.DATADOG_HOST);
        expect(monitor.port).to.equal(process.env.DATADOG_PORT);
        done();
      });

      it('should use environment prefix by default', function (done) {
        expect(monitor.prefix).to.equal(process.env.MONITOR_PREFIX);
        done();
      });

      it('should construct a new monitor', function (done) {
        var custom = monitor.createMonitor();
        expect(custom.host).to.exist();
        expect(custom.port).to.exist();
        expect(custom.client).to.exist();
        done();
      })

      it('should use user defined host when specified', function (done) {
        var customHost = '10.12.14.18';
        var custom = monitor.createMonitor({
          host: customHost
        });
        expect(custom.host).to.equal(customHost);
        expect(monitor.port).to.equal(process.env.DATADOG_PORT);
        done();
      });

      it('should use user defined port when specified', function (done) {
        var customPort = '7777';
        var custom = monitor.createMonitor({
          port: customPort
        });
        expect(monitor.host).to.equal(process.env.DATADOG_HOST);
        expect(custom.port).to.equal(customPort);
        done();
      });

      it('should use user defined prefix when specified', function (done) {
        var customPrefix = 'prefix';
        var custom = monitor.createMonitor({
          prefix: customPrefix
        });
        expect(custom.prefix).to.equal(customPrefix);
        done();
      });

      it('should not use a prefix when not specified', function (done) {
        var envMonitorPrefix = process.env.MONITOR_PREFIX;
        delete process.env.MONITOR_PREFIX;
        var custom = monitor.createMonitor();
        expect(custom.prefix).to.be.null();
        process.env.MONITOR_PREFIX = envMonitorPrefix;
        done();
      })
    });

    describe('helper aliases', function () {
      it('should send sets through datadog', function (done) {
        var key = 'example.set';
        var keyWithPrefix = monitor.prefix + '.' + key;
        var value = 1337;
        var sampleRate = '1s';
        var tags = 'tag1 tag2';
        var stub = monitor.client.set;
        monitor.set(key, value, sampleRate, tags);
        expect(stub.calledOnce).to.be.true();
        expect(stub.calledWith(keyWithPrefix, value, sampleRate, tags)).to.be.true();
        done();
      });

      it('should send counter increments through datadog', function (done) {
        var key = 'example.counter';
        var keyWithPrefix = monitor.prefix + '.' + key;
        var value = 42;
        var sampleRate = '1d';
        var tags = 'my tags';
        var stub = monitor.client.increment;
        monitor.increment(key, value, sampleRate, tags);
        expect(stub.calledOnce).to.be.true();
        expect(stub.calledWith(keyWithPrefix, value, sampleRate, tags)).to.be.true();
        done();
      });

      it('should send histograms through datadog', function (done) {
        var key = 'example.histogram';
        var keyWithPrefix = monitor.prefix + '.' + key;
        var value = 420;
        var sampleRate = '1w';
        var tags = 'mah tagz';
        var stub = monitor.client.histogram;
        monitor.histogram(key, value, sampleRate, tags);
        expect(stub.calledOnce).to.be.true();
        expect(stub.calledWith(keyWithPrefix, value, sampleRate, tags)).to.be.true();
        done();
      });

      it('should send gauges through datadog', function (done) {
        var key = 'speed.of.light';
        var keyWithPrefix = monitor.prefix + '.' + key;
        var value = 299792458;
        var sampleRate = '1yr';
        var tags = 'einstein is cool';
        var stub = monitor.client.gauge;
        monitor.gauge(key, value, sampleRate, tags);
        expect(stub.calledOnce).to.be.true();
        expect(stub.calledWith(keyWithPrefix, value, sampleRate, tags)).to.be.true();
        done();
      });

      it('methods should not use a prefix if none was specified', function (done) {
        var envMonitorPrefix = process.env.MONITOR_PREFIX;
        delete process.env.MONITOR_PREFIX;

        var custom = monitor.createMonitor();
        console.log(custom);
        var methods = ['set', 'increment', 'histogram', 'gauge'];
        methods.forEach(function (method) {
          var stub = sinon.stub(custom.client, method);
          var key = 'key';
          custom[method](key);

          expect(stub.calledWith(key)).to.be.true();
          custom.client[method].restore();
        });

        process.env.MONITOR_PREFIX = envMonitorPrefix;
        done();
      });
    });

    describe('timer', function() {
      it('should start the timer by default', function (done) {
        var timer = monitor.timer('timer');
        expect(timer.startDate).to.exist();
        done();
      });

      it('should not start the timer if instructed to not do so', function (done) {
        var timer = monitor.timer('timer', false);
        expect(timer.startDate).to.not.exist();
        done();
      });

      it('should call client histogram method with correct name when stopped', function (done) {
        var timerName = 'timer';
        monitor.client.histogram.restore();
        sinon.stub(monitor.client, 'histogram', function (name, duration) {
          expect(name).to.equal(monitor.prefix + '.' + timerName);
          done();
        });
        var timer = monitor.timer(timerName);
        timer.stop();
      });

      it('should report a realistic duration when stopped', function (done) {
        var duration = 60;
        var timer = monitor.timer('timer');
        sinon.stub(timer, 'callback', function (duration) {
          expect(duration).about(duration, 15);
          done();
        });
        setTimeout(function () {
          timer.stop();
        }, duration);
      });

      it('should not attempt to start a timer multiple times', function (done) {
        var timer = monitor.timer('timer', false);
        timer.start();
        var originalDate = timer.startDate;
        timer.start();
        expect(timer.startDate).to.equal(originalDate);
        done();
      });

      it('should not execute the callback the timer is stopped before being started', function (done) {
        var timer = monitor.timer('timer', false);
        sinon.stub(timer, 'callback');
        timer.stop();
        expect(timer.callback.callCount).to.equal(0);
        timer.callback.restore();
        done();
      })
    });
  });
});
