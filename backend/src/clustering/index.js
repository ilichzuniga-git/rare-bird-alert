const db = require('../db');

const CLUSTER_RADIUS_M = 250;

/**
 * Haversine distance in metres between two lat/lng points.
 */
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6_371_000;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

/**
 * Re-compute a cluster's centroid as the mean of all its sighting coordinates.
 */
async function recomputeCentroid(clusterId) {
  const { rows } = await db.query(
    `SELECT AVG(lat) AS lat, AVG(lng) AS lng,
            COUNT(*) AS cnt,
            COUNT(DISTINCT source_id) AS checklists,
            MIN(observed_at) AS first_seen,
            MAX(observed_at) AS last_seen
     FROM sightings
     WHERE cluster_id = $1 AND lat IS NOT NULL AND lng IS NOT NULL`,
    [clusterId]
  );
  const r = rows[0];
  await db.query(
    `UPDATE clusters
     SET center_lat = $1, center_lng = $2,
         sighting_count = $3, checklist_count = $4,
         first_seen = $5, last_seen = $6,
         updated_at = NOW()
     WHERE id = $7`,
    [r.lat, r.lng, r.cnt, r.checklists, r.first_seen, r.last_seen, clusterId]
  );
}

/**
 * Assign each unclustered sighting (with coordinates) to an existing cluster
 * within CLUSTER_RADIUS_M, or create a new cluster for it.
 *
 * Algorithm:
 *   1. Load all active clusters (last_seen within 28 days) per species key.
 *   2. For each unclustered sighting, find the nearest cluster of the same species
 *      whose centre is within CLUSTER_RADIUS_M.
 *   3. Assign it, or create a new cluster.
 *   4. Recompute centroids for every touched cluster.
 */
async function clusterSightings() {
  // Fetch unclustered sightings that have coordinates
  const { rows: unclustered } = await db.query(`
    SELECT id,
           COALESCE(scientific_name, common_name) AS species_key,
           common_name, scientific_name,
           lat, lng, observed_at, source_id
    FROM sightings
    WHERE cluster_id IS NULL AND lat IS NOT NULL AND lng IS NOT NULL
    ORDER BY observed_at ASC
  `);

  // Build a working map of active clusters per species key (in-memory for speed)
  const { rows: activeClusters } = await db.query(`
    SELECT id, species_key, center_lat, center_lng
    FROM clusters
    WHERE last_seen > NOW() - INTERVAL '28 days'
  `);

  // Map: species_key → cluster[]
  const clusterMap = new Map();
  for (const c of activeClusters) {
    if (!clusterMap.has(c.species_key)) clusterMap.set(c.species_key, []);
    clusterMap.get(c.species_key).push(c);
  }

  const touchedClusterIds = new Set();

  for (const s of unclustered) {
    const key = s.scientific_name || s.common_name;
    const candidates = clusterMap.get(key) || [];

    // Find nearest cluster within radius
    let best = null;
    let bestDist = Infinity;
    for (const c of candidates) {
      const dist = haversine(s.lat, s.lng, c.center_lat, c.center_lng);
      if (dist <= CLUSTER_RADIUS_M && dist < bestDist) {
        best = c;
        bestDist = dist;
      }
    }

    if (best) {
      // Assign to existing cluster
      await db.query('UPDATE sightings SET cluster_id = $1 WHERE id = $2', [best.id, s.id]);
      touchedClusterIds.add(best.id);
    } else {
      // Create a new cluster
      const { rows: created } = await db.query(
        `INSERT INTO clusters
           (species_key, common_name, center_lat, center_lng, first_seen, last_seen)
         VALUES ($1, $2, $3, $4, $5, $5)
         RETURNING id`,
        [key, s.common_name, s.lat, s.lng, s.observed_at]
      );
      const newId = created[0].id;
      await db.query('UPDATE sightings SET cluster_id = $1 WHERE id = $2', [newId, s.id]);
      touchedClusterIds.add(newId);

      // Add to in-memory map so subsequent sightings in this run can find it
      if (!clusterMap.has(key)) clusterMap.set(key, []);
      clusterMap.get(key).push({ id: newId, species_key: key, center_lat: s.lat, center_lng: s.lng });
    }
  }

  // Recompute centroids for all touched clusters
  for (const id of touchedClusterIds) {
    await recomputeCentroid(id);
  }

  if (touchedClusterIds.size > 0) {
    console.log(`[clustering] Assigned ${unclustered.length} sightings across ${touchedClusterIds.size} clusters.`);
  }

  return touchedClusterIds.size;
}

module.exports = { clusterSightings, haversine, CLUSTER_RADIUS_M };
