const https = require('https');
const SightingSource = require('./SightingSource');
const config = require('../config');
const db = require('../db');

const INAT_BASE = 'https://api.inaturalist.org/v1';

// iNaturalist taxon ID for class Aves (all birds)
const AVES_TAXON_ID = 3;

/**
 * Fetches rare, research-grade bird sightings from the iNaturalist API.
 *
 * "Verified" = quality_grade=research (community-confirmed: 2+ agreeing IDs)
 * "Rare"     = species with fewer than RARITY_THRESHOLD total research-grade
 *              observations in the place (configurable via INAT_RARITY_THRESHOLD)
 *
 * Docs: https://api.inaturalist.org/v1/docs/
 *
 * No API key is required for read-only requests (rate limit: 100 req/min).
 */
class INaturalistSource extends SightingSource {
  constructor() {
    super('inaturalist');
    this.rarityThreshold = config.inaturalist.rarityThreshold;
    this.lookbackDays    = config.inaturalist.lookbackDays;
  }

  /**
   * Fetch rare, research-grade bird sightings for a region.
   *
   * Three-step approach:
   *   1. All-time species counts → Map<taxon_id, all_time_count>
   *   2. Recent species counts (last lookbackDays) → which species appeared lately
   *   3. Intersection: recently-seen species whose all-time count < threshold
   *   4. Fetch actual observations of only those species
   *
   * This avoids the "needle in a haystack" problem of fetching 200 generic
   * recent observations that are dominated by common birds.
   *
   * @param {string} regionCode  e.g. 'US-CA-037'
   * @returns {Promise<NormalizedSighting[]>}
   */
  async fetchSightings(regionCode) {
    const { rows } = await db.query(
      'SELECT inat_place_id FROM regions WHERE code = $1',
      [regionCode]
    );
    const placeId = rows[0]?.inat_place_id;
    if (!placeId) {
      console.warn(`[inat] No inat_place_id set for region ${regionCode} — skipping.`);
      return [];
    }

    const d1Str = this._daysAgo(this.lookbackDays);

    // Step 1: all-time rarity map for this place
    const allTimeMap = await this._getAllTimeSpeciesCounts(placeId);

    // Step 2: which species have been seen recently?
    const recentSpecies = await this._getRecentSpeciesCounts(placeId, d1Str);

    // Step 3: keep only species that are rare by all-time count
    const rareRecentIds = recentSpecies
      .map(s => s.taxon?.id)
      .filter(id => id != null && (allTimeMap.get(id) ?? Infinity) < this.rarityThreshold);

    if (rareRecentIds.length === 0) {
      console.log(`[inat] ${regionCode}: no rare species observed in the last ${this.lookbackDays} days.`);
      return [];
    }

    console.log(`[inat] ${regionCode}: ${rareRecentIds.length} rare species seen recently — fetching observations.`);

    // Step 4: fetch actual observations of those specific rare species
    const observations = await this._getObservationsForTaxa(placeId, rareRecentIds, d1Str);

    return observations.map(obs => this._normalize(obs, regionCode, allTimeMap));
  }

  /** Returns a Map<taxon_id, all_time_count> for all bird species in the place. */
  async _getAllTimeSpeciesCounts(placeId) {
    const url = [
      `${INAT_BASE}/observations/species_counts`,
      `?place_id=${placeId}`,
      `&taxon_id=${AVES_TAXON_ID}`,
      `&quality_grade=research`,
      `&captive=false`,
      `&per_page=500`,
    ].join('');

    const data = await this._get(url);
    const map = new Map();
    for (const item of (data.results || [])) {
      if (item.taxon?.id != null) map.set(item.taxon.id, item.count);
    }
    return map;
  }

  /** Returns the list of species observed in this place since d1Str. */
  async _getRecentSpeciesCounts(placeId, d1Str) {
    const url = [
      `${INAT_BASE}/observations/species_counts`,
      `?place_id=${placeId}`,
      `&taxon_id=${AVES_TAXON_ID}`,
      `&quality_grade=research`,
      `&captive=false`,
      `&d1=${d1Str}`,
      `&per_page=500`,
    ].join('');

    const data = await this._get(url);
    return data.results || [];
  }

  /**
   * Fetch observations for a specific list of taxon IDs.
   * Uses taxon_id[] array parameters so we get only the rare species.
   */
  async _getObservationsForTaxa(placeId, taxonIds, d1Str) {
    const taxonParams = taxonIds.map(id => `taxon_id[]=${id}`).join('&');
    const url = [
      `${INAT_BASE}/observations`,
      `?place_id=${placeId}`,
      `&${taxonParams}`,
      `&quality_grade=research`,
      `&captive=false`,
      `&d1=${d1Str}`,
      `&order_by=observed_on`,
      `&order=desc`,
      `&per_page=200`,
    ].join('');

    const data = await this._get(url);
    return data.results || [];
  }

  /** Returns a YYYY-MM-DD string for N days ago. */
  _daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  }

  /**
   * Normalize an iNaturalist observation into the shared NormalizedSighting shape.
   * @param {object} obs         Raw iNaturalist observation
   * @param {string} regionCode
   * @param {Map}    allTimeMap  Map<taxon_id, all_time_count> from _getAllTimeSpeciesCounts
   */
  _normalize(obs, regionCode, allTimeMap) {
    const taxon = obs.taxon || {};
    const coords = obs.location ? obs.location.split(',').map(Number) : [null, null];

    return {
      source:          this.name,
      source_id:       String(obs.id),
      region_code:     regionCode,
      common_name:     taxon.preferred_common_name || taxon.name || 'Unknown',
      scientific_name: taxon.name || null,
      species_code:    null,   // iNaturalist has no eBird species code
      lat:             coords[0] || null,
      lng:             coords[1] || null,
      location_name:   obs.place_guess || null,
      observed_at:     new Date(obs.time_observed_at || obs.observed_on),
      how_many:        null,   // iNaturalist records presence, not count
      rarity_count:    allTimeMap?.get(taxon.id) ?? null,
      photo_url:       taxon.default_photo?.square_url ?? null,
    };
  }

  /**
   * HTTP GET helper — returns parsed JSON body.
   * Sends a descriptive User-Agent per iNaturalist API guidelines.
   */
  _get(url) {
    return new Promise((resolve, reject) => {
      const options = {
        headers: {
          'User-Agent': 'RareBirdAlertApp/1.0 (contact: see project README)',
          'Accept': 'application/json',
        },
      };
      https.get(url, options, res => {
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`iNaturalist API returned ${res.statusCode} for ${url}`));
        }
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(new Error(`iNaturalist response parse error: ${e.message}`));
          }
        });
      }).on('error', reject);
    });
  }
}

module.exports = INaturalistSource;
