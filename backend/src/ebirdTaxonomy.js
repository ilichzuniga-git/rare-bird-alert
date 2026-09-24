const config = require('./config');

const TAXONOMY_URL = 'https://api.ebird.org/v2/ref/taxonomy/ebird?fmt=json&cat=species';
const REFRESH_MS = 24 * 60 * 60 * 1000;

let codeBySciName = null; // Map<lowercase scientific name, eBird species code>
let loadedAt = 0;
let inflight = null;

async function load() {
  const res = await fetch(TAXONOMY_URL, {
    headers: { 'X-eBirdApiToken': config.ebird.apiKey },
  });
  if (!res.ok) throw new Error(`eBird taxonomy returned ${res.status}`);
  const taxa = await res.json();
  codeBySciName = new Map(taxa.map(t => [t.sciName.toLowerCase(), t.speciesCode]));
  loadedAt = Date.now();
  console.log(`[taxonomy] Loaded ${codeBySciName.size} eBird species codes.`);
}

/** Load (or refresh daily) the eBird taxonomy. Never throws — lookups just return null. */
async function ensureLoaded() {
  if (codeBySciName && Date.now() - loadedAt < REFRESH_MS) return;
  if (!config.ebird.apiKey) return;
  inflight ??= load()
    .catch(err => console.warn('[taxonomy] Load failed:', err.message))
    .finally(() => { inflight = null; });
  await inflight;
}

/**
 * eBird species code for a scientific name, e.g. 'Pyrocephalus rubinus' → 'verfly'.
 * Subspecies (trinomials, as iNaturalist sometimes reports) fall back to the species.
 */
function ebirdCodeFor(scientificName) {
  if (!codeBySciName || !scientificName) return null;
  const name = scientificName.trim().toLowerCase();
  return codeBySciName.get(name)
    ?? codeBySciName.get(name.split(/\s+/).slice(0, 2).join(' '))
    ?? null;
}

module.exports = { ensureLoaded, ebirdCodeFor };
