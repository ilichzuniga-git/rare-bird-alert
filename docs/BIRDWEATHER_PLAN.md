# BirdWeather corroboration — implementation plan

Goal: on a rare bird that people already reported (a cluster), show "Also heard by a BirdWeather
station" when a nearby BirdWeather station's BirdNET detections corroborate it. Stay inside the
permission Tim (BirdWeather founder) granted on 2026-09-28:
- Corroboration only. Detections NEVER create sightings, clusters, alerts, or push notifications,
  and never change a cluster's status label/level, last_seen, or any count.
- Query a small number of species near active rare-bird reports, a few times an hour. No bulk collection.
- Store only the match result (station, species, date, confidence). Never audio, never the
  detections' soundscape URLs, never raw detection rows.
- Credit BirdWeather and BirdNET and link to the station's BirdWeather page.

## Verified BirdWeather API facts (tested live 2026-09-29, no key needed)
Endpoint: POST https://app.birdweather.com/graphql, JSON body {query, variables}.

1. Species lookup by scientific name:
   query($sci:String){ species(scientificName:$sci){ id commonName scientificName ebirdCode } }
   -> {"data":{"species":{"id":"426","commonName":"Black Phoebe","scientificName":"Sayornis nigricans","ebirdCode":"blkpho"}}}
   `species` is null when not found.
2. Detections near a point:
   query($sid:ID,$ne:InputLocation,$sw:InputLocation,$p:InputDuration,$minConf:Float){
     detections(first:100, speciesId:$sid, ne:$ne, sw:$sw, period:$p, confidenceGte:$minConf){
       nodes { id timestamp confidence coords{lat lon} station{ id name locationPrivacy coords{lat lon} } }
     } }
   InputLocation = {lat, lon}   (note: `lon`, not `lng`)
   InputDuration = {from: "YYYY-MM-DD", to: "YYYY-MM-DD", timezone: "America/Los_Angeles"}
                   (or {count: 2, unit: "day"})
   timestamp is ISO8601 with offset, e.g. "2026-09-29T15:53:36-07:00". confidence is 0..1.
   station can be null; station.locationPrivacy=true means its coordinates are fuzzed.
3. Station page URL: https://app.birdweather.com/stations/<station id> (returns 200).

## Backend (backend/, Node 20, CommonJS, express 5, pg, node-cron — NO new npm dependencies;
use Node's global fetch + AbortSignal.timeout)

### 1. Migration `backend/src/db/migrations/016_birdweather_matches.sql`
```sql
CREATE TABLE IF NOT EXISTS birdweather_matches (
  id               SERIAL PRIMARY KEY,
  cluster_id       INTEGER NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
  station_id       TEXT NOT NULL,
  station_name     TEXT NOT NULL,
  species_name     TEXT NOT NULL,          -- BirdWeather common name
  detected_on      DATE NOT NULL,          -- Pacific date
  detection_count  INTEGER NOT NULL,       -- detections at this station that day (>= 2)
  max_confidence   DOUBLE PRECISION NOT NULL,
  checked_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cluster_id, station_id, detected_on)
);
CREATE INDEX IF NOT EXISTS birdweather_matches_cluster_id_idx ON birdweather_matches (cluster_id);
```

### 2. Config (`backend/src/config.js`)
Add a `birdweather` block, following the existing eBird/iNaturalist pattern:
- `enabled: process.env.BIRDWEATHER_ENABLED === 'true'` (off by default)
- `minConfidence` from BIRDWEATHER_MIN_CONFIDENCE, default 0.7
- `maxClustersPerRun` from BIRDWEATHER_MAX_CLUSTERS, default 25

