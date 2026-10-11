const https = require('https');
const db = require('./db');
const { ensureLoaded: ensureRarity, rarityCountFor } = require('./rarity');
const { isAtSea } = require('./atSea');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';

// Expo hands messages on to Apple and Google afterwards; their errors (such as missing FCM
// credentials) only show in the receipts, which are ready a few minutes after sending
const RECEIPT_DELAY_MS = 5 * 60 * 1000;

// Sighting ids sent with a notification, so tapping it opens those birds. Kept well under
// the 4 KB push payload limit; the app shows whichever of them are still in its feed.
const MAX_IDS = 100;

/** "A", "A and B", "A, B and 3 more" */
function nameList(names) {
  if (names.length <= 2) return names.join(' and ');
  return `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`;
}

/**
 * The notification for one poll cycle's new sightings: the species and where. Birds you can
 * reach come first, rarest first; ones out on the ocean (pelagic trips, which few people go
 * on) follow, marked "(at sea)". Exported for testing.
 * @param {{ id: number, common_name: string, location_name: string|null, region_name: string,
 *           rarity: number|null, at_sea: boolean }[]} sightings
 */
function buildMessage(sightings) {
  // Land before sea, then rarest (fewest all-time county records; no data counts as common), then newest
  const ranked = [...sightings].sort((a, b) =>
    a.at_sea - b.at_sea || (a.rarity ?? Infinity) - (b.rarity ?? Infinity) || b.id - a.id);
  // A species counts as at sea only when every new report of it is
  const species = [...new Set(ranked.map(s => s.common_name))].map(name => ({
    name,
    atSea: ranked.every(s => s.common_name !== name || s.at_sea),
  }));
  const label = sp => (sp.atSea ? `${sp.name} (at sea)` : sp.name);
  const regions = [...new Set(ranked.map(s => s.region_name))];
  // "Los Angeles & Orange County", not "Los Angeles County & Orange County"
  const where = regions.map((r, i) => (i < regions.length - 1 ? r.replace(/ County$/, '') : r)).join(' & ');

  let title, body;
  if (species.length === 1) {
    const places = [...new Set(ranked.map(s => s.location_name).filter(Boolean))];
    title = `🐦 ${label(species[0])}`;
    body = places.length === 1 ? `${places[0]} · ${where}` : `New in ${where}`;
  } else if (species.every(sp => sp.atSea)) {
    title = `🐦 ${species.length} new rare birds at sea off ${where}`;
    body = nameList(species.map(sp => sp.name));
  } else {
    title = `🐦 ${species.length} new rare birds in ${where}`;
    body = nameList(species.map(label));
  }
  return { title, body, data: { sightingIds: ranked.slice(0, MAX_IDS).map(s => s.id) } };
}

/**
 * Send one push notification to every registered device for a poll cycle's new sightings.
 * @param {number[]} sightingIds
 */
async function dispatchNotifications(sightingIds) {
  if (!(await db.query('SELECT 1 FROM device_tokens LIMIT 1')).rows.length) return;

  const { rows } = await db.query(
    `SELECT s.id, s.common_name, s.scientific_name, s.location_name, s.region_code, s.rarity_count,
            s.lat, s.lng, r.name AS region_name
       FROM sightings s JOIN regions r ON r.code = s.region_code
      WHERE s.id = ANY($1)`,
    [sightingIds]
  );
  if (!rows.length) return; // purged in the same cycle (older than the retention window)

  // eBird rows carry no rarity; rate them the way /api/sightings does
  await ensureRarity([...new Set(rows.map(r => r.region_code))]);
  for (const r of rows) {
    r.rarity = r.rarity_count ?? rarityCountFor(r.region_code, r.scientific_name);
    r.at_sea = isAtSea(r.lat, r.lng);
  }

  const { title, body, data } = buildMessage(rows);

  // Count this alert for each device's app-icon badge; only builds that clear it get a number
  const { rows: devices } = await db.query(
    'UPDATE device_tokens SET unread = unread + CASE WHEN badges THEN 1 ELSE 0 END RETURNING token, platform, badges, unread'
  );
  const messages = devices.map(d => ({
    to: d.token, sound: 'default', title, body, data,
    ...(d.badges ? { badge: d.unread } : {}),
  }));

  // Expo push API accepts batches of up to 100
  const BATCH = 100;
  const deadTokens = [];
  const receiptIds = {}; // receipt id -> device platform, for the delivery check
  const platformOf = new Map(devices.map(d => [d.token, d.platform || 'unknown']));
  for (let i = 0; i < messages.length; i += BATCH) {
    const batch = messages.slice(i, i + BATCH);
    const response = await _postJSON(EXPO_PUSH_URL, batch);
    if (response?.errors) console.warn('[notifications] Expo rejected the batch:', JSON.stringify(response.errors));
    // Expo returns one ticket per message, in order. DeviceNotRegistered means
    // the app was uninstalled or the token expired — stop sending to it.
    (response?.data || []).forEach((ticket, j) => {
      const platform = platformOf.get(batch[j].to);
      if (ticket.status === 'ok') receiptIds[ticket.id] = platform;
      else if (ticket.details?.error === 'DeviceNotRegistered') deadTokens.push(batch[j].to);
      else console.warn(`[notifications] Push to ${platform} device failed: ${ticket.details?.error ?? ''} ${ticket.message ?? ''}`);
    });
  }

  const perPlatform = {};
  for (const d of devices) perPlatform[d.platform || 'unknown'] = (perPlatform[d.platform || 'unknown'] || 0) + 1;
  const breakdown = Object.entries(perPlatform).map(([p, n]) => `${n} ${p}`).join(', ');
  console.log(`[notifications] Sent "${title}" to ${devices.length} device(s) (${breakdown})`);
  if (Object.keys(receiptIds).length) {
    setTimeout(() => checkReceipts(receiptIds).catch(e =>
      console.warn('[notifications] Receipt check failed:', e.message)), RECEIPT_DELAY_MS).unref();
  }

  if (deadTokens.length) {
    await db.query('DELETE FROM device_tokens WHERE token = ANY($1)', [deadTokens]);
    console.log(`[notifications] Removed ${deadTokens.length} unregistered device token(s).`);
  }
}

/**
 * Log the deliveries Apple or Google refused, grouped by platform and error.
 * Expo accepts up to 1000 receipt ids per request.
 * @param {Record<string, string>} receiptIds receipt id -> device platform
 */
async function checkReceipts(receiptIds) {
  const ids = Object.keys(receiptIds);
  const failed = {};
  for (let i = 0; i < ids.length; i += 1000) {
    const response = await _postJSON(EXPO_RECEIPTS_URL, { ids: ids.slice(i, i + 1000) });
    for (const [id, receipt] of Object.entries(response?.data || {})) {
      if (receipt.status !== 'error') continue;
      const key = `${receiptIds[id]}: ${receipt.details?.error ?? ''} ${receipt.message ?? ''}`.trim();
      failed[key] = (failed[key] || 0) + 1;
    }
  }
  const lines = Object.entries(failed).map(([k, n]) => `${n} × ${k}`);
  if (lines.length) console.warn(`[notifications] Delivery failures: ${lines.join(' | ')}`);
  else console.log(`[notifications] All ${ids.length} deliveries accepted by Apple/Google`);
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

module.exports = { dispatchNotifications, buildMessage };
