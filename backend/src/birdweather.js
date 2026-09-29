const cron = require('node-cron');
const db = require('./db');
const config = require('./config');
const { CLUSTER_RADIUS_M, haversine } = require('./clustering');
const { REGION_TIME_ZONE } = require('./time');

const GRAPHQL_URL = 'https://app.birdweather.com/graphql';
const STATION_URL_BASE = 'https://app.birdweather.com/stations/';
const USER_AGENT = 'BirdersBestFriend/1.x (+https://rba-backend.cloudedapps.org/privacy)';
const REQUEST_TIMEOUT_MS = 15_000;

// Pacific-date helper. The BirdWeather API expects a date range in Pacific time
// for the LA/OC region; we use it for everything we compare against the cluster.
const pacificDateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: REGION_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
});

function pacificDate(d) {
  return pacificDateFmt.format(d); // "YYYY-MM-DD"
}

// ---- in-memory caches ----
// speciesId cache: scientific name -> { id: string|null, commonName: string|null, expiresAt: number }
// Misses are cached too so an unknown species isn't re-asked every run; misses
// expire after 24 h so newly-added species eventually resolve.
const speciesCache = new Map();
const MISS_TTL_MS = 24 * 60 * 60 * 1000;

async function lookupSpeciesId(scientificName) {
  if (!scientificName) return null;
  const cached = speciesCache.get(scientificName);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.id ? { id: cached.id, commonName: cached.commonName } : null;
  }

  const data = await gql(
    `query($sci:String){ species(scientificName:$sci){ id commonName scientificName ebirdCode } }`,
    { sci: scientificName }
  );
  const sp = data?.species;
  if (!sp) {
    speciesCache.set(scientificName, { id: null, commonName: null, expiresAt: Date.now() + MISS_TTL_MS });
    return null;
  }
  speciesCache.set(scientificName, { id: sp.id, commonName: sp.commonName, expiresAt: Infinity });
  return { id: sp.id, commonName: sp.commonName };
}

// ---- GraphQL transport ----
class RateLimitedError extends Error {
  constructor(msg) { super(msg); this.name = 'RateLimitedError'; }
}

async function gql(query, variables) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 429) throw new RateLimitedError(`HTTP 429 from BirdWeather`);
  if (!res.ok) throw new Error(`BirdWeather HTTP ${res.status}`);
  const json = await res.json();
  if (Array.isArray(json.errors) && json.errors.length) {
    throw new Error(`BirdWeather GraphQL error: ${json.errors[0].message}`);
  }
  return json.data;
}

// ---- per-cluster logic ----
async function fetchDetections(speciesId, center, period) {
  // Bounding box of CLUSTER_RADIUS_M (300 m) around the centre.
  const r = CLUSTER_RADIUS_M;
  const dLat = r / 111320;
  const dLng = r / (111320 * Math.cos(center.lat * Math.PI / 180));
  const ne = { lat: center.lat + dLat, lon: center.lng + dLng };
  const sw = { lat: center.lat - dLat, lon: center.lng - dLng };
  const data = await gql(
    `query($sid:ID,$ne:InputLocation,$sw:InputLocation,$p:InputDuration,$minConf:Float){
       detections(first:100, speciesId:$sid, ne:$ne, sw:$sw, period:$p, confidenceGte:$minConf){
         nodes {
           id timestamp confidence
           coords{lat lon}
           station{ id name locationPrivacy coords{lat lon} }
         }
       }
     }`,
    { sid: speciesId, ne, sw, p: period, minConf: config.birdweather.minConfidence }
  );
  return data?.detections?.nodes ?? [];
}

// Days on which the cluster itself was reported. We only count a BirdWeather
// station's detection if the bird was also reported here on that same day.
async function loadReportedDays(clusterId) {
  const { rows } = await db.query(
    `SELECT DISTINCT to_char(d, 'YYYY-MM-DD') AS day FROM (
       SELECT (observed_at AT TIME ZONE $2)::date AS d
         FROM sightings WHERE cluster_id = $1
       UNION
       SELECT (created_at AT TIME ZONE $2)::date AS d
         FROM cluster_reports WHERE cluster_id = $1 AND type = 'refound'
     ) s WHERE d IS NOT NULL`,
    [clusterId, REGION_TIME_ZONE]
  );
  return new Set(rows.map(r => r.day));
}

function pause(ms) { return new Promise(r => setTimeout(r, ms)); }

