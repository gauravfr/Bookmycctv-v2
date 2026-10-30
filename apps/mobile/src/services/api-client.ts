import { mobileConfig, requireApiBaseUrl } from '@/constants/config';
import type { ApiFailure, ApiSuccess } from '@/types/domain';
export class ApiClientError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
  public get isOffline(): boolean {
    return this.code === 'NETWORK_UNAVAILABLE' || this.code === 'REQUEST_TIMEOUT';
  }
}
type AuthAdapter = {
  accessToken: () => string | null;
  refresh: () => Promise<string | null>;
  unauthorized: () => Promise<void>;
};
let authAdapter: AuthAdapter = {
  accessToken: () => null,
  refresh: async () => null,
  unauthorized: async () => undefined,
};
export const configureApiAuth = (adapter: AuthAdapter) => {
  authAdapter = adapter;
};
type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  authenticated?: boolean;
  timeoutMs?: number;
  retryOnUnauthorized?: boolean;
};
const parseBody = async (response: Response): Promise<unknown> => {
  const type = response.headers.get('content-type') ?? '';
  if (!type.includes('application/json')) return null;
  return response.json().catch(() => null);
};
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    body,
    authenticated = true,
    timeoutMs = mobileConfig.requestTimeoutMs,
    retryOnUnauthorized = true,
    ...init
  } = options;
  const token = authenticated ? authAdapter.accessToken() : null;
  const headers = new Headers(init.headers);
  headers.set('accept', 'application/json');
  if (body !== undefined) headers.set('content-type', 'application/json');
  if (token) headers.set('authorization', `Bearer ${token}`);
  let response: Response;
  try {
    response = await fetch(`${requireApiBaseUrl()}${path}`, {
      ...init,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'TimeoutError';
    throw new ApiClientError(
      0,
      timedOut ? 'REQUEST_TIMEOUT' : 'NETWORK_UNAVAILABLE',
      timedOut
        ? 'The request timed out. Please try again.'
        : 'The server is unreachable. Check your connection and API address.',
    );
  }
  if (response.status === 401 && authenticated && retryOnUnauthorized) {
    const refreshed = await authAdapter.refresh();
    if (refreshed) return apiRequest<T>(path, { ...options, retryOnUnauthorized: false });
    await authAdapter.unauthorized();
  }
  const payload = await parseBody(response);
  if (!response.ok) {
    const failure = payload as Partial<ApiFailure> | null;
    throw new ApiClientError(
      response.status,
      failure?.error?.code ?? `HTTP_${response.status}`,
      failure?.error?.message ?? safeStatusMessage(response.status),
      failure?.error?.details,
      failure?.meta?.requestId,
    );
  }
  const success = payload as ApiSuccess<T> | null;
  if (!success || success.success !== true)
    throw new ApiClientError(
      response.status,
      'INVALID_API_RESPONSE',
      'The server returned an invalid response.',
    );
  return success.data;
}
function safeStatusMessage(status: number): string {
  if (status === 400) return 'The request is invalid.';
  if (status === 403) return 'You do not have permission for this action.';
  if (status === 404) return 'The requested item was not found.';
  if (status === 409) return 'The request conflicts with the current state.';
  if (status === 422) return 'Some values are not supported.';
  if (status === 429) return 'Too many requests. Please wait and try again.';
  if (status >= 500) return 'The service is temporarily unavailable.';
  return 'The request failed.';
}
export async function apiBinary(path: string): Promise<{ blob: Blob; contentType: string }> {
  const token = authAdapter.accessToken();
  try {
    const response = await fetch(`${requireApiBaseUrl()}${path}`, {
      headers: {
        accept: 'image/jpeg,image/png',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      signal: AbortSignal.timeout(mobileConfig.requestTimeoutMs),
    });
    if (!response.ok)
      throw new ApiClientError(
        response.status,
        `HTTP_${response.status}`,
        safeStatusMessage(response.status),
      );
    return {
      blob: await response.blob(),
      contentType: response.headers.get('content-type') ?? 'application/octet-stream',
    };
  } catch (error) {
    if (error instanceof ApiClientError) throw error;
    throw new ApiClientError(0, 'NETWORK_UNAVAILABLE', 'The server is unreachable.');
  }
}
