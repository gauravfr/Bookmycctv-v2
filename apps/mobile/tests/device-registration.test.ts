import { describe, expect, it } from 'vitest';
import {
  buildDeviceRegistrationPayload,
  validateDeviceRegistration,
  type DeviceRegistrationDraft,
} from '../src/features/device-registration';

const valid = (): DeviceRegistrationDraft => ({
  displayName: 'Front gate NVR',
  brand: 'HIKVISION',
  deviceType: 'NVR',
  connectionMethod: 'LOCAL_LAN',
  hostname: 'camera.example.test',
  gatewayId: '',
  username: 'installer',
  password: 'secret',
  rtspPort: '8554',
  httpPort: '8080',
  onvifPort: '8000',
  customRtspPath: '/Streaming/Channels/101',
  streamTransport: 'TCP',
});

describe('device registration', () => {
  it('accepts backend-compatible DNS hosts and nonstandard ports', () =>
    expect(validateDeviceRegistration(valid())).toEqual({}));
  it('rejects invalid ports, hosts, and credential-bearing RTSP paths', () => {
    const errors = validateDeviceRegistration({
      ...valid(),
      hostname: 'bad host',
      rtspPort: '70000',
      customRtspPath: 'rtsp://user:pass@host/live',
    });
    expect(errors.hostname).toBeTruthy();
    expect(errors.rtspPort).toBeTruthy();
    expect(errors.customRtspPath).toBeTruthy();
  });
  it('requires the conditional gateway identifier without clearing other values', () => {
    const draft = { ...valid(), connectionMethod: 'SECURE_GATEWAY' as const, gatewayId: '' };
    expect(validateDeviceRegistration(draft).gatewayId).toBeTruthy();
    expect(draft.password).toBe('secret');
  });
  it('maps only the exact backend payload and trims non-secret fields', () => {
    const payload = buildDeviceRegistrationPayload({
      ...valid(),
      displayName: '  Gate  ',
      hostname: ' cam.local ',
    });
    expect(payload).toMatchObject({
      displayName: 'Gate',
      hostname: 'cam.local',
      rtspPort: 8554,
      tlsVerify: true,
    });
    expect(payload).not.toHaveProperty('gatewayId');
  });
});
