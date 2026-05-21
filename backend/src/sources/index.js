const config = require('../config');
const EbirdSource = require('./EbirdSource');
const INaturalistSource = require('./INaturalistSource');

/**
 * Returns all enabled data-source adapters.
 * Add new sources here as they are implemented.
 */
function getSources() {
  const sources = [];
  if (config.ebird.enabled) {
    sources.push(new EbirdSource());
  }
  if (config.inaturalist.enabled) {
    sources.push(new INaturalistSource());
  }
  return sources;
}

module.exports = { getSources };
