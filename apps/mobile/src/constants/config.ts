const configuredBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/$/, '');
export const mobileConfig = {
  apiBaseUrl: configuredBaseUrl,
  requestTimeoutMs: 15_000,
} as const;
export function requireApiBaseUrl(): string {
  if (!mobileConfig.apiBaseUrl) throw new Error('EXPO_PUBLIC_API_BASE_URL is not configured');
  if (!/^https?:\/\//.test(mobileConfig.apiBaseUrl))
    throw new Error('EXPO_PUBLIC_API_BASE_URL must be an HTTP(S) origin');
  return mobileConfig.apiBaseUrl;
}
