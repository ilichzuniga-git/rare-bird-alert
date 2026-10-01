const express = require('express');
const router = express.Router();
const { rateLimit } = require('express-rate-limit');
const db = require('../db');

/**
 * POST /api/devices/register
 * Body: { token: string, platform?: 'ios' | 'android' }
 * Registers an Expo push token. Upserts so re-registrations are safe.
 */
// Each install registers about once per app launch, so this only stops junk-token floods
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,                 // per IP per hour (generous for phones sharing a carrier IP)
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many registrations — try again later' },
});

router.post('/register', registerLimiter, async (req, res) => {
  const { token, platform } = req.body || {};
  // Expo push tokens look like ExponentPushToken[...]; anything else can't be delivered to
  if (typeof token !== 'string' || token.length > 200 || !/^Expo(nent)?PushToken\[.+\]$/.test(token)) {
    return res.status(400).json({ error: 'A valid Expo push token is required' });
  }
  if (platform != null && !['ios', 'android'].includes(platform)) {
    return res.status(400).json({ error: 'platform must be "ios" or "android"' });
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
