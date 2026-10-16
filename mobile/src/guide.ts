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

/** "1.5.1", from app.json's expo.version (the same on iOS and Android). */
export const APP_VERSION: string = Constants.expoConfig?.version ?? '';

/**
 * The "What's new" card shown once after an update. Bump `version` and the highlights with each
 * release that has something worth saying, and add the same release to the guide's What's new tab.
 * Releases without a matching entry here show no card.
 */
export const WHATS_NEW = {
  version: '1.6.0',
  title: 'Closer, fresher, by bus or boat',
  highlights: [
    { icon: '📍', text: 'Near me shows birds within 10, 25 or 50 km from the last 7 days, with the range drawn on the map.' },
    { icon: '✨', text: 'Pins sparkle for a bird refound today or a rare one seen today, and fade after a dip. The top card goes to a bird seen in the last 3 days.' },
    { icon: '🚌', text: 'Transit directions to a bird, and a ferry link for birds on Catalina and the Channel Islands.' },
  ],
};
