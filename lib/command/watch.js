var optionsFormatter = include('cli/options-formatter');
var config = include('config');
var defaultInterval = config.get('watcher.defaultInterval');
var logger = include('logger');
var fs = require('fs');
var path = require('path');
var watchersDirectory = config.get('dirs.watchers') || path.join(config.get('dirs.base') || config.get('rootDir'), 'watchers');
var _ = require('lodash');
var notifier = include('notifier');
var watchers = [];

if (!fs.existsSync(watchersDirectory)) {
  logger.warn('Cannot find watchers\'s directory: ' + watchersDirectory + '. No watcher will be avvailable');
}

try {
  watchers = _.map(fs.readdirSync(watchersDirectory), function(watcher) {
    return watcher.replace('.js', '');
  });
} catch(error) {
  logger.debug('Unable to access watchers dir: ' + error.message);
}

function validateRequestedEntities(entities) {
  return _.filter(entities, function(entity) {
    if (watchers.indexOf(entity) < 0) {
      logger.warn('Requested entity "' + entity + '" has no available watcher, skipping it.');
    } else {
      return entity;
    }
  });
}

function launchWatcher(name, options) {
  var watcher = require(watchersDirectory + '/' + name);

  watcher.entity = watcher.entity || name;

  options = {
    entity: watcher.entity,
    priority: options.priority || 0,
    interval: options.interval || null
  };

  var messenger = notifier(options);

  logger.info('Launching watcher: ' + watcher.entity);
  watcher.watch(options, function(key, message, priority) {
    messenger.notify(key, message, priority);
  });
}

function run(options) {
  var validEntities = validateRequestedEntities(options.entity);

  if (validEntities.length < 1) {
    validEntities = watchers;
  }

  if (validEntities.length > 1) {
    logger.warn('You are launching more than one watcher within this process (' + validEntities.join(', ') + '). This might not be a wise thing to do!');
  }

  _.forEach(validEntities, function(name) {
    launchWatcher(name, options);
  });
}

module.exports = {
  configure: function(command) {
    command.option('-E --entity <entity,entity,...>', 'One or more entities to watch, comma separated');
    command.option('-I --interval [value]', 'interval between checks (ie. "3m")');
  },
  action: function(options) {
    options.interval = options.interval || defaultInterval;
    run(optionsFormatter(options));
  }
};
