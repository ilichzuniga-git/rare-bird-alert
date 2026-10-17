# Roadmap

What is planned, being considered and being watched for Birder's Best Friend (Android and iOS). Tick items here as they ship. Project overview and setup: [README.MD](README.MD).

## Planned

**Map pins that show what's fresh; featured card only for recent birds (2026-10-16).** User-requested.
- [x] A pin shines (a gloss sweep and two gold sparkles, every 3 s) when a user refound the bird in the last 24 h, or when a Rare, Very Rare or Exceptional bird was seen today. Notable birds seen today don't shine (14 birds today vs 3 rare ones). Still under Reduce Motion (`LeafletMap.tsx` `.shine` / `.glint`)
- [x] A pin is faded and greyed, with no motion, when a user dipped the bird in the last 24 h and there's been no refound or report since. The dip wins over the shine
- [x] The featured (hero) card goes only to a bird seen in the last 3 days (`FEATURE_DAYS` in `birds.ts`): the rarest on Last 7 / 30 days, the closest on Near me. With none that recent there's no hero, just the list. Was: an Evening Grosbeak last seen 5 days ago headlined
- [x] Checked in the iPhone simulator (shine, sparkles and fade forced on for two pins; hero on Last 7 days)
- [ ] Test on real phones, both platforms
- [ ] Guide and What's new entry

**Repeat alerts for the same bird (fixed 2026-10-16).** Seen on Oct 11 (Pine Siskin) and Oct 12 (Catalina Red Crossbill and Clay-colored Sparrow alerted at 12:00, 12:50, 1:10 and 1:50 PM). eBird shares a group's checklist with each member, and every copy gets its own checklist id, often days later, with the same species, place and minute. Each copy was inserted as a new sighting and alerted again. The poller now skips a report when eBird already gave one for that species, spot and minute under another checklist (`backend/src/poller/index.js`). 133 of the 496 eBird rows live on Oct 16 were such copies.
- [x] Poller skips shared-checklist copies, so they neither alert nor count as extra reports
- [ ] Confirm no repeats over the next few days of alerts
- [ ] Copies stored before the fix still inflate "N reports" until they age out (28 days); delete them if that bothers anyone

