const express = require('express');
const router = express.Router();
const { rateLimit } = require('express-rate-limit');
const db = require('../db');

/**
 * POST /api/devices/register
 * Body: { token: string, platform?: 'ios' | 'android', badge?: boolean }
 * Registers an Expo push token. Upserts so re-registrations are safe. The app registers on
 * every launch, so this also resets the unread count behind the app-icon badge. badge: true
 * comes from builds that clear the badge themselves (1.5.0+); only those get counts.
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
  const { token, platform, badge } = req.body || {};
  // Expo push tokens look like ExponentPushToken[...]; anything else can't be delivered to
  if (typeof token !== 'string' || token.length > 200 || !/^Expo(nent)?PushToken\[.+\]$/.test(token)) {
    return res.status(400).json({ error: 'A valid Expo push token is required' });
  }
  if (platform != null && !['ios', 'android'].includes(platform)) {
    return res.status(400).json({ error: 'platform must be "ios" or "android"' });
  }

  try {
    await db.query(
      `INSERT INTO device_tokens (token, platform, last_seen, badges, unread)
       VALUES ($1, $2, now(), $3, 0)
       ON CONFLICT (token) DO UPDATE
         SET last_seen = now(), platform = EXCLUDED.platform, badges = EXCLUDED.badges, unread = 0`,
      [token, platform || null, badge === true]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[POST /api/devices/register]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Coming back to an app that's still running sends this instead of a full register
const seenLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 120,                // per IP per hour
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many requests — try again later' },
});

/**
 * POST /api/devices/seen
 * Body: { token: string }
 * The app was opened or an alert arrived while it was open: the next alert's badge starts at 1.
 */
router.post('/seen', seenLimiter, async (req, res) => {
  const { token } = req.body || {};
  if (typeof token !== 'string' || token.length > 200) {
    return res.status(400).json({ error: 'A valid Expo push token is required' });
  }
  try {
    await db.query('UPDATE device_tokens SET unread = 0, last_seen = now() WHERE token = $1', [token]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[POST /api/devices/seen]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
