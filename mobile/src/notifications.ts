import { Platform } from 'react-native';
// Type-only import — erased at compile time, so it never triggers expo-notifications'
// own module-init side effects (see below).
import type * as NotificationsModule from 'expo-notifications';
import Constants from 'expo-constants';

const API_BASE = 'https://rba-backend.cloudedapps.org';

// This install's push token, once registered; markAlertsSeen needs it
let pushToken: string | null = null;

// Push notifications are not supported in Expo Go SDK 53+.
// They require a development build or production build.
function isExpoGo(): boolean {
  return Constants.executionEnvironment === 'storeClient';
}

// IMPORTANT: never statically `import * as Notifications from 'expo-notifications'` —
// as of the SDK 57 version of the package, merely importing it runs an auto-registration
// side effect (DevicePushTokenAutoRegistration.fx.js) that calls addPushTokenListener(),
// which on Android inside Expo Go does `throw new Error(...)` (not console.warn), crashing
// the whole app before any of our own isExpoGo() checks below ever run. Loading the module
// only via dynamic import, and only when we already know we're not in Expo Go on Android,
// keeps that side effect from ever executing there.
let notificationsPromise: Promise<typeof NotificationsModule> | null = null;
function loadNotifications(): Promise<typeof NotificationsModule> {
  notificationsPromise ??= import('expo-notifications');
  return notificationsPromise;
}

/**
 * Request permission, get the Expo push token, and register it with the backend.
 * Safe to call multiple times -- the backend upserts on conflict.
 * No-ops silently when running inside Expo Go (SDK 53+ limitation).
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  if (isExpoGo()) {
    console.log('[notifications] Skipping push registration -- not supported in Expo Go (SDK 53+). Use a dev build to test notifications.');
    return null;
  }

  const Notifications = await loadNotifications();

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('[notifications] Push permission not granted');
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Rare Bird Alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2d6a4f',
    });
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;
    console.log('[notifications] Expo push token:', token);

    // badge: this build clears the icon badge when opened, so the server may send counts.
    // Registering also tells the server the app was just opened (unread back to 0).
    await fetch(`${API_BASE}/api/devices/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, platform: Platform.OS, badge: true }),
    });
    pushToken = token;
    Notifications.setBadgeCountAsync(0).catch(() => {});

    return token;
  } catch (err: any) {
    console.warn('[notifications] Token registration failed:', err.message);
    return null;
  }
}

/**
 * Clear the app-icon badge, and the server's count of alerts since the app was last opened
 * (the next alert's badge starts again at 1). Call when the app comes to the foreground.
 */
export async function markAlertsSeen() {
  if (isExpoGo() || Platform.OS === 'web' || !pushToken) return;
  const Notifications = await loadNotifications();
  const count = await Notifications.getBadgeCountAsync().catch(() => 0);
  if (count === 0) return; // nothing to clear, so no request
  Notifications.setBadgeCountAsync(0).catch(() => {});
  fetch(`${API_BASE}/api/devices/seen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: pushToken }),
  }).catch(() => {});
}

/**
 * Configure how notifications are handled while the app is foregrounded.
 * Call once at app startup (before rendering). Safe in Expo Go -- see loadNotifications().
 */
export async function configureNotificationHandler() {
  if (isExpoGo()) return;

  const Notifications = await loadNotifications();

  Notifications.setNotificationHandler({
    handleNotification: async () => {
      // An alert that arrives while the app is open has been seen: don't count it on the icon
      if (pushToken) {
        fetch(`${API_BASE}/api/devices/seen`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: pushToken }),
        }).catch(() => {});
      }
      return {
        // shouldShowAlert is deprecated in favor of the two below (banner = heads-up,
        // list = notification center/shade) — both true keeps the old behavior.
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      };
    },
  });
}

/**
 * Call onTap with the sighting ids of a tapped notification: one tapped while the app
 * is running or in the background, or the one that launched it from closed. Returns an
 * unsubscribe function. No-ops in Expo Go, like the rest of this file.
 */
export function onNotificationTap(onTap: (sightingIds: number[]) => void): () => void {
  if (isExpoGo() || Platform.OS === 'web') return () => {};

  let sub: { remove: () => void } | null = null;
  let cancelled = false;
  // A launch tap can arrive through both paths below; handle each notification once
  const handled = new Set<string>();

  const handle = (response: NotificationsModule.NotificationResponse | null) => {
    if (!response) return;
    const id = response.notification.request.identifier;
    if (handled.has(id)) return;
    handled.add(id);
    const ids = response.notification.request.content.data?.sightingIds;
    // Older server builds sent no ids; the tap then still opens the week's list
    onTap(Array.isArray(ids) ? ids.filter((n): n is number => typeof n === 'number') : []);
  };

  loadNotifications().then(Notifications => {
    if (cancelled) return;
    sub = Notifications.addNotificationResponseReceivedListener(response => {
      handle(response);
      Notifications.clearLastNotificationResponseAsync().catch(() => {});
    });
    // The tap that launched the app may have fired before the listener existed
    Notifications.getLastNotificationResponseAsync().then(response => {
      if (cancelled || !response) return;
      handle(response);
      Notifications.clearLastNotificationResponseAsync().catch(() => {});
    }).catch(() => {});
  }).catch(() => {});

  return () => { cancelled = true; sub?.remove(); };
}
