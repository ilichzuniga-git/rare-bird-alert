# UI renders

Three concepts for modernizing the List and Map panes. Mockups only — sample data, a drawn map,
and bird silhouettes standing in for iNaturalist photos. Nothing here is used by the app.

| File | Idea |
|---|---|
| `01-field-guide` | Warm paper + serif "printed field guide" look; rarity as small-caps color; photo medallion pins; preview card with Refound/Dipped on the map |
| `02-night-chase` | Dark "live" UI for chasing; stat strip, banner cards for the hottest birds; glowing/pulsing pins, swipeable card carousel |
| `03-bottom-sheet` | One screen: map always underneath, list in a draggable bottom sheet (Apple/Google Maps style); per-day seen/dipped strip |

Open the `.html` files in a browser, or look at the matching `.png`. Shared sample data and the map drawing live in `shared.js`.

Re-render a PNG (from this folder):

```bash
chrome --headless=new --hide-scrollbars --window-size=1000,1150 --virtual-time-budget=4000 \
  --screenshot=01-field-guide.png file:///C:/claude/rba-app/renders/01-field-guide.html
```
