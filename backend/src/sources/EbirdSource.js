const https = require('https');
const SightingSource = require('./SightingSource');
const config = require('../config');

const EBIRD_BASE = 'https://api.ebird.org/v2';

/**
 * Fetches notable sightings from the eBird API v2.
 * Docs: https://documenter.getpostman.com/view/664302/S1ENwy59
 */
class EbirdSource extends SightingSource {
  constructor() {
    super('ebird');
  }

  /**
   * GET /v2/data/obs/{regionCode}/recent/notable
   * Returns up to 100 notable observations from the past 14 days.
   */
  async fetchSightings(regionCode) {
    const url = `${EBIRD_BASE}/data/obs/${regionCode}/recent/notable?detail=full&maxResults=100`;
    const raw = await this._get(url);
    return raw.map(obs => this._normalize(obs, regionCode));
  }

  _normalize(obs, regionCode) {
    return {
      source:          this.name,
      source_id:       obs.subId,
      region_code:     regionCode,
      common_name:     obs.comName,
      scientific_name: obs.sciName || null,
      species_code:    obs.speciesCode || null,
      lat:             obs.lat != null ? parseFloat(obs.lat) : null,
      lng:             obs.lng != null ? parseFloat(obs.lng) : null,
      location_name:   obs.locName || null,
      observed_at:     new Date(obs.obsDt.replace(' ', 'T')),
      how_many:        obs.howMany != null ? parseInt(obs.howMany, 10) : null,
      rarity_count:    null, // eBird already filters to notable — no numeric count needed
      photo_url:       null, // lazy-loaded in the mobile app via iNaturalist taxa API
    };
  }

  _get(url) {
    return new Promise((resolve, reject) => {
      const options = {
        headers: { 'X-eBirdApiToken': config.ebird.apiKey },
      };
      https.get(url, options, res => {
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`eBird API returned ${res.statusCode} for ${url}`));
        }
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(new Error(`eBird response parse error: ${e.message}`));
          }
        });
      }).on('error', reject);
    });
  }
}

module.exports = EbirdSource;
