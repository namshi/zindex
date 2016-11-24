var path = require('path');
var fs = require('fs');
var _ = require('lodash');
var logger = require('./logger');
var config = require('./config');
var utils = require('./utils');

var entitiesPath = config.get('dirs.indexers') || path.join(config.get('dirs.base') || config.get('rootDir'), 'indexers');
var hl = require('highland');
var lockFile = require('lockfile');
var lockingFile = require('path').join(config.get('rootDir'), config.get('lockfile.name') || 'zindex.lock');

function lock() {
  console.log('Lock:: lockfile');
  try {
    lockFile.lockSync(locki);
  } catch (err) {
    var isLockValid = lockFile.checkSync(lockingFile, {
      stale: config.get('lockfile.expire')
    });

    if (!isLockValid) {
      console.log('Stale lockfile, deleting and recreating');
      lockFile.unlockSync(lockingFile);
      lock();
      return;
    }

    console.log('Lockfile detected. Another instance of Zindex is running at this time. If this is not the case, please delete the lockfile');
    process.exit();
  }
}

if (!fs.existsSync(entitiesPath)) {
  logger.warn('Cannot find indexers\'s directory: ' + entitiesPath + '. No indexer will be avvailable');
}

/**
 * Converts the data stream in a reactive object
 * ans invokes a formatter, if present, that formats
 * the data.
 *
 * The formatter needs to be a function in a file
 * called formatter.js, per-entity.
 */
function transform(data, options) {
  logger.debug('Indexer:: transform, loading data in Higlands, Options: ' + JSON.stringify(options));

  return new Promise(function(resolve, reject) {
    if (!(data instanceof Promise)) {
      data = utils.wrapInPromise(data);
    }

    data.then(function(result) {
      /*
       !!! from this point on our data
       will be encapsulated in an HL object
       */
      var collection = hl(result);
      var transformed = null;

      try {
        logger.debug('Indexer:: transform:: Loading transformer: ' + path.join(entitiesPath, options.entity, 'transformer'));
        var transformer = {
          transform: require(path.join(entitiesPath, options.entity, 'transformer'))
        };
        transformed = transformer.transform(collection, options);

        if (transformed === undefined) {
          reject(new Error('Your transformer needs to return an observable. (just `return data.map([...]);` if you don\'t know what to do)'));
          return;
        }

        resolve(transformed);
      } catch (err) {
        logger.warn('Indexer:: transform:: Warning: ' + err);
        resolve(collection);
      }
    });
  });
}

/**
 * Returns the backend options.
 * @param entity
 * @param options
 * @returns Object
 */
function getBackendOptions(entity, options) {
  return {
    entity: entity,
    realtime: (options.realtime || false),
    fullImport: (options.fullImport || false)
  };
}

/**
 * Indexes the entity data into the registered
 * backends once the data have been transformed.
 */
function indexIntoBackends(entity, data, options) {
  logger.debug('Indexer:: indexing Into Backends');
  var backendsPath = path.join(entitiesPath, entity, 'backends');

  options = getBackendOptions(entity, options);

  return utils.getFiles(backendsPath).then(function(backends) {
    logger.debug('Indexer:: Found %d backends', backends.length);

    logger.debug('Indexer:: indexIntoBackends:: promise resolved, going for transform... options: ' + JSON.stringify(data.options));
    options = _.merge(options, data.options);

    return transform(data.data, options).then(function(observable) {
      logger.debug('Indexer:: indexIntoBackends:: transformation happened, indexing into backends: ', backends);
      var promises = [];

      backends.forEach(function(backend) {
        var backendPath = path.join(backendsPath, backend);
        var indexIntoBackend = require(backendPath);
        logger.info('Indexer:: Indexing %s in backend "%s"', entity, path.basename(backend, path.extname(backend)));

        if (typeof indexIntoBackend === 'object') {
          promises.push(indexIntoBackend.index(observable.fork(), options));
        } else {
          /*
           !!! forking our HL observable for each backend
           */
          promises.push(indexIntoBackend(observable.fork(), options));
        }
      });

      return Promise.all(promises);
    });
  });
}

/**
 * Loads data for a given entity.
 */
function loadData(entity, options) {
  logger.debug('Indexer:: Load Data');
  var source = require(path.join(entitiesPath, entity, 'source'))(options);

  return source;
}

/**
 * Indexes an entity, loading data from its source
 * and indexing it into the backends.
 *
 * @todo we should refactor this so that if you want
 * to return an array or a stream from the source.js
 * you can. Currently you need to return a promise or
 * an array of promises (ie. shops.js).
 */
function indexEntity(entity, options) {
  logger.debug('Indexer:: indexing Entity');
  var sources = loadData(entity, options);
  var promises = [];

  if (!_.isArray(sources)) {
    sources = [sources];
  }

  sources.forEach(function(source) {
    promises.push(indexIntoBackends(entity, source, options));
  });

  return Promise.all(promises);
}

/**
 * Loops through the entities and indexes them.
 */
function indexEntities(options) {
  logger.debug('Indexer:: indexing Entities: ' + options.entity);
  return utils.getDirectories(entitiesPath).then(function(dirs) {
    var promises = [];
    dirs.forEach(function(entity) {
      if (!options.entity || _.includes(options.entity, entity)) {
        promises.push(indexEntity(entity, options));
      }
    });

    return Promise.all(promises);
  });
}

/**
 * Give some feedback when the indexer is done
 * importing everything.
 */
var time = new Date().getTime();

if (process.env.CRON_SCHEDULE) {
  lock();
}

if (process.argv.indexOf('-v') > -1) {
  config.config.logger.console.level = 'debug';
}

process.on('exit', function() {
  lockFile.unlockSync(lockingFile);
  logger.info('Indexer:: The indexer has finished running in %ssec', (new Date().getTime() - time) / 1000);
});

module.exports = function(options) {
  !options.realtime && logger.info('Indexer:: Starting to index...');

  options.fullImport = !(options.realtime || options.since);
  return indexEntities(options).then((res) => {
    logger.info('Indexer:: The indexer has finished running in %ssec', (new Date().getTime() - time) / 1000);

    return lockFile.unlockSync(lockingFile);
  });
};
