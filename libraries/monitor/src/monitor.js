const assert = require('assert');
const serializeError = require('serialize-error');
const TimeKeeper = require('./timekeeper');

class Monitor {
  constructor({logger, mock, enable, verify = false, types = {}}) {
    this._log = logger;
    this.verify = verify;
    this.mock = mock;
    this.enable = enable;
    this.log = {};
    Object.entries(types).forEach(([name, meta]) => {
      this.register({name, ...meta});
    });
  }

  debug(...args) {
    this._log.debug(...args);
  }

  info(...args) {
    this._log.info(...args);
  }

  notice(...args) {
    this._log.notice(...args);
  }

  warning(...args) {
    this._log.warning(...args);
  }

  err(...args) {
    this._log.err(...args);
  }

  crit(...args) {
    this._log.crit(...args);
  }

  alert(...args) {
    this._log.alert(...args);
  }

  emerg(...args) {
    this._log.emerg(...args);
  }

  /*
   * Register a new logging type
   */
  register({name, type, version, level, fields}) {
    assert(!this[name], `Cannot override "${name}" as custom message type.`);
    const requiredFields = Object.keys(fields);
    this.log[name] = (fields, overrides={}) => {
      if (this.verify) {
        assert(level !== 'any' || overrides.level !== undefined, 'Must provide `overrides.level` if registered level is `any`.');
        const providedFields = Object.keys(fields);
        assert(!providedFields.includes('v'), '"v" is a reserved field for logging messages.');
        requiredFields.forEach(f => assert(providedFields.includes(f), `Log message "${name}" must include field "${f}".`));
      }
      if (level === 'any') {
        level = overrides.level;
      }
      this._log[level](type, {v: version, ...fields});
    };
  }

  /*
   * The most basic timer.
   */
  timer(key, funcOrPromise) {
    const start = process.hrtime();
    const done = (x) => {
      const d = process.hrtime(start);
      this.log.basicTimer({
        key,
        duration: d[0] * 1000 + d[1] / 1000000,
      });
    };
    if (funcOrPromise instanceof Function) {
      try {
        funcOrPromise = funcOrPromise();
      } catch (e) {
        // If this is a sync function that throws, we let it...
        // We just remember to call done() afterwards
        done();
        throw e;
      }
    }
    Promise.resolve(funcOrPromise).then(done, done);
    return funcOrPromise;
  }

  /**
   * Given a function that operates on a single message, this will wrap it such
   * that it will time itself.
   */
  timedHandler(name, handler) {
    return async (message) => {
      const start = process.hrtime();
      let success = 'success';
      try {
        await handler(message);
      } catch (e) {
        success = 'error';
        throw e;
      } finally {
        const d = process.hrtime(start);
        this.log.handlerTimer({
          name,
          status: success,
          duration: d[0] * 1000 + d[1] / 1000000,
        });
      }
    };
  }

  /**
   * Given an express api method, this will time it
   * and report via the monitor.
   */
  expressMiddleware(name) {
    return (req, res, next) => {
      let sent = false;
      const start = process.hrtime();
      const send = () => {
        try {
          // Avoid sending twice
          if (sent) {
            return;
          }
          sent = true;

          const d = process.hrtime(start);

          this.log.expressTimer({
            name,
            statusCode: res.statusCode,
            duration: d[0] * 1000 + d[1] / 1000000,
          });
        } catch (err) {
          this.reportError(err);
        }
      };
      res.once('finish', send);
      res.once('close', send);
      next();
    };
  }

  /*
   * Simply return a Timekeeper object
   */
  timeKeeper(name) {
    return new TimeKeeper(this, name);
  }

  /**
   * Patch an AWS service (an instance of a service from aws-sdk)
   */
  patchAWS(service) {
    const monitor = this;
    const makeRequest = service.makeRequest;
    service.makeRequest = function(operation, params, callback) {
      const r = makeRequest.call(this, operation, params, callback);
      r.on('complete', () => {
        const requestTime = (new Date()).getTime() - r.startTime.getTime();
        monitor.log.awsTimer({
          service: service.serviceIdentifier,
          operation,
          duration: requestTime,
          region: service.config ? service.config.region : undefined,
        });
      });
      return r;
    };
  }

  /**
   * Monitor a one-shot process.  This function's promise never resolves!
   * (except in testing, with MockMonitor)
   */
  async oneShot(name, fn) {
    let exitStatus = 0;

    try {
      try {
        assert.equal(typeof name, 'string');
        assert.equal(typeof fn, 'function');

        await this.timer(name, fn);
      } catch (err) {
        this.reportError(err);
        exitStatus = 1;
      }
    } finally {
      if (this.enable && (!this.mock || this.mock.allowExit)) {
        process.exit(exitStatus);
      }
    }
  }

  /**
   * Given a process name, this will report basic
   * OS-level usage statistics like CPU and Memory
   * on a minute-by-minute basis.
   *
   * Returns a function that can be used to stop monitoring.
   */
  resources(procName, interval = 60) {
    if (this._resourceInterval) {
      clearInterval(this._resourceInterval);
    }
    let lastCpuUsage = null;
    let lastMemoryUsage = null;

    this._resourceInterval = setInterval(() => {
      lastCpuUsage = process.cpuUsage(lastCpuUsage);
      lastMemoryUsage = process.memoryUsage(lastMemoryUsage);
      this.log.resourceMetrics({lastCpuUsage, lastMemoryUsage});
    }, interval * 1000);

    return () => this.stopResourceMonitoring();
  }

  stopResourceMonitoring() {
    if (this._resourceInterval) {
      clearInterval(this._resourceInterval);
      this._resourceInterval = null;
    }
  }

  /*
   * Simple counts. Generally should no longer be used. Prefer logging
   * specific types. Counts are designed to be summed up in a time period
   * for monitoring purposes.
   */
  count(key, val) {
    val = val || 1;
    try {
      assert(typeof val === 'number', 'Count values must be numbers');
    } catch (err) {
      this.reportError(err, {key, val});
      return;
    }
    this.log.countMetric({key, val});
  }

  /*
   * Simple measures. Generally should no longer be used. Prefer logging
   * specific types. Measures are designed to have percentiles taken over
   * them for monitoring purposes.
   */
  measure(key, val) {
    try {
      assert(typeof val === 'number', 'Measure values must be numbers');
    } catch (err) {
      this.reportError(err, {key, val});
      return;
    }
    this.log.measureMetric({key, val});
  }

  /**
   * Take a standard error and break it up into loggable bits.
   *
   * * err: A string or Error object to be serialized and logged
   * * level: Kept around for legacy reasons, only added to fields
   * * extra: extra data to add to the serialized error
   *
   */
  reportError(err, level = 'err', extra = {}) {
    if (err.hasOwnProperty && !(err.hasOwnProperty('stack') || err.hasOwnProperty('message'))) {
      err = new Error(err);
    }
    if (typeof level !== 'string') {
      extra = level;
      level = 'err';
    }
    this.log.errorReport(Object.assign({}, serializeError(err), extra), {level});
  }
}

module.exports = Monitor;
