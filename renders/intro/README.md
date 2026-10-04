# Intro deck

A 5-slide introduction to **Birder's Best Friend**. Open `index.html` in a browser
and use the arrow keys (or the dots / arrows in the pager) to step through.

Nothing here is wired into the app — this folder is mockups only, same as the
three concept renders in `../`. No existing code was touched.

## What's in the deck

| # | Slide | What it shows |
|---|---|---|
| 1 | Welcome | Hero phone with the map + sheet, Nazca Booby at Point Fermin, source chips |
| 2 | Three browse modes | The bottom-sheet period switcher (This week / Near me / Trip) and what each mode does |
| 3 | The map | Rarity rings, status dots, at-sea toggle, cluster trail — with a legend panel |
| 4 | Tap a pin | Bird detail view (photo, tier pill, location, status, Add to Trip) plus a push-notification mock |
| 5 | Built on real sources | eBird as the featured source, iNaturalist and BirdWeather as supporting sources |

## View it

```bash
# macOS
open renders/intro/index.html
# Windows
start renders/intro/index.html
# or just drag the file into a browser
```

Controls:
- **← / →** — previous / next slide
- **Space** — next slide
- **Home / End** — first / last
- **Swipe** left/right on touch devices

## Export each slide as a PNG

The page is wider than it is tall, so a tall window works best. Chrome headless:

```bash
# macOS
chrome --headless=new --hide-scrollbars --window-size=1280,820 \
  --virtual-time-budget=4000 \
  --screenshot=01-welcome.png "file://$PWD/renders/intro/index.html#slide=1"
```

There is no `#slide=N` URL hash yet — for now, click the dot you want and run
the screenshot, or open the page and use the OS screenshot tool. If you want
PNG-per-slide as a workflow, add a hash listener to the slide script and re-run.