const { Pool } = require('pg');
const config = require('../config');

const pool = new Pool({
  connectionString: config.databaseUrl,
});

pool.on('error', (err) => {
  console.error('Unexpected DB error', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};