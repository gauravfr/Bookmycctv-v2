import type { ConnectionMethod, DeviceBrand, DeviceRegistration, DeviceType } from '@/types/domain';

export interface DeviceRegistrationDraft {
  displayName: string;
  brand: DeviceBrand;
  deviceType: DeviceType;
  connectionMethod: ConnectionMethod;
  hostname: string;
  gatewayId: string;
  username: string;
  password: string;
  rtspPort: string;
  httpPort: string;
  onvifPort: string;
  customRtspPath: string;
  streamTransport: 'TCP' | 'UDP';
}
export type DeviceRegistrationErrors = Partial<Record<keyof DeviceRegistrationDraft, string>>;
const hostnamePattern =
  /^(?=.{1,253}$)(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)*[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i;
const validHost = (value: string) =>
  hostnamePattern.test(value) ||
  (value.split('.').length === 4 &&
    value.split('.').every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255));
const portError = (value: string) =>
  !/^\d+$/.test(value)
    ? 'Enter a whole number.'
    : Number(value) < 1 || Number(value) > 65535
      ? 'Port must be between 1 and 65535.'
      : undefined;

export function validateDeviceRegistration(
  draft: DeviceRegistrationDraft,
): DeviceRegistrationErrors {
  const errors: DeviceRegistrationErrors = {};
  if (draft.displayName.trim().length < 2) errors.displayName = 'Enter at least 2 characters.';
  if (!draft.username) errors.username = 'Device username is required by the backend.';
  if (!draft.password) errors.password = 'Device password is required by the backend.';
  if (draft.connectionMethod === 'LOCAL_LAN') {
    if (!draft.hostname.trim()) errors.hostname = 'Hostname or IP address is required.';
    else if (!validHost(draft.hostname.trim()))
      errors.hostname = 'Enter a valid DNS hostname or IPv4 address.';
  }
  if (draft.connectionMethod === 'SECURE_GATEWAY' && !draft.gatewayId.trim())
    errors.gatewayId = 'Select or enter an enrolled gateway ID.';
  errors.rtspPort = portError(draft.rtspPort);
  errors.httpPort = portError(draft.httpPort);
  errors.onvifPort = portError(draft.onvifPort);
  if (draft.customRtspPath.includes('://') || draft.customRtspPath.includes('@'))
    errors.customRtspPath = 'Enter only a path; schemes and embedded credentials are not allowed.';
  if (draft.customRtspPath.length > 500)
    errors.customRtspPath = 'Path must be 500 characters or fewer.';
  return Object.fromEntries(
    Object.entries(errors).filter(([, value]) => value),
  ) as DeviceRegistrationErrors;
}

export function buildDeviceRegistrationPayload(draft: DeviceRegistrationDraft): DeviceRegistration {
  return {
    displayName: draft.displayName.trim(),
    brand: draft.brand,
    deviceType: draft.deviceType,
    connectionMethod: draft.connectionMethod,
    ...(draft.connectionMethod === 'LOCAL_LAN' ? { hostname: draft.hostname.trim() } : {}),
    ...(draft.connectionMethod === 'SECURE_GATEWAY' ? { gatewayId: draft.gatewayId.trim() } : {}),
    username: draft.username,
    password: draft.password,
    rtspPort: Number(draft.rtspPort),
    httpPort: Number(draft.httpPort),
    onvifPort: Number(draft.onvifPort),
    ...(draft.customRtspPath.trim() ? { customRtspPath: draft.customRtspPath.trim() } : {}),
    streamTransport: draft.streamTransport,
    tlsEnabled: false,
    tlsVerify: true,
  };
}
export const deviceTypeDescriptions: Record<DeviceType, string> = {
  IP_CAMERA: 'A single network camera.',
  DVR: 'A recorder for analogue camera channels.',
  NVR: 'A recorder for IP camera channels.',
  XVR: 'A hybrid recorder supporting multiple camera technologies.',
};
export const unavailableConnectionReason: Partial<Record<ConnectionMethod, string>> = {
  SECURE_GATEWAY:
    'Enrollment exists, but device command and media relay transport are not implemented.',
  VENDOR_CLOUD: 'No authorized vendor-cloud integration is configured.',
};
