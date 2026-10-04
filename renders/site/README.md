# Guide site

A small website that replaces the in-app tutorial idea. One page with three tabs:

| Tab | URL hash | What it is |
|---|---|---|
| Tour | `#tour` | How the app works, with simulator screenshots of the real app (1.4.0) |
| What's new | `#whats-new` | One entry per release, with the iOS build and Android version code |
| Privacy | `#privacy` | The privacy policy, the same text as `backend/src/privacy.html` |

Design follows `../01-field-guide.html`: warm paper, Fraunces serif headings with a rust italic second
half, small-caps labels, dashed rules. The rarity legend uses the app's own tier colours so it matches
the pins people see.

Not live yet. The plan:

1. Move this folder to the backend (e.g. `backend/src/site/`) and serve it at `/guide`, keeping
   `/privacy` working (Play Console and the App Store listing link to it). Pushing `backend/` deploys.
2. In the next app build: a once-per-version "What's new" card that opens `/guide#whats-new`, and a
   Guide link on the About screen.
3. The site can also be the App Store "Support URL".

## View it

```bash
open renders/site/index.html        # macOS
start renders/site/index.html       # Windows
```

## Fonts

`fonts/` holds Fraunces (roman and italic) and Inter as variable `.woff2` files, from
`@fontsource-variable` on jsDelivr (SIL Open Font License). They are served from this site rather
than Google Fonts, so a visit contacts no third party and the privacy policy needs no change.

## Re-shooting the screenshots (Mac)

`shots/*.jpg` are iPhone 18 Pro simulator screenshots, 603×1311 JPEG.

1. Boot the simulator and open DeviceHub; set a clean status bar:
   `xcrun simctl status_bar booted override --time 9:41 --batteryState charged --batteryLevel 100`
2. Start Metro from `mobile/` (`npx expo start --port 8090`) and open `exp://127.0.0.1:8090` in Expo Go.
   Turn off Expo Go's floating gear: tap it, then switch off **Tools button**.
3. For Near me and the trip, give the simulator a location:
   `xcrun simctl location booted set 33.6846,-117.8265` (Irvine).
4. Taps can be scripted with [AXe](https://github.com/cameroncooke/AXe)
   (`brew install cameroncooke/axe/axe`): `axe describe-ui` lists elements and their positions,
   and `axe touch -x X -y Y --down --up --delay 0.12 --udid <id>` taps one. Don't type while no text
   field is focused: Expo Go treats `r` as reload.
5. `xcrun simctl io booted screenshot shot.png`, then
   `sips -s format jpeg -s formatOptions 82 -Z 1311 shot.png --out shots/<name>.jpg`.

| File | Screen |
|---|---|
| `home.jpg` | This week, map and sheet (at-sea birds hidden) |
| `list.jpg` | Sheet dragged up |
| `near.jpg` | Near me |
| `search.jpg` | Search "murrelet" in Last 30 days |
| `last30.jpg` / `atsea-on.jpg` | At-sea pill hidden / shown |
| `detail.jpg` | Evening Grosbeak page |
| `detail-sea.jpg` | Craveri's Murrelet page, "Seen at sea" |
| `trip.jpg` | Trip with two stops |
| `about.jpg` | About screen |
