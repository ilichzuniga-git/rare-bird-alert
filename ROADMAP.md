# Roadmap

What is planned, being considered and being watched for Birder's Best Friend (Android and iOS). Tick items here as they ship. Project overview and setup: [README.MD](README.MD).

## Planned

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

**"Near me" has no distance limit. Fix soon.** Tester feedback (2026-10-13), from Long Beach: "I'm not sure I'd consider a bird in Lancaster near me. How far away is the app tracking?" It isn't tracking any distance. `period === 'near'` keeps every bird the API returns (the last 28 days; `inPeriod` in `mobile/src/birds.ts` returns true) and only sorts them by distance (`mobile/App.tsx`, the `birds` memo). The map then fits all of those pins plus you, so it covers both counties. The location is also read once per app session and never refreshed (`choosePeriod`), so it goes stale if you drive somewhere.
- [ ] Limit Near me to a radius, e.g. 25 km (about 15 mi) by default, with a small 10 / 25 / 50 km chooser remembered in `mobile/src/prefs.ts`. Label it in the segment or under it ("Within 25 km")
- [ ] Decide the time window: probably the last 7 days, matching the first tab, since a 3-week-old bird nearby is rarely still there
- [ ] Map: fit to you plus the birds inside the radius, and draw the radius circle so it's clear what "near" means
- [ ] Empty state: "No rare birds within 25 km in the last 7 days", with a button to widen the radius
- [ ] Refresh the location when Near me is tapped again or the app comes back to the foreground, not just once per session
- [ ] Update the guide's Near me step (`backend/src/site/index.html`) and the What's new entry

**Island birds get walking directions.** Seen 2026-10-12: Directions for a rare bird on Santa Catalina Island opened walking directions, because there's no road from the mainland. Islands rightly count as land for the at-sea check, so they keep the Directions button. Plan: flag island sightings (the island polygons in `backend/src/data/socal-land.json` are separate from the mainland) and show "🏝️ Island · ferry needed" instead of driving directions. Possibly link to the ferry (Catalina Express from Long Beach, San Pedro or Dana Point; Island Packers for the Channel Islands). Trip directions should skip them, like at-sea birds.
- [ ] Backend: add `on_island` to `/api/sightings` rows next to `at_sea`
- [ ] App: island label and ferry note on the bird screen, no driving directions, skipped in trip routing

**Public transit directions for one bird.** Requested by a user. Only on a single bird's Directions button, not the trip: someone on transit is unlikely to cross the city for several birds the way a driver does, and transit routing doesn't handle multiple stops anyway. Plain links, no API key, like driving.
- [ ] Bird screen: a transit option next to Directions (Google Maps `travelmode=transit`; Apple Maps `dirflg=r` on iOS, which already offers Apple or Google)
- [ ] None for at-sea birds; island birds get the ferry note instead
- [ ] Trip directions stay driving only
- [ ] Update the guide and the What's new entry

## Ideas worth exploring

Not committed to. Each needs more thought before it's built.
- [ ] **Push alerts for saved birds** ("your saved Pinyon Jay was refound"). Would mean storing the saved list on the server next to the anonymous push token: still account-free, but the Data safety form, App Store privacy answers and privacy page would need updating.
- [ ] **Share a trip** with a friend via a link that carries the saved list, no accounts needed.
- [ ] **Advertise that Refound / Dipped are faster than eBird.** A tap reaches everyone within seconds. On 2026-10-08 an eBird upload took about 21 minutes to reach the app (about 19 of those were eBird's own delay). Say so in the guide, the What's new card or on the bird screen to encourage taps.
- [ ] **Animated map marker for birds with a recent Refound / Dipped**, e.g. a pulse on a fresh refound, so the community reports stand out on the map and encourage participation.
- [ ] **Darker red as Dipped reports pile up.** One "Dipped" is weak evidence that a bird has left; five in a day is strong. Deepen the red (pin, list row, bird screen) with the number of recent dips. eBird sightings take priority: a new eBird report after the dips means the bird is still there, so it resets or outweighs them, and the red should only count dips since the latest eBird sighting.
- [ ] **Expand to all of California** (raised 2026-10-12). The user picks 2–3 counties or a preset radius, so the map, list and alerts stay local. API load depends on what the **server** polls, not on how many people use the app: the poller (`backend/src/poller/index.js`, every 10 minutes) fetches each enabled region once and every phone reads from our database. Today that's 2 counties × (1 eBird call + a couple of iNaturalist calls). Options to look at:
  - **One statewide call per source.** eBird `data/obs/US-CA/recent/notable` returns the whole state in one request (raise `maxResults` from 100). iNaturalist can query California's place id once. Then the phone filters by its chosen counties or radius. This is likely cheaper than polling 58 counties one by one.
  - **Poll only the counties someone picked**, and slow the poll for counties nobody has opened in a while.
  - **Rarity is per county today** (the guide explains this). Statewide data would still need a county per sighting to rank it, and eBird's notable list is per region, so check whether "notable for California" misses birds that are only rare locally.
  - **Alerts:** the push token would need its chosen counties or radius stored next to it so each phone only hears about its area. That changes the privacy page, the Data safety form and the App Store privacy answers (still no account and no exact location if it stores counties, not coordinates).

## Things to watch

Known quirks we've decided to live with for now. Revisit if users notice them.
- **Rarity is per county, not per area.** Tiers come from all-time iNaturalist counts for the whole county, so a mountain species seen in the lowlands can be under-rated. Example (2026-10-10): a White-headed Woodpecker at Wardlow Park, Long Beach, rated "Notable" (LA County has 452 records, nearly all from the San Gabriels), while one at Rush Park, Rossmoor, about 5 km away, rated "Exceptional" (Orange County has 0). The labels are accurate for each county. A possible fix is counting records within about 25 km of the sighting, which needs many more iNaturalist calls (`backend/src/rarity.js`).
- **Deprecated edge-to-edge APIs (Play Console, 2026-10-11, 1.5.0 vc 9).** Android 15 deprecated some status-bar and window APIs, and React Native / Expo libraries still call them. Not from our code and only a warning; it should clear with Expo SDK upgrades. Revisit if Play turns it into a requirement.
- **Portrait lock ignored on large screens (Play Console, 2026-10-11).** `app.json` sets `"orientation": "portrait"`, which Android 16 ignores on tablets and foldables, so the app can show in landscape there. Phones are unaffected. Landscape has never been tried; check once in a tablet emulator, and only adjust the layout if it breaks.
