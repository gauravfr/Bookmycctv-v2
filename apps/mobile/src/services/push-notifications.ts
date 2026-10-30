import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { api } from './bookmycctv-api';

const PUSH_TOKEN_ID_KEY = 'bookmycctv.push-token-id.v1';
const DEVICE_ID_KEY = 'bookmycctv.device-id.v1';

const deviceId = async () => {
  const saved = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (saved) return saved;
  const created = `${Platform.OS}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  await SecureStore.setItemAsync(DEVICE_ID_KEY, created, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return created;
};

const projectId = () =>
  Constants.easConfig?.projectId ??
  (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId;

export const pushNotifications = {
  async register() {
    if (!Device.isDevice)
      throw new Error('Remote push notifications require a physical Android or iOS device.');
    if (Platform.OS !== 'android' && Platform.OS !== 'ios')
      throw new Error('Remote push notifications are supported only on Android and iOS.');
    let permission = await Notifications.getPermissionsAsync();
    if (permission.status !== 'granted') permission = await Notifications.requestPermissionsAsync();
    if (permission.status !== 'granted')
      throw new Error('Notification permission was not granted on this device.');
    const easProjectId = projectId();
    if (!easProjectId)
      throw new Error('Expo EAS projectId is missing from the mobile application configuration.');
    const expoToken = (await Notifications.getExpoPushTokenAsync({ projectId: easProjectId })).data;
    const registered = await api.registerPushToken({
      token: expoToken,
      deviceId: await deviceId(),
      platform: Platform.OS === 'android' ? 'ANDROID' : 'IOS',
    });
    await SecureStore.setItemAsync(PUSH_TOKEN_ID_KEY, registered.id, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    return registered;
  },
  async revoke() {
    const id = await SecureStore.getItemAsync(PUSH_TOKEN_ID_KEY);
    if (!id) return;
    await api.revokePushToken(id);
    await SecureStore.deleteItemAsync(PUSH_TOKEN_ID_KEY);
  },
};
