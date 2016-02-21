var logger = include('logger');
var utils = include('utils');
var config = include('config');
var entitiesPath = config.get('indexer.entities.directory');
var _ = require('lodash');
var path = require('path');
var optionsFormatter = include('cli/options-formatter');

/**
 * Index command.
 *
 * This command will go through the entities registered
 * within the indexer and run imports on them.
 */
module.exports = {
  description: 'Bootstrap one or more backends',
  configure: function(command) {
    command.option('-E --entity [value]', 'which entity to index, you can specify a comma-separated list of entities');
  },
  action: function(options) {
    if (!options.entity) {
      logger.error('Entity name is mandatory.');
      return;
    }

    logger.info('Bootstrap:: bootstrap for ' + options.entity);

    options = optionsFormatter(options);

    utils.getDirectories(entitiesPath).then(function(dirs) {
      dirs.forEach(function(entity) {
        if (!options.entity || _.contains(options.entity, entity)) {
          var backendsPath = path.join(entitiesPath, entity, 'backends');

          utils.getFiles(backendsPath).then(function(backends) {
            logger.info('Bootstrap:: Found %d backends', backends.length);

            backends.forEach(function(backend) {
              var backendPath = path.join(backendsPath, backend);
              var bootstrapBackend = require(backendPath);
              logger.info('Bootstrap:: bootstrapping %s in backend "%s"', entity, path.basename(backend, path.extname(backend)));

              if (_.isPlainObject(bootstrapBackend)) {
                bootstrapBackend.bootstrap({
                  entity: entity
                }, function() {
                  logger.info('Bootstrap:: backend ' + entity + ' DONE.');
                });
              } else {
                logger.info('Bootstrap:: no bootstrap function found for backend "%s"', path.basename(backend, path.extname(backend)));
              }
            });
          });
        }
      });
    });

  }
};
