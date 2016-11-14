/**
 * Dependencies.
 */
var zindex = require('../zindex');
var optionsFormatter = require('../cli/options-formatter');

/**
 * Index command.
 *
 * This command will go through the entities registered
 * within the indexer and run imports on them.
 */
module.exports = {
  description: 'Indexes entities in the registered backends',
  configure: function(command) {
    command.option('-S --since [value]', 'index entities in the specified timeframe (ie. "3h")');
    command.option('-E --entity [value]', 'which entity to index, you can specify a comma-separated list of entities');
    command.option('--erp', 'forces the indexer to call the ERP if needed');
  },
  action: function(options) {
    return zindex(optionsFormatter(options));
  }
};
