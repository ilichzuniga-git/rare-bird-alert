const express = require('express');
const router = express.Router();
const db = require('../db');
const { CLUSTER_RADIUS_M } = require('../clustering');

/**
 * Derive a human-readable status label from cluster data.
 * Returns { label, level } where level is 'green' | 'amber' | 'red' | 'gray'
 */
function clusterStatus(cluster) {
  const now = Date.now();
  const lastSeenMs = new Date(cluster.last_seen).getTime();
  const lastRefoundMs = cluster.last_refound_at ? new Date(cluster.last_refound_at).getTime() : null;

  // Most recent confirmed sighting: user refound report beats passive sighting
  const lastConfirmedMs = lastRefoundMs
    ? Math.max(lastSeenMs, lastRefoundMs)
    : lastSeenMs;

  const hoursAgo = (now - lastConfirmedMs) / (1000 * 60 * 60);
  const daysAgo  = hoursAgo / 24;

  const multiObserver = cluster.checklist_count >= 2 || cluster.refound_count >= 1;

  if (hoursAgo < 6) {
    return {
      label: `Continuing · ${Math.round(hoursAgo)}h ago`,
      level: 'green',
    };
  }
  if (hoursAgo < 48 && multiObserver) {
    const label = hoursAgo < 24
      ? `Continuing · ${Math.round(hoursAgo)}h ago`
      : 'Continuing · last seen yesterday';
    return { label, level: 'green' };
  }
  if (daysAgo < 3 && !multiObserver) {
    return {
      label: `Single report · ${Math.round(daysAgo)}d ago`,
      level: 'gray',
    };
  }
  if (daysAgo < 7) {
    return {
      label: `Last seen ${Math.round(daysAgo)}d ago`,
      level: 'amber',
    };
  }
  return {
    label: `May have departed · ${Math.round(daysAgo)}d ago`,
    level: 'red',
  };
}

// GET /api/clusters
// Returns all active clusters (last_seen within 28 days) with status labels
// and the lat/lng of every sighting in each cluster for the map trail.
router.get('/', async (req, res) => {
  try {
    const { rows: clusters } = await db.query(`
      SELECT c.*,
             json_agg(
               json_build_object('lat', s.lat, 'lng', s.lng, 'observed_at', s.observed_at, 'source', s.source)
               ORDER BY s.observed_at ASC
             ) FILTER (WHERE s.lat IS NOT NULL) AS sighting_pins
      FROM clusters c
      LEFT JOIN sightings s ON s.cluster_id = c.id
      WHERE c.last_seen > NOW() - INTERVAL '28 days'
      GROUP BY c.id
      ORDER BY c.last_seen DESC
    `);

    const result = clusters.map(c => ({
      ...c,
      status: clusterStatus(c),
      radius_m: CLUSTER_RADIUS_M,
    }));

    res.json({ clusters: result });
  } catch (err) {
    console.error('[GET /api/clusters]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/clusters/:id  — single cluster with full sighting trail
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT c.*,
             json_agg(
               json_build_object('lat', s.lat, 'lng', s.lng, 'observed_at', s.observed_at, 'source', s.source)
               ORDER BY s.observed_at ASC
             ) FILTER (WHERE s.lat IS NOT NULL) AS sighting_pins
      FROM clusters c
      LEFT JOIN sightings s ON s.cluster_id = c.id
      WHERE c.id = $1
      GROUP BY c.id
    `, [req.params.id]);

    if (!rows.length) return res.status(404).json({ error: 'Cluster not found' });
    res.json({ cluster: { ...rows[0], status: clusterStatus(rows[0]), radius_m: CLUSTER_RADIUS_M } });
  } catch (err) {
    console.error('[GET /api/clusters/:id]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/clusters/:id/report
// Body: { type: 'refound' | 'dipped', device_id?: string, lat?: number, lng?: number }
router.post('/:id/report', async (req, res) => {
  const { type, device_id, lat, lng } = req.body;
  if (!['refound', 'dipped'].includes(type)) {
    return res.status(400).json({ error: 'type must be "refound" or "dipped"' });
  }

  try {
    // Check cluster exists
    const { rows } = await db.query('SELECT id FROM clusters WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Cluster not found' });

    // Insert report
    await db.query(
      `INSERT INTO cluster_reports (cluster_id, type, device_id, lat, lng)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.params.id, type, device_id || null, lat || null, lng || null]
    );

    // Update cluster aggregate stats
    if (type === 'refound') {
      await db.query(
        `UPDATE clusters SET
           last_refound_at = NOW(),
           refound_count   = refound_count + 1,
           updated_at      = NOW()
         WHERE id = $1`,
        [req.params.id]
      );
    } else {
      await db.query(
        `UPDATE clusters SET
           last_dipped_at = NOW(),
           dip_count      = dip_count + 1,
           updated_at     = NOW()
         WHERE id = $1`,
        [req.params.id]
      );
    }

    // Return fresh cluster status
    const { rows: updated } = await db.query('SELECT * FROM clusters WHERE id = $1', [req.params.id]);
    res.json({ ok: true, status: clusterStatus(updated[0]) });
  } catch (err) {
    console.error('[POST /api/clusters/:id/report]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
