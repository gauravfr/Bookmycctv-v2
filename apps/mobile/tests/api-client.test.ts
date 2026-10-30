import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiRequest, configureApiAuth } from '../src/services/api-client';
import type { ApiClientError } from '../src/services/api-client';
const ok = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data, meta: { requestId: 'req-1' } }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
const fail = (status: number, code: string, message: string) =>
  new Response(
    JSON.stringify({ success: false, error: { code, message }, meta: { requestId: 'req-x' } }),
    { status, headers: { 'content-type': 'application/json' } },
  );
describe('mobile API client', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('retries once with a rotated access token after 401', async () => {
    let token = 'old';
    const refresh = vi.fn(async () => {
      token = 'new';
      return token;
    });
    configureApiAuth({ accessToken: () => token, refresh, unauthorized: async () => undefined });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(fail(401, 'TOKEN_EXPIRED', 'Expired'))
      .mockResolvedValueOnce(ok({ value: 42 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(apiRequest<{ value: number }>('/api/v1/test')).resolves.toEqual({ value: 42 });
    expect(refresh).toHaveBeenCalledOnce();
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit).headers).toMatchObject({});
    expect(
      new Headers((fetchMock.mock.calls[1]?.[1] as RequestInit).headers).get('authorization'),
    ).toBe('Bearer new');
  });
  it('maps validation errors without hiding the backend code', async () => {
    configureApiAuth({
      accessToken: () => null,
      refresh: async () => null,
      unauthorized: async () => undefined,
    });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          fail(422, 'CAMERA_CAPABILITY_UNAVAILABLE', 'camera:view is unavailable'),
        ),
    );
    await expect(
      apiRequest('/api/v1/test', { authenticated: false }),
    ).rejects.toMatchObject<ApiClientError>({
      status: 422,
      code: 'CAMERA_CAPABILITY_UNAVAILABLE',
      message: 'camera:view is unavailable',
    });
  });
});
