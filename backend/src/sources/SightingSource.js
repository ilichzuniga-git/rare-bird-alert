/**
 * Abstract base class for sighting data sources.
 * Each adapter must implement fetchSightings(regionCode) and return an array
 * of normalized sighting objects.
 */
class SightingSource {
  constructor(name) {
    if (new.target === SightingSource) {
      throw new Error('SightingSource is abstract — extend it.');
    }
    this.name = name;
  }

  /**
   * Fetch recent notable sightings for a region.
   * @param {string} regionCode  e.g. 'US-CA-037'
   * @returns {Promise<NormalizedSighting[]>}
   */
  async fetchSightings(regionCode) { // eslint-disable-line no-unused-vars
    throw new Error(`${this.name}.fetchSightings() not implemented`);
  }
}

/**
 * @typedef {Object} NormalizedSighting
 * @property {string}  source         Source name (e.g. 'ebird')
 * @property {string}  source_id      Source's unique observation ID
 * @property {string}  region_code    eBird region code
 * @property {string}  common_name
 * @property {string}  [scientific_name]
 * @property {string}  [species_code]
 * @property {number}  [lat]
 * @property {number}  [lng]
 * @property {string}  [location_name]
 * @property {Date}    observed_at
 * @property {number}  [how_many]
 */

module.exports = SightingSource;
