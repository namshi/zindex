/**
 * Module dependencies.
 */
var zindex = require('commander');
var commands = require('./lib/commands');
var config = require('./lib/config');

if (process.argv.indexOf('-v') > -1) {
  config.config.logger.console.level = 'debug';
}

/**
 * Configuration.
 */
zindex
  .version('1.0.0')
  .option('-v --verbosity', 'Verbose logging, if present will output debug logs');

/**
 * Register all command available in zindex.
 */
commands.register(zindex);

/**
 * Boot.
 */
zindex.parse(process.argv);

/**
 * Display the help if called without args.
 */
if (!zindex.args.length) {
  zindex.help();
}

module.exports = zindex;
