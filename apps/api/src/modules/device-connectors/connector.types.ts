import type { DeviceBrand, DeviceType } from '../devices/device.model.js';
import type { Capability } from '../cameras/camera.model.js';
export interface ConnectorInput {
  hostname: string;
  onvifPort: number;
  rtspPort: number;
  username: string;
  password: string;
  deviceType: DeviceType;
  customRtspPath?: string;
  timeoutMs: number;
}
export interface DiscoveredProfile {
  token: string;
  name?: string;
  channelId: string;
  codec?: string;
  width?: number;
  height?: number;
  streamUri?: string;
  snapshotUri?: string;
  capabilities: Record<string, Capability>;
}
export interface ConnectionResult {
  networkReachable: boolean;
  authenticationSuccessful: boolean;
  deviceInformationDiscovered: boolean;
  channelsDiscovered: boolean;
  streamUriObtained: boolean;
  streamMediaVerified: boolean;
  device: {
    manufacturer?: string;
    model?: string;
    firmwareVersion?: string;
    serialNumber?: string;
  };
  profiles: DiscoveredProfile[];
  warnings: string[];
}
export interface DeviceConnector {
  readonly brand: DeviceBrand;
  connect(input: ConnectorInput): Promise<ConnectionResult>;
  fallbackRtspPath(input: ConnectorInput, channel: number, subtype: number): string | undefined;
}
