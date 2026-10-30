import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../src/services/bookmycctv-api';
import { StreamController } from '../src/services/streaming';
describe('StreamController', () => {
  afterEach(() => vi.restoreAllMocks());
  it('returns only a ready authorized HLS descriptor', async () => {
    const descriptor = {
      sessionId: 's1',
      cameraId: 'c1',
      protocol: 'HLS' as const,
      playbackMode: 'REMOTE' as const,
      status: 'READY' as const,
      expiresAt: new Date().toISOString(),
      endpoint: 'https://media.example/hls/c1/index.m3u8',
      authorization: { scheme: 'Bearer' as const, token: 'short-lived' },
      playerRequirements: [],
      diagnosticCode: null,
    };
    vi.spyOn(api, 'createStream').mockResolvedValue(descriptor);
    const controller = new StreamController();
    await expect(controller.start('c1')).resolves.toEqual(descriptor);
  });
  it('revokes an unusable session and rejects playback', async () => {
    vi.spyOn(api, 'createStream').mockResolvedValue({
      sessionId: 's2',
      cameraId: 'c1',
      protocol: 'HLS',
      playbackMode: 'REMOTE',
      status: 'FAILED',
      expiresAt: new Date().toISOString(),
      endpoint: null,
      playerRequirements: [],
      diagnosticCode: 'MEDIA_GATEWAY_UNAVAILABLE',
    });
    const revoke = vi.spyOn(api, 'revokeStream').mockResolvedValue({});
    await expect(new StreamController().start('c1')).rejects.toThrow('MEDIA_GATEWAY_UNAVAILABLE');
    expect(revoke).toHaveBeenCalledWith('s2');
  });
  it('revokes the active session during cleanup', async () => {
    vi.spyOn(api, 'createStream').mockResolvedValue({
      sessionId: 's3',
      cameraId: 'c1',
      protocol: 'HLS',
      playbackMode: 'REMOTE',
      status: 'READY',
      expiresAt: new Date().toISOString(),
      endpoint: 'https://media.example/live.m3u8',
      authorization: { scheme: 'Bearer', token: 't' },
      playerRequirements: [],
      diagnosticCode: null,
    });
    const revoke = vi.spyOn(api, 'revokeStream').mockResolvedValue({});
    const controller = new StreamController();
    await controller.start('c1');
    await controller.stop();
    expect(revoke).toHaveBeenCalledOnce();
  });
});
