# Data Sources

This file tracks every external data source the app pulls from, its licensing posture, and attribution requirements. Update whenever a source is added, removed, or its terms change. The in-app **About** screen (`mobile/src/AboutModal.tsx`) must stay in sync with the attribution text here.

## Licensing posture

**The app is free and non-commercial** (decided 2026-09-23): no price, no ads, no in-app purchases. That keeps us inside the eBird API's default non-commercial terms and lets us show CC BY-NC photos.

Before adding any monetization — ads, paid features, subscriptions, even donation perks — re-check every source below. It would likely require written permission from Cornell for eBird and would rule out all NC-licensed photos.

## eBird API 2.0
- Used by: `backend/src/sources/EbirdSource.js` (sightings), `backend/src/routes/sightings.js` (observer notes), `backend/src/ebirdTaxonomy.js` (species codes)
- Endpoints:
  - `GET /v2/data/obs/{region}/recent/notable?detail=full` — notable sightings, polled every 10 minutes per region
  - `GET /v2/product/checklist/view/{subId}` — observer notes, on demand when a sighting is opened (never stored)
  - `GET /v2/ref/taxonomy/ebird?fmt=json&cat=species` — ~11k species, fetched once a day and cached in memory, to add eBird species codes to iNaturalist sightings in API responses
- License: non-commercial by default; commercial use requires written permission.
- Permission status: free non-commercial app, using a personal API key. No commercial license needed or requested.
- Contact for commercial use: Mary Guthrie (msg21@cornell.edu)
- Attribution (required): **"Data from eBird (Cornell Lab of Ornithology, ebird.org)"**
  - Shown in the app header ("Data from eBird & iNaturalist") and in full, with a link, on the About screen
- Notes: notable sightings include reports not yet confirmed by eBird reviewers — don't describe them as "reviewed" in the UI.
- `obsDt` is the observer's local time with no zone. It must be parsed as Pacific time (`backend/src/time.js`), not by `new Date()` on the UTC server — that bug stored every eBird time 7–8 hours early until migration 015.
- Links out to ebird.org hotspot pages (`/hotspot/{locId}`) and species pages (`/species/{code}`).
- Last terms review: 2026-05-11. Non-commercial decision recorded: 2026-09-23.

## iNaturalist API
- Used by: `backend/src/sources/INaturalistSource.js` (sightings, photos), `backend/src/routes/sightings.js` (observer notes/comments), `mobile/App.tsx` `fetchPhotoForSpecies` (photos for eBird sightings)
- Endpoints: `/v1/observations` and `/v1/observations/species_counts` (rare research-grade birds per place), `/v1/observations/{id}` (notes/comments, on demand), `/v1/taxa?q=` (species photo)
- `species_counts` is paged (`backend/src/speciesCounts.js`): LA County has ~600 species and the list is sorted most-observed first, so a single 500-row page silently dropped the rarest ones. The same counts rate eBird sightings (`backend/src/rarity.js`, cached daily; 2–3 requests per day).
- Only `quality_grade=research` observations are used (2+ agreeing community IDs).
- No API key. Requests send a descriptive `User-Agent`; keep request volume modest (iNaturalist asks clients to stay around 1 request/second).
- Attribution: "Data from iNaturalist" — shown in the header and on the About screen, linking to inaturalist.org.

### iNaturalist photos
Photos are the photographers' work, each under its own license.

| License | Shown? |
|---|---|
| CC0, CC BY, CC BY-SA, CC BY-ND | ✅ |
| CC BY-NC, CC BY-NC-SA, CC BY-NC-ND | ✅ — allowed because the app is non-commercial |
| All rights reserved (no license code) | ❌ never fetched, stored, or shown |

- Enforced in two places, which must stay in sync: `USABLE_LICENSES` in `INaturalistSource.js` (photos stored at poll time) and in `mobile/App.tsx` (photos looked up for eBird sightings).
- Attribution (required by every CC license): each photo shows the photographer credit **and the license code** (e.g. "© Paul Reeves" / "CC BY-NC-SA") in an overlay. The About screen explains the licenses and links to creativecommons.org/licenses.
- We display iNaturalist's own square thumbnails and don't otherwise alter photos (relevant for ND licenses).
- Measured 2026-09-23: of 40 species in the live feed, 3 had photos under the old commercial-only filter, and 30 do with NC allowed (the other 10 are all-rights-reserved).

## OpenStreetMap tiles + Leaflet
- Used by: `mobile/src/LeafletMap.tsx` (map tab and sighting maps, in a WebView)
- Tiles: `https://{s}.tile.openstreetmap.org` — data © OpenStreetMap contributors, ODbL.
- Attribution (required): "© OpenStreetMap contributors" — shown on every map (Leaflet's attribution control) and on the About screen.
- Tile usage policy: OSM's public tile servers are for light use only. Fine for a small free app, but if usage grows, switch to a hosted tile provider or self-hosted tiles.
- Leaflet 1.9.4 loaded from unpkg (BSD-2-Clause).

## All About Birds (Cornell Lab)
- Links only: tapping a photo or placeholder opens `allaboutbirds.org/guide/{name}`. No data is fetched.

## Expo push notification service
- `backend/src/notifications.js` sends pushes via `exp.host`. Tokens are anonymous; tokens Expo reports as `DeviceNotRegistered` are deleted.

## BirdWeather (evaluated, not integrated)
- GraphQL API at `app.birdweather.com/graphql`: acoustic BirdNET detections from ~100 LA/OC stations, with eBird species codes, confidence scores and community votes. Open without a key as of 2026-09-23.
- No rarity flag, and unverified machine IDs of rare species are mostly false positives, so it isn't suitable as a rarity source. It could work as corroboration (a nearby station hearing a known rare bird).
- Terms/licensing are **not stated** in the API docs. Email support@birdweather.com before integrating.
