import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { api } from './api';
import { openActionLink } from '../navigation/actionLinks';

let registeredToken: string | null = null;

// Show pushes as banners even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false,
  }),
});

/**
 * Ask for permission, get this device's Expo push token and register it with
 * the backend. Silently does nothing on web, simulators, or when permission is
 * denied. Android delivery additionally needs FCM credentials in EAS, and push
 * does not work in Expo Go on Android (use a development build).
 */
export async function registerForPush(): Promise<string | null> {
  try {
    if (Platform.OS === 'web' || !Device.isDevice) return null;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Smart Agri', importance: Notifications.AndroidImportance.HIGH,
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return null;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? (Constants as any).easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await api.post('/profile/push-token', { token, platform: Platform.OS });
    registeredToken = token;
    return token;
  } catch (e) {
    console.warn('Push registration skipped:', (e as Error)?.message);
    return null;
  }
}

/** Stop pushes to this device for the user who is signing out. */
export async function unregisterPush() {
  if (!registeredToken) return;
  try {
    await api.post('/profile/push-token/remove', { token: registeredToken });
  } catch {
    // ignore — the backend also drops tokens Expo reports as unregistered
  }
  registeredToken = null;
}

/** Tapping a push opens the screen in its actionLink. Returns an unsubscribe fn. */
export function listenForPushTaps(role?: string) {
  if (Platform.OS === 'web') return () => {};
  const sub = Notifications.addNotificationResponseReceivedListener(resp => {
    const link = (resp.notification.request.content.data as any)?.actionLink;
    openActionLink(link, role);
  });
  return () => sub.remove();
}
