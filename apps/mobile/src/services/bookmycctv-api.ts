import { apiRequest, apiBinary } from './api-client';
import type {
  AssignedCamera,
  Camera,
  CameraAssignment,
  CameraPermission,
  Device,
  DeviceBrand,
  DeviceType,
  ConnectionMethod,
  DeviceRegistration,
  NotificationPreference,
  Organization,
  Pagination,
  SecurityEvent,
  StreamDescriptor,
  User,
} from '@/types/domain';
const idOf = (value: { id?: string; _id?: string }) => value.id ?? value._id ?? '';
const normalizeOrganization = (value: Organization & { _id?: string }): Organization => ({
  ...value,
  id: idOf(value),
});
const normalizeUser = (value: User & { _id?: string }): User => ({ ...value, id: idOf(value) });
const normalizeAssignment = (value: CameraAssignment & { _id?: string }): CameraAssignment => ({
  ...value,
  id: idOf(value),
});
export const api = {
  health: () =>
    apiRequest<{ status: string; database?: string }>('/api/v1/health', { authenticated: false }),
  ready: () =>
    apiRequest<{ status: string; database?: string }>('/api/v1/ready', { authenticated: false }),
  organizations: async (page = 1, limit = 20) => {
    const out = await apiRequest<{
      items: Array<Organization & { _id?: string }>;
      pagination: Pagination;
    }>(`/api/v1/platform/organizations?page=${page}&limit=${limit}`);
    return { ...out, items: out.items.map(normalizeOrganization) };
  },
  organization: async (id: string) =>
    normalizeOrganization(
      (
        await apiRequest<{ organization: Organization & { _id?: string } }>(
          `/api/v1/platform/organizations/${id}`,
        )
      ).organization,
    ),
  createOrganization: async (input: {
    name: string;
    code: string;
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
  }) =>
    normalizeOrganization(
      (
        await apiRequest<{ organization: Organization & { _id?: string } }>(
          '/api/v1/platform/organizations',
          { method: 'POST', body: input },
        )
      ).organization,
    ),
  installers: async (organizationId: string) => {
    const out = await apiRequest<{ items: Array<User & { _id?: string }>; pagination: Pagination }>(
      `/api/v1/platform/organizations/${organizationId}/admins?page=1&limit=100`,
    );
    return out.items.map(normalizeUser);
  },
  createInstaller: async (
    organizationId: string,
    input: { username: string; displayName: string; email?: string; temporaryPassword: string },
  ) =>
    normalizeUser(
      (
        await apiRequest<{ user: User & { _id?: string } }>(
          `/api/v1/platform/organizations/${organizationId}/admins`,
          { method: 'POST', body: input },
        )
      ).user,
    ),
  clients: async (page = 1, limit = 50) => {
    const out = await apiRequest<{ items: Array<User & { _id?: string }>; pagination: Pagination }>(
      `/api/v1/admin/clients?page=${page}&limit=${limit}`,
    );
    return { ...out, items: out.items.map(normalizeUser) };
  },
  client: async (id: string) =>
    normalizeUser(
      (await apiRequest<{ user: User & { _id?: string } }>(`/api/v1/admin/clients/${id}`)).user,
    ),
  createClient: async (input: {
    username: string;
    displayName: string;
    email?: string;
    temporaryPassword: string;
  }) =>
    normalizeUser(
      (
        await apiRequest<{ user: User & { _id?: string } }>('/api/v1/admin/clients', {
          method: 'POST',
          body: input,
        })
      ).user,
    ),
  assignments: async (clientId: string) =>
    (
      await apiRequest<{ items: Array<CameraAssignment & { _id?: string }> }>(
        `/api/v1/admin/clients/${clientId}/cameras`,
      )
    ).items.map(normalizeAssignment),
  assignCamera: async (clientId: string, cameraId: string, permissions: CameraPermission[]) =>
    normalizeAssignment(
      (
        await apiRequest<{ assignment: CameraAssignment & { _id?: string } }>(
          `/api/v1/admin/clients/${clientId}/cameras`,
          { method: 'POST', body: { cameraId, permissions } },
        )
      ).assignment,
    ),
  updateAssignment: async (clientId: string, cameraId: string, permissions: CameraPermission[]) =>
    normalizeAssignment(
      (
        await apiRequest<{ assignment: CameraAssignment & { _id?: string } }>(
          `/api/v1/admin/clients/${clientId}/cameras/${cameraId}`,
          { method: 'PATCH', body: { permissions } },
        )
      ).assignment,
    ),
  removeAssignment: (clientId: string, cameraId: string) =>
    apiRequest(`/api/v1/admin/clients/${clientId}/cameras/${cameraId}`, { method: 'DELETE' }),
  devices: (page = 1, limit = 50) =>
    apiRequest<{ items: Device[]; pagination: Pagination }>(
      `/api/v1/admin/devices?page=${page}&limit=${limit}`,
    ),
  device: async (id: string) =>
    (await apiRequest<{ device: Device }>(`/api/v1/admin/devices/${id}`)).device,
  registerDevice: async (input: DeviceRegistration) =>
    (await apiRequest<{ device: Device }>('/api/v1/admin/devices', { method: 'POST', body: input }))
      .device,
  deviceOptions: () =>
    apiRequest<{
      brands: DeviceBrand[];
      deviceTypes: DeviceType[];
      connectionMethods: ConnectionMethod[];
    }>('/api/v1/devices/brands'),
  testConnection: (id: string) =>
    apiRequest<{
      networkReachable: boolean;
      authenticationSuccessful: boolean;
      channelsDiscovered: boolean;
      streamMediaVerified: boolean;
      profiles: Array<{ channelId: string; codec?: string }>;
      warnings: string[];
    }>(`/api/v1/admin/devices/${id}/test-connection`, { method: 'POST', timeoutMs: 60_000 }),
  discover: async (id: string) => {
    const summary = await apiRequest<{
      created: number;
      updated: number;
      channels: number;
      warnings: string[];
    }>(`/api/v1/admin/devices/${id}/discover`, { method: 'POST', timeoutMs: 60_000 });
    const cameras = (await apiRequest<{ items: Camera[] }>(`/api/v1/admin/devices/${id}/cameras`))
      .items;
    return { ...summary, cameras };
  },
  deviceCameras: async (id: string) =>
    (await apiRequest<{ items: Camera[] }>(`/api/v1/admin/devices/${id}/cameras`)).items,
  cameras: async () => (await apiRequest<{ items: Camera[] }>('/api/v1/cameras')).items,
  camera: async (id: string) =>
    (await apiRequest<{ camera: Camera }>(`/api/v1/cameras/${id}`)).camera,
  assignedCameras: async () =>
    (await apiRequest<{ items: AssignedCamera[] }>('/api/v1/client/cameras')).items,
  events: async () =>
    (
      await apiRequest<{ items: Array<SecurityEvent & { _id?: string }> }>(
        '/api/v1/security-events',
      )
    ).items.map((event) => ({ ...event, id: idOf(event) })),
  acknowledgeEvent: async (id: string) =>
    (
      await apiRequest<{ event: SecurityEvent }>(`/api/v1/security-events/${id}/acknowledge`, {
        method: 'POST',
      })
    ).event,
  resolveEvent: async (id: string) =>
    (
      await apiRequest<{ event: SecurityEvent }>(`/api/v1/security-events/${id}/resolve`, {
        method: 'POST',
      })
    ).event,
  eventEvidence: (id: string) => apiBinary(`/api/v1/security-events/${id}/evidence`),
  notificationPreferences: async () =>
    (
      await apiRequest<{ preferences: NotificationPreference | null }>(
        '/api/v1/notification-preferences',
      )
    ).preferences,
  saveNotificationPreferences: async (input: NotificationPreference) =>
    (
      await apiRequest<{ preferences: NotificationPreference }>(
        '/api/v1/notification-preferences',
        { method: 'PUT', body: input },
      )
    ).preferences,
  registerPushToken: async (input: {
    token: string;
    deviceId: string;
    platform: 'ANDROID' | 'IOS';
  }) =>
    apiRequest<{ id: string; deviceId: string; platform: 'ANDROID' | 'IOS' }>(
      '/api/v1/push-tokens',
      { method: 'POST', body: input },
    ),
  revokePushToken: (id: string) =>
    apiRequest<{ revoked: boolean }>(`/api/v1/push-tokens/${id}`, { method: 'DELETE' }),
  createStream: async (cameraId: string, transport: 'HLS' | 'WEBRTC' = 'HLS') =>
    (
      await apiRequest<{ stream: StreamDescriptor }>(`/api/v1/cameras/${cameraId}/streams`, {
        method: 'POST',
        body: { transport },
        timeoutMs: 30_000,
      })
    ).stream,
  refreshStream: async (sessionId: string) =>
    (
      await apiRequest<{ stream: StreamDescriptor }>(`/api/v1/streams/${sessionId}/refresh`, {
        method: 'POST',
      })
    ).stream,
  revokeStream: (sessionId: string) =>
    apiRequest(`/api/v1/streams/${sessionId}`, { method: 'DELETE' }),
  streamHealth: async (sessionId: string) =>
    (
      await apiRequest<{
        health: { status: string; online: boolean; diagnosticCode: string | null };
      }>(`/api/v1/streams/${sessionId}/health`)
    ).health,
  snapshot: (cameraId: string) => apiBinary(`/api/v1/cameras/${cameraId}/snapshots`),
  ptzMove: (cameraId: string, input: { x: number; y: number; zoom: number; durationMs: number }) =>
    apiRequest(`/api/v1/cameras/${cameraId}/ptz/move`, { method: 'POST', body: input }),
};
