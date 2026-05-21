import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const API_BASE = 'http://localhost:3000';

/**
 * Request permission, get the Expo push token, and register it with the backend.
 * Safe to call multiple times — the backend upserts on conflict.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  // Push notifications are not supported in the Expo Go simulator on web
  if (Platform.OS === 'web') return null;

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

  // On Android, a notification channel is required
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
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}
