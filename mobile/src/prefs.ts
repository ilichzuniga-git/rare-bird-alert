import { useCallback, useState } from 'react';
import { File, Paths } from 'expo-file-system';

// ---------------------------------------------------------------------------
// Small display settings, kept between launches in a JSON file in the app's
// private documents folder (like the trip). Never sent to the server.
// ---------------------------------------------------------------------------

export interface Prefs {
  /** Leave out birds last seen out on the ocean (pelagic trips) */
  hideAtSea: boolean;
  /** The app version whose "What's new" card was last shown (or skipped), null before the first */
  lastSeenVersion: string | null;
}

// At-sea birds start hidden: pelagic trips are rare next to land birding
const DEFAULTS: Prefs = { hideAtSea: true, lastSeenVersion: null };

const prefsFile = () => new File(Paths.document, 'prefs.json');

function load(): Prefs {
  try {
    const f = prefsFile();
    if (!f.exists) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(f.textSync()) };
  } catch {
    return DEFAULTS; // a corrupt file shouldn't break the app; the next change overwrites it
  }
}

function save(prefs: Prefs) {
  try {
    const f = prefsFile();
    if (!f.exists) f.create();
    f.write(JSON.stringify(prefs));
  } catch {
    // best-effort: the setting still applies for this session
  }
}

export function usePrefs() {
  const [prefs, setPrefs] = useState<Prefs>(load);
  const setPref = useCallback(<K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    setPrefs(prev => {
      const next = { ...prev, [key]: value };
      save(next);
      return next;
    });
  }, []);
  return { prefs, setPref };
}
