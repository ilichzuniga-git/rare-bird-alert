const config = require('../config');
const EbirdSource = require('./EbirdSource');

/**
 * Returns all enabled data-source adapters.
 * Add new sources here as they are implemented.
 */
function getSources() {
  const sources = [];
  if (config.ebird.enabled) {
    sources.push(new EbirdSource());
  }
  return sources;
}

module.exports = { getSources };
