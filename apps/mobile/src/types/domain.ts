export type UserRole = 'PLATFORM_ADMIN' | 'INSTALLER_ADMIN' | 'CLIENT';
export type EntityStatus = 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'UNKNOWN' | 'CONNECTING';
export type CapabilityState = 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN' | 'REQUIRES_CONFIGURATION';
export type DeviceBrand = 'DAHUA' | 'CP_PLUS' | 'HIKVISION';
export type DeviceType = 'IP_CAMERA' | 'DVR' | 'NVR' | 'XVR';
export type ConnectionMethod = 'LOCAL_LAN' | 'SECURE_GATEWAY' | 'VENDOR_CLOUD';
export type CameraPermission =
  'camera:view' | 'camera:snapshot' | 'camera:ptz' | 'camera:audio' | 'camera:events';
export interface ApiMeta {
  requestId: string;
  page?: number;
  limit?: number;
  total?: number;
  pages?: number;
}
export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta: ApiMeta;
}
export interface ApiFailure {
  success: false;
  error: { code: string; message: string; details?: unknown };
  meta: ApiMeta;
}
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
export interface User {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  role: UserRole;
  status: 'ACTIVE' | 'SUSPENDED' | 'DISABLED';
  organizationId: string | null;
  mustChangePassword: boolean;
}
export interface Organization {
  id: string;
  name: string;
  code: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'DISABLED';
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
}
export interface Capability {
  state: CapabilityState;
  source: string;
  verifiedAt?: string;
}
export interface CameraProfile {
  token: string;
  name?: string;
  codec?: string;
  width?: number;
  height?: number;
}
export interface Camera {
  id: string;
  deviceId: string;
  channelId: string;
  displayName: string;
  profiles: CameraProfile[];
  status: EntityStatus;
  mediaStatus: EntityStatus;
  capabilities: Record<string, Capability>;
  lastSeenAt: string | null;
}
export interface Device {
  id: string;
  displayName: string;
  brand: DeviceBrand;
  deviceType: DeviceType;
  connectionMethod: ConnectionMethod;
  hostname?: string;
  ports: { rtsp: number; http: number; onvif: number; vendor: number | null };
  streamTransport: 'TCP' | 'UDP';
  tlsEnabled: boolean;
  connectionState: EntityStatus | 'GATEWAY_NOT_READY';
  model: string | null;
  firmwareVersion: string | null;
  lastHealthCheckAt: string | null;
}
export interface SecurityEvent {
  id: string;
  cameraId?: string;
  eventType: string;
  source: string;
  severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  occurredAt: string;
  acknowledged: boolean;
  resolved: boolean;
  confidence?: number;
  metadata: Record<string, unknown>;
}
export type PlayerState =
  'idle' | 'loading' | 'connecting' | 'live' | 'offline' | 'unavailable' | 'unauthorized' | 'error';

export interface Pagination {
  page: number;
  limit: number;
  total: number;
}
export interface CameraAssignment {
  id: string;
  clientId: string;
  cameraId: string;
  permissions: CameraPermission[];
  assignedAt: string;
  updatedAt: string;
}
export interface AssignedCamera {
  camera: Camera;
  permissions: CameraPermission[];
  assignedAt: string;
}
export interface StreamDescriptor {
  sessionId: string;
  cameraId: string;
  protocol: 'WEBRTC' | 'HLS';
  playbackMode: 'LOCAL' | 'REMOTE';
  status: 'PROVISIONING' | 'READY' | 'FAILED' | 'REVOKED' | 'EXPIRED';
  expiresAt: string;
  endpoint: string | null;
  authorization?: { scheme: 'Bearer'; token: string };
  playerRequirements: string[];
  diagnosticCode: string | null;
}
export interface NotificationPreference {
  pushEnabled: boolean;
  eventTypes: string[];
  minimumSeverity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  quietHours?: { start: string; end: string };
  timeZone: string;
  cameraIds: string[];
}
export interface DeviceRegistration {
  displayName: string;
  brand: DeviceBrand;
  deviceType: DeviceType;
  connectionMethod: ConnectionMethod;
  hostname?: string;
  publicEndpoint?: string;
  gatewayId?: string;
  username: string;
  password: string;
  rtspPort: number;
  httpPort: number;
  onvifPort: number;
  vendorPort?: number;
  customRtspPath?: string;
  streamTransport: 'TCP' | 'UDP';
  tlsEnabled: boolean;
  tlsVerify: boolean;
}
