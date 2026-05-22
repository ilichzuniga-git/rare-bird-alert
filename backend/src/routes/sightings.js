const express = require('express');
const https = require('https');
const router = express.Router();
const db = require('../db');
const config = require('../config');

/** Minimal HTTPS GET → parsed JSON. */
function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, res => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      let body = '';
      res.on('data', c => { body += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error(`JSON parse error: ${e.message}`)); }
      });
    }).on('error', reject);
  });
}

// GET /api/sightings
// Query params:
//   region - eBird region code (e.g. 'US-CA-037'), or comma-separated list
//   limit  - max results (default 50, max 200)
//   since  - ISO 8601 timestamp; only return sightings observed after this
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 500, 500);
    const conditions = [];
    const params = [];

    if (req.query.region) {
      const codes = req.query.region.split(',').map(s => s.trim());
      params.push(codes);
      conditions.push(`region_code = ANY($${params.length})`);
    }

    if (req.query.since) {
      const since = new Date(req.query.since);
      if (isNaN(since)) {
        return res.status(400).json({ error: 'Invalid "since" date' });
      }
      params.push(since);
      conditions.push(`observed_at > $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit);

    const sql = `
      SELECT
        s.id, s.region_code, r.name AS region_name,
        s.source, s.source_id,
        s.common_name, s.scientific_name, s.species_code,
        s.lat, s.lng, s.location_name, s.location_id,
        s.observed_at, s.how_many, s.rarity_count, s.photo_url, s.photo_attribution,
        s.notes, s.cluster_id, s.created_at
      FROM sightings s
      JOIN regions r ON r.code = s.region_code
      ${where}
      ORDER BY s.observed_at DESC
      LIMIT $${params.length}
    `;

    const { rows } = await db.query(sql, params);
    res.json({ sightings: rows, count: rows.length });
  } catch (err) {
    console.error('[GET /api/sightings]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/sightings/regions - list all available regions
router.get('/regions', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT code, name, enabled FROM regions ORDER BY name'
    );
    res.json({ regions: rows });
  } catch (err) {
    console.error('[GET /api/sightings/regions]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/sightings/:id/comments
// Returns observer notes + community comments for a single sighting.
// Unified response shape:
//   { source, observer_note: string|null, comments: [{author, text, created_at}] }
router.get('/:id/comments', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT source, source_id, species_code FROM sightings WHERE id = $1',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Sighting not found' });

    const { source, source_id, species_code } = rows[0];

    // Guard: if source_id is missing we can't fetch from upstream
    if (!source_id) {
      return res.json({ source, observer_note: null, comments: [] });
    }

    // ── eBird ──────────────────────────────────────────────────────────────────
    if (source === 'ebird') {
      try {
        const data = await httpsGet(
          `https://api.ebird.org/v2/product/checklist/view/${source_id}`,
          { 'X-eBirdApiToken': config.ebird.apiKey }
        );

        const obs = (data.obs || []).find(o => o.speciesCode === species_code);
        const observer_note = obs?.comments?.trim() || null;

        const submitterName = data.userDisplayName || 'Observer';
        const clComments = (data.comments || [])
          .filter(c => typeof c === 'string' && c.trim())
          .map(text => ({ author: submitterName, text: text.trim(), created_at: null }));

        return res.json({ source: 'ebird', observer_note, comments: clComments });
      } catch (ebirdErr) {
        console.warn(`[comments] eBird fetch failed for ${source_id}:`, ebirdErr.message);
        return res.json({ source: 'ebird', observer_note: null, comments: [] });
      }
    }

    // ── iNaturalist ────────────────────────────────────────────────────────────
    if (source === 'inaturalist') {
      try {
        const data = await httpsGet(
          `https://api.inaturalist.org/v1/observations/${source_id}`,
          { 'User-Agent': 'RareBirdAlertApp/1.0', 'Accept': 'application/json' }
        );

        const obs = data.results?.[0];
        if (!obs) return res.json({ source: 'inaturalist', observer_note: null, comments: [] });

        const observer_note = obs.description?.trim() || null;
        const comments = (obs.comments || []).map(c => ({
          author: c.user?.login || 'iNaturalist user',
          text:   c.body?.trim() || '',
          created_at: c.created_at || null,
        })).filter(c => c.text);

        return res.json({ source: 'inaturalist', observer_note, comments });
      } catch (inatErr) {
        console.warn(`[comments] iNat fetch failed for ${source_id}:`, inatErr.message);
        return res.json({ source: 'inaturalist', observer_note: null, comments: [] });
      }
    }

    // Unknown source
    return res.json({ source, observer_note: null, comments: [] });

  } catch (err) {
    console.error(`[GET /api/sightings/${req.params.id}/comments]`, err.message);
    // Return empty rather than a 500 so the mobile shows "no notes" not an error
    res.json({ source: 'unknown', observer_note: null, comments: [] });
  }
});

module.exports = router;
