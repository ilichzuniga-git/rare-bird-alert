import { File, Paths } from 'expo-file-system';
import type { ClusterData, Sighting } from './types';

// ---------------------------------------------------------------------------
// The last feed that loaded, kept in a JSON file in the app's private documents
// folder (like the trip and prefs). With no signal at a trailhead the app opens
// on it instead of an error. Public data only; never sent anywhere.
// ---------------------------------------------------------------------------

export interface SavedFeed {
  sightings: Sighting[];
  clusters: ClusterData[];
  /** When the phone fetched it (ms) */
  savedAt: number;
}

const feedFile = () => new File(Paths.document, 'feed.json');

export function loadFeed(): SavedFeed | null {
  try {
    const f = feedFile();
    if (!f.exists) return null;
    const feed = JSON.parse(f.textSync()) as SavedFeed;
    return Array.isArray(feed.sightings) && Array.isArray(feed.clusters) && typeof feed.savedAt === 'number' ? feed : null;
  } catch {
    return null; // a corrupt file shouldn't break the app; the next load overwrites it
  }
}

export function saveFeed(feed: SavedFeed) {
  try {
    const f = feedFile();
    if (!f.exists) f.create();
    f.write(JSON.stringify(feed));
  } catch {
    // best-effort: only matters the next time the app opens offline
  }
}
