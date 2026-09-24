const db = require('./db');
const { fetchSpeciesCounts } = require('./speciesCounts');

const REFRESH_MS = 24 * 60 * 60 * 1000;

// region code → { byName: Map<lowercase sci name, all-time count>, loadedAt }
const cache = new Map();
const inflight = new Map();

async function load(regionCode) {
  const { rows } = await db.query('SELECT inat_place_id FROM regions WHERE code = $1', [regionCode]);
  const placeId = rows[0]?.inat_place_id;
  if (!placeId) return;
  const { byName } = await fetchSpeciesCounts(placeId);
  cache.set(regionCode, { byName, loadedAt: Date.now() });
  console.log(`[rarity] Loaded all-time counts for ${byName.size} species in ${regionCode}.`);
}

/** Load (or refresh daily) the counts for these regions. Never throws — lookups just return null. */
async function ensureLoaded(regionCodes) {
  await Promise.all(regionCodes.map(code => {
    const entry = cache.get(code);
    if (entry && Date.now() - entry.loadedAt < REFRESH_MS) return null;
    if (!inflight.has(code)) {
      inflight.set(code, load(code)
        .catch(err => console.warn(`[rarity] Load failed for ${code}:`, err.message))
        .finally(() => inflight.delete(code)));
    }
    return inflight.get(code);
  }));
}

/** Warm the cache for every enabled region (call at startup). */
async function warm() {
  try {
    const { rows } = await db.query('SELECT code FROM regions WHERE enabled = true');
    await ensureLoaded(rows.map(r => r.code));
  } catch (err) {
    console.warn('[rarity] Warm-up failed:', err.message);
  }
}

/**
 * All-time research-grade iNaturalist observations of this species in the region,
 * the same measure iNaturalist sightings are rated by. Subspecies fall back to the
 * species. null = no match (not loaded yet, or the name differs between taxonomies)
 * — callers should treat that as "no rarity data", not as "never seen".
 */
function rarityCountFor(regionCode, scientificName) {
  const byName = cache.get(regionCode)?.byName;
  if (!byName || !scientificName) return null;
  const full = scientificName.trim().toLowerCase();
  const species = full.split(/\s+/).slice(0, 2).join(' ');
  const count = byName.get(full) ?? byName.get(species);
  if (count != null) return count;
  // Known to iNaturalist from another region → the name isn't a taxonomy mismatch,
  // the species just has no research-grade records here: as rare as it gets.
  for (const [code, other] of cache) {
    if (code !== regionCode && (other.byName.has(full) || other.byName.has(species))) return 0;
  }
  return null;
}

module.exports = { ensureLoaded, warm, rarityCountFor };
