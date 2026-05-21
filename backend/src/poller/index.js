const cron = require('node-cron');
const db = require('../db');
const { getSources } = require('../sources');

/**
 * Upsert a single normalized sighting into the DB.
 * The UNIQUE(source, source_id) constraint means duplicate observations
 * are silently ignored.
 */
async function upsertSighting(s) {
  const sql = `
    INSERT INTO sightings
      (region_code, source, source_id, species_code, common_name, scientific_name,
       lat, lng, location_name, observed_at, how_many, rarity_count, photo_url)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
    ON CONFLICT (source, source_id) DO NOTHING
  `;
  await db.query(sql, [
    s.region_code, s.source, s.source_id, s.species_code,
    s.common_name, s.scientific_name,
    s.lat, s.lng, s.location_name,
    s.observed_at, s.how_many, s.rarity_count ?? null, s.photo_url ?? null,
  ]);
}

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
        let newCount = 0;
        for (const s of sightings) {
          const result = await db.query(
            `INSERT INTO sightings
               (region_code, source, source_id, species_code, common_name, scientific_name,
                lat, lng, location_name, observed_at, how_many, rarity_count, photo_url,
                photo_attribution)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
             ON CONFLICT (source, source_id) DO NOTHING`,
            [
              s.region_code, s.source, s.source_id, s.species_code,
              s.common_name, s.scientific_name,
              s.lat, s.lng, s.location_name,
              s.observed_at, s.how_many, s.rarity_count ?? null, s.photo_url ?? null,
              s.photo_attribution ?? null,
            ]
          );
          if (result.rowCount > 0) newCount++;
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

  // Purge sightings older than 28 days (keep 4 weeks of history)
  try {
    const { rowCount } = await db.query(
      "DELETE FROM sightings WHERE observed_at < NOW() - INTERVAL '28 days'"
    );
    if (rowCount > 0) console.log(`[poller] Purged ${rowCount} sightings older than 28 days.`);
  } catch (err) {
    console.error('[poller] Purge error:', err.message);
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
