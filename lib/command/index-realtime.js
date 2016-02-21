/**
 * Dependencies.
 */
var logger = include('logger');
var indexer = include('command/index');
var amqp = include('storages/amqp');
var _ = require('lodash');

/**
 * Validates the options passed to this command.
 */
function validateOptions(options) {
  if (!options.entity || !options.priority) {
    logger.error('You must specify entity AND priority for this command (ie. --entity products --priority 2)');
    logger.error('Run this command with the --help flag for some doc');
    process.exit(1);
  }
}

/**
 * Handles an amqp message.
 * Pay attention: if we send a string or a number,
 * our content sill be contained in the data property of
 * the `message` object and it will be a `Buffer`.
 * In order to get our content we will need to call `toString()`
 * on the data `Buffer`.
 * If the message is a normal object we'll simply merge it with
 * our actionOption and carry on
 *
 * refer to : http://nodejs.org/api/buffer.html
 * for further information about buffers.
 *
 * @param {Object} message
 * @param {String} entity
 */
function handleMessage(message, entity) {
  var actionOptions = {
    entity: entity,
    realtime: true
  };

  if (message.data && Buffer.isBuffer(message.data)) {
    actionOptions.id = message.data.toString('utf-8');
  } else {
    _.merge(actionOptions, message);
  }

  logger.info('IndexRealtime:: Received a message to index the ' + entity + ' with options: ' + JSON.stringify(actionOptions));

  indexer.action(actionOptions);
}

/**
 * Realtime indexing command.
 *
 * This command will listen to AMQP messages to
 * index updated entities in realtime.
 */
module.exports = {
  description: 'listens for AMQP messages to index updated entities',
  configure: function(command) {
    command.option('-E --entity <entity>', 'which entity will be receive messages for');
    command.option('-P --priority <priority>', 'defines on which priority queue we will listen to (0..9), zero being lowest priority');
  },
  action: function(options) {
    validateOptions(options);

    logger.info('Waiting to receive updates for %s', options.entity);

    amqp.listen(options).then(function() {
      amqp.queue.subscribe(function(message) {
        handleMessage(message, options.entity);
      });
    }).catch(function(error) {
      logger.error('IndexRealtime:: connection error: ' + JSON.stringify(error));
      process.exit(1);
    });
  }
};
