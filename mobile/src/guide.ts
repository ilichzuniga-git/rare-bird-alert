import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { LIGHT as colors } from './theme'; // the guide website is light only
import { API_BASE } from './util';

// ---------------------------------------------------------------------------
// The guide website (backend/src/site): tour, what's new and privacy policy.
// Opened in an in-app browser sheet, so closing it lands back in the app.
// ---------------------------------------------------------------------------

export type GuideTab = 'tour' | 'whats-new' | 'privacy';

export function openGuide(tab: GuideTab = 'tour') {
  WebBrowser.openBrowserAsync(`${API_BASE}/guide/#${tab}`, {
    controlsColor: colors.accent,
    toolbarColor: colors.bg,
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
  }).catch(() => {});
}

/** "1.5.1", from app.json's expo.version (the same on iOS and Android). */
export const APP_VERSION: string = Constants.expoConfig?.version ?? '';

/**
 * The "What's new" card shown once after an update. Bump `version` and the highlights with each
 * release that has something worth saying, and add the same release to the guide's What's new tab.
 * Releases without a matching entry here show no card.
 */
export const WHATS_NEW = {
  version: '1.7.0',
  title: 'Day and night',
  highlights: [
    { icon: '🌙', text: 'Dark mode: the app and the map follow your phone\'s light or dark setting.' },
    { icon: '📶', text: 'No signal? The app opens on the last birds it loaded and says how old they are.' },
    { icon: '😔', text: 'Dips add up: a deeper red the more people dipped since the last sighting. Sort the list by Rarest too.' },
  ],
};