**Trip drawer: save birds for a day trip.** Saved birds stay on the phone only: no accounts, nothing sent to the server, no change to the Data safety form or App Store privacy answers. Code: `mobile/src/trip.ts`, `TripSheet.tsx`, `CarIcon.tsx`.
- [x] Car button on the bird detail card saves it to the trip (turns green with a check)
- [x] Car button next to the search bar opens the trip, with a count badge
- [x] Saved birds refresh from the live feed, so their status is current ("Refound today", "Continuing")
- [x] Each saved bird keeps a snapshot (its latest report), so it still shows after it leaves the feed, marked "No recent reports"
- [x] Map shows only the saved birds, numbered in driving order from you (nearest stop next); your spot is a car pin
- [x] **Directions** button opens Google Maps with every stop as a waypoint (plain link, no API key). Google caps it at 10 stops, so the trip header counts "N of 10 stops" and flags anything past 10 as "Not in directions"
- [x] Swipe a bird sideways to remove it; two-tap "Clear"
- [x] On-device storage via `expo-file-system` (a JSON file in the app's private documents folder). It was already in the lockfile as a dependency of `expo`, so no new third-party package was needed

**iOS version.** Same codebase as Android; built and tested on a Mac (see [`MAC_SETUP.md`](MAC_SETUP.md)). Started 2026-10-02.
- [x] iOS config: bundle id `com.ilichzuniga.rarebirdalert`, export-compliance flag, "while using" location prompt only
- [x] About screen header clears the status bar / Dynamic Island
- [x] Trip **Directions** offers Apple Maps or Google Maps on iOS (Apple Maps takes the same 10 stops)
- [x] iPad support: split hero card on wide screens; tested on iPhone and iPad simulators, portrait and landscape
- [x] Apple Developer Program, EAS credentials (certificate, provisioning profile, APNs push key; renew by 2027-10-03)
- [x] First TestFlight build (1.3.0 build 3); App Store Connect app "Birder's Best Friend"
- [x] TestFlight on a real iPhone (a family member, build 3, 2026-10-04). Her feedback led to the at-sea and notification-tap changes below
- [x] TestFlight on her iPhone: at-sea labels and switch confirmed on 1.4.0 (build 4, 2026-10-04; she had to reinstall before the changes appeared); push notifications confirmed working (2026-10-07)
- [x] App Store listing (2026-10-07): screenshots (iPhone 6.3" 1206×2622 from the iPhone 18 Pro simulator, iPad 13" 2064×2752), subtitle, description, keywords, Reference / Education, age rating 4+, USA only, free. App Privacy: Device ID (push token) and Other User Content (Refound/Dipped reports), both App Functionality only, not linked, no tracking; location not collected. Privacy policy URL `https://rba-backend.cloudedapps.org/privacy`, support URL `https://rba-backend.cloudedapps.org/guide/`
- [x] Submitted 1.5.0 (5) for App Store review (2026-10-07), set to manual release
- [x] Added the product page header video (`icons/app-store-header.mp4`) and the search results image (`icons/app-store-search-result.png`) to the listing and resubmitted for review (2026-10-07). See [Store assets](README.MD#store-assets)
- [x] Answered App Review's Guideline 2.1 request (2026-10-08): a simulator screen recording (no iPhone available; `AppStoreReview/`) plus the written answers in [docs/APP_REVIEW.md](docs/APP_REVIEW.md), also pasted into the App Review Notes field
- [x] Approved by App Review, then **Release This Version** in App Store Connect (released 2026-10-12)

**Both apps**
- [x] Guide site live at `https://rba-backend.cloudedapps.org/guide/` (2026-10-04): Tour, What's new, Privacy; `/privacy` redirects to its Privacy tab. Source and screenshot how-to: `backend/src/site/README.md`. Add a What's new entry with every release
- [ ] **1.5.0, both apps.** Shipped to testers 2026-10-04; open until the real-phone test below passes:
  - [x] "What's new" card, shown once per version (`mobile/src/WhatsNewCard.tsx`; text in `WHATS_NEW`, `mobile/src/guide.ts`). Its buttons open the guide in an in-app browser (`expo-web-browser`, a new native module, so it needs the new build)
  - [x] About screen modernized (`mobile/src/AboutModal.tsx`): page sheet on iPhone, header like the bird page, a teal Guide card (tour / what's new), source cards with link pills, a Privacy policy pill
  - [x] App-icon badge: the backend counts alerts per device since its app was last opened (`device_tokens.unread`, migration 019, live) and sends the count to builds that register with `badge: true`; the app clears it on launch, on returning to the foreground, and for alerts that arrive while it's open (`POST /api/devices/seen`). Older builds get no badge
  - [x] Guide: 1.5.0 entry in What's new, new `about.jpg`, tour step 09 about the guide card, badge in the alerts step (2026-10-04)
  - [ ] Test on real phones (iOS notifications confirmed 2026-10-07; Android 2026-10-11): the card and Guide links on both platforms; the badge counts up with alerts and clears on opening (not testable in Expo Go). Android not yet tried in an emulator
  - [x] Built from commit b283018 and uploaded (2026-10-04): iOS 1.5.0 build 5 on TestFlight, Android 1.5.0 versionCode 9 on Play Internal testing
- [x] About screen and privacy page match current data handling: reports store only bird, type and time; location stays on the phone (2026-10-03)
- [x] `expo.version` bumped to **1.4.0** (2026-10-04), first used by the iOS TestFlight build with the at-sea and notification changes
- [x] **Android upload (1.4.0, versionCode 8):** built with `eas build -p android --profile production`, uploaded to Play Console → Internal Testing (2026-10-04). Brings Android up to the iOS build:
  - **At-sea birds** (see below): "At sea" labels, no Directions or trip button for them, and the "🚤 At sea" switch, hidden by default (red, struck through while hidden)
  - **Notification taps** (see below): a tap opens the bird, or lists the announced birds under "Just reported". The new notification wording is already live from the server, but taps do nothing on 1.3.0
  - About text fix and the search box AutoFill change
  - First Android build without the location-sending report code (1.3.0 and earlier still send it; the server ignores it)
  - Test on an Android phone before uploading: at-sea switch and labels, a notification tap with the app open, in the background and closed
- [x] **Google Play production access** applied for (2026-10-10), after closed testing via a tester service; survey answered with that service's suggested answers
- [x] Production access granted (2026-10-11)
- [x] Release 1.5.1 to Production in Play Console (live by 2026-10-12) (built with the Last 7 days fix; first Android release since the FCM V1 key was added)
- [x] iOS 1.5.1 build 6 (EAS b994bcbd) uploaded and submitted to App Review (2026-10-12), set to release automatically once approved
- [ ] iOS 1.5.1 live on the App Store; then add the date to the guide's What's new
- [x] **1.6.0** (Near me range, Closest to you, Transit, island ferry note, sparkle/fade pins, 3-day hero) built 2026-10-16: iOS build 7 (EAS 3b0862a4) submitted to App Review, Android vc 11 (EAS c78b9a12) sent to Play Production review. Guide entry live
- [ ] 1.6.0 live on both stores; then add the dates to the guide's What's new
- [ ] **1.7.0** (dark mode, offline feed, dip reds and "Dipped ×N", Newest/Rarest sort, accessibility labels, map name declutter, About "faster than eBird" card) builds started 2026-10-17: iOS build 8 (EAS a9092e7c), Android 12 (EAS a4f71997). Guide entry live. Android: upload the .aab to Production (replaces 1.6.0, which was the latest Production release). iOS build 8 uploaded to App Store Connect 2026-10-17 (EAS submission 5afbdd23); submit for review once 1.6.0 (in review) is approved. Android .aab: https://expo.dev/artifacts/eas/yel7m_nHMEHZyPjDFaWNw9BxtUjKn9ju_KSuQlz3p3U.aab
- [ ] Retake the guide screenshots (Near me with the range, island and Transit on a bird page) after the next round of updates

**At-sea (pelagic) birds.** From TestFlight feedback (2026-10-04): the rarest birds were often far offshore, seen from pelagic boat trips, and the app offered driving directions to a point in the ocean. Shared code, so both apps get it; the backend half is live as soon as it's pushed, and the app half ships with the next build of each. Older builds ignore the new field, so nothing changes for them until they update.
- [x] Backend adds `at_sea` to each `/api/sightings` row: more than 2 km from land, using Natural Earth's 1:10m land and minor-islands polygons clipped to Southern California (`backend/src/atSea.js`, `backend/src/data/socal-land.json`, about 16 KB). Computed per response, so no migration. Catalina, San Clemente, Santa Barbara Island and the northern Channel Islands count as land, as do beaches, harbours and bays. A region outside lat 32.0–35.6, lng -120.5 to -116.5 needs the data re-clipped
- [x] Bird detail: "🚤 At sea" in the header and a "Seen at sea" note; no Directions and no car (save to trip) button. A bird saved before can still be removed
- [x] List rows, the hero card and map pins say "At sea"
- [x] "🚤 At sea · N" switch next to the source filters hides those birds; remembered on the phone (`mobile/src/prefs.ts`, a JSON file like the trip). Hidden by default, since pelagic trips are rare next to land birding; tap the pill to show them
- [x] The hero card picks the rarest bird you can reach; an at-sea bird leads only when nothing else is in view
- [x] Trip directions skip at-sea birds (saved before this change)

**Notification taps.** From TestFlight feedback (2026-10-04): tapping a notification just opened the app where it was left, and the notification never said which bird. Shared code, so both apps get it. The server half is live once pushed, so testers on older builds see the new wording right away; tapping only works after they update.
- [x] One notification per poll cycle, instead of one per source and county (`backend/src/poller/index.js`)
- [x] It names the birds, rarest first: "🐦 Craveri's Murrelet" / "Crespi Knoll (ORA Co.) · Orange County" for one species, "🐦 3 new rare birds in Orange County" / "Cocos Booby, Least Storm-Petrel and 1 more" for several. `data.sightingIds` carries the new sighting ids (up to 100) (`backend/src/notifications.js`)
- [x] At-sea birds come after the ones you can reach and say "(at sea)": "🐦 Craveri's Murrelet (at sea)", "Pinyon Jay and Cocos Booby (at sea)", or "🐦 2 new rare birds at sea off Orange County" when they're all at sea. Pelagic trips are rare next to land birding. Everyone still gets them; the app's at-sea switch lives on the phone, so the server can't honor it without storing that setting
- [x] Tapping refreshes, then opens the bird's detail when it's one bird; otherwise "This week" lists the announced birds first: the rarest as the hero (★ NEW), the rest under "Just reported", then "Also this week" as usual. Announced birds show even if they were seen before this week or are at sea while those are hidden (`mobile/src/notifications.ts`, `App.tsx`, `RaritiesSheet.tsx`)
- [x] Works when the tap launches the app from closed, too
- [x] "Just reported" clears when you switch tabs, pull to refresh, or leave the app
- [ ] Test on a real phone (Expo Go has no push): one-bird and several-bird notifications, app open / in the background / closed

**BirdWeather corroboration.** Permission granted 2026-09-28; stay within the scope in [docs/SOURCES.MD](docs/SOURCES.MD#birdweather-integrated).
- [x] Backend job: for each active rare-bird report, query BirdWeather for high-confidence detections of that species within ~300 m on the same days, a few times an hour
- [x] Only count a match with ≥2 detections (single rare detections are often misidentifications)
- [x] Store only the match (station, species, date, confidence), never audio
- [x] "Also heard by a BirdWeather station" tag in the bird detail view, crediting BirdWeather and BirdNET and linking to the station page
- [x] Detections never create alerts or reports on their own
- [x] Off unless `BIRDWEATHER_ENABLED=true`. Code: `backend/src/birdweather.js`, migration 016, `SightingDetail.tsx`; plan in [docs/BIRDWEATHER_PLAN.md](docs/BIRDWEATHER_PLAN.md)
- [ ] Let Tim at BirdWeather know when it ships

**Android code shrinking (R8), fix by February 2027.** Play Console (2026-10-11, on 1.5.0 vc 9) scores the bundle's obfuscation at 1% and says under 25% "may impact your visibility and publishing capabilities" after the deadline. Expo leaves R8 off by default. Do it in the next regular release, not a rushed point release.
- [ ] Add `expo-build-properties` to `mobile/app.json` plugins with `android.enableMinifyInReleaseBuilds: true` and `android.enableShrinkResourcesInReleaseBuilds: true` (Android only; iOS builds are unaffected)
- [ ] Build it and test the release build on a real phone before uploading: launch, map and pins, bird detail, search, trip, Refound / Dipped, guide links, a notification and a notification tap. Shrinking can strip code a library loads by reflection, which crashes only in release builds; add keep rules (`extraProguardRules`) for whatever breaks
- [ ] Check the obfuscation score in Play Console once the build is uploaded

**"Near me" has no distance limit.** Tester feedback (2026-10-13), from Long Beach: "I'm not sure I'd consider a bird in Lancaster near me. How far away is the app tracking?" It isn't tracking any distance. `period === 'near'` keeps every bird the API returns (the last 28 days; `inPeriod` in `mobile/src/birds.ts` returns true) and only sorts them by distance (`mobile/App.tsx`, the `birds` memo). The map then fits all of those pins plus you, so it covers both counties. The location is also read once per app session and never refreshed (`choosePeriod`), so it goes stale if you drive somewhere.
- [x] Near me keeps to a radius: 25 km by default, with a "Within 10 / 25 / 50 km" row under the segment while Near me is on, remembered in `mobile/src/prefs.ts` (`nearRadiusKm`; choices in `NEAR_RADII_KM`, `mobile/src/birds.ts`). Kilometres, like every other distance in the app. List heading reads "Also within 25 km"
- [x] Time window: the last 7 days, matching the first tab (`inPeriod`)
- [x] Map: a dashed circle shows the radius, and the map fits to it (`showMe` / `fitAll` in `mobile/src/LeafletMap.tsx`)
- [x] Empty state: "No rare birds within 10 km in the last 7 days." with a "Widen to 25 km" button (none at 50 km)
- [x] Location refreshes when Near me (or the trip) is tapped again and when the app comes back to the foreground on those views, keeping the last fix until the new one arrives. The map refits when the spot moves, unless a bird is open
- [x] Checked in the iPhone simulator (2026-10-16): circle and fit at 25 km from Long Beach, the empty state at 10 km in the Sespe Wilderness, and a refresh on returning to the app after the location moved
- [ ] Test on real phones, both platforms
- [ ] Update the guide's Near me step (`backend/src/site/index.html`) and the What's new entry

**Island birds get walking directions.** Seen 2026-10-12: Directions for a rare bird on Santa Catalina Island opened walking directions, because there's no road from the mainland. Islands rightly count as land for the at-sea check, so they keep the Directions button. Plan: flag island sightings (the island polygons in `backend/src/data/socal-land.json` are separate from the mainland) and show "🏝️ Island · ferry needed" instead of driving directions. Possibly link to the ferry (Catalina Express from Long Beach, San Pedro or Dana Point; Island Packers for the Channel Islands). Trip directions should skip them, like at-sea birds.
- [x] Backend: `island` (the island's name, or null) on `/api/sightings` rows next to `at_sea` (`islandAt` in `backend/src/atSea.js`). On an island ring or within the same 2 km coast buffer, so Two Harbors counts. Terminal Island is bridged, so it stays mainland. Live 2026-10-16; `at_sea` matched the old result on all 500 rows
- [x] App: "🏝️ Island" in the lists and header, an "On <island>" card with how to get there, a "⛴️ Ferry ↗" pill (Catalina Express; Island Packers for the Channel Islands) in place of Directions and Transit. San Clemente and San Nicolas say Navy, closed to the public; the Coronado Islands say no landing. Can't be saved to the trip; one saved earlier is skipped in routing. Checked in the iPhone simulator on a Catalina Red-headed Woodpecker (2026-10-16)
- [ ] Test on real phones, both platforms

**Public transit directions for one bird.** Requested by a user. Only on a single bird's Directions button, not the trip: someone on transit is unlikely to cross the city for several birds the way a driver does, and transit routing doesn't handle multiple stops anyway. Plain links, no API key, like driving.
- [x] Bird screen: a "🚌 Transit" pill next to Directions (`openTransitDirections` in `mobile/src/util.ts`). Android opens Google Maps (`travelmode=transit`); iOS asks Apple Maps (`daddr` + `dirflg=r`, works on every iOS version) or Google Maps, offering Google only when its app is installed (`comgooglemaps://` with `directionsmode=transit`): Google's mobile website ignores the travel mode and opens on driving. Without the app, Transit goes straight to Apple Maps. Apple link checked in the simulator: opens Directions in transit mode from My Location (2026-10-16)
- [x] None for at-sea birds or obscured iNaturalist locations (same rule as Directions)
- [x] Island birds get the ferry note instead (with the island work above)
- [x] Trip directions stay driving only
- [ ] Test on real phones: the pill on a bird page, both map apps on iPhone, Google Maps on Android
- [ ] Update the guide and the What's new entry

**Code review fixes (from `mcode_review.md`, 2026-10-17).** Built 2026-10-17, unreleased:
- [x] Offline: the last feed that loaded is kept in `feed.json` (`mobile/src/feed.ts`, like the trip and prefs). With no signal the app opens on it, and the header says "offline · data from 6:12 AM" instead of an error. Checked in the simulator against an unreachable server. Photos for eBird birds still need the network (iNaturalist lookups).
- [x] Newest / Rarest toggle beside the list title on Last 7 / 30 days, kept in prefs (`listSort`). Near me stays closest-first; "Just reported" keeps its order.
- [x] Accessibility: list rows and the hero read one sentence (name, rarity, when, where, distance, status, dips); roles and selected state on the period tabs, source and radius pills, report chips, Refound / Dipped, trip and About buttons. Labels checked in the simulator's accessibility tree.
- [x] Push registration used its own hard-coded server address (`notifications.ts`); it now shares `API_BASE` from `util.ts`
- [x] Trip directions on iPhones older than iOS 18.4 (no Apple multi-stop link) go straight to Google Maps
- [x] Map name tags no longer pile up (seen on the full 30-day feed): tags are placed in priority order (selected bird, trip stops, then the most recent Exceptional birds) and any that would touch one already placed is hidden; it re-runs after every zoom or pan, so more names appear as you zoom in (`declutter()` in `LeafletMap.tsx`, `tagPriority` on pins). Pins showing a name sit above the others, and a shared pin takes the colour of the bird it names. Checked in the simulator zoomed out and on a selected bird.
- [ ] Test on real phones, both platforms, including VoiceOver / TalkBack and airplane mode
- [x] "Last 30 days" was cut off at 500 sightings (about 9 days on 2026-10-17). The server now returns the whole 28-day window (safety cap 5000) and ignores `limit`, so 1.6.0 and older builds get the full feed too; responses are gzipped (`compression`). The app no longer sends `limit=500`.

## Ideas worth exploring

Not committed to. Each needs more thought before it's built.
- [ ] **Push alerts for saved birds** ("your saved Pinyon Jay was refound"). Would mean storing the saved list on the server next to the anonymous push token: still account-free, but the Data safety form, App Store privacy answers and privacy page would need updating.
- [ ] **Share a trip** with a friend via a link that carries the saved list, no accounts needed.
- [x] **Advertise that Refound / Dipped are faster than eBird.** A tap reaches everyone within seconds. On 2026-10-08 an eBird upload took about 21 minutes to reach the app (about 19 of those were eBird's own delay). Say so in the guide, the What's new card or on the bird screen to encourage taps. Done 2026-10-17: a "Why Refound and Dipped are usually first" section on the guide's bird-page step (live), and a "Birders in this app" card on the About screen (ships with the next build). Reports reach other phones when they open or refresh the app, not by push.
- [x] **Animated map marker for birds with a recent Refound / Dipped**, e.g. a pulse on a fresh refound, so the community reports stand out on the map and encourage participation. Built 2026-10-16 for 1.6.0 as the sparkle and fade pins (see Planned).
- [x] **Dark mode** (requested 2026-10-16). Follow the phone's setting. Today `mobile/app.json` sets `"userInterfaceStyle": "light"`, which forces light on both platforms; switch it to `"automatic"` and read `useColorScheme()`. Colors come from `mobile/src/theme.ts`, but about 40 hex values are hard-coded across the components and need moving into the theme. The map is the hard part: OpenStreetMap's standard tiles have no dark style. Either a dark tile provider (for example CARTO dark, which needs its license and attribution in `docs/SOURCES.MD` and About) or a CSS filter that darkens the OSM tiles inside the Leaflet WebView (`LeafletMap.tsx`), keeping the pins and rarity colours untouched. Check that the rarity colours, the sparkle and the faded pins still read on a dark map. The guide site could follow `prefers-color-scheme` too. Built 2026-10-17 (unreleased):
  - [x] `app.json` `userInterfaceStyle: "automatic"`, and `expo-system-ui` added (Android needs it to follow the setting). Status bar `auto`; the search keyboard follows the theme. Needs a new native build.
  - [x] `mobile/src/theme.ts` has `LIGHT` and `DARK` palettes with the same keys; every hard-coded colour became a token (`textSoft`, `link`, `tealSoft`, `noteSoft`, `warn`, `inverse` for the dark buttons and toasts, …). Screens use `makeStyles(colors => …)` + `useStyles()`, and `useColors()` for inline colours. Rarity badge colours moved to `tierSoft` / `tierInk`; the pins keep the tier colour in both themes.
  - [x] Map: the OSM tiles are inverted with a CSS filter on the tile pane (no new provider or license); tags, popups, attribution and zoom buttons get dark styles. Switching light/dark restyles the live map without reloading it.
  - [x] Checked in the iOS Simulator (Expo Go), both themes: map, list, hero card, What's new, bird page, About
  - [ ] Test on real phones, especially Android (expo-system-ui) and the red dip outlines on a dark map
  - [ ] The guide site could follow `prefers-color-scheme` too
  - [ ] Guide screenshots and What's new entry at release
- [x] **Darker red as Dipped reports pile up.** One "Dipped" is weak evidence that a bird has left; five in a day is strong. Deepen the red (pin, list row, bird screen) with the number of recent dips. eBird sightings take priority: a new eBird report after the dips means the bird is still there, so it resets or outweighs them, and the red should only count dips since the latest eBird sighting. Built 2026-10-17 (unreleased):
  - [x] Server: `/api/clusters` and `/api/clusters/:id` return `recent_dips`, the dips in the last 3 days made after the latest sighting or refound (`RECENT_DIPS_SQL` in `backend/src/routes/clusters.js`). A new eBird/iNaturalist report or a Refound resets it. Query checked in PGlite.
  - [x] Map pin: any dip fades the fill towards grey and swaps the white outline for red, deeper with more dips: 1, 2–3, 4+ (`DIP_RED` in `mobile/src/theme.ts`, `dipLevel` in `mobile/src/birds.ts`). Replaces the 1.6.0 fade (opacity and greyscale, last 24 h only), which washed out any red; the fade now lasts as long as the dips count, up to 3 days.
  - [x] List row and bird page: a "✗ Dipped ×N" in the same deepening red; the top card adds it to its status chip
  - [ ] Test on real phones, both platforms, with a bird that has several dips
  - [ ] Update the guide (the pin legend in "The map and the Rarities list") and the What's new entry at release
- [ ] **Expand to all of California** (raised 2026-10-12). The user picks 2–3 counties or a preset radius, so the map, list and alerts stay local. API load depends on what the **server** polls, not on how many people use the app: the poller (`backend/src/poller/index.js`, every 10 minutes) fetches each enabled region once and every phone reads from our database. Today that's 2 counties × (1 eBird call + a couple of iNaturalist calls). Options to look at:
  - **One statewide call per source.** eBird `data/obs/US-CA/recent/notable` returns the whole state in one request (raise `maxResults` from 100). iNaturalist can query California's place id once. Then the phone filters by its chosen counties or radius. This is likely cheaper than polling 58 counties one by one.
  - **Poll only the counties someone picked**, and slow the poll for counties nobody has opened in a while.
  - **Rarity is per county today** (the guide explains this). Statewide data would still need a county per sighting to rank it, and eBird's notable list is per region, so check whether "notable for California" misses birds that are only rare locally.
  - **Alerts:** the push token would need its chosen counties or radius stored next to it so each phone only hears about its area. That changes the privacy page, the Data safety form and the App Store privacy answers (still no account and no exact location if it stores counties, not coordinates).

## Things to watch

Known quirks we've decided to live with for now. Revisit if users notice them.
- **Rarity is per county, not per area.** Tiers come from all-time iNaturalist counts for the whole county, so a mountain species seen in the lowlands can be under-rated. Example (2026-10-10): a White-headed Woodpecker at Wardlow Park, Long Beach, rated "Notable" (LA County has 452 records, nearly all from the San Gabriels), while one at Rush Park, Rossmoor, about 5 km away, rated "Exceptional" (Orange County has 0). The labels are accurate for each county. A possible fix is counting records within about 25 km of the sighting, which needs many more iNaturalist calls (`backend/src/rarity.js`).
- **Deprecated edge-to-edge APIs (Play Console, 2026-10-11, 1.5.0 vc 9).** Android 15 deprecated some status-bar and window APIs, and React Native / Expo libraries still call them. Not from our code and only a warning; it should clear with Expo SDK upgrades. Revisit if Play turns it into a requirement. Flagged again on 1.6.0 (vc 11, 2026-10-17): the calls are all inside React Native (`StatusBarModule.setColor`, `StatusBarModule.getTypedExportedConstants`, `WindowUtilKt.enableEdgeToEdge`), so still nothing to change on our side.
- **Portrait lock ignored on large screens (Play Console, 2026-10-11).** `app.json` sets `"orientation": "portrait"`, which Android 16 ignores on tablets and foldables, so the app can show in landscape there. Phones are unaffected. Landscape has never been tried on Android; check once in a tablet emulator, and only adjust the layout if it breaks. Flagged again on 1.6.0 (vc 11, 2026-10-17). Decided to keep the lock: removing it would also let phones rotate, where the map and bottom sheet are cramped. The iPad build already runs in landscape (simulator pass 2026-10-03), so wide layouts are likely fine.