### 3. New module `backend/src/birdweather.js`
- `lookupSpeciesId(scientificName)`: in-memory Map cache (cache `null` misses too, so an unknown
  species isn't re-asked every run; misses can expire after 24 h).
- `gql(query, variables)`: POST with `Content-Type: application/json`, a `User-Agent` of
  `BirdersBestFriend/1.x (+https://rba-backend.cloudedapps.org/privacy)`, 15 s timeout. Throw on
  non-2xx or on a GraphQL `errors` array. On HTTP 429 throw an error the job recognises so it
  stops the whole run.
- `checkClusters()` — one run:
  1. Select active clusters: `last_seen > NOW() - INTERVAL '7 days'`, ordered by `last_seen DESC`,
     `LIMIT maxClustersPerRun`. Species key is `clusters.species_key` (scientific name, falling
     back to common name — so a lookup miss is expected sometimes; just skip).
  2. For each cluster, sequentially (never in parallel), with ~1 s pause between API calls:
     a. species id via lookupSpeciesId; skip if null.
     b. Bounding box of CLUSTER_RADIUS_M (300 m, from `clustering/index.js`) around the centre:
        dLat = r / 111320, dLng = r / (111320 * cos(lat)). ne = {lat+dLat, lon: lng+dLng}, sw = {lat-dLat, lon: lng-dLng}.
     c. Period: from = Pacific date of max(first_seen, now - 6 days), to = today (Pacific),
        timezone America/Los_Angeles.
     d. Filter the returned detections in JS:
        - skip if station is null or station.locationPrivacy is true (fuzzed coordinates can't
          support a 300 m claim);
        - keep only those whose own coords are within 300 m of the cluster centre (haversine,
          reuse `haversine` from `clustering/index.js`) — the box's corners are ~420 m away;
        - keep only Pacific dates on which the cluster itself was reported: a sighting
          (`sightings.cluster_id`) or a 'refound' `cluster_reports` row on that Pacific date
          ("same days"). Get those dates with one SQL query per cluster.
     e. Group by (station id, Pacific date). A group counts only with >= 2 detections
        (single rare detections are often misidentifications).
     f. Upsert each counting group into birdweather_matches
        (ON CONFLICT (cluster_id, station_id, detected_on) DO UPDATE detection_count, max_confidence,
        station_name, checked_at). Use GREATEST for detection_count/max_confidence so a later page
        with fewer results can't shrink a match.
  3. Delete matches with `detected_on < (NOW() AT TIME ZONE 'America/Los_Angeles')::date - 28`.
  4. Log one summary line: `[birdweather] checked N clusters, M matches`.
  - One cluster's error is logged and doesn't stop the run; a 429 stops the run.
  - Guard against overlapping runs with a module-level `running` flag.
- `startBirdWeatherJob()`: if not enabled, log `[birdweather] Disabled` and return. Otherwise run
  once ~2 min after startup (let the first poll cluster things) and then on cron `7,27,47 * * * *`
  (3×/hour, offset from the 10-minute poller).
- Pacific-date helper: format with `Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' })`
  -> "YYYY-MM-DD". `REGION_TIME_ZONE` is exported from `backend/src/time.js`; use it.

### 4. `backend/src/server.js`
Call `startBirdWeatherJob()` in the `app.listen` callback after `startPoller()`.

### 5. `backend/src/routes/clusters.js` — GET /:id only
Add `birdweather` to the returned cluster: array (possibly empty) of
`{ station_id, station_name, station_url, date: 'YYYY-MM-DD', detections, max_confidence }`,
newest date first, max 5. Wrap its query in its own try/catch like the `days` query so it can never
break the detail view. Do NOT add it to the list endpoint, and do NOT touch `clusterStatus()`.

## Mobile (mobile/, Expo SDK 57, React Native, TypeScript — NO new packages)

### 6. `mobile/src/types.ts`
```ts
export interface BirdWeatherMatch {
  station_id: string; station_name: string; station_url: string;
  date: string; // YYYY-MM-DD, Pacific
  detections: number; max_confidence: number;
}
```
and on ClusterData: `/** Single-cluster endpoint only */ birdweather?: BirdWeatherMatch[];`

### 7. `mobile/src/SightingDetail.tsx` — in DetailBody
When `cluster?.birdweather?.length`, render a small card right after the refound/dipped CTA row
and before the links row:
- Title: "🎧 Also heard by a BirdWeather station"
- One row per match (max 3): station name as a link (Linking.openURL(station_url)) + " ↗",
  then "· <formatted date> · N detections". Use the existing `formatDate` from `./util` for the date
  (parse 'YYYY-MM-DD' as a local date — `new Date(y, m-1, d)` — not `new Date(str)`, which is UTC).
- Credit line (small, gray): "Acoustic ID by BirdNET, via BirdWeather. Machine IDs; not a confirmed sighting."
  with "BirdNET" linking to https://birdnet.cornell.edu and "BirdWeather" to https://www.birdweather.com.
- Style with the existing `colors` / `styles` conventions in the file (add new style entries).
  It must not change the status line, level colour or CTA.

### 8. `mobile/src/AboutModal.tsx`
Add a "BirdWeather & BirdNET" Section after iNaturalist: acoustic detections from BirdWeather
stations (links), identified by BirdNET (Cornell Lab / Chemnitz University of Technology); used with
BirdWeather's permission, only to note when a station near an already-reported bird also heard that
species; detections never create reports or alerts on their own; no audio is stored.

### 9. `mobile/app.json`: version 1.2.0 -> 1.3.0.

## Docs
10. `docs/SOURCES.MD`: rename the heading to "BirdWeather (integrated)" and add a bullet saying
    where the code lives (`backend/src/birdweather.js`, migration 016, BIRDWEATHER_ENABLED env var).
    The existing README.md anchor `#birdweather-permission-granted-not-yet-integrated` must then be
    updated to match the new heading.
11. `README.md` roadmap: tick the implemented BirdWeather items (leave "Let Tim know" unticked).
    Add `BIRDWEATHER_ENABLED=true` to wherever backend env vars are documented.

## Not in scope (explicitly)
- No change to privacy.html / Play Data safety: no user data is involved.
- No map pins for stations, no push notifications, no BirdWeather data on the list endpoint.
- No tests framework exists in this repo; don't add one.

## Rollout (done by the user/me, not by the code)
Deploy backend with BIRDWEATHER_ENABLED unset -> migrations run -> set it to true in Dokploy ->
watch `[birdweather]` log lines -> verify a detail view -> EAS build 1.3.0 -> email Tim.
