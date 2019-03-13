const os = require('os');
const assert = require('assert');
const chalk = require('chalk');
const stringify = require('fast-json-stable-stringify');

const LEVELS = {
  emerg: 0,
  alert: 1,
  crit: 2,
  err: 3,
  warning: 4,
  notice: 5,
  info: 6,
  debug: 7,
};

const LEVELS_REVERSE = [
  'EMERGENCY',
  'ALERT',
  'CRITICAL',
  'ERROR',
  'WARNING',
  'NOTICE',
  'INFO',
  'DEBUG',
];

const LEVELS_REVERSE_COLOR = [
  chalk.red.bold('EMERGENCY'),
  chalk.red.bold('ALERT'),
  chalk.red.bold('CRITICAL'),
  chalk.red('ERROR'),
  chalk.yellow('WARNING'),
  chalk.blue('NOTICE'),
  chalk.green('INFO'),
  chalk.magenta('DEBUG'),
];

/*
 * Implements the mozlog standard as defined in
 * https://wiki.mozilla.org/Firefox/Services/Logging
 *
 * We can consider supporting extra logging standards
 * later if we want.
 */
class Logger {
  constructor({name, service, level, pretty=false, destination=process.stdout, metadata=null, gitVersion=undefined}) {
    assert(name, 'Must specify Logger name.');

    this.name = name;
    this.service = service;
    this.destination = destination;
    this.pretty = pretty;
    this.metadata = Object.keys(metadata).length > 0 ? metadata : null;
    this.pid = process.pid;
    this.hostname = os.hostname();
    this.gitVersion = gitVersion;

    level = level.trim().toLowerCase();
    assert(LEVELS[level] !== undefined, `Error levels must correspond to syslog severity levels. ${level} is invalid.`);
    this.level = LEVELS[level];
  }

  _log(level, type, fields) {
    if (level > this.level) {
      return;
    }

    if (fields === undefined) {
      fields = type;
      type = 'monitor.generic';
    }
    if (typeof fields === 'string' || typeof fields === 'number') {
      fields = {message: fields};
    }

    if (fields === null || typeof fields === 'boolean') {
      level = LEVELS['err'];
      const origType = type;
      type = 'monitor.loggingError',
      fields = {
        error: 'Invalid field to be logged.',
        origType,
        orig: fields,
      };
    }
    if (fields.meta !== undefined) {
      level = LEVELS['err'];
      const origType = type;
      type = 'monitor.loggingError',
      fields = {
        error: 'You may not set meta fields on logs directly.',
        origType,
        orig: fields,
      };
    }

    if (this.metadata) {
      fields.meta = this.metadata;
    }

    let message = fields.stack || fields.message;

    if (this.pretty) {
      message = message ? message.toString().replace(/\n/g, '\\n') : '';
      const extra = Object.keys(fields).reduce((s, f) => {
        if (f !== 'msg') {
          s = s + `\n\t${f}: ${fields[f].toString().replace(/\n/g, '\\n')}`;
        }
        return s;
      }, '');
      const line = chalk`${(new Date()).toJSON()} ${LEVELS_REVERSE_COLOR[level]} (${type}): {blue ${message}}{gray ${extra}}\n`;
      this.destination.write(line);
    } else {
      this.destination.write(stringify({
        Timestamp: Date.now() * 1000000,
        Type: type,
        Logger: this.name,
        Hostname: this.hostname,
        EnvVersion: '2.0',
        Severity: level,
        Pid: this.pid,
        Fields: fields,
        message, // will be omitted if undefined
        severity: LEVELS_REVERSE[level], // for stackdriver
        serviceContext: { // for stackdriver
          service: this.service,
          version: this.gitVersion,
        },
      }) + '\n');
    }
  }

  emerg(type, fields) {
    this._log(LEVELS['emerg'], type, fields);
  }

  alert(type, fields) {
    this._log(LEVELS['alert'], type, fields);
  }

  crit(type, fields) {
    this._log(LEVELS['crit'], type, fields);
  }

  err(type, fields) {
    this._log(LEVELS['err'], type, fields);
  }

  warning(type, fields) {
    this._log(LEVELS['warning'], type, fields);
  }

  notice(type, fields) {
    this._log(LEVELS['notice'], type, fields);
  }

  info(type, fields) {
    this._log(LEVELS['info'], type, fields);
  }

  debug(type, fields) {
    this._log(LEVELS['debug'], type, fields);
  }
}

module.exports = {Logger, LEVELS};
