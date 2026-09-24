import { tierFor, type Tier } from './theme';
import { distanceMetres, formatDate } from './util';
import type { ClusterData, Sighting } from './types';

/** One bird on the map / in the sheet: a cluster's reports, or a lone unclustered sighting. */
export interface Bird {
  key: string;
  latest: Sighting;
  /** Every report of this bird, newest first */
  reports: Sighting[];
  cluster: ClusterData | null;
  tier: Tier;
  /** Largest "how many" across the reports */
  count: number | null;
}

export type Period = 'week' | 'month' | 'near';

export function groupBirds(sightings: Sighting[], clusters: Map<number, ClusterData>): Bird[] {
  const groups = new Map<string, Sighting[]>();
  for (const s of sightings) {
    const key = s.cluster_id != null ? `c${s.cluster_id}` : `s${s.id}`;
    const group = groups.get(key);
    if (group) group.push(s);
    else groups.set(key, [s]);
  }
  const birds: Bird[] = [];
  for (const [key, group] of groups) {
    const reports = [...group].sort((a, b) => (a.observed_at < b.observed_at ? 1 : -1));
    const latest = reports[0];
    const counts = reports.map(r => r.how_many).filter((n): n is number => n != null);
    const rarity = reports.find(r => r.rarity_count != null)?.rarity_count ?? null;
    birds.push({
      key,
      latest,
      reports,
      cluster: latest.cluster_id != null ? clusters.get(latest.cluster_id) ?? null : null,
      tier: tierFor(rarity),
      count: counts.length ? Math.max(...counts) : null,
    });
  }
  return birds.sort((a, b) => (a.latest.observed_at < b.latest.observed_at ? 1 : -1));
}

// observed_at carries the observer's local wall-clock time in its UTC fields (eBird
// reports local time and the backend stores it unconverted), so compare *dates* in
// those fields against today's local date rather than doing hour arithmetic.
function wallDate(iso: string): string {
  return iso.slice(0, 10);
}
function localDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Start of the current week (Sunday), as a YYYY-MM-DD local date. */
export function weekStart(now = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() - d.getDay());
  return localDate(d);
}

export function inPeriod(bird: Bird, period: Period, now = new Date()): boolean {
  if (period === 'week') return wallDate(bird.latest.observed_at) >= weekStart(now);
  return true; // the API only keeps the last 28 days
}

/** "Today", "Yesterday", or "Sep 21". */
export function whenLabel(iso: string, now = new Date()): string {
  const day = wallDate(iso);
  const today = localDate(now);
  if (day === today) return 'Today';
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (day === localDate(y)) return 'Yesterday';
  return formatDate(iso);
}

/** Word-start match, so "rail" finds Ridgway's Rail but not "…River Trail". */
export function matchesQuery(bird: Bird, query: string): boolean {
  if (!query) return true;
  const re = new RegExp(`(^|[^a-z])${query.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
  const s = bird.latest;
  return [s.common_name, s.scientific_name, s.location_name, s.region_name]
    .some(v => v != null && re.test(v.toLowerCase()));
}

export function distanceTo(bird: Bird, from: { lat: number; lng: number }): number | null {
  const { lat, lng } = bird.latest;
  if (lat == null || lng == null) return null;
  return distanceMetres(from.lat, from.lng, Number(lat), Number(lng));
}

/** Rarest first, then most-reported, then most recent: picks the hero card. */
export function byRarity(a: Bird, b: Bird): number {
  return (
    b.tier.rank - a.tier.rank ||
    b.reports.length - a.reports.length ||
    (a.latest.observed_at < b.latest.observed_at ? 1 : -1)
  );
}

/** "Continuing", "Single report", … without the backend's hour count (see wallDate note). */
export function statusWord(bird: Bird): string | null {
  return bird.cluster ? bird.cluster.status.label.split(' · ')[0] : null;
}

/** "Refound 38 min ago" when a user refound it in the last day (server time, so accurate). */
export function refoundLabel(bird: Bird, now = Date.now()): string | null {
  const at = bird.cluster?.last_refound_at;
  if (!at) return null;
  const mins = Math.round((now - new Date(at).getTime()) / 60000);
  if (mins < 0 || mins > 24 * 60) return null;
  if (mins < 60) return `Refound ${Math.max(mins, 1)} min ago`;
  return `Refound ${Math.round(mins / 60)}h ago`;
}
