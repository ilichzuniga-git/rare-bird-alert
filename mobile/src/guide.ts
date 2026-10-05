import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { colors } from './theme';
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

/** "1.5.0", from app.json's expo.version (the same on iOS and Android). */
export const APP_VERSION: string = Constants.expoConfig?.version ?? '';

/**
 * The "What's new" card shown once after an update. Bump `version` and the highlights with each
 * release that has something worth saying, and add the same release to the guide's What's new tab.
 * Releases without a matching entry here show no card.
 */
export const WHATS_NEW = {
  version: '1.5.0',
  title: 'A guide to the app',
  highlights: [
    { icon: '📖', text: 'A guide with a tour of every screen, plus what changed in each update. It\'s under About too.' },
    { icon: '🔴', text: 'The app icon shows how many rare-bird alerts came in since you last opened the app.' },
    { icon: '✨', text: 'A cleaner About screen, with the sources and your data at a glance.' },
  ],
};
