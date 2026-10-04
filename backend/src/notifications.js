const https = require('https');
const db = require('./db');
const { ensureLoaded: ensureRarity, rarityCountFor } = require('./rarity');
const { isAtSea } = require('./atSea');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

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
  const { rows: devices } = await db.query(
    'SELECT token FROM device_tokens'
  );
  if (devices.length === 0) return;

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
  const messages = devices.map(d => ({ to: d.token, sound: 'default', title, body, data }));

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

  console.log(`[notifications] Sent "${title}" to ${devices.length} device(s)`);

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

module.exports = { dispatchNotifications, buildMessage };
