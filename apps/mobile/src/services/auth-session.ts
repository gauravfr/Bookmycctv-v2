import * as SecureStore from 'expo-secure-store';
import { apiRequest, configureApiAuth } from './api-client';
import type { User } from '@/types/domain';
import { SingleFlight } from '@/utils/single-flight';
const REFRESH_KEY = 'bookmycctv.refresh-token.v1';
export interface Credentials {
  accessToken: string;
  accessTokenExpiresInSeconds: number;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  user: User;
}
let accessToken: string | null = null;
let currentUser: User | null = null;
const refreshGate = new SingleFlight<string | null>();
let onSessionLost: () => Promise<void> = async () => undefined;
const persist = async (credentials: Credentials) => {
  accessToken = credentials.accessToken;
  currentUser = credentials.user;
  await SecureStore.setItemAsync(REFRESH_KEY, credentials.refreshToken, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
};
const clear = async () => {
  accessToken = null;
  currentUser = null;
  await SecureStore.deleteItemAsync(REFRESH_KEY).catch(() => undefined);
};
const refresh = async (): Promise<string | null> =>
  refreshGate.run(async () => {
    const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
    if (!refreshToken) return null;
    try {
      const credentials = await apiRequest<Credentials>('/api/v1/auth/refresh', {
        method: 'POST',
        body: { refreshToken },
        authenticated: false,
        retryOnUnauthorized: false,
      });
      await persist(credentials);
      return credentials.accessToken;
    } catch {
      await clear();
      return null;
    }
  });
configureApiAuth({
  accessToken: () => accessToken,
  refresh,
  unauthorized: async () => {
    await clear();
    await onSessionLost();
  },
});
export const authSession = {
  user: () => currentUser,
  token: () => accessToken,
  onLost: (handler: () => Promise<void>) => {
    onSessionLost = handler;
  },
  async login(username: string, password: string) {
    const credentials = await apiRequest<Credentials>('/api/v1/auth/login', {
      method: 'POST',
      body: { username, password },
      authenticated: false,
      retryOnUnauthorized: false,
    });
    await persist(credentials);
    return credentials.user;
  },
  async restore() {
    const token = await refresh();
    if (!token) return null;
    const result = await apiRequest<{ user: User; permissions: string[] }>('/api/v1/auth/me');
    currentUser = result.user;
    return result.user;
  },
  async logout() {
    const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
    try {
      if (refreshToken)
        await apiRequest('/api/v1/auth/logout', { method: 'POST', body: { refreshToken } });
    } finally {
      await clear();
    }
  },
  async changePassword(currentPassword: string, newPassword: string) {
    await apiRequest('/api/v1/auth/change-password', {
      method: 'POST',
      body: { currentPassword, newPassword },
    });
    await clear();
  },
  clear,
};
