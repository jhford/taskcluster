# TaskCluster Client [![Build Status](https://travis-ci.org/taskcluster/taskcluster-client.svg?branch=master)](https://travis-ci.org/taskcluster/taskcluster-client)
_A taskcluster client library for node.js._

This client library is generated from the auto-generated API reference.
You can create a Client class from a JSON reference object at runtime using
`taskcluster.createClient(reference)`. But there is also a set of builtin
references from which Client classes are already constructed.

## Calling API End-Points
To invoke an API end-point instantiate a taskcluster Client class, these are
classes can be created from a JSON reference object, but a number of them are
also built-in to this library. In the following example we instantiate an
instance of the `Queue` Client class and use to to create a task.

```js
var taskcluster = require('taskcluster-client');

// Instantiate the Queue Client class
var queue = new taskcluster.Queue({
  credentials: {
    clientId:     '...',
    accessToken:  '...'
  }
});

// Create task using the queue client
var taskId = '...';
queue.createTask(taskId, task).then(function(result) {
  // status is a task status structure
  console.log(result.status);
});
```

The `payload` parameter is always a JSON object as documented by the REST API
documentation. The methods always returns a _promise_ for the response JSON
object as documented in the REST API documentation.

## Listening for Events
Many TaskCluster components publishes messages about current events over AMQP.
The JSON reference object also contains meta-data about declared AMQP topic
exchanges and their routing key construction. This is designed to make it easy
to construct routing key patterns and parse routing keys from incoming messages.

The following example create a `listener` and instantiate an instance of
the Client class `QueueEvents` which we use to find the exchange and create
a routing pattern to listen for completion of a specific task. The
`taskCompleted` method will construct a routing key pattern by using `*` or `#`
for missing entries, pending on whether or not they are single word or
multi-key entries.

```js
var taskcluster = require('taskcluster-client');

// Create a listener (this creates a queue on AMQP)
var listener = new taskcluster.Listener({
  connectionString:   'amqp://...'
});

// Instantiate the QueueEvents Client class
var queueEvents = new taskcluster.QueueEvents();

// Bind to task-completed events from queue that matches routing key pattern:
//   '<myTaskId>.*.*.*.*.*.#'
listener.bind(queueEvents.taskCompleted({taskId: '<myTaskId>'}));

// Listen for messages
listener.on('message', function(message) {
  message.exchange        // Exchange from which message came
  message.payload         // Documented on docs.taskcluster.net
  message.routingKey      // Message routing key in string format
  message.routing.taskId  // Element from parsed routing key
  message.routing.runId   // ...
  message.redelivered     // True, if message has been nack'ed and requeued
  return new Promise(...);
});

// Listen and consume events:
listener.resume().then(function() {
  // Now listening
});
```

For advanced queue usage the `connect` method can be used to
create and bind the queue and return an associated [amqplib] channel:

```js
var taskcluster = require('taskcluster-client');

// Create a listener (this creates a queue on AMQP)
var listener = new taskcluster.Listener({
  connectionString:   'amqp://...'
});

// See: http://www.squaremobius.net/amqp.node/doc/channel_api.html
var channel = listener.connect().then(function(channel) {
  return channel.consume(function(msg) {
    channel.ack(msg);
  });
});
```

The listener creates a AMQP queue, on the server side and subscribes to messages
on the queue. It's possible to use named queues, see details below. For details
on routing key entries refer to documentation on
[docs.taskcluster.net](docs.taskcluster.net).

**Remark,** API end-points and AMQP exchanges are typically documented in
separate reference files. For this reason they also have separate Client
classes, even if they are from the same component.