async function checkOneCluster(cluster) {
  // species_key is the scientific name (or the common name when a source had none;
  // those miss the lookup and are skipped)
  const sp = await lookupSpeciesId(cluster.species_key);
  if (!sp) return 0;

  // Pacific date range: from max(first_seen, now - 6 days) to today
  const today = new Date();
  const earliest = new Date(Math.max(
    new Date(cluster.first_seen).getTime(),
    today.getTime() - 6 * 24 * 60 * 60 * 1000
  ));
  const period = {
    from: pacificDate(earliest),
    to: pacificDate(today),
    timezone: REGION_TIME_ZONE,
  };

  const detections = await fetchDetections(sp.id,
    { lat: cluster.center_lat, lng: cluster.center_lng }, period);

  const reportedDays = await loadReportedDays(cluster.id);
  if (!reportedDays.size) return 0;

  // Filter: station present, not privacy-fuzzed, coords within 300 m, same Pacific day
  const center = { lat: cluster.center_lat, lng: cluster.center_lng };
  const groups = new Map(); // key: station_id|date -> { station, detections[], maxConf }
  for (const d of detections) {
    const st = d.station;
    if (!st || st.locationPrivacy) continue;
    const dc = d.coords;
    if (!dc || dc.lat == null || dc.lon == null) continue;
    if (haversine(center.lat, center.lng, dc.lat, dc.lon) > CLUSTER_RADIUS_M) continue;
    const day = pacificDate(new Date(d.timestamp));
    if (!reportedDays.has(day)) continue;
    const key = `${st.id}|${day}`;
    let g = groups.get(key);
    if (!g) {
      g = { station: st, day, detections: 0, maxConf: 0 };
      groups.set(key, g);
    }
    g.detections += 1;
    if (d.confidence > g.maxConf) g.maxConf = d.confidence;
  }

  let upserts = 0;
  for (const g of groups.values()) {
    if (g.detections < 2) continue; // a single detection is often a misID
    await db.query(
      `INSERT INTO birdweather_matches
         (cluster_id, station_id, station_name, species_name, detected_on,
          detection_count, max_confidence, checked_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (cluster_id, station_id, detected_on) DO UPDATE SET
         detection_count = GREATEST(birdweather_matches.detection_count, EXCLUDED.detection_count),
         max_confidence  = GREATEST(birdweather_matches.max_confidence,  EXCLUDED.max_confidence),
         station_name    = EXCLUDED.station_name,
         checked_at      = NOW()`,
      [cluster.id, g.station.id, g.station.name, sp.commonName || cluster.common_name,
       g.day, g.detections, g.maxConf]
    );
    upserts += 1;
  }
  return upserts;
}

// ---- single run + scheduler ----
let running = false;

async function checkClusters() {
  if (running) {
    console.log('[birdweather] Previous run still in progress — skipping.');
    return;
  }
  running = true;
  const startedAt = Date.now();
  let checked = 0, matches = 0;

  try {
    const { rows: clusters } = await db.query(
      `SELECT id, common_name, species_key,
              center_lat, center_lng, first_seen, last_seen
       FROM clusters
       WHERE last_seen > NOW() - INTERVAL '7 days'
         AND center_lat IS NOT NULL AND center_lng IS NOT NULL
       ORDER BY last_seen DESC
       LIMIT $1`,
      [config.birdweather.maxClustersPerRun]
    );

    for (const cluster of clusters) {
      try {
        const upserts = await checkOneCluster(cluster);
        matches += upserts;
        checked += 1;
      } catch (err) {
        if (err instanceof RateLimitedError) {
          console.warn(`[birdweather] Stopping run after rate-limit (${checked} clusters checked).`);
          break;
        }
        console.error(`[birdweather] Cluster ${cluster.id} (${cluster.common_name}):`, err.message);
        // continue with the next cluster
      }
      await pause(1000); // space out the API calls
    }

    // Drop corroborations older than 28 days (Pacific)
    try {
      const { rowCount } = await db.query(
        `DELETE FROM birdweather_matches
         WHERE detected_on < (NOW() AT TIME ZONE $1)::date - 28`,
        [REGION_TIME_ZONE]
      );
      if (rowCount) console.log(`[birdweather] Purged ${rowCount} stale matches.`);
    } catch (err) {
      console.error('[birdweather] Purge error:', err.message);
    }
  } catch (err) {
    console.error('[birdweather] Run error:', err.message);
  } finally {
    running = false;
    const secs = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(`[birdweather] checked ${checked} clusters, ${matches} matches (${secs}s)`);
  }
}

function startBirdWeatherJob() {
  if (!config.birdweather.enabled) {
    console.log('[birdweather] Disabled');
    return;
  }
  console.log('[birdweather] Enabled — running 3×/hour, offset from the poller.');
  // Give the first poll a chance to cluster recent sightings before we ask
  // BirdWeather about them.
  setTimeout(() => {
    checkClusters().catch(err => console.error('[birdweather] Run error:', err.message));
  }, 2 * 60 * 1000);
  // 3×/hour, offset 7 minutes from the 10-minute poller so the runs don't collide.
  cron.schedule('7,27,47 * * * *', () => {
    checkClusters().catch(err => console.error('[birdweather] Run error:', err.message));
  });
}

module.exports = { startBirdWeatherJob, checkClusters, RateLimitedError, STATION_URL_BASE };
