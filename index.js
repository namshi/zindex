/**
 * Adds the ability to not specify relative
 * paths in local require('./../../bah').
 *
 * You can just use include('bah');
 */
global.include = function(path) {
  return require(require('path').join(__dirname, 'lib', path));
};

/**
 * Module dependencies.
 */
var zindex = require('commander');
var commands = include('commands');
var config = include('config');
var lockFile = require('lockfile');
var config = require('./lib/config');

global.lockfile = require('path').join(config.get('rootDir'), config.get('lockfile.name') || 'zlib.lock');

function lock() {
  console.log('Lock:: lockfile');
  try {
    lockFile.lockSync(global.lockfile);
  } catch (err) {
    var isLockValid = lockFile.checkSync(global.lockfile, {
      stale: config.get('lockfile.expire')
    });

    if (!isLockValid) {
      console.log('Stale lockfile, deleting and recreating');
      lockFile.unlockSync(global.lockfile);
      lock();
      return;
    }

    console.log('Lockfile detected. Another instance of Zindex is running at this time. If this is not the case, please delete the lockfile');
    process.exit();
  }
}

if (process.env.CRON_SCHEDULE) {
  lock();
}

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
