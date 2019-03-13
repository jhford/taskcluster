const path = require('path');
const {fork} = require('child_process');
const assert = require('assert');
const testing = require('taskcluster-lib-testing');
const MonitorManager = require('../src');

suite('BaseMonitor', function() {
  let manager, monitor;

  setup(function() {
    manager = new MonitorManager({
      serviceName: 'testing-service',
    });
    manager.setup({
      level: 'debug',
      verify: true,
      mock: {
        allowExit: true,
      },
    });
    monitor = manager.monitor();
  });

  teardown(function() {
    manager.terminate();
  });

  suite('timer', function() {
    const takes100ms = () => new Promise(resolve => setTimeout(() => resolve(13), 100));
    const checkMonitor = (len) => {
      // check this after a short delay, as otherwise the Promise.resolve
      // can measure something after timer returns..
      return new Promise(resolve => setTimeout(resolve, 10)).then(() => {
        assert.equal(manager.messages.length, len);
        manager.messages.forEach(m => {
          assert.equal(m.Logger, 'taskcluster.testing-service.root');
          assert.equal(m.Type, 'monitor.timer');
          assert.equal(m.Fields.key, 'pfx');
        });
      });
    };

    test('of a sync function', async function() {
      assert.equal(monitor.timer('pfx', () => 13), 13);
      await checkMonitor(1);
    });

    test('of a sync function that fails', async function() {
      assert.throws(() => {
        monitor.timer('pfx', () => { throw new Error('uhoh'); });
      }, /uhoh/);
      await checkMonitor(1);
    });

    test('of an async function', async function() {
      assert.equal(await monitor.timer('pfx', takes100ms), 13);
      await checkMonitor(1);
      assert(manager.messages[0].Fields.duration >= 90);
    });

    test('of an async function that fails', async function() {
      let err;
      try {
        await monitor.timer('pfx', async () => { throw new Error('uhoh'); });
      } catch (e) {
        err = e;
      }
      assert(err && /uhoh/.test(err.message));
      await checkMonitor(1);
    });

    test('of a promise', async function() {
      assert.equal(await monitor.timer('pfx', takes100ms()), 13);
      await checkMonitor(1);
      assert(manager.messages[0].Fields.duration >= 90);
    });

    test('of a failed promise', async function() {
      let err;
      try {
        await monitor.timer('pfx', Promise.reject(new Error('uhoh')));
      } catch (e) {
        err = e;
      }
      assert(err && /uhoh/.test(err.message));
      await checkMonitor(1);
    });
  });

  suite('oneShot', function() {
    const oldExit = process.exit;
    let exitStatus = null;

    suiteSetup('mock exit', function() {
      process.exit = (s) => { exitStatus = s; };
    });

    suiteTeardown('unmock exit', function() {
      process.exit = oldExit;
    });

    setup('clear exitStatus', function() {
      exitStatus = null;
    });

    test('successful async function', async function() {
      await monitor.oneShot('expire', async () => {});
      assert.equal(exitStatus, 0);
      assert.equal(manager.messages.length, 1);
      assert.equal(manager.messages[0].Logger, 'taskcluster.testing-service.root');
      assert(manager.messages[0].Fields.key);
      assert(manager.messages[0].Fields.duration);
    });

    test('unsuccessful async function', async function() {
      await monitor.oneShot('expire', async () => { throw new Error('uhoh'); });
      assert.equal(exitStatus, 1);
      assert.equal(manager.messages.length, 2);
      assert(manager.messages[0].Fields.key);
      assert(manager.messages[0].Fields.duration);
      assert.equal(manager.messages[1].Fields.name, 'Error');
      assert.equal(manager.messages[1].Fields.message, 'uhoh');
    });

    test('missing name', async function() {
      await monitor.oneShot(async () => { throw new Error('uhoh'); });
      assert.equal(exitStatus, 1);
      assert(manager.messages[0].Fields.name.startsWith('AssertionError'));
    });
  });

  suite('prefix', function() {

    test('prefixes make sense', function() {
      const child = manager.monitor('api');
      monitor.count('foobar', 5);
      child.count('foobar', 6);

      assert.equal(manager.messages.length, 2);
      assert.equal(manager.messages[0].Logger, 'taskcluster.testing-service.root');
      assert.equal(manager.messages[1].Logger, 'taskcluster.testing-service.root.api');
      assert.equal(manager.messages[0].Fields.val, 5);
      assert.equal(manager.messages[1].Fields.val, 6);
    });

    test('can double prefix', function() {
      const child = manager.monitor('api');
      const grandchild = manager.monitor('api.something');
      monitor.count('foobar', 5);
      child.count('foobar', 6);
      grandchild.count('foobar', 7);

      assert.equal(manager.messages.length, 3);
      assert.equal(manager.messages[0].Logger, 'taskcluster.testing-service.root');
      assert.equal(manager.messages[1].Logger, 'taskcluster.testing-service.root.api');
      assert.equal(manager.messages[2].Logger, 'taskcluster.testing-service.root.api.something');
      assert.equal(manager.messages[0].Fields.val, 5);
      assert.equal(manager.messages[1].Fields.val, 6);
      assert.equal(manager.messages[2].Fields.val, 7);
    });

    test('metadata is merged', function() {
      const child = manager.monitor('api', {addition: 1000});
      monitor.measure('bazbing', 5);
      child.measure('bazbing', 6);

      assert.equal(manager.messages.length, 2);
      assert.equal(manager.messages[0].Logger, 'taskcluster.testing-service.root');
      assert.equal(manager.messages[1].Logger, 'taskcluster.testing-service.root.api');
      assert.equal(manager.messages[0].Fields.meta, undefined);
      assert.equal(manager.messages[1].Fields.meta.addition, 1000);
    });

    test('can configure child loggers with specific levels and default to root', function() {
      const b = new MonitorManager({
        serviceName: 'testing-service',
      });
      b.setup({
        level: 'root:info root.api:debug',
        mock: true,
      });

      const m = b.monitor();
      const child1 = b.monitor('api');
      const child2 = b.monitor('handler');
      m.debug('foobar', 1);
      child1.debug('bazbing', 2);
      child2.debug('what', 3);

      assert.equal(b.messages.length, 1);
      assert.equal(b.messages[0].Logger, 'taskcluster.testing-service.root.api');
    });

    test('if using child logger levels, must specify root', function() {
      const b = new MonitorManager({
        serviceName: 'testing-service',
      });
      assert.throws(() => b.setup({
        level: 'root.api:debug',
        mock: true,
      }));
    });
  });

  suite('uncaught and unhandled', function() {

    const testExits = (done, args, check) => {
      let output = '';

      const proc = fork(
        path.resolve(__dirname, './exit.js'),
        args,
        {
          silent: true,
        }
      );
      proc.stdout.on('data', data => output += data.toString());
      proc.stderr.on('data', data => output += data.toString());

      proc.on('exit', code => {
        check(done, code, output);
      });
    };

    test('normal', function(done) {
      testExits(done, [], (done, code, output) => {
        assert.equal(code, 0);
        assert.equal(output, '');
        done();
      });
    });

    test('thrown but with no interception', function(done) {
      testExits(done, [
        '--shouldError',
      ], (done, code, output) => {
        assert.equal(code, 1);
        assert(output.includes('Error: hello there'));
        assert.throws(() => JSON.parse(output));
        done();
      });
    });

    test('thrown with interception', function(done) {
      testExits(done, [
        '--shouldError',
        '--patchGlobal',
      ], (done, code, output) => {
        assert.equal(code, 1);
        assert(output.includes('Error: hello there'));
        assert(JSON.parse(output));
        done();
      });
    });

    test('unhandled but with no interception', function(done) {
      testExits(done, [
        '--shouldUnhandle',
      ], (done, code, output) => {
        assert.equal(code, 0);
        assert(output.includes('UnhandledPromiseRejectionWarning: whaaa'));
        assert.throws(() => JSON.parse(output));
        done();
      });
    });

    test('unhandled with interception', function(done) {
      testExits(done, [
        '--shouldUnhandle',
        '--patchGlobal',
        '--bailOnUnhandledRejection',
      ], (done, code, output) => {
        assert.equal(code, 1);
        assert(output.includes('Unhandled Rejection at'));
        assert(JSON.parse(output));
        done();
      });
    });

    test('unhandled with interception but continues', function(done) {
      testExits(done, [
        '--shouldUnhandle',
        '--patchGlobal',
      ], (done, code, output) => {
        assert.equal(code, 0);
        assert(output.includes('Unhandled Rejection at'));
        assert(JSON.parse(output));
        done();
      });
    });

  });

  suite('other basics', function() {
    test('should record errors', function() {
      monitor.reportError(new Error('oh no'));
      assert.equal(manager.messages.length, 1);
      assert.equal(manager.messages[0].Severity, 3);
      assert.equal(manager.messages[0].severity, 'ERROR');
      assert.equal(manager.messages[0].Fields.name, 'Error');
      assert.equal(manager.messages[0].Fields.message, 'oh no');
      assert(manager.messages[0].Fields.stack);
    });

    test('should record errors with extra', function() {
      monitor.reportError(new Error('oh no'), {foo: 5});
      assert.equal(manager.messages.length, 1);
      assert.equal(manager.messages[0].Severity, 3);
      assert.equal(manager.messages[0].severity, 'ERROR');
      assert.equal(manager.messages[0].Fields.name, 'Error');
      assert.equal(manager.messages[0].Fields.message, 'oh no');
      assert.equal(manager.messages[0].Fields.foo, 5);
      assert(manager.messages[0].Fields.stack);
    });

    test('should record errors with extra and level', function() {
      monitor.reportError(new Error('oh no'), 'warning', {foo: 5});
      assert.equal(manager.messages.length, 1);
      assert.equal(manager.messages[0].Severity, 4);
      assert.equal(manager.messages[0].severity, 'WARNING');
      assert.equal(manager.messages[0].Fields.name, 'Error');
      assert.equal(manager.messages[0].Fields.message, 'oh no');
      assert.equal(manager.messages[0].Fields.foo, 5);
      assert(manager.messages[0].Fields.stack);
    });

    test('should record errors that are strings', function() {
      monitor.reportError('oh no');
      assert.equal(manager.messages.length, 1);
      assert.equal(manager.messages[0].Fields.name, 'Error');
      assert.equal(manager.messages[0].Fields.message, 'oh no');
      assert(manager.messages[0].Fields.stack);
    });

    test('should count', function() {
      monitor.count('something', 5);
      assert.equal(manager.messages.length, 1);
      assert.equal(manager.messages[0].Fields.key, 'something');
      assert.equal(manager.messages[0].Fields.val, 5);
      assert.equal(manager.messages[0].Severity, 6);
    });

    test('should count with default', function() {
      monitor.count('something');
      assert.equal(manager.messages.length, 1);
      assert.equal(manager.messages[0].Fields.key, 'something');
      assert.equal(manager.messages[0].Fields.val, 1);
      assert.equal(manager.messages[0].Severity, 6);
    });

    test('should measure', function() {
      monitor.measure('whatever', 50);
      assert.equal(manager.messages.length, 1);
      assert.equal(manager.messages[0].Fields.key, 'whatever');
      assert.equal(manager.messages[0].Fields.val, 50);
      assert.equal(manager.messages[0].Severity, 6);
    });

    test('should reject malformed counts', function() {
      monitor.count('something', 'foo');
      assert.equal(manager.messages.length, 1);
      assert.equal(manager.messages[0].Severity, 3);
      assert.equal(manager.messages[0].Fields.name, 'AssertionError [ERR_ASSERTION]');
    });

    test('should reject malformed measures', function() {
      monitor.measure('something', 'bar');
      assert.equal(manager.messages.length, 1);
      assert.equal(manager.messages[0].Severity, 3);
      assert.equal(manager.messages[0].Fields.name, 'AssertionError [ERR_ASSERTION]');
    });

    test('should monitor resource usage', async function() {
      const stopMonitor = monitor.resources('testing', 1/500);
      return testing.poll(async () => {
        assert(manager.messages.length > 200);
        assert(manager.messages[0].Fields.lastCpuUsage !== undefined);
        stopMonitor();
      });
    });

    test('monitor.timeKeeper', async () => {
      const doodad = monitor.timeKeeper('doodadgood');
      doodad.measure();
      assert.equal(manager.messages.length, 1);
      assert.equal(manager.messages[0].Fields.key, 'doodadgood');
    });

    test('monitor.timeKeeper forced double submit', async () => {
      const doodad = monitor.timeKeeper('doodadgood');
      doodad.measure();
      doodad.measure(true);
      assert.equal(manager.messages.length, 2);
      assert.equal(manager.messages[0].Fields.key, 'doodadgood');
      assert.equal(manager.messages[1].Fields.key, 'doodadgood');
    });

    test('monitor.timeKeeper unforced double submit throws', async () => {
      const doodad = monitor.timeKeeper('doodadgood');
      doodad.measure();
      assert.throws(() => doodad.measure(), Error);
    });

    test('monitor.patchAWS(service)', async () => {
      const aws = require('aws-sdk');
      const ec2 = new aws.EC2({
        region: 'us-west-2',
        credentials: new aws.Credentials('akid', 'fake', 'session'),
      });
      monitor.patchAWS(ec2);
      await ec2.describeAvailabilityZones().promise().catch(err => {
        // Ignored ec2 error, we measure duration, not success
      });
      assert.equal(manager.messages.length, 1);
      assert.equal(manager.messages[0].Logger, 'taskcluster.testing-service.root');
      assert.equal(manager.messages[0].Fields.operation, 'describeAvailabilityZones');
      assert.equal(manager.messages[0].Fields.service, 'ec2');
      assert.equal(manager.messages[0].Fields.region, 'us-west-2');
      assert(manager.messages[0].Fields.duration > 0);
    });
  });
});
