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
  for (let i = 0; i < messages.length; i += BATCH) {
    const batch = messages.slice(i, i + BATCH);
    await _postJSON(EXPO_PUSH_URL, batch);
  }

  console.log(`[notifications] Sent to ${devices.length} device(s) for ${region.name}`);
}

function _postJSON(url, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Length': Buffer.byteLength(payload),
      },
    };
    const req = https.request(url, options, res => {
      res.resume();
      resolve();
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

module.exports = { dispatchNotifications };
