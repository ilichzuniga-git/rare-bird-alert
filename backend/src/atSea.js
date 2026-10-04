// Flags sightings that are out on the ocean (pelagic trips), which can't be reached by car.
//
// data/socal-land.json is Natural Earth's 1:10m land and minor-islands polygons
// (public domain, naturalearthdata.com), clipped to lat 32.0–35.6, lng -120.5 to -116.5:
// an array of rings, each an array of [lng, lat]. It covers LA and Orange Counties
// including the Channel Islands; a new region outside that box needs the data re-clipped.
const LAND = require('./data/socal-land.json');

// The 1:10m coastline is generalised by up to about a kilometre, so only points this far
// from it count as at sea. Beaches, harbours and bays stay on land.
const COAST_BUFFER_KM = 2;
const KM_PER_DEG_LAT = 111.32;

function insideRing(ring, lng, lat) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** True when the point is on the water, more than COAST_BUFFER_KM from any land. */
function isAtSea(lat, lng) {
  if (lat == null || lng == null) return false;
  lat = Number(lat); lng = Number(lng); // pg returns NUMERIC columns as strings
  if (LAND.some(ring => insideRing(ring, lng, lat))) return false;

  // Distance to the nearest coastline segment, on a local flat projection in km
  const kx = KM_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
  for (const ring of LAND) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const ax = (ring[j][0] - lng) * kx, ay = (ring[j][1] - lat) * KM_PER_DEG_LAT;
      const bx = (ring[i][0] - lng) * kx, by = (ring[i][1] - lat) * KM_PER_DEG_LAT;
      const dx = bx - ax, dy = by - ay;
      const t = dx || dy ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy))) : 0;
      if (Math.hypot(ax + t * dx, ay + t * dy) <= COAST_BUFFER_KM) return false;
    }
  }
  return true;
}

module.exports = { isAtSea };
