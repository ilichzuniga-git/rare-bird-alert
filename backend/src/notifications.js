const https = require('https');
const db = require('./db');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Send push notifications to all registered devices when new sightings arrive.
 * @param {{ code: string, name: string }} region
 * @param {number} newCount
 */
async function dispatchNotifications(region, newCount) {
  const { rows: devices } = await db.query(
    'SELECT token FROM device_tokens'
  );
  if (devices.length === 0) return;

  const birdWord = newCount === 1 ? 'sighting' : 'sightings';
  const messages = devices.map(d => ({
    to: d.token,
    sound: 'default',
    title: `🐦 New in ${region.name}`,
    body: `${newCount} new rare bird ${birdWord} reported.`,
    data: { regionCode: region.code, newCount },
  }));

  // Expo push API accepts batches of up to 100
  const BATCH = 100;
  const deadTokens = [];
  for (let i = 0; i < messages.length; i += BATCH) {
    const batch = messages.slice(i, i + BATCH);
    const response = await _postJSON(EXPO_PUSH_URL, batch);
    // Expo returns one ticket per message, in order. DeviceNotRegistered means
    // the app was uninstalled or the token expired — stop sending to it.
    (response?.data || []).forEach((ticket, j) => {
      if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
        deadTokens.push(batch[j].to);
      }
    });
  }

  console.log(`[notifications] Sent to ${devices.length} device(s) for ${region.name}`);

  if (deadTokens.length) {
    await db.query('DELETE FROM device_tokens WHERE token = ANY($1)', [deadTokens]);
    console.log(`[notifications] Removed ${deadTokens.length} unregistered device token(s).`);
  }
}

function _postJSON(url, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };
    const req = https.request(url, options, res => {
      let body = '';
      res.on('data', c => { body += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (_) { resolve(null); } // non-JSON error page: nothing to prune
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

module.exports = { dispatchNotifications };
