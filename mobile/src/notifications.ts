import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

const API_BASE = 'https://rba-backend.cloudedapps.org';

// Push notifications are not supported in Expo Go SDK 53+.
// They require a development build or production build.
function isExpoGo(): boolean {
  return Constants.executionEnvironment === 'storeClient';
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

    await fetch(`${API_BASE}/api/devices/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, platform: Platform.OS }),
    });

    return token;
  } catch (err: any) {
    console.warn('[notifications] Token registration failed:', err.message);
    return null;
  }
}

/**
 * Configure how notifications are handled while the app is foregrounded.
 * Call once at app startup (before rendering).
 */
export function configureNotificationHandler() {
  if (isExpoGo()) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}
