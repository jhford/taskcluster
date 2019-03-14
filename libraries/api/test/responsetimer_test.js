const request = require('superagent');
const assert = require('assert');
const APIBuilder = require('../');
const MonitorManager = require('taskcluster-lib-monitor');
const helper = require('./helper');
const libUrls = require('taskcluster-lib-urls');

suite('api/responsetimer', function() {
  // Create test api
  const builder = new APIBuilder({
    title: 'Test Api',
    description: 'Another test api',
    serviceName: 'test',
    apiVersion: 'v1',
  });

  builder.declare({
    method: 'get',
    route: '/single-param/:myparam',
    name: 'testParam',
    title: 'Test End-Point',
    description: 'Place we can call to test something',
  }, function(req, res) {
    res.status(200).send(req.params.myparam);
  });

  builder.declare({
    method: 'get',
    route: '/slash-param/:name(*)',
    name: 'testSlashParam',
    title: 'Test End-Point',
    description: 'Place we can call to test something',
  }, function(req, res) {
    res.status(404).send(req.params.name);
  });

  builder.declare({
    method: 'get',
    route: '/another-param/:name(*)',
    name: 'testAnotherParam',
    title: 'Test End-Point',
    description: 'Place we can call to test something',
  }, function(req, res) {
    res.status(500).send(req.params.name);
  });

  // Reference for test api server
  let monitorManager = null;

  // Create a mock authentication server
  setup(async () => {
    monitorManager = new MonitorManager({
      serviceName: 'lib-api-test',
    });
    monitorManager.setup({
      mock: true,
    });

    await helper.setupServer({builder, monitor: monitorManager.monitor('api')});
  });
  teardown(() => {
    monitorManager.terminate();
    helper.teardownServer();
  });

  test('single parameter', async function() {
    const u = path => libUrls.api(helper.rootUrl, 'test', 'v1', path);
    await request.get(u('/single-param/Hello')),
    await request.get(u('/single-param/Goodbye')),
    await request.get(u('/slash-param/Slash')).catch(err => {}),
    await request.get(u('/another-param/Another')).catch(err => {}),
    assert.equal(monitorManager.messages.length, 4);
    monitorManager.messages.forEach(event => {
      assert.equal(event.Type, 'monitor.apiMethod');
      assert.equal(event.Logger, 'taskcluster.lib-api-test.root.api');
    });
    assert.equal(monitorManager.messages[0].Fields.name, 'testParam');
    assert.equal(monitorManager.messages[0].Fields.statusCode, 200);
    assert.equal(monitorManager.messages[1].Fields.name, 'testParam');
    assert.equal(monitorManager.messages[1].Fields.statusCode, 200);
    assert.equal(monitorManager.messages[2].Fields.name, 'testSlashParam');
    assert.equal(monitorManager.messages[2].Fields.statusCode, 404);
    assert.equal(monitorManager.messages[3].Fields.name, 'testAnotherParam');
    assert.equal(monitorManager.messages[3].Fields.statusCode, 500);
  });
});
