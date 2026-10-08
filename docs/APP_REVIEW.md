# App Review

Apple's questions for "Birder's Best Friend" and our answers. Keep the reply below in App Store Connect → App Review Information → **Notes** for every future submission, and update it when the app changes.

## 2026-10-08: Guideline 2.1, Information Needed (1.5.0 build 5)

Apple asked, because the developer account is new, for:
1. a screen recording on a physical device
2. the app's purpose and audience
3. setup instructions and any login
4. the external services the app uses
5. regional differences
6. authorization for regulated or third-party material

### Reply (paste into App Store Connect and into the Notes field)

```
1. Screen recording
Attached: a recording of the release build (1.5.0) starting from launching the app. I am an independent developer and don't own an iPhone, so it was recorded on the iPhone 18 Pro simulator running iOS 27, the latest. The app was tested on a physical iPhone through TestFlight (builds 3 to 5, by a family member), including push notifications, confirmed on 2026-10-07. The app has no accounts (no registration, login or deletion), no paid content or in-app purchases, and no user-posted text, photos or profiles (see 2 and 3).

2. Purpose and audience
Birder's Best Friend shows rare bird sightings in Los Angeles and Orange County, California, on one map, updated every 10 minutes. It is for birdwatchers who want to know quickly when a rare bird has been reported nearby, see where exactly it was seen, and decide whether it is worth the drive. Today that means checking several websites and mailing lists; the app combines the public reports, ranks each bird by how rare it is locally, groups repeat reports of the same individual bird, and tells you whether it is still being seen. Optional push notifications announce new rare birds. The app is free, with no ads, accounts or purchases.

3. How to use it (no login or setup needed)
- Open the app: the map shows every rare bird reported this week; the sheet below lists them, rarest first.
- Tap a pin or a list row to open the bird: photo, rarity, the observer's notes, the reports, and Directions.
- "This week / Last 30 days / Near me" and the source chips filter the list. "Near me" asks for location permission (used only on the phone to sort by distance; never sent).
- The car button saves birds to a day trip; the trip opens a driving route in Apple Maps or Google Maps. Saved birds stay on the phone.
- "Refound" / "Dipped" on a bird lets birders say whether they found it. These are anonymous one-tap reports with no text, photos or profiles; the server stores only the bird, the type and the time, and rate-limits them.
- The About screen (logo, top left) has the guide, data credits and privacy policy.
Observer notes shown on a bird come from eBird and iNaturalist as published there, read-only, with a link to the original report on those sites.

4. External services
- eBird API (Cornell Lab of Ornithology): rare bird reports and observer notes
- iNaturalist API: research-grade bird observations, notes and photos
- BirdWeather API: confirms a report when a nearby acoustic station heard the same species (used with written permission)
- OpenStreetMap map tiles with the Leaflet library: the map
- All About Birds (Cornell Lab) links: species pages
- Expo push notification service (via Apple Push Notification service): alerts
- Our own server (rba-backend.cloudedapps.org) collects the reports and serves them to the app
No authentication, payment or AI services are used.

5. Regional differences
The content covers Los Angeles and Orange County, California, and the app is offered in the United States only. It works the same way everywhere; there are no region-specific features.

6. Third-party material
Not a regulated industry. All data is used within its providers' terms, with the required credits in the app (header and About screen): eBird under its API terms for non-commercial use, with attribution; iNaturalist photos only under Creative Commons licenses, each shown with the photographer's name and license; BirdWeather by written permission from its founder (2026-09-28); OpenStreetMap under the ODbL with attribution on every map. The app is non-commercial. We can provide the BirdWeather permission email on request.
```

### Screen recording

We have no iPhone, so the recording comes from the iOS 27 simulator. It runs a simulator build of the same code as 1.5.0 (5): EAS profile `ios-simulator`, build d1124f5f, 2026-10-08. It is recorded with `xcrun simctl io booted recordVideo`. The reply says so. Result: `AppStoreReview/birders-best-friend-walkthrough.mp4` (2 min 20 s, 1206×2622). In it, Refound is opened and then cancelled, so no fake report reaches the live server. If Apple insists on a physical device, borrow an iPhone, install TestFlight build 5 and follow the same steps.

1. Start recording on the Home Screen, then tap the app icon to launch it.
2. Map and sheet: pan the map a little, then drag the sheet up to show the list.
3. Tap the hero bird. Scroll its page to show the photo credit, the reports, the observer notes and **Directions**. Close it.
4. Switch to **Last 30 days**, then **Near me** (allow location when asked), then tap a source chip.
5. Tap the **🚤 At sea** pill to show at-sea birds, then tap it again.
6. Open a bird and tap **Refound**, then confirm. Point out that it is one tap, with no text.
7. Tap the car button on two birds, open the trip, and tap **Directions** to show the route. Come back.
8. Open **About**: scroll through the credits and tap **Privacy policy**.
9. Optional: show a notification arriving and tap it.

Keep it under about 3 minutes. Attach the video to the reply in App Store Connect (Resolution Center).
