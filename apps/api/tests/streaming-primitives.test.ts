import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApiError } from '../src/utils/api-error.js';
import { MediaMtxGateway } from '../src/modules/streams/media-gateway.service.js';
import { StreamService } from '../src/modules/streams/stream.service.js';
import { testConfig } from './helpers.js';

describe('streaming security primitives', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('fails closed when the media gateway is disabled', async () => {
    const gateway = new MediaMtxGateway(testConfig);
    await expect(gateway.provision('camera-1', 'rtsp://secret@example/cam')).rejects.toMatchObject({
      code: 'MEDIA_GATEWAY_DISABLED',
      status: 503,
    } satisfies Partial<ApiError>);
  });
  it('uses actual HLS and WHEP endpoints without query credentials', () => {
    const gateway = new MediaMtxGateway(testConfig);
    expect(gateway.playback('camera-safe', 'HLS')).toBe(
      'http://127.0.0.1:8888/camera-safe/index.m3u8',
    );
    expect(gateway.playback('camera-safe', 'WEBRTC')).toBe(
      'http://127.0.0.1:8889/camera-safe/whep',
    );
    expect(gateway.playback('camera-safe', 'HLS')).not.toContain('?');
  });
  it('does not put camera credentials into playback descriptors', () => {
    const media = new MediaMtxGateway(testConfig);
    const service = new StreamService(testConfig, {} as never, {} as never, media);
    const descriptor = service.descriptor(
      {
        _id: {} as never,
        organizationId: {} as never,
        cameraId: { toString: () => 'camera-1' } as never,
        userId: {} as never,
        sessionId: 'session-1',
        transport: 'HLS',
        playbackMode: 'REMOTE',
        status: 'READY',
        mediaPath: 'camera-safe',
        tokenHash: 'server-only-hash',
        expiresAt: new Date(),
        lastActivityAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      'one-time-token',
    );
    const serialized = JSON.stringify(descriptor);
    expect(serialized).not.toContain('rtsp://');
    expect(serialized).not.toContain('server-only-hash');
    expect(descriptor.authorization).toEqual({ scheme: 'Bearer', token: 'one-time-token' });
  });
  it('does not expose a URL for a failed session', () => {
    const service = new StreamService(
      testConfig,
      {} as never,
      {} as never,
      new MediaMtxGateway(testConfig),
    );
    const descriptor = service.descriptor({
      _id: {} as never,
      organizationId: {} as never,
      cameraId: { toString: () => 'camera-1' } as never,
      userId: {} as never,
      sessionId: 'session-1',
      transport: 'WEBRTC',
      playbackMode: 'REMOTE',
      status: 'FAILED',
      mediaPath: 'camera-safe',
      tokenHash: 'hash',
      expiresAt: new Date(),
      lastActivityAt: new Date(),
      diagnosticCode: 'STREAM_SOURCE_NOT_READY',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(descriptor.endpoint).toBeNull();
    expect(descriptor.diagnosticCode).toBe('STREAM_SOURCE_NOT_READY');
  });
});
