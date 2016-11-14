var config = require('./config');
var logLevel = config.get('logger.general.level') || config.get('logger.console.level', {}, 'info');
var logger = require('node-nmlogger')({
  env: config.get('env'),
  level: logLevel
});

module.exports = logger;
