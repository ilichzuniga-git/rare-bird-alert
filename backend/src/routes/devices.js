const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * POST /api/devices/register
 * Body: { token: string, platform?: 'ios' | 'android' }
 * Registers an Expo push token. Upserts so re-registrations are safe.
 */
router.post('/register', async (req, res) => {
  const { token, platform } = req.body;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'token is required' });
  }

  try {
    await db.query(
      `INSERT INTO device_tokens (token, platform, last_seen)
       VALUES ($1, $2, now())
       ON CONFLICT (token) DO UPDATE SET last_seen = now(), platform = EXCLUDED.platform`,
      [token, platform || null]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[POST /api/devices/register]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
