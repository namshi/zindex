/**
 * Dependencies.
 */
var utils = include('utils');

/**
 * Option parser: this module provides
 * a way to enrich cli-passed options.
 *
 * For example, timeframes like "3h"
 * get converted to datetime objects.
 */
module.exports = function(options) {
  options = options || {};

  if (options.interval) {
    options.interval = utils.stringToMoment(options.interval);
  }

  if (options.since) {
    options.since = utils.stringToMoment(options.since);
  }

  if (options.entity) {
    options.entity = options.entity.split(',');
  }

  return options;
};