## Documentation
The set of API entries listed below is generated from the builtin references.
Detailed documentation with description, payload and result format details is
available on [docs.taskcluster.net](http://docs.taskcluster.net).

On the [documentation site](http://docs.taskcluster.net) entries often have a
_signature_, you'll find that it matches the signatures below. Notice that all
the methods returns a promise. A method with `: void` also returns a promise,
that either resolves without giving a value or rejects with an error.

<!-- START OF GENERATED DOCS -->

### Methods in `taskcluster.Auth`
```js
// Create Auth client instance with default baseUrl:
//  - https://auth.taskcluster.net/v1
var auth = new taskcluster.Auth(options);
```
 * `auth.inspect(clientId) : result`
 * `auth.getCredentials(clientId) : result`

### Methods in `taskcluster.Queue`
```js
// Create Queue client instance with default baseUrl:
//  - https://queue.taskcluster.net/v1
var queue = new taskcluster.Queue(options);
```
 * `queue.createTask(taskId, payload) : result`
 * `queue.getTask(taskId) : result`
 * `queue.defineTask(taskId, payload) : result`
 * `queue.scheduleTask(taskId) : result`
 * `queue.getTask(taskId) : result`
 * `queue.status(taskId) : result`
 * `queue.claimTask(taskId, runId, payload) : result`
 * `queue.reclaimTask(taskId, runId) : result`
 * `queue.claimWork(provisionerId, workerType, payload) : result`
 * `queue.reportCompleted(taskId, runId, payload) : result`
 * `queue.rerunTask(taskId) : result`
 * `queue.createArtifact(taskId, runId, name, payload) : result`
 * `queue.getArtifactFromRun(taskId, runId, name) : void`
 * `queue.getLatestArtifact(taskId, name) : void`
 * `queue.getArtifactsFromRun(taskId, runId) : void`
 * `queue.getLatestArtifacts(taskId) : void`
 * `queue.getPendingTasks(provisionerId) : void`
 * `queue.getAMQPConnectionString() : result`

### Methods in `taskcluster.Scheduler`
```js
// Create Scheduler client instance with default baseUrl:
//  - http://scheduler.taskcluster.net/v1
var scheduler = new taskcluster.Scheduler(options);
```
 * `scheduler.createTaskGraph(payload) : result`
 * `scheduler.extendTaskGraph(taskGraphId, payload) : result`
 * `scheduler.getTaskGraphStatus(taskGraphId) : result`
 * `scheduler.getTaskGraphInfo(taskGraphId) : result`
 * `scheduler.inspectTaskGraph(taskGraphId) : result`

### Exchanges in `taskcluster.QueueEvents`
```js
// Create QueueEvents client instance with default exchangePrefix:
//  - queue/v1/
var queueEvents = new taskcluster.QueueEvents(options);
```
 * `queueEvents.taskPending(routingKeyPattern) : binding-info`
 * `queueEvents.taskRunning(routingKeyPattern) : binding-info`
 * `queueEvents.taskCompleted(routingKeyPattern) : binding-info`
 * `queueEvents.taskFailed(routingKeyPattern) : binding-info`

### Exchanges in `taskcluster.SchedulerEvents`
```js
// Create SchedulerEvents client instance with default exchangePrefix:
//  - scheduler/v1/
var schedulerEvents = new taskcluster.SchedulerEvents(options);
```
 * `schedulerEvents.taskGraphRunning(routingKeyPattern) : binding-info`
 * `schedulerEvents.taskGraphExtended(routingKeyPattern) : binding-info`
 * `schedulerEvents.taskGraphBlocked(routingKeyPattern) : binding-info`
 * `schedulerEvents.taskGraphFinished(routingKeyPattern) : binding-info`

<!-- END OF GENERATED DOCS -->

## Create Client Class Dynamically
You can create a Client class from a reference JSON object as illustrated
below:

```js
var reference = {...}; // JSON from references.taskcluster.net/...

// Create Client class
var MyClient = taskcluster.createClient(reference);

// Instantiate an instance of MyClient
var myClient = new MyClient(options);

// Make a request with a method on myClient
myClient.myMethod(arg1, arg2, payload).then(function(result) {
  // ...
});
```

## Configuration of API Invocations
There is a number of configuration options for Client which affects invocation
of API end-points. These are useful if using a non-default server, for example
when setting up a staging area or testing locally.

### Configuring API BaseUrls
If you use the builtin API Client classes documented above you can configure
the `baseUrl` when creating an instance of the client. As illustrated below:

```js
var auth = new taskcluster.Auth({
  credentials:  {...},
  baseUrl:      "http://localhost:4040" // Useful for development and testing
});
```

### Configuring Credentials
When creating an instance of a Client class the credentials can be provided
in options. For example:
```js
var auth = new taskcluster.Auth({
  credentials: {
    clientId:     '...',
    accessToken:  '...'
  }
});
```

You can also configure default options globally using
`taskcluster.config(options)`, as follows:

```js
// Configure default options
taskcluster.config({
  credentials: {
    clientId:     '...',
    accessToken:  '...'
  }
});

// No credentials needed here
var auth = new taskcluster.Auth();
```

If the `clientId` and `accessToken` are left empty we also check the
`TASKCLUSTER_CLIENT_ID` and `TASKCLUSTER_ACCESS_TOKEN` environment variables
to use as defaults (similar to how AWS, Azure, etc. handle authentication).

### Delegated Authorization
If your client has the scope `auth:can-delegate` you can send requests with
a scope set different from the one you have. This is useful when the
scheduler performs a request on behalf of a task-graph, or when
authentication takes place in a trusted proxy. See example below:

```js
// Create delegating instance of Auth Client class
var auth = new taskcluster.Auth({
  credentials: {
    clientId:     '...',
    accessToken:  '...'
  },
  authorization: {
    delegating:   true,
    scopes:       ['scope', ...]  // For example task.scopes
  }
});

// This request is only successful if the set of scopes declared above
// allows the request to come through. The set of scopes the client has
// will not be used to authorize this request.
auth.getCredentials(someClientId).then(function(result) {
  // ...
});
```
We call this delegated authorization, because the trusted node that has the
scope `auth:can-delegate`, delegates authorization of the request to API
end-point.

## Configuration of Exchange Bindings
When a taskcluster Client class is instantiated the option `exchangePrefix` may
be given. This will replace the default `exchangePrefix`. This can be useful if
deploying a staging area or similar. See example below:

```js

// Instantiate the QueueEvents Client class
var queueEvents = new taskcluster.QueueEvents({
  exchangePrefix:     'staging-queue/v1/'
});

// This listener will now bind to: staging-queue/v1/task-completed
listener.bind(queueEvents.taskCompleted({taskId: '<myTaskId>'}));
```

## Using the Listener

TODO:
```
var listener = new taskcluster.Listener({
  prefetch:           5,            // Number of tasks to process in parallel
  connectionString:   'amqp://...', // AMQP connection string
  // If no queue name is given, the queue is:
  //    exclusive, autodeleted and non-durable
  // If a queue name is given, the queue is:
  //    durable, not auto-deleted and non-exclusive
  queueName:          'my-queue',   // Queue name, undefined if none
  maxLength:          0,            // Max allowed queue size
});

listener.connect().then(...);       // Setup listener and bind queue
listener.resume().then(...);        // Start getting new messages
listener.pause().then(...);         // Pause retrieval of new messages
listener.close();                   // Disconnect from AMQP
```

## Updating Builtin APIs
When releasing a new version of the `taskcluster-client` library, we should
always update the builtin references using `utils/update-apis.js` this
maintenance script can be used to list, show, add, remove and update builtin
API definitions.

When `apis.json` is updated, please run `utils/generate-docs.js` to update
the documentation in this file.

##License
The taskcluster client library is released on [MPL 2.0](http://mozilla.org/MPL/2.0/).