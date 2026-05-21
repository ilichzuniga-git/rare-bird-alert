/**
 * One-off script: verify and fix iNaturalist place IDs in the regions table.
 * Run from the backend folder: node src/scripts/fixInatPlaceIds.js
 */
require('dotenv').config();
const { pool } = require('../db');

const CORRECT_PLACE_IDS = {
  'US-CA-037': 962,   // Los Angeles County, CA
  'US-CA-059': 2738,  // Orange County, CA
};

async function run() {
  const { rows } = await pool.query(
    'SELECT code, name, inat_place_id FROM regions ORDER BY code'
  );

  console.log('\nCurrent state:');
  for (const r of rows) {
    const expected = CORRECT_PLACE_IDS[r.code];
    const ok = r.inat_place_id === expected;
    console.log(`  ${r.code} (${r.name}): inat_place_id = ${r.inat_place_id ?? 'NULL'}  ${ok ? '✓' : `✗ — should be ${expected}`}`);
  }

  // Apply fixes
  let fixed = 0;
  for (const [code, placeId] of Object.entries(CORRECT_PLACE_IDS)) {
    const result = await pool.query(
      'UPDATE regions SET inat_place_id = $1 WHERE code = $2 AND (inat_place_id IS DISTINCT FROM $1)',
      [placeId, code]
    );
    if (result.rowCount > 0) {
      console.log(`\n  Fixed ${code} → inat_place_id = ${placeId}`);
      fixed++;
    }
  }

  if (fixed === 0) {
    console.log('\nAll place IDs already correct — no changes needed.');
  } else {
    console.log(`\nFixed ${fixed} region(s). Restart the backend to pick up changes.`);
  }

  await pool.end();
}

run().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
