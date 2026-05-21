/**
 * Diagnostic: test each step of the iNaturalist fetch pipeline.
 * Run from the backend folder: node src/scripts/testInat.js
 */
require('dotenv').config();
const https = require('https');
const { pool } = require('../db');

const INAT_BASE = 'https://api.inaturalist.org/v1';
const AVES_TAXON_ID = 3;
const RARITY_THRESHOLD = parseInt(process.env.INAT_RARITY_THRESHOLD || '20', 10);
const LOOKBACK_DAYS    = parseInt(process.env.INAT_LOOKBACK_DAYS    || '30', 10);

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'RareBirdAlertApp/1.0', 'Accept': 'application/json' } }, res => {
      console.log(`  HTTP ${res.statusCode} → ${url.slice(0, 100)}...`);
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve(JSON.parse(body)));
    }).on('error', reject);
  });
}

async function run() {
  // 1. Check DB
  const { rows } = await pool.query('SELECT code, name, inat_place_id FROM regions WHERE enabled=true');
  console.log('\n=== Regions in DB ===');
  rows.forEach(r => console.log(`  ${r.code} | ${r.name} | inat_place_id = ${r.inat_place_id}`));

  for (const region of rows) {
    const placeId = region.inat_place_id;
    if (!placeId) { console.log(`\n  SKIP ${region.code} — no inat_place_id`); continue; }

    console.log(`\n=== ${region.name} (place_id=${placeId}) ===`);

    // 2. Species counts
    const scUrl = `${INAT_BASE}/observations/species_counts?place_id=${placeId}&taxon_id=${AVES_TAXON_ID}&quality_grade=research&captive=false&order_by=count&order=asc&per_page=500`;
    const scData = await get(scUrl);
    const results = scData.results || [];
    const rare = results.filter(r => r.count < RARITY_THRESHOLD);
    console.log(`  total species: ${scData.total_results}, in page: ${results.length}, rare (<${RARITY_THRESHOLD}): ${rare.length}`);
    if (rare.length > 0) {
      console.log('  sample rare species:');
      rare.slice(0, 4).forEach(r => console.log(`    count=${r.count}  ${r.taxon?.preferred_common_name}  (taxon_id=${r.taxon?.id})`));
    }

    // 3. Recent observations
    const d1 = new Date();
    d1.setDate(d1.getDate() - LOOKBACK_DAYS);
    const d1Str = d1.toISOString().slice(0, 10);
    const obsUrl = `${INAT_BASE}/observations?place_id=${placeId}&taxon_id=${AVES_TAXON_ID}&quality_grade=research&captive=false&d1=${d1Str}&order_by=observed_on&order=desc&per_page=200`;
    const obsData = await get(obsUrl);
    const obs = obsData.results || [];
    console.log(`  recent observations (last ${LOOKBACK_DAYS}d): ${obsData.total_results} total, ${obs.length} in page`);
    if (obs.length > 0) {
      console.log(`  sample obs taxon_ids: ${obs.slice(0,5).map(o => o.taxon?.id).join(', ')}`);
    }

    // 4. Filter
    const rareTaxonIds = new Set(rare.map(r => r.taxon?.id));
    const matched = obs.filter(o => rareTaxonIds.has(o.taxon?.id));
    console.log(`  rare taxon IDs in set: ${rareTaxonIds.size}, matched in recent obs: ${matched.length}`);
    if (matched.length > 0) {
      console.log('  sample matched:');
      matched.slice(0, 3).forEach(o => console.log(`    ${o.taxon?.preferred_common_name} @ ${o.place_guess} on ${o.observed_on}`));
    }
  }

  await pool.end();
}

run().catch(err => { console.error('\nFatal:', err.message); process.exit(1); });
