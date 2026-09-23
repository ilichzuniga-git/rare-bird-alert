const cron = require('node-cron');
const db = require('../db');
const { getSources } = require('../sources');
const { clusterSightings } = require('../clustering');

// Sightings older than this are purged after each poll, and skipped on insert
// so sources with a longer lookback (iNaturalist: 30 days) don't re-insert
// them every cycle and trigger "new sighting" notifications.
const RETENTION_DAYS = 28;

/**
 * Run one full poll cycle across all enabled sources × all enabled regions.
 * Returns the total number of new sightings inserted.
 */
async function pollAll() {
  const { rows: regions } = await db.query(
    'SELECT code, name FROM regions WHERE enabled = true'
  );
  const sources = getSources();

  if (sources.length === 0) {
    console.log('[poller] No sources enabled — skipping poll.');
    return 0;
  }

  let totalNew = 0;

  for (const region of regions) {
    for (const source of sources) {
      try {
        const sightings = await source.fetchSightings(region.code);
        const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
        let newCount = 0;
        for (const s of sightings) {
          if (new Date(s.observed_at).getTime() < cutoff) continue;
          // xmax = 0 only for freshly inserted rows; rowCount alone also counts
          // ON CONFLICT updates, which made every re-fetched sighting look new.
          const result = await db.query(
            `INSERT INTO sightings
               (region_code, source, source_id, species_code, common_name, scientific_name,
                lat, lng, location_name, location_id, observed_at, how_many, rarity_count,
                photo_url, photo_attribution, notes)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
             ON CONFLICT (source, source_id, COALESCE(species_code, '')) DO UPDATE SET
               location_id       = COALESCE(sightings.location_id, EXCLUDED.location_id),
               photo_url         = COALESCE(sightings.photo_url, EXCLUDED.photo_url),
               photo_attribution = COALESCE(sightings.photo_attribution, EXCLUDED.photo_attribution),
               notes             = COALESCE(sightings.notes, EXCLUDED.notes)
             RETURNING (xmax = 0) AS inserted`,
            [
              s.region_code, s.source, s.source_id, s.species_code,
              s.common_name, s.scientific_name,
              s.lat, s.lng, s.location_name, s.location_id ?? null,
              s.observed_at, s.how_many, s.rarity_count ?? null,
              s.photo_url ?? null, s.photo_attribution ?? null, s.notes ?? null,
            ]
          );
          if (result.rows[0]?.inserted) newCount++;
        }
        console.log(
          `[poller] ${source.name} / ${region.name}: ${sightings.length} fetched, ${newCount} new`
        );
        totalNew += newCount;

        // Notify devices about new sightings (imported lazily to avoid circular deps)
        if (newCount > 0) {
          try {
            const { dispatchNotifications } = require('../notifications');
            await dispatchNotifications(region, newCount);
          } catch (e) {
            console.warn('[poller] Notification dispatch error:', e.message);
          }
        }
      } catch (err) {
        console.error(`[poller] Error polling ${source.name} / ${region.code}:`, err.message);
      }
    }
  }

  // Purge sightings older than the retention window
  try {
    const { rowCount } = await db.query(
      "DELETE FROM sightings WHERE observed_at < NOW() - make_interval(days => $1)",
      [RETENTION_DAYS]
    );
    if (rowCount > 0) console.log(`[poller] Purged ${rowCount} sightings older than ${RETENTION_DAYS} days.`);
  } catch (err) {
    console.error('[poller] Purge error:', err.message);
  }

  // Cluster new sightings into continuing-bird groups
  try {
    await clusterSightings();
  } catch (err) {
    console.error('[poller] Clustering error:', err.message);
  }

  return totalNew;
}

/**
 * Start the background cron job (every 10 minutes).
 * Call this once at server startup.
 */
function startPoller() {
  console.log('[poller] Starting — polling every 10 minutes.');
  pollAll().catch(err => console.error('[poller] Initial poll error:', err.message));
  cron.schedule('*/10 * * * *', () => {
    pollAll().catch(err => console.error('[poller] Poll error:', err.message));
  });
}

module.exports = { startPoller, pollAll };
