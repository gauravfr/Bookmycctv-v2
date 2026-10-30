import { createServer } from 'node:net';
import { Types } from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CameraModel } from '../src/modules/cameras/camera.model.js';
import { MongoCameraResourceValidator } from '../src/modules/cameras/camera-resource.js';
import { ConnectorRegistry } from '../src/modules/device-connectors/vendor-connectors.js';
import { RtspProbeService } from '../src/modules/device-connectors/rtsp-probe.service.js';
import { CredentialCryptoService } from '../src/modules/devices/credential-crypto.service.js';
import { safeDevice } from '../src/modules/devices/device.model.js';
import {
  deviceRegistrationSchema,
  fieldDefinitions,
} from '../src/modules/devices/device.schemas.js';
import {
  NetworkPolicyService,
  cidrContains,
} from '../src/modules/devices/network-policy.service.js';
import { testConfig } from './helpers.js';

describe('device integration security and connectors', () => {
  afterEach(() => vi.restoreAllMocks());
  it('encrypts and authenticates credentials with unique AES-GCM nonces', () => {
    const crypto = new CredentialCryptoService(testConfig);
    const first = crypto.encrypt('camera-password');
    const second = crypto.encrypt('camera-password');
    expect(first.ciphertext).not.toBe('camera-password');
    expect(first.iv).not.toBe(second.iv);
    expect(crypto.decrypt(first)).toBe('camera-password');
  });
  it('rejects modified encrypted credentials', () => {
    const crypto = new CredentialCryptoService(testConfig);
    const value = crypto.encrypt('camera-password');
    value.authTag = Buffer.alloc(16).toString('base64');
    expect(() => crypto.decrypt(value)).toThrow();
  });
  it('recognizes approved IPv4 CIDRs', () => {
    expect(cidrContains('192.168.4.12', '192.168.0.0/16')).toBe(true);
    expect(cidrContains('8.8.8.8', '192.168.0.0/16')).toBe(false);
  });
  it('allows explicitly approved private destinations', async () => {
    await expect(
      new NetworkPolicyService(['192.168.0.0/16']).assertAllowed('192.168.1.20'),
    ).resolves.toEqual(['192.168.1.20']);
  });
  it('blocks loopback even if mistakenly allowlisted', async () => {
    await expect(
      new NetworkPolicyService(['127.0.0.0/8']).assertAllowed('127.0.0.1'),
    ).rejects.toMatchObject({ code: 'DEVICE_DESTINATION_DENIED' });
  });
  it('blocks metadata and link-local destinations', async () => {
    await expect(
      new NetworkPolicyService(['169.254.0.0/16']).assertAllowed('169.254.169.254'),
    ).rejects.toMatchObject({ code: 'DEVICE_DESTINATION_DENIED' });
  });
  it('selects the correct vendor adapter', () => {
    const registry = new ConnectorRegistry({ connect: vi.fn() } as never);
    expect(registry.get('DAHUA').brand).toBe('DAHUA');
    expect(registry.get('CP_PLUS').brand).toBe('CP_PLUS');
    expect(registry.get('HIKVISION').brand).toBe('HIKVISION');
  });
  it('uses documented vendor paths without assuming CP Plus firmware', () => {
    const registry = new ConnectorRegistry({ connect: vi.fn() } as never);
    const input = { customRtspPath: undefined } as never;
    expect(registry.get('DAHUA').fallbackRtspPath(input, 1, 0)).toContain('realmonitor');
    expect(registry.get('HIKVISION').fallbackRtspPath(input, 1, 0)).toContain('101');
    expect(registry.get('CP_PLUS').fallbackRtspPath(input, 1, 0)).toBeUndefined();
  });
  it('rejects invalid brands and missing LAN endpoints', () => {
    expect(() =>
      deviceRegistrationSchema.parse({
        displayName: 'Recorder',
        brand: 'OTHER',
        deviceType: 'NVR',
        connectionMethod: 'LOCAL_LAN',
        username: 'admin',
        password: 'secret',
      }),
    ).toThrow();
    expect(() =>
      deviceRegistrationSchema.parse({
        displayName: 'Recorder',
        brand: 'DAHUA',
        deviceType: 'NVR',
        connectionMethod: 'LOCAL_LAN',
        username: 'admin',
        password: 'secret',
      }),
    ).toThrow();
  });
  it('returns dynamic field requirements without credentials', () => {
    const result = fieldDefinitions('DAHUA', 'NVR', 'LOCAL_LAN');
    expect(result.fields.find((field) => field.name === 'hostname')?.required).toBe(true);
    expect(JSON.stringify(result)).not.toContain('camera-password');
  });
  it('never serializes encrypted device credentials', () => {
    const safe = safeDevice({
      _id: new Types.ObjectId(),
      organizationId: new Types.ObjectId(),
      createdBy: new Types.ObjectId(),
      displayName: 'Recorder',
      brand: 'DAHUA',
      deviceType: 'NVR',
      connectionMethod: 'LOCAL_LAN',
      hostname: '192.168.1.2',
      usernameEncrypted: { ciphertext: 'x', iv: 'y', authTag: 'z', keyId: 'k' },
      passwordEncrypted: { ciphertext: 'x', iv: 'y', authTag: 'z', keyId: 'k' },
      rtspPort: 554,
      httpPort: 80,
      onvifPort: 80,
      streamTransport: 'TCP',
      tlsEnabled: false,
      tlsVerify: true,
      connectionState: 'UNKNOWN',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(safe).not.toHaveProperty('passwordEncrypted');
    expect(safe).not.toHaveProperty('usernameEncrypted');
  });
  it('rejects assignments when a requested capability is unsupported', async () => {
    vi.spyOn(CameraModel, 'findOne').mockResolvedValue({
      capabilities: { ptz: { state: 'UNSUPPORTED' } },
    } as never);
    await expect(
      new MongoCameraResourceValidator().validate(new Types.ObjectId(), new Types.ObjectId(), [
        'camera:ptz',
      ]),
    ).rejects.toMatchObject({ code: 'CAMERA_CAPABILITY_UNAVAILABLE' });
  });
  it('accepts an assignment only for verified capability support', async () => {
    vi.spyOn(CameraModel, 'findOne').mockResolvedValue({
      capabilities: { liveVideo: { state: 'SUPPORTED' } },
    } as never);
    await expect(
      new MongoCameraResourceValidator().validate(new Types.ObjectId(), new Types.ObjectId(), [
        'camera:view',
      ]),
    ).resolves.toBeUndefined();
  });
  it('performs a real bounded RTSP DESCRIBE negotiation', async () => {
    const server = createServer((socket) =>
      socket.once('data', () =>
        socket.end(
          'RTSP/1.0 200 OK\r\nCSeq: 1\r\nContent-Type: application/sdp\r\n\r\nv=0\r\nm=video 0 RTP/AVP 96\r\na=rtpmap:96 H264/90000\r\n',
        ),
      ),
    );
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No server address');
    try {
      const result = await new RtspProbeService().probe({
        host: '127.0.0.1',
        port: address.port,
        path: '/stream',
        username: 'u',
        password: 'p',
        timeoutMs: 1000,
      });
      expect(result).toMatchObject({ reachable: true, authenticated: true, streamAvailable: true });
      expect(result.codecs).toContain('H264');
    } finally {
      server.close();
    }
  });
});
