# Guide site

Live at **https://rba-backend.cloudedapps.org/guide/**, served by `../server.js`; pushing `backend/`
deploys it. `/privacy` (the URL in the Play Console and App Store listing) redirects to `#privacy`.
A small website that replaces an in-app tutorial. One page with three tabs:

| Tab | URL hash | What it is |
|---|---|---|
| Tour | `#tour` | How the app works, with simulator screenshots of the real app (taken on 1.4.0/1.5.0; text current to 1.7.0) |
| What's new | `#whats-new` | One entry per release, with the iOS build and Android version code. While a store is still reviewing it, the build label adds a status in ochre (`<span class="rollout">in progress</span>` / `queued`); remove it when that version goes live |
| Privacy | `#privacy` | The privacy policy. Change it here when data handling changes, with a new date |

Design follows `../01-field-guide.html`: warm paper, Fraunces serif headings with a rust italic second
half, small-caps labels, dashed rules. The rarity legend uses the app's own tier colours so it matches
the pins people see.

The app links here from About (Take the tour, What's new) and from the once-per-version "What's new"
card (`WHATS_NEW` in `mobile/src/guide.ts`), which opens `/guide/#whats-new`. Each release gets an entry
in both. The site is also the App Store Support URL.

Screenshots due for a retake (held until after the next round of updates, per the user): `near.jpg`
(no 10/25/50 km pills or range circle), and a bird page with the Transit pill, an island bird with the
Ferry pill, the sparkle pins and the pale red-outlined dip pins (1.7.0 replaced the old fade), the
Newest / Rarest switch above the list, and "✗ Dipped ×N" on a bird page, none of which are shown yet.
1.7.0 also added dark mode; the tour shots stay light, but a dark one could go in the 1.7.0 entry.

The tab script is `guide.js`, not inline: the server's Content-Security-Policy (helmet) blocks
inline scripts. Inline `style` attributes are allowed.

## View it

```bash
open backend/src/site/index.html     # macOS
start backend/src/site/index.html    # Windows
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

Pointing hands: each `<span class="hand" style="--x:…;--y:…">` inside a `.shot` puts a fingertip on
that spot, in % of the screen (402×874 pt, so `axe describe-ui` frames convert directly). `--r` turns
the hand around the fingertip (`-90deg` points up, `90deg` down) and `--f:-1` mirrors it to point left.
The hand is drawn in `index.html` (the `#hand` symbol), not a stock icon. Re-check the positions after
re-shooting a screen.

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
