This is the Rare Bird Alert (RBA) project — a mobile app that surfaces
rare bird sightings in Los Angeles and Orange Counties (extensible to
other regions), with push notifications.

Structure:
- backend/ is an Express + Postgres server (Node 22 LTS)
- mobile/ is a React Native app via Expo SDK 54 (TypeScript)
- docs/ holds architecture and data source notes (see SOURCES.md)

Development environment:
- Backend runs locally via `npm run dev` from backend/, port 3000
- Mobile runs via `npx expo start --localhost` from mobile/, with the
  phone connected over USB using `adb reverse tcp:8081 tcp:8081`
- Postgres database is `rba_dev` on localhost:5432

Key principles:
- Data sources are pluggable adapters (see backend/src/sources/)
- Regions are data, not code — adding a county is a DB row, not a
  refactor
- Every sighting carries its source attribution; legal posture is
  tracked in docs/SOURCES.md
- The eBird API uses a non-commercial license; commercial use will
  be requested from Cornell before any paid launch

Style preferences:
- Provide complete working files, not patches, when changes are
  non-trivial
- Use TypeScript for mobile, JavaScript for backend
- Avoid adding dependencies unless necessary
- Keep secrets in .env files (never commit them)