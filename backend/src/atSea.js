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

// Islands with no road from the mainland, each found by a point inside its ring.
// Terminal Island (Port of LA) is left out: it's bridged to the mainland.
const ISLAND_POINTS = [
  ['Santa Catalina Island', 33.39, -118.42],
  ['San Clemente Island', 32.92, -118.5],
  ['San Nicolas Island', 33.25, -119.5],
  ['Santa Barbara Island', 33.475, -119.037],
  ['Anacapa Island', 34.008, -119.42],
  ['Santa Cruz Island', 34.0, -119.75],
  ['Santa Rosa Island', 33.96, -120.1],
  ['San Miguel Island', 34.04, -120.37],
  ['Coronado Islands', 32.41, -117.245],
];
const ISLAND_OF_RING = LAND.map(ring =>
  ISLAND_POINTS.find(([, lat, lng]) => insideRing(ring, lng, lat))?.[0] ?? null);

/** Index of the land ring the point is on or within COAST_BUFFER_KM of (the nearest), or -1 at sea. */
function landRing(lat, lng) {
  if (lat == null || lng == null) return -1;
  lat = Number(lat); lng = Number(lng); // pg returns NUMERIC columns as strings
  const inside = LAND.findIndex(ring => insideRing(ring, lng, lat));
  if (inside >= 0) return inside;

  // Distance to the nearest coastline segment, on a local flat projection in km
  const kx = KM_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
  let nearest = -1, best = COAST_BUFFER_KM;
  LAND.forEach((ring, r) => {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const ax = (ring[j][0] - lng) * kx, ay = (ring[j][1] - lat) * KM_PER_DEG_LAT;
      const bx = (ring[i][0] - lng) * kx, by = (ring[i][1] - lat) * KM_PER_DEG_LAT;
      const dx = bx - ax, dy = by - ay;
      const t = dx || dy ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy))) : 0;
      const d = Math.hypot(ax + t * dx, ay + t * dy);
      if (d <= best) { best = d; nearest = r; }
    }
  });
  return nearest;
}

/** True when the point is on the water, more than COAST_BUFFER_KM from any land. */
function isAtSea(lat, lng) {
  return lat != null && lng != null && landRing(lat, lng) < 0;
}

/** The island's name when the point is on (or just off) one with no road to it, else null. */
function islandAt(lat, lng) {
  const r = landRing(lat, lng);
  return r < 0 ? null : ISLAND_OF_RING[r];
}

module.exports = { isAtSea, islandAt };
