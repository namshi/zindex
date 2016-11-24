/**
 * Dependencies, it includes the node's util lib.
 */
var path = require('path');
var fs = require('fs');
var _ = require('lodash');
var utils = require('util');
var moment = require('moment');

/**
 * Returns all files in the specified directory.
 */
utils.getFiles = function(directory) {
  return utils.getResources(directory, function(stat) {
    return stat.isFile();
  });
};

/**
 * Returns all directories in the specified directory.
 */
utils.getDirectories = function(directory) {
  return utils.getResources(directory, function(stat) {
    return stat.isDirectory();
  });
};

/**
 * Returns all filesystem resources in the specified
 * directory.
 *
 * If a filter function is specified, it will be used
 * to filter resources -- the callback receives a stat
 * instance of each resource in the directory.
 */
utils.getResources = function(directory, filter) {
  return new Promise(function(resolve, reject) {
    fs.readdir(directory, function(err, resources) {
      if (err) {
        var logger = require('./logger');
        logger.error('You are requesting files inside ' + directory + ' but the directory doesn\'t exist');
        logger.error('Perhaps you are trying to setup new sources / backends? Then create that folder ;-)');

        reject(err);
      }

      if (filter) {
        var files = [];

        resources.forEach(function(resource) {
          var stat = fs.lstatSync(path.join(directory, resource));

          if (filter(stat)) {
            files.push(resource);
          }
        });

        resolve(files);
      } else {
        resolve(resources);
      }
    });
  });
};

/**
 * Checks if the given instance has the needed properties set.
 * It will cause a crash (throw) if one of them is missing.
 * It bails out at the 1st error.
 *
 * @param {object} instance
 * @param {array | string} requires
 */
utils.checkRequires = function(instance, requires) {
  requires = (_.isArray(requires)) ? requires : [requires];

  requires.forEach(function(requirement) {
    if (!instance.hasOwnProperty(requirement) || instance[requirement] === undefined || instance[requirement] === null) {
      var constructorName = (instance.constructor.name !== 'Object') ? '(' + instance.constructor.name + ') ' : '';

      throw new Error('The object ' + constructorName + 'needs to have "' + requirement + '" correctly set or it will not run!!!!\n' + 'Please check your code and be sure you correctly called it\'s constructor or it\'s init method.\n' + 'Check the following stack trace, around line 4, for a hint on where it happens: \n');
    }
  });
};

/**
 * Gets a prototype based objects and returns an
 * and extension
 *
 * @param {Object} ancestor
 * @returns {Object}
 */
utils.extend = function(ancestor) {
  var descendant = function() {
    ancestor.apply(this, arguments);
  };

  utils.inherits(descendant, ancestor);

  return descendant;
};

/**
 * Parse a string (ex: 5m) to a moment object
 *
 * @param string
 * @returns {object}
 */
utils.stringToMoment = function(string) {
  var stringParts = string.match(/[a-zA-Z]+|[0-9]+/g);
  if (!stringParts[1]) {
    stringParts[1] = 's';
  }

  return moment().subtract(stringParts[0], stringParts[1]);
};

/**
 * Return an interval in milliseconds
 * It receives a moment() object and calculates it distance
 * from the given Date() object. If no date is provided
 * it will calculate the interval from 'now'.
 *
 * @param {object} interval
 * @param {object} date
 * @returns {number}
 */
utils.getInterval = function(interval, date) {
  date = date || new Date();
  var intervalTimestamp = interval.unix();
  var now = parseInt((date.getTime() / 1000), 10);

  interval = ((now - intervalTimestamp) * 1000);

  return interval;
};

/**
 * I got annoyed of the `indexOf` thingy
 *
 * @param target
 * @param subject
 * @returns {*|boolean}
 */
utils.contains = function(target, subject) {
  return (target && target.indexOf(subject) > -1);
};

/**
 * Transforms a list of objects to a a series
 * of arrays convenient for bulk query generation
 * and extracts the fields list.
 *
 * The node-mysql driver is able to run bulk queries
 * if you provide the fields to update and a list of
 * values:
 *
 * - [name, last_name], [[alex, nadalin], [luciano, colosio]]
 *
 * Since we deal with list of entities in the form of
 * [name: alex, last_name: nadalin] we need to restructure
 * the data a bit before feeding it to the driver.
 *
 * @param entities
 * @returns {Object}
 */
utils.prepareForBulkQuery = function(entities) {
  var fields = Object.keys(entities[0]);

  var list = _.map(entities, function(entity) {
    var values = [];

    fields.forEach(function(fieldName) {
      values.push(entity[fieldName]);
    });

    return values;
  });

  var fieldsUpdateString = _.map(fields, function(field) {
    return field + '=VALUES(' + field + ')';
  }).join(',');

  return {
    list: [list],
    fields: fields.join(','),
    updateString: fieldsUpdateString
  };
};

/**
 * Takes a general value argument and wraps it into a resolved promise
 *
 * @param  {Any} value
 * @return {Promise}
 */
utils.wrapInPromise = function(value) {
  return new Promise(function(resolve) {
    resolve(value);
  });
};

/**
 * Exports.
 */
module.exports = utils;
