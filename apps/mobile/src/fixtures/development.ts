import type { Camera, Device, Organization, SecurityEvent } from '@/types/domain';
const ensureDev = () => {
  if (!__DEV__) throw new Error('Development fixtures are unavailable in production builds');
};
export const previewOrganizations = (): Organization[] => {
  ensureDev();
  return [
    {
      id: 'org-1',
      name: 'Aster Retail Group',
      code: 'ASTER',
      status: 'ACTIVE',
      contactName: 'Meera Shah',
      contactEmail: 'ops@aster.example',
      contactPhone: '+91 ••••• 4821',
    },
    {
      id: 'org-2',
      name: 'Northstar Logistics',
      code: 'NORTH',
      status: 'ACTIVE',
      contactName: 'Rohan Mehta',
      contactEmail: 'security@northstar.example',
      contactPhone: '+91 ••••• 1138',
    },
    {
      id: 'org-3',
      name: 'Harbor Hotels',
      code: 'HARBOR',
      status: 'SUSPENDED',
      contactName: 'Anita Rao',
      contactEmail: null,
      contactPhone: null,
    },
  ];
};
const supported = (source = 'ONVIF') => ({
  state: 'SUPPORTED' as const,
  source,
  verifiedAt: '2026-10-26T08:15:00.000Z',
});
const unknown = (source = 'DISCOVERY') => ({ state: 'UNKNOWN' as const, source });
export const previewCameras = (): Camera[] => {
  ensureDev();
  return [
    {
      id: 'cam-1',
      deviceId: 'dev-1',
      channelId: '1',
      displayName: 'Main entrance',
      status: 'ONLINE',
      mediaStatus: 'ONLINE',
      profiles: [{ token: 'main', name: 'HD', codec: 'H264', width: 1920, height: 1080 }],
      capabilities: {
        liveVideo: supported(),
        snapshot: supported(),
        ptz: { state: 'UNSUPPORTED', source: 'ONVIF' },
        audioInput: unknown(),
        events: supported(),
      },
      lastSeenAt: '2026-10-26T09:12:00.000Z',
    },
    {
      id: 'cam-2',
      deviceId: 'dev-1',
      channelId: '2',
      displayName: 'Warehouse aisle 04',
      status: 'ONLINE',
      mediaStatus: 'DEGRADED',
      profiles: [{ token: 'main', codec: 'H265', width: 2560, height: 1440 }],
      capabilities: {
        liveVideo: supported(),
        snapshot: supported(),
        ptz: supported(),
        audioInput: supported(),
        events: supported(),
      },
      lastSeenAt: '2026-10-26T09:11:00.000Z',
    },
    {
      id: 'cam-3',
      deviceId: 'dev-2',
      channelId: '1',
      displayName: 'Loading bay',
      status: 'OFFLINE',
      mediaStatus: 'OFFLINE',
      profiles: [],
      capabilities: {
        liveVideo: unknown(),
        snapshot: unknown(),
        ptz: unknown(),
        audioInput: unknown(),
        events: unknown(),
      },
      lastSeenAt: '2026-10-26T06:40:00.000Z',
    },
  ];
};
export const previewDevices = (): Device[] => {
  ensureDev();
  return [
    {
      id: 'dev-1',
      displayName: 'Warehouse NVR',
      brand: 'HIKVISION',
      deviceType: 'NVR',
      connectionMethod: 'SECURE_GATEWAY',
      hostname: '10.0.••.••',
      ports: { rtsp: 554, http: 80, onvif: 80, vendor: null },
      streamTransport: 'TCP',
      tlsEnabled: true,
      connectionState: 'ONLINE',
      model: 'DS-7608',
      firmwareVersion: 'V4.7',
      lastHealthCheckAt: '2026-10-26T09:10:00.000Z',
    },
    {
      id: 'dev-2',
      displayName: 'Loading bay camera',
      brand: 'DAHUA',
      deviceType: 'IP_CAMERA',
      connectionMethod: 'LOCAL_LAN',
      hostname: '192.168.••.••',
      ports: { rtsp: 554, http: 80, onvif: 80, vendor: null },
      streamTransport: 'TCP',
      tlsEnabled: false,
      connectionState: 'OFFLINE',
      model: null,
      firmwareVersion: null,
      lastHealthCheckAt: '2026-10-26T08:55:00.000Z',
    },
  ];
};
export const previewEvents = (): SecurityEvent[] => {
  ensureDev();
  return [
    {
      id: 'event-1',
      cameraId: 'cam-1',
      eventType: 'MOTION_DETECTED',
      source: 'DEVICE_EVENT',
      severity: 'HIGH',
      acknowledged: false,
      resolved: false,
      occurredAt: '09:08',
      metadata: { title: 'Motion after business hours' },
    },
    {
      id: 'event-2',
      cameraId: 'cam-2',
      eventType: 'CAMERA_OFFLINE',
      source: 'HEALTH_MONITOR',
      severity: 'CRITICAL',
      acknowledged: true,
      resolved: false,
      occurredAt: '08:42',
      metadata: { title: 'Video signal interrupted' },
    },
    {
      id: 'event-3',
      cameraId: 'cam-2',
      eventType: 'PERSON_DETECTED',
      source: 'AI_INFERENCE',
      severity: 'MEDIUM',
      acknowledged: true,
      resolved: true,
      occurredAt: 'Yesterday',
      metadata: { title: 'Person detected in restricted zone' },
    },
  ];
};
