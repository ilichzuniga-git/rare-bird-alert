const express = require('express');
const router = express.Router();
const db = require('../db');

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
        s.notes, s.created_at
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

module.exports = router;
