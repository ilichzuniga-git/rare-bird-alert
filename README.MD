# Rare Bird Alert (RBA)

A mobile app that shows rare bird sightings for LA & Orange County, powered by eBird data, with push notifications and an interactive map.

## Project structure

```
rba-app/
  backend/   Express API + PostgreSQL + eBird poller
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
EBIRD_API_KEY=YOUR_EBIRD_KEY
EBIRD_ENABLED=true
JWT_SECRET=change_me_to_a_long_random_string
PORT=3000
```

Get a free eBird API key at: https://ebird.org/api/keygen

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

The **most common issue** is the adb tunnel dropping silently after `npm install` or a Metro restart. When in doubt, re-run both `adb reverse` commands.

---

## Useful backend commands

```bash
# Apply any unapplied DB migrations (safe to re-run)
npm run db:migrate

# Manually trigger a one-shot eBird poll
npm run poll:once

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

- The **poller** runs every 10 minutes, fetches notable sightings from eBird for LA County (US-CA-037) and Orange County (US-CA-059), and upserts them into Postgres
- The **API** serves sightings to the mobile app via `GET /api/sightings`
- **Push notifications** fire via Expo's push service whenever new sightings arrive
- The **map** uses OpenStreetMap + Leaflet (free, no API key) rendered inside a WebView
