# 🐦 Birder's Best Friend

A mobile app for LA & Orange County birders that shows rare bird sightings from eBird and iNaturalist, tracks whether a bird is continuing at a location, and lets chasers report refounds and dips in real time.

## Starting the app in Expo Go (every session)

**Where this runs:** every command below runs in a terminal **on your laptop** (Command Prompt or PowerShell), inside the `mobile` folder: never on the phone, and never from the repo root (`C:\claude\rba-app` itself has no `package.json`). The phone only comes in at step 5, where you type a URL into the **Expo Go app**.

One-time setup (installing `adb`, the Samsung USB driver, USB debugging, `npm install` in `mobile/`) is covered in [Running the app on your phone](#running-the-app-on-your-phone). After that:

1. **Plug the phone into the laptop over USB** and unlock it.
2. **Open a terminal on the laptop** and check the phone is connected:
   ```bash
   adb devices
   ```
   You should see the phone's serial followed by `device`. If it says `unauthorized`, tap **Allow** on the phone's "Allow USB debugging?" prompt.
3. **Forward Metro's port to the phone** (same terminal):
   ```bash
   adb reverse tcp:8081 tcp:8081
   ```
4. **Start Metro from the `mobile` folder** (same terminal):
   ```bash
   cd C:\claude\rba-app\mobile
   npx expo start
   ```
   Use plain `npx expo start`, **not** `--localhost` (see the note below). Ignore the `exp://192.168…` address and QR code it prints; the work network blocks that route. Wait for "Logs for your project will appear below".
5. **On the phone**, open **Expo Go** → **Enter URL** → `exp://127.0.0.1:8081` → **Connect**. The first load takes a while because Metro builds the bundle; after that it's quick.
6. **Edit code on the laptop:** saving reloads the app on the phone automatically. Press `r` in the Metro terminal to force a reload.
7. **Stop:** press `Ctrl+C` in the Metro terminal.

The app talks to the **production backend** by default, so you don't need Postgres or a local server for app changes.

> **Why not `--localhost`:** since the SDK 57 upgrade, `npx expo start --localhost` makes Metro listen only on the IPv6 loopback (`[::1]:8081`). `adb reverse` delivers the phone's traffic to IPv4 `127.0.0.1:8081`, which is refused, and Expo Go shows **"Something went wrong" / "failed to download remote update"**. Plain `npx expo start` listens on every address, so the USB route works. You can check with `netstat -ano | findstr :8081`: you want a `0.0.0.0:8081` line.

**No USB cable handy?** Run `npx expo start --tunnel` instead (skip steps 1–3) and enter the `exp://….exp.direct` address it prints. It routes through the internet over the phone's own Wi-Fi or data, and is slower to start. The first time, it needs `@expo/ngrok`; if it errors asking to install it, run `npm install --no-save @expo/ngrok@4.1.3` inside `mobile/` and retry.

**If it doesn't load:**

| Problem | Fix |
|---|---|
| "Something went wrong" / "failed to download remote update" | Metro was started with `--localhost`, or `adb reverse` was lost (it resets when you replug or restart adb). Restart Metro with plain `npx expo start`, re-run `adb reverse tcp:8081 tcp:8081`, reopen `exp://127.0.0.1:8081` |
| `adb devices` lists nothing | Try another cable or USB port; on a Samsung, check the Samsung USB driver is installed (see [Troubleshooting](#troubleshooting)) |
| `ConfigError: … package.json does not exist` | You're in the repo root — `cd mobile` first |
| Port 8081 already in use | An old Metro is still running: close that terminal, or run `npx kill-port 8081` |
| "Project is incompatible with this version of Expo Go" | The Play Store updated Expo Go to a newer SDK than the app. Upgrade the app's SDK to match (`npx expo install expo@^<version> --fix`), or turn off auto-update for Expo Go |

The `expo-notifications` messages in the Metro log are expected: Expo Go doesn't support push notifications.

---

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
- [Expo Go](https://expo.dev/go) on your phone, matching the app's Expo SDK (57) — Expo Go auto-updates from the Play Store and only runs the one SDK version it ships with, so this can silently drift out of sync with the app; see [Starting the app in Expo Go](#starting-the-app-in-expo-go-every-session) if it says "incompatible"
- Android Debug Bridge (ADB) — `winget install Google.PlatformTools` on Windows, or via Android Studio
- [PostgreSQL](https://www.postgresql.org/) on port 5432 — only needed to run the backend locally

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

For the everyday commands, see [Starting the app in Expo Go](#starting-the-app-in-expo-go-every-session) above — this section is the one-time setup and the full picture behind them.

By default the app talks to the **production backend** (`https://rba-backend.cloudedapps.org`), so for mobile-only changes you just need Metro — no local backend or Postgres.

### 1. One-time: install adb and connect the phone

Enable **USB debugging** (Settings → About phone → tap Build number 7× → Developer options → USB debugging), plug the phone into the laptop over USB, and accept the "Allow USB debugging?" prompt. On Windows, install `adb` first: `winget install Google.PlatformTools` (see [Prerequisites](#prerequisites)). Then, in a laptop terminal:

```bash
adb devices   # phone should be listed as "device" (not "unauthorized")
```

USB is the reliable path on networks with client isolation (e.g. work Wi-Fi), where the phone can't reach the laptop's LAN IP. Then forward Metro's port:

```bash
adb reverse tcp:8081 tcp:8081   # re-run after replugging the phone
```

### 2. Start Metro — from `mobile/`, not the repo root

```bash
cd mobile
npx expo start
```

Not `--localhost`: on SDK 57 that binds Metro to IPv6 `[::1]` only, which `adb reverse` can't reach (see the note in [Starting the app in Expo Go](#starting-the-app-in-expo-go-every-session)). `--tunnel` also works, without USB.

### 3. Open in Expo Go

Open **Expo Go** on the phone → **Enter URL** → `exp://127.0.0.1:8081` (or the `exp://….exp.direct` address if using `--tunnel`) → **Connect**. Code changes reload automatically.

Expected in Expo Go: an `expo-notifications` error saying push was removed from Expo Go in SDK 53. `mobile/src/notifications.ts` loads that module dynamically and only outside Expo Go for exactly this reason — if you ever see this crash the whole app (a red "[runtime not ready]" screen, not just a log line), something is importing `expo-notifications` statically again. Test real notifications with a Play Store Internal Testing build instead.

### Optional: run against a local backend

Only needed when changing `backend/` (requires Postgres — see First-time setup).

```bash
cd backend
npm run db:migrate   # npm start migrates automatically; npm run dev does not
npm run dev
```

Forward the backend port to the phone as well:

```bash
adb reverse tcp:3000 tcp:3000
```

This only works over USB, not `--tunnel`. If the backend is also only listening on IPv6 (`netstat -ano | findstr :3000` shows only `[::1]`), start it so it binds IPv4 too.

Create `mobile/.env.local` (git-ignored) with:

```
EXPO_PUBLIC_API_BASE=http://127.0.0.1:3000
```

Restart Metro after creating, changing, or deleting it (the value is baked in at bundle time). Delete the file to go back to production.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `adb devices` lists nothing (Windows, Samsung) | Install the [Samsung Android USB Driver](https://developer.samsung.com/android-usb-driver) — without it Windows binds a generic driver to the phone's ADB interface. Other brands: [Google USB Driver](https://developer.android.com/studio/run/win-usb) |
| `adb devices` shows `unauthorized` | Unlock the phone and accept the "Allow USB debugging?" prompt |
| `ConfigError: … package.json does not exist` | You ran Expo from the repo root — `cd mobile` first |
| "Something went wrong" / "failed to download remote update" | Metro started with `--localhost` (IPv6-only on SDK 57), or `adb reverse` was lost. Use plain `npx expo start` and re-run `adb reverse tcp:8081 tcp:8081` |
| `[runtime not ready]: Error: expo-notifications: …` (red screen, app never renders) | A real crash, not the expected log-only warning — something added a static `import ... from 'expo-notifications'`. Load it dynamically in `src/notifications.ts` instead (only outside Expo Go) |
| `CommandError: … @expo/ngrok … non-interactive mode` when running `--tunnel` | Run `npm install --no-save @expo/ngrok@4.1.3` inside `mobile/`, then retry |
| "relation regions does not exist" | Run `npm run db:migrate` in the backend folder |
| "Network request failed" on phone | If using a local backend, re-run `adb reverse tcp:3000 tcp:3000` (USB only), then tap Retry in the app |
| White screen / "No apps connected" in the Metro terminal | The previously-connected app crashed or was closed — reopen it from Expo Go's URL/recents |
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

## Production deployment

The app runs against a live backend hosted on Dokploy at **https://cloudedapps.org**.

| Service | URL |
|---|---|
| Backend API | https://rba-backend.cloudedapps.org |
| Dokploy dashboard | https://cloudedapps.org |

The backend is configured with these environment variables in Dokploy:

```
NODE_ENV=production
PORT=3000
DATABASE_URL=<internal postgres connection string>
EBIRD_API_KEY=<key>
EBIRD_ENABLED=true
INAT_ENABLED=true
INAT_RARITY_THRESHOLD=20
INAT_LOOKBACK_DAYS=30
```

If you need to run database migrations on the production server, open the **Docker Terminal** in the Dokploy app service and run:

```bash
node src/db/migrate.js
```

---

## Updating the app

### Backend changes

1. Make your changes in `backend/`
2. Commit and push to GitHub — Dokploy is set to **Autodeploy on push**, so the server updates automatically within a minute or two
3. New migrations apply automatically — `npm start` runs `node src/db/migrate.js` before starting the server

### Mobile app changes

1. Make your changes in `mobile/`
2. Commit and push to GitHub
3. Run `eas build -p android --profile production` and download the `.aab`
4. Upload the `.aab` to Play Console → Internal Testing → Create new release
5. Testers get the update automatically through the Play Store

You do **not** need to rebuild for backend-only changes — those take effect immediately since the app talks to the live server.

---

## Building the app

The app is built in the cloud using [EAS Build](https://docs.expo.dev/build/introduction/) (Expo's build service). You need an Expo account — sign up free at https://expo.dev.

**Where this runs:** every command below runs in a terminal on the laptop, inside `C:\claude\rba-app\mobile`. The build itself happens on Expo's servers; nothing needs the phone.

### One-time setup

```bash
npm install -g eas-cli@23.2.0
eas login
```

`eas-cli` is pinned to a vetted version (see `security.md`); bump it deliberately rather than taking whatever is newest.

**Firebase config for cloud builds.** `mobile/google-services.json` (needed for push notifications) is git-ignored, and EAS doesn't upload ignored files. Instead, it's stored once as a secret EAS file variable; `mobile/app.config.js` uses it in cloud builds and the local file otherwise:

```bash
eas env:set --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json --environment production --environment preview --visibility secret
```

Re-run the same command if the Firebase file ever changes (`env:set` creates or updates).

**Version codes.** Google Play rejects any upload whose version code it has seen before. `eas.json` sets `appVersionSource: "remote"` and `autoIncrement: true` on the production profile, so EAS stores the version code and bumps it on every production build. Check it with `eas build:version:get -p android`. If Play Console has ever received a higher code than EAS shows, raise it once with `eas build:version:set -p android`.

The Android keystore (signing key) is managed by EAS and was generated via `eas credentials`. Do not delete it — it's required for all future Play Store uploads.

### Build profiles

The `mobile/eas.json` file defines two profiles:

| Profile | Output | Use for |
|---|---|---|
| `preview` | `.apk` | Quick local testing — sideload directly onto any Android device |
| `production` | `.aab` (App Bundle) | Google Play Store (Internal Testing / release); auto-increments the version code |

The user-visible version (`1.1.0`) is `expo.version` in `app.json`; bump it for releases testers should notice.

### Build a preview APK (sideloadable, no Play Store needed)

```bash
cd mobile
eas build -p android --profile preview
```

Takes roughly 5–10 minutes. When done, EAS prints a download link for the `.apk` file.

Install it on your Android phone by:
1. Downloading the `.apk` to your phone
2. Opening the file — Android will prompt you to allow installs from unknown sources
3. Tap Install

> **Note:** Push notifications do **not** work in preview APK builds or in Expo Go. Use the Play Store Internal Testing track to test notifications.

### Build a production AAB (for Play Store)

```bash
cd mobile
eas build -p android --profile production
```

Takes roughly 10–20 minutes. EAS prints a link to the build page; download the `.aab` from there, then upload it as described below.

---

## Play Store — Internal Testing (Beta)

The app is distributed to beta testers via Google Play's Internal Testing track. Testers install through the Play Store normally — no sideloading warnings, and push notifications work correctly.

### Uploading a new build to testers

1. Build a production AAB (see above)
2. Go to [Google Play Console](https://play.google.com/console) → Birder's Best Friend
3. Navigate to **Testing → Internal Testing**
4. Click **Create new release**
5. Upload the `.aab` file, add release notes, and click **Save and publish**
6. Testers receive the update automatically through the Play Store within a few minutes

### Adding new testers

1. In Play Console go to **Testing → Internal Testing → Testers tab**
2. Edit your tester email list and add their Gmail address
3. Save, then send them the opt-in URL shown on that page
4. They open the URL on their Android device, tap "Become a tester", then install from the Play Store

> **Important:** You must add yourself to the tester list too, or your device will keep running the old sideloaded version.

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

- The **poller** runs every 10 minutes, fetches sightings from all enabled sources for LA County (US-CA-037) and Orange County (US-CA-059), and upserts them into Postgres. Only genuinely new sightings count as new and trigger push notifications. Sightings older than 28 days are skipped and purged.
- After each poll, the **clustering engine** groups same-species sightings within 300m into continuing-bird clusters and updates their status
- The **API** serves sightings and clusters to the mobile app
- **Push notifications** fire via Expo's push service whenever new sightings arrive; tokens for uninstalled apps are pruned automatically
- The **map** uses OpenStreetMap + Leaflet (free, no API key) rendered inside a WebView

The app is **free and non-commercial**. That's what lets it use eBird's API under its default terms and show CC BY-NC photos. See [`docs/SOURCES.MD`](docs/SOURCES.MD) before changing that.

### Data sources

**eBird** — pulls up to 100 notable sightings per region per poll from the eBird notable observations endpoint. Requires a free API key. Notable sightings can include reports not yet confirmed by eBird reviewers.

**iNaturalist** — pulls rare, community-verified bird sightings. "Verified" means `quality_grade=research` (2+ agreeing community IDs). "Rare" means the species has fewer than `INAT_RARITY_THRESHOLD` total research-grade observations in that area. No API key required. Each region needs an `inat_place_id` stored in the `regions` table — run `node src/scripts/fixInatPlaceIds.js` to verify or correct them.

**eBird species codes for iNaturalist sightings** — iNaturalist has no eBird codes, so the backend downloads eBird's taxonomy once a day (`backend/src/ebirdTaxonomy.js`) and fills in `species_code` by scientific name in `/api/sightings` responses. Only the response is changed. The database column stays `NULL` for iNaturalist rows, because it is part of the sightings dedupe key.

Full licensing and attribution details for every source are in [`docs/SOURCES.MD`](docs/SOURCES.MD).

### About screen and attribution

The **About** button in the header opens `mobile/src/AboutModal.tsx`, which carries the required credits:

- eBird: *"Data from eBird (Cornell Lab of Ornithology, ebird.org)"*
- iNaturalist data and the photo licenses
- © OpenStreetMap contributors and Leaflet
- a short "your data" note

The header also shows "Data from eBird & iNaturalist" at all times. Keep the About text in sync with `docs/SOURCES.MD`.

### iNaturalist rarity tuning

Adjust `INAT_RARITY_THRESHOLD` in `backend/.env` to control how strict "rare" is:
- Lower (e.g. `5`) = only very rarely seen species
- Higher (e.g. `50`) = includes less common but more regularly seen species

Default is `50`.

### Photo licensing

Bird photos come from iNaturalist under Creative Commons licenses. Because the app is non-commercial, it shows:

| License | Shown? |
|---|---|
| `CC0`, `CC BY`, `CC BY-SA`, `CC BY-ND` | ✅ |
| `CC BY-NC`, `CC BY-NC-SA`, `CC BY-NC-ND` | ✅ (non-commercial use only) |
| All rights reserved | ❌ never fetched or stored |

Allowing NC licenses raised photo coverage from 3 to 30 out of 40 sampled species. Each photo shows the photographer credit **and the license code** in an overlay, as CC requires. Tapping a photo, or the 🐦 placeholder, opens the species page on All About Birds.

The filter lives in two places that must stay in sync:
- `USABLE_LICENSES` in `backend/src/sources/INaturalistSource.js`: photos stored with iNaturalist sightings at poll time
- `USABLE_LICENSES` in `mobile/App.tsx`: photos looked up lazily for eBird sightings

### Rarity badges

Each bird gets a color-coded rarity tier from the species' **all-time research-grade iNaturalist observations in its county**. That count comes with iNaturalist sightings; for eBird sightings the backend looks it up by scientific name (`backend/src/rarity.js`, cached daily, added to `/api/sightings` responses only). A species iNaturalist knows from the other county but never recorded in this one counts as 0.

| Badge | Threshold | Color |
|---|---|---|
| Exceptional | ≤ 3 all-time records | Red |
| Very Rare | 4–9 all-time records | Orange |
| Rare | 10–49 all-time records | Amber |
| Notable | 50+ records, or no iNaturalist match (eBird can still flag these, e.g. out of season) | Gray |

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

### Map tab

- **One pin per bird.** Sightings in the same cluster collapse into a single pin, using their most recent report. For example, five observers' checklists of one Vesper Sparrow show as one pin.
- **Tapping a pin** opens that bird's Refound/Dipped view.
- **A spot with several birds** (a busy hotspot) shows a picker listing each bird with its report count and date, e.g. "Vesper Sparrow · 5 reports · Sep 17".

### Refound/Dipped view

Opened by tapping a map pin, or the **location address** on any sighting card. It shows:

- **Header:** the bird's name, location and continuing status, plus an **eBird species page ↗** link.
- **Map:** the report's location with a dashed green circle for the 300m cluster stakeout zone, and trail dots for the other sightings of the same individual.
- **✓ Refound** and **✗ Dipped** buttons.
- **Report chips**, when the bird has several reports: one chip per report (date, time, source). Selecting a chip switches the map, coordinates and observer notes to that report.
- **📍 Open this report's location in Maps:** opens the phone's maps app at the report's exact coordinates for directions.
- **🎯 Open observer's exact spot in Maps:** shown when the observer typed coordinates into their notes, which birders often do because hotspot reports all share the hotspot's pin. Decimal (`34.15575° N, 118.28397° W`, `34.15575, -118.28397`) and degree-minute-second (`34°09'20.7"N 118°17'02.3"W`) formats are recognised. Only coordinates within 25km of the report are accepted. The spot also gets an orange target marker on the map, with its distance from the report pin.
- **Observer notes and comments** for the selected report.

Tapping Refound or Dipped shows a confirmation sheet. The app requests foreground GPS permission and displays your distance from the cluster centre (e.g. "You are ~120m from this spot"). If you appear to be more than 1km away, an amber warning is shown.

On confirming a Refound:
- the cluster's `last_refound_at` is updated immediately for all users
- a short bird chirp plays
- your GPS coordinates (if available) are stored with the report

Reports are anonymous (no account required). To limit abuse, the backend:
- accepts at most 10 reports per IP per 15 minutes
- counts a repeat report of the same type on the same bird from the same IP only once per hour

### Observer comments

The Refound/Dipped view fetches live observer notes and community comments from the source API:
- **eBird:** retrieves the full checklist via `/v2/product/checklist/view/{subId}`. Shows the per-species observer note plus the checklist comments, which eBird may return as a single string.
- **iNaturalist:** retrieves the observation's description and community comment thread.

Comments are fetched on demand and never stored in the local database.
