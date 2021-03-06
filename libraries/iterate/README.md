# Iterate Library

The motivation for this library is to provide a common framework for the running
of code many times in a robust and fail-safe manner.  At its core, this library
takes a chunk of code, runs it, waits a defined period of time, then runs it
again.  This library ensures that code run through it does not freeze, does not
fail too many times and does not fail silently.

## Example
Here is a simple example of this library:

```javascript
var Iterate = require(`taskcluster-lib-iterate`);

i = new Iterate({
  maxFailures: 5,
  maxIterationTime: 10000,
  watchdogTime: 5000,
  waitTime: 2000,
  handler: async (watchdog, state) => {
    await doSomeWork();
    watchdog.touch();  // tell Iterate that we`re doing work still
    await doMoreWork();
    watchdog.touch();
  },
});

// starting the iterator will invoke the handler immediately, but returns before
// the iteration is complete.
i.start();

i.on(`stopped`, () => {
  console.log(`All done here!`);
});
```

## Options:

The constructor for the `Iterate` class takes an options object, with the following properties.
All times are in milliseconds.

* `handler`: the async function to call repeatedly, called as `await handler(watchdog, state)`.
  See details below.
* `monitor` (optional): instance of a `taskcluster-lib-monitor` instance with a name appropriate for this iterate instance.
  This is used to report errors.
* `maxIterationTime`: the maximum allowable duration of an iteration interval.
  An iteration longer than this is considered failed.
  This time is exclusive of the time we wait between iterations.
* `minIterationTime` (optional): the minimum allowable duration of an iteration interval.
  An iteration shorter than this is considered failed.
* `waitTime`: the time to wait between finishing an iteration and beginning the next.
* `maxIterations` (optional, default infinite): Complete up to this many
  iterations and then successfully exit.  Failed iterations count.
* `maxFailures` (optional, default 7): number of failures to tolerate before considering the iteration loop a failure by emitting an `error` event.
  This provides a balance between quick recovery from transient errors and the crashing the process for persistent errors.
* `watchdogTime`: this is the time within which `watchdog.touch` must be called or the iteration is considered a failure.
  If this value is omitted or zero, the watchdog is disabled.

The main function of the `Iterate` instance is to call `handler` repeatedly.
This is an async function, receiving two parameters -- `(watchdog, state)`.

The `watchdog` parameter is basically a ticking timebomb that must be defused frequently by calling its `.touch()` method.
It has methods `.start()`, `.stop()` and `.touch()` and emits `expired` when it expires.
What it allows an implementor is the abilty to say that while the absolute maximum iteration interval (`maxIterationTime`), incremental progress should be made.
The idea here is that after each chunk of work in the handler, you run `.touch()`.
If the `watchdogTime` duration elapses without a touch, then the iteration is considered faild.
This way, you can have a handler that can be marked as failing without waiting the full `maxIterationTime`.

The `state` parameter is an object that is passed in to the handler function.
It allows each iteration to accumulate data and use on following iterations.
Because this object is passed in by reference, changes to properties on the object are saved, but reassignment of the state variable will not be saved.
In other words, do `state.data = {count: 1}` and not `state = {count:1}`.

## Events

Iterate is an event emitter.  When relevant events occur, the following events
are emitted.  If the `error` event does not have a listener, the process will
exit with a non-zero exit code when it would otherwise be emitted.

* `started`: when overall iteration starts
* `stopped`: when overall iteration is finished
* `completed`: only when we have a max number of iterations, when we
  finish the last iteration
* `iteration-start`: when an individual iteration starts
* `iteration-success`: when an individual iteration completes with
  success.  provides the value that handler resolves with
* `iteration-failure`: provides iteration error
* `iteration-complete`: when an iteration is complete regardless of outcome
* `error`: when the iteration is considered to be concluded and provides
  list of iteration errors.  If there are no handlers and this event is
  emitted, an exception will be thrown in a process.nextTick callback.
