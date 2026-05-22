# 🐦 Birder's Best Friend

A mobile app for LA & Orange County birders that shows rare bird sightings from eBird and iNaturalist, tracks whether a bird is continuing at a location, and lets chasers report refounds and dips in real time.

## Project structure

```
rba-app/
  backend/   Express API + PostgreSQL + poller + clustering engine
  mobile/    React Native / Expo mobile app
  docs/      Notes, architecture, data source legal posture
```

---

## Prerequisites

Install these once:

- [Node.js](https://nodejs.org/) v20+
- [PostgreSQL](https://www.postgresql.org/) running locally on port 5432
- [Expo Go](https://expo.dev/go) on your phone (iOS or Android)
- Android Debug Bridge (ADB) — included with Android Studio, or install platform-tools standalone

---

## First-time setup

### 1. Create the database

Open pgAdmin or psql and run:

```sql
CREATE DATABASE rba_dev;
```

### 2. Create the backend environment file

Create `backend/.env` (never commit this file):

```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/rba_dev

# eBird
EBIRD_API_KEY=YOUR_EBIRD_KEY
EBIRD_ENABLED=true

# iNaturalist (no API key required)
INAT_ENABLED=true
INAT_RARITY_THRESHOLD=50
INAT_LOOKBACK_DAYS=30

JWT_SECRET=change_me_to_a_long_random_string
PORT=3000
```

Get a free eBird API key at: https://ebird.org/api/keygen

iNaturalist requires no API key for read-only access.

### 3. Install backend dependencies and run migrations

```bash
cd backend
npm install
npm run db:migrate
```

### 4. Install mobile dependencies

```bash
cd mobile
npm install
```

---

## Running the app on your phone

You need **three things running simultaneously**. Open separate terminal windows for each.

### Terminal 1 — backend server

```bash
cd backend
npm run dev
```

You should see: `RBA backend listening on port 3000`

### Terminal 2 — Expo / Metro bundler

```bash
cd mobile
npx expo start
```

A QR code will appear in the terminal.

### Terminal 3 — ADB USB tunnels (Android only)

> **Run this every time you restart Metro or run `npm install`.** It bridges your phone's network requests to your computer's localhost.

```bash
adb reverse tcp:8081 tcp:8081
adb reverse tcp:3000 tcp:3000
```

Port 8081 = Metro bundler · Port 3000 = API server

### On your phone

1. Connect your phone via USB with USB debugging enabled
2. Open **Expo Go**
3. Scan the QR code from Terminal 2, or type `exp://127.0.0.1:8081` manually

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| "relation regions does not exist" | Run `npm run db:migrate` in the backend folder |
| "Network request failed" on phone | Re-run both `adb reverse` commands, then tap Retry in the app |
| White screen / "No apps connected" | Re-run `adb reverse`, open Expo Go, scan the QR code again |
| Metro port already in use | `npx kill-port 8081` |
| iNaturalist showing 0 sightings | Run `node src/scripts/testInat.js` to diagnose; check `inat_place_id` is set correctly |
| iNaturalist showing wrong-region results | Run `node src/scripts/fixInatPlaceIds.js`, then `npm run db:migrate` to apply the fix |
| Cluster status not showing on cards | Run `npm run poll:once` to trigger clustering on existing sightings |

The **most common issue** is the adb tunnel dropping silently after `npm install` or a Metro restart. When in doubt, re-run both `adb reverse` commands.

---

## Useful backend commands

```bash
# Apply any unapplied DB migrations (safe to re-run)
npm run db:migrate

# Manually trigger a one-shot poll (all enabled sources) + clustering
npm run poll:once

# Test iNaturalist fetch pipeline and print diagnostic output
node src/scripts/testInat.js

# Verify and auto-fix iNaturalist place IDs in the DB
node src/scripts/fixInatPlaceIds.js

# Start server with auto-reload on file changes
npm run dev
```

---

## Updating GitHub

### Everyday workflow

```bash
# 1. Check what changed
git status

# 2. Stage all changes
git add .

# 3. Commit with a message describing what you did
git commit -m "your message here"

# 4. Push to GitHub
git push
```

### First push to a new repo

```bash
git push -u origin main
```

### What NOT to commit

The `.gitignore` handles this automatically, but avoid:

- `backend/.env` — contains your API key and DB password
- `node_modules/` — regenerated via `npm install`
- `.expo/` — generated build artifacts

---

## How it works

- The **poller** runs every 10 minutes, fetches sightings from all enabled sources for LA County (US-CA-037) and Orange County (US-CA-059), and upserts them into Postgres
- After each poll, the **clustering engine** groups same-species sightings within 300m into continuing-bird clusters and updates their status
- The **API** serves sightings and clusters to the mobile app
- **Push notifications** fire via Expo's push service whenever new sightings arrive
- The **map** uses OpenStreetMap + Leaflet (free, no API key) rendered inside a WebView

### Data sources

**eBird** — pulls up to 100 notable sightings per region per poll from the eBird notable observations endpoint. Requires a free API key. Location rows on eBird cards are tappable and link to the eBird hotspot page for that location.

**iNaturalist** — pulls rare, community-verified bird sightings. "Verified" means `quality_grade=research` (2+ agreeing community IDs). "Rare" means the species has fewer than `INAT_RARITY_THRESHOLD` total research-grade observations in that area. No API key required. Location rows on iNaturalist cards link to the original observation on inaturalist.org. Each region needs an `inat_place_id` stored in the `regions` table — run `node src/scripts/fixInatPlaceIds.js` to verify or correct them.

### iNaturalist rarity tuning

Adjust `INAT_RARITY_THRESHOLD` in `backend/.env` to control how strict "rare" is:
- Lower (e.g. `5`) = only very rarely seen species
- Higher (e.g. `50`) = includes less common but more regularly seen species

Default is `50`.

### iNaturalist photo licensing

iNaturalist photos carry a variety of Creative Commons licenses. The app **only displays photos with commercially usable licenses**: `CC0`, `CC BY`, `CC BY-SA`, and `CC BY-ND`. Photos licensed as **NC (non-commercial)** — `CC BY-NC`, `CC BY-NC-SA`, `CC BY-NC-ND` — and **all-rights-reserved** photos are never fetched or stored.

In practice, roughly 90% of rare-species taxon photos on iNaturalist are NC or all-rights-reserved, so most sightings show a 🐦 placeholder instead. Tapping the placeholder (or any photo) opens the species page on All About Birds. When a licensed photo is shown, a photographer credit overlay is displayed at the bottom of the image.

This filter is applied in two places:
- `INaturalistSource.js` — at poll time, before storing `photo_url` and `photo_attribution` to the DB
- `App.tsx` (`fetchPhotoForSpecies`) — for eBird sightings where photos are fetched lazily at display time

### Rarity badges

Each sighting card displays a color-coded rarity badge based on the species' all-time observation count in the region (iNaturalist) or eBird notable status:

| Badge | Threshold | Color |
|---|---|---|
| Exceptional | ≤ 3 all-time records | Red |
| Very Rare | 4–9 all-time records | Orange |
| Rare | 10–49 all-time records | Amber |
| Notable | eBird notable / no count | Gray |

### Continuing bird clusters

After each poll the backend runs a spatial clustering pass. Sightings of the same species within 300m of each other are grouped into a **cluster** representing a single continuing individual. Each cluster tracks:

- First and last sighting date
- Number of distinct observer checklists
- User-submitted Refound and Dipped counts

The status label shown on each card and in the map modal is derived from these values:

| Label | Meaning |
|---|---|
| Continuing · Xh ago | Multi-observer or recently refound, seen within 48h |
| Single report · Xd ago | Only one checklist, no independent confirmation |
| Last seen Xd ago | Not seen in 2–7 days |
| May have departed | No sighting in over 7 days |

### Refound and Dipped reporting

Tapping the **Map** button on any sighting opens the map modal, which shows:

- The sighting's location with a dashed green circle indicating the 300m cluster stakeout zone
- Trail dots for all other sightings of the same individual (oldest to newest)
- The current continuing status in the header
- **✓ Refound** and **✗ Dipped** buttons

Tapping either button shows a confirmation sheet. The app requests foreground GPS permission and displays your distance from the cluster centre (e.g. "You are ~120m from this spot"). If you appear to be more than 1km away an amber warning is shown. On confirming a Refound, the cluster's `last_refound_at` is updated immediately for all users, a short bird chirp plays, and your GPS coordinates (if available) are stored with the report. Reports are anonymous (no account required).

### Observer comments

The map modal also fetches live observer notes and community comments from the source API:
- **eBird** — retrieves the full checklist via `/v2/product/checklist/view/{subId}` and shows per-species comments if present
- **iNaturalist** — retrieves the observation's description and community comment thread

Comments are fetched on demand and never stored in the local database.
