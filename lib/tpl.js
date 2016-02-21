/**
 * Deps
 */
var swig = require('swig');
var fs = require('fs');

var cache = {};

/**
 * * Exports a simple function that parses
 * a file at the specified path as a swig
 * template.
 * It will cache the template once loaded
 *
 * @param {String} src
 * @param {Object} options
 * @returns {string}
 */
module.exports = function(src, options) {
  if (cache[src] === undefined) {
    cache[src] = fs.readFileSync(src).toString();
  }

  return swig.render(cache[src], {
    locals: options
  });
};
