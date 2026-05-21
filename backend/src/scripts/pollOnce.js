require('dotenv').config();
const { pollAll } = require('../poller');
const { pool } = require('../db');

(async () => {
  try {
    console.log('Running one-shot poll…');
    const newCount = await pollAll();
    console.log(`Done. ${newCount} new sighting(s) inserted.`);
  } catch (err) {
    console.error('Poll failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
