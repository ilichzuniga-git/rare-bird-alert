import { useCallback, useEffect, useRef, useState } from 'react';
import { ActionSheetIOS, Linking, Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import type { Bird } from './birds';
import { tierFor } from './theme';
import { distanceMetres } from './util';
import type { Sighting } from './types';

// ---------------------------------------------------------------------------
// The trip drawer: birds saved for a day trip. Stored only on this phone (a JSON
// file in the app's private documents folder), never sent to the server.
// ---------------------------------------------------------------------------

export interface SavedBird {
  /** Bird key when saved ("c<cluster id>" or "s<sighting id>") */
  key: string;
  savedAt: string;
  /** Latest report as last seen in the feed, so the bird still shows once it drops out */
  snapshot: Sighting;
}

export interface TripBird {
  bird: Bird;
  /** No longer in the live feed: shown from the saved snapshot */
  stale: boolean;
}

const tripFile = () => new File(Paths.document, 'trip.json');

function load(): SavedBird[] {
  try {
    const f = tripFile();
    if (!f.exists) return [];
    const data = JSON.parse(f.textSync());
    return Array.isArray(data?.birds) ? data.birds : [];
  } catch {
    return []; // a corrupt file shouldn't break the app; the next save overwrites it
  }
}

function save(birds: SavedBird[]) {
  try {
    const f = tripFile();
    if (!f.exists) f.create();
    f.write(JSON.stringify({ version: 1, birds }));
  } catch {
    // best-effort: the in-memory trip still works for this session
  }
}

/** The live bird for a saved one: same key, or (if it has since joined a cluster) the same report. */
function findLive(saved: SavedBird, birds: Bird[]): Bird | undefined {
  return birds.find(b => b.key === saved.key) ??
    birds.find(b => b.reports.some(r => r.id === saved.snapshot.id));
}

function fromSnapshot(saved: SavedBird): Bird {
  const s = saved.snapshot;
  return { key: saved.key, latest: s, reports: [s], cluster: null, tier: tierFor(s.rarity_count), count: s.how_many };
}

export function useTrip(allBirds: Bird[]) {
  const [saved, setSaved] = useState<SavedBird[]>(load);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    save(saved);
  }, [saved]);

  // Keep snapshots current (and follow a lone report into its new cluster)
  useEffect(() => {
    if (!allBirds.length) return;
    setSaved(prev => {
      let changed = false;
      const next = prev.map(sv => {
        const live = findLive(sv, allBirds);
        if (!live || (live.key === sv.key && live.latest.id === sv.snapshot.id)) return sv;
        changed = true;
        return { ...sv, key: live.key, snapshot: live.latest };
      });
      return changed ? next : prev;
    });
  }, [allBirds]);

  const has = useCallback((key: string) => saved.some(s => s.key === key), [saved]);

  const toggle = useCallback((bird: Bird): boolean => {
    const adding = !saved.some(s => s.key === bird.key);
    setSaved(prev => adding
      ? [...prev, { key: bird.key, savedAt: new Date().toISOString(), snapshot: bird.latest }]
      : prev.filter(s => s.key !== bird.key));
    return adding;
  }, [saved]);

  const remove = useCallback((key: string) => setSaved(prev => prev.filter(s => s.key !== key)), []);
  const clear = useCallback(() => setSaved([]), []);

  const birds: TripBird[] = saved.map(sv => {
    const live = findLive(sv, allBirds);
    return live ? { bird: live, stale: false } : { bird: fromSnapshot(sv), stale: true };
  });

  return { birds, count: saved.length, has, toggle, remove, clear };
}

type Point = { lat: number; lng: number };

function pointOf(b: Bird): Point | null {
  const { lat, lng } = b.latest;
  return lat == null || lng == null ? null : { lat: Number(lat), lng: Number(lng) };
}

/**
 * Driving order: repeatedly go to the nearest unvisited stop, starting from the
 * user (or the first saved bird). Birds without coordinates go last.
 */
export function routeOrder(trip: TripBird[], start: Point | null): TripBird[] {
  const left = trip.filter(t => pointOf(t.bird));
  const route: TripBird[] = [];
  let at = start ?? (left[0] ? pointOf(left[0].bird) : null);
  while (left.length && at) {
    let best = 0;
    let bestD = Infinity;
    left.forEach((t, i) => {
      const p = pointOf(t.bird)!;
      const d = distanceMetres(at!.lat, at!.lng, p.lat, p.lng);
      if (d < bestD) { bestD = d; best = i; }
    });
    const [next] = left.splice(best, 1);
    route.push(next);
    at = pointOf(next.bird);
  }
  return [...route, ...trip.filter(t => !pointOf(t.bird))];
}

/** Google Maps links take at most 9 waypoints plus the destination; Apple Maps is held to the same. */
export const MAX_STOPS = 10;

/**
 * Driving directions from the user's location through every stop. Android opens Google Maps;
 * iOS asks Apple Maps or Google Maps (the Google link opens its app when installed, else Safari).
 */
export function openTripDirections(route: TripBird[]) {
  const pts = route.map(t => pointOf(t.bird)).filter((p): p is Point => !!p).slice(0, MAX_STOPS)
    .map(p => `${p.lat},${p.lng}`);
  if (!pts.length) return;
  const destination = pts[pts.length - 1];
  const waypoints = pts.slice(0, -1);

  let google = `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${encodeURIComponent(destination)}`;
  if (waypoints.length) google += `&waypoints=${encodeURIComponent(waypoints.join('|'))}`;
  if (Platform.OS !== 'ios') { Linking.openURL(google); return; }

  // Unified Maps URL (iOS 18.4+): one `waypoint` per stop, no source = from the user's location
  const apple = `https://maps.apple.com/directions?mode=driving&destination=${encodeURIComponent(destination)}`
    + waypoints.map(w => `&waypoint=${encodeURIComponent(w)}`).join('');
  ActionSheetIOS.showActionSheetWithOptions(
    { title: 'Directions', options: ['Apple Maps', 'Google Maps', 'Cancel'], cancelButtonIndex: 2 },
    i => { if (i === 0) Linking.openURL(apple); else if (i === 1) Linking.openURL(google); },
  );
}
