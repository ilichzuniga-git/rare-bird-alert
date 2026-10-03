This is the Rare Bird Alert (RBA) project — a mobile app ("Birder's Best Friend") that surfaces
rare bird sightings in Los Angeles and Orange Counties (extensible to
other regions), with push notifications. Android is in Play Store
testing; the iOS version is in TestFlight.

Structure:
- backend/ is an Express + Postgres server (Node 22 LTS)
- mobile/ is a React Native app via Expo SDK 57 (TypeScript), one
  codebase for Android and iOS
- docs/ holds architecture and data source notes (see SOURCES.md)

Development environment:
- Windows (main machine, Android): see README.MD
- Mac (iOS builds and the iOS Simulator): see MAC_SETUP.md
- Pull before starting on either machine; both push to main
- Backend runs locally via `npm run dev` from backend/, port 3000
- Mobile runs via `npx expo start` from mobile/ (not `--localhost`,
  which binds IPv6 only on SDK 57). On Android the phone connects over
  USB using `adb reverse tcp:8081 tcp:8081`
- Postgres database is `rba_dev` on localhost:5432

Key principles:
- Data sources are pluggable adapters (see backend/src/sources/)
- Regions are data, not code — adding a county is a DB row, not a
  refactor
- Every sighting carries its source attribution; legal posture is
  tracked in docs/SOURCES.md
- The app is free and non-commercial (decided 2026-09-23), which keeps
  the eBird API on its default non-commercial terms and allows CC BY-NC
  photos. Monetizing would require revisiting both — see docs/SOURCES.MD
- Platform differences stay in Platform.OS checks and the ios/android
  sections of mobile/app.json; shared changes must work on both

Style preferences:
- Provide complete working files, not patches, when changes are
  non-trivial
- Use TypeScript for mobile, JavaScript for backend
- Avoid adding dependencies unless necessary
- Keep secrets in .env files (never commit them)
