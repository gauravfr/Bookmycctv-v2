import type { Types } from 'mongoose';
import type { AppConfig } from '../../config/env.js';
import { ApiError } from '../../utils/api-error.js';
import type { AuditService } from '../alerts/audit.service.js';
import { CameraModel } from '../cameras/camera.model.js';
import type { ConnectorInput, ConnectionResult } from '../device-connectors/connector.types.js';
import type { ConnectorRegistry } from '../device-connectors/vendor-connectors.js';
import { RtspProbeService } from '../device-connectors/rtsp-probe.service.js';
import type { CredentialCryptoService } from './credential-crypto.service.js';
import { DeviceModel, safeDevice, type DeviceRecord } from './device.model.js';
import type { NetworkPolicyService } from './network-policy.service.js';

export class DeviceService {
  public constructor(
    private readonly config: AppConfig,
    private readonly crypto: CredentialCryptoService,
    private readonly network: NetworkPolicyService,
    private readonly connectors: ConnectorRegistry,
    private readonly audit: AuditService,
    private readonly rtsp = new RtspProbeService(),
  ) {}
  private filter(organizationId: Types.ObjectId, id?: Types.ObjectId) {
    return { ...(id ? { _id: id } : {}), organizationId, deletedAt: { $exists: false } };
  }
  public async create(
    organizationId: Types.ObjectId,
    actorId: Types.ObjectId,
    body: Record<string, unknown>,
  ) {
    if (body.connectionMethod === 'LOCAL_LAN')
      await this.network.assertAllowed(String(body.hostname));
    if (body.connectionMethod === 'VENDOR_CLOUD')
      throw new ApiError(
        422,
        'VENDOR_CLOUD_UNAVAILABLE',
        'No authorized vendor cloud integration is configured',
      );
    const created = await DeviceModel.create({
      ...body,
      organizationId,
      createdBy: actorId,
      usernameEncrypted: this.crypto.encrypt(String(body.username)),
      passwordEncrypted: this.crypto.encrypt(String(body.password)),
    });
    await this.audit.record({
      actorId,
      action: 'DEVICE_CREATED',
      targetType: 'Device',
      targetId: created.id,
      organizationId,
      metadata: {
        brand: created.brand,
        deviceType: created.deviceType,
        connectionMethod: created.connectionMethod,
      },
    });
    return safeDevice(created);
  }
  public async list(organizationId: Types.ObjectId, page: number, limit: number) {
    const filter = this.filter(organizationId);
    const [items, total] = await Promise.all([
      DeviceModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      DeviceModel.countDocuments(filter),
    ]);
    return {
      items: items.map((item) => safeDevice(item as DeviceRecord & { _id: Types.ObjectId })),
      pagination: { page, limit, total },
    };
  }
  public async getDocument(
    organizationId: Types.ObjectId,
    id: Types.ObjectId,
    credentials = false,
  ) {
    const query = DeviceModel.findOne(this.filter(organizationId, id));
    if (credentials) query.select('+usernameEncrypted +passwordEncrypted');
    const device = await query;
    if (!device) throw new ApiError(404, 'DEVICE_NOT_FOUND', 'Device not found');
    return device;
  }
  public async get(organizationId: Types.ObjectId, id: Types.ObjectId) {
    return safeDevice(await this.getDocument(organizationId, id));
  }
  public async update(
    organizationId: Types.ObjectId,
    actorId: Types.ObjectId,
    id: Types.ObjectId,
    body: Record<string, unknown>,
  ) {
    if (body.hostname) await this.network.assertAllowed(String(body.hostname));
    const updates = { ...body };
    if (body.username) {
      updates.usernameEncrypted = this.crypto.encrypt(String(body.username));
      delete updates.username;
    }
    if (body.password) {
      updates.passwordEncrypted = this.crypto.encrypt(String(body.password));
      delete updates.password;
    }
    const device = await DeviceModel.findOneAndUpdate(
      this.filter(organizationId, id),
      { $set: updates },
      { new: true, runValidators: true },
    );
    if (!device) throw new ApiError(404, 'DEVICE_NOT_FOUND', 'Device not found');
    await this.audit.record({
      actorId,
      action: 'DEVICE_UPDATED',
      targetType: 'Device',
      targetId: device.id,
      organizationId,
      metadata: {
        fields: Object.keys(body).filter((field) => !['username', 'password'].includes(field)),
      },
    });
    return safeDevice(device);
  }
  public async remove(organizationId: Types.ObjectId, actorId: Types.ObjectId, id: Types.ObjectId) {
    const now = new Date();
    const device = await DeviceModel.findOneAndUpdate(
      this.filter(organizationId, id),
      { deletedAt: now, connectionState: 'OFFLINE' },
      { new: true },
    );
    if (!device) throw new ApiError(404, 'DEVICE_NOT_FOUND', 'Device not found');
    await CameraModel.updateMany(
      { organizationId, deviceId: id, deletedAt: { $exists: false } },
      { deletedAt: now, status: 'OFFLINE' },
    );
    await this.audit.record({
      actorId,
      action: 'DEVICE_DELETED',
      targetType: 'Device',
      targetId: device.id,
      organizationId,
    });
  }
  private async connectorInput(
    device: Awaited<ReturnType<DeviceService['getDocument']>>,
  ): Promise<ConnectorInput> {
    if (device.connectionMethod === 'SECURE_GATEWAY')
      throw new ApiError(
        503,
        'GATEWAY_NOT_READY',
        'Secure gateway transport is not implemented yet',
      );
    if (device.connectionMethod !== 'LOCAL_LAN' || !device.hostname)
      throw new ApiError(422, 'CONNECTION_METHOD_UNAVAILABLE', 'Connection method is unavailable');
    await this.network.assertAllowed(device.hostname);
    return {
      hostname: device.hostname,
      onvifPort: device.onvifPort,
      rtspPort: device.rtspPort,
      username: this.crypto.decrypt(device.usernameEncrypted),
      password: this.crypto.decrypt(device.passwordEncrypted),
      deviceType: device.deviceType,
      customRtspPath: device.customRtspPath,
      timeoutMs: this.config.DEVICE_CONNECT_TIMEOUT_MS,
    };
  }
  public async testConnection(
    organizationId: Types.ObjectId,
    actorId: Types.ObjectId,
    id: Types.ObjectId,
    includeSensitiveDiscovery = false,
  ): Promise<ConnectionResult> {
    const device = await this.getDocument(organizationId, id, true);
    await DeviceModel.updateOne(
      { _id: id },
      { connectionState: 'CONNECTING', lastHealthCheckAt: new Date() },
    );
    await this.audit.record({
      actorId,
      action: 'DEVICE_CONNECTION_TEST_REQUESTED',
      targetType: 'Device',
      targetId: device.id,
      organizationId,
    });
    try {
      const input = await this.connectorInput(device);
      let result: ConnectionResult | undefined;
      let lastError: unknown;
      for (let attempt = 0; attempt <= this.config.DEVICE_CONNECT_RETRIES; attempt += 1) {
        try {
          result = await this.connectors.get(device.brand).connect(input);
          break;
        } catch (error) {
          lastError = error;
          if (attempt < this.config.DEVICE_CONNECT_RETRIES)
            await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
        }
      }
      if (!result) throw lastError;
      const firstStream = result.profiles.find((profile) => profile.streamUri)?.streamUri;
      if (firstStream) {
        try {
          const uri = new URL(firstStream);
          await this.network.assertAllowed(uri.hostname);
          const probe = await this.rtsp.probe({
            host: uri.hostname,
            port: Number(uri.port || device.rtspPort),
            path: `${uri.pathname}${uri.search}`,
            username: input.username,
            password: input.password,
            timeoutMs: this.config.DEVICE_CONNECT_TIMEOUT_MS,
          });
          result.streamMediaVerified = probe.streamAvailable;
        } catch {
          result.warnings.push('RTSP media negotiation was not verified');
        }
      }
      const now = new Date();
      await DeviceModel.updateOne(
        { _id: id },
        {
          $set: {
            connectionState: result.channelsDiscovered ? 'ONLINE' : 'DEGRADED',
            lastSuccessfulConnectionAt: now,
            lastHealthCheckAt: now,
            model: result.device.model ?? device.model,
            firmwareVersion: result.device.firmwareVersion ?? device.firmwareVersion,
            serialNumber: result.device.serialNumber ?? device.serialNumber,
          },
          $unset: { lastConnectionErrorCategory: 1 },
        },
      );
      await this.audit.record({
        actorId,
        action: 'DEVICE_CONNECTION_TEST_SUCCEEDED',
        targetType: 'Device',
        targetId: device.id,
        organizationId,
        metadata: {
          channelsDiscovered: result.profiles.length,
          streamUriObtained: result.streamUriObtained,
          streamMediaVerified: result.streamMediaVerified,
        },
      });
      if (includeSensitiveDiscovery) return result;
      return {
        ...result,
        profiles: result.profiles.map(
          ({ streamUri: _stream, snapshotUri: _snapshot, ...profile }) => {
            void _stream;
            void _snapshot;
            return profile;
          },
        ),
      };
    } catch (error) {
      const category =
        error instanceof ApiError
          ? error.code
          : /401|auth/i.test(error instanceof Error ? error.message : '')
            ? 'AUTHENTICATION_FAILED'
            : /timeout/i.test(error instanceof Error ? error.message : '')
              ? 'NETWORK_TIMEOUT'
              : 'CONNECTION_FAILED';
      await DeviceModel.updateOne(
        { _id: id },
        {
          connectionState: category === 'GATEWAY_NOT_READY' ? 'GATEWAY_NOT_READY' : 'OFFLINE',
          lastConnectionErrorCategory: category,
          lastHealthCheckAt: new Date(),
        },
      );
      await this.audit.record({
        actorId,
        action: 'DEVICE_CONNECTION_TEST_FAILED',
        targetType: 'Device',
        targetId: device.id,
        organizationId,
        metadata: { category },
      });
      throw error instanceof ApiError
        ? error
        : new ApiError(502, category, 'Authenticated device connection failed');
    }
  }
  public async discover(
    organizationId: Types.ObjectId,
    actorId: Types.ObjectId,
    id: Types.ObjectId,
  ) {
    const result = await this.testConnection(organizationId, actorId, id, true);
    const now = new Date();
    const seen: string[] = [];
    let created = 0;
    let updated = 0;
    for (const profile of result.profiles) {
      seen.push(profile.channelId);
      const existing = await CameraModel.findOne({
        organizationId,
        deviceId: id,
        channelId: profile.channelId,
      });
      const profiles = [
        {
          token: profile.token,
          name: profile.name,
          codec: profile.codec,
          width: profile.width,
          height: profile.height,
          ...(profile.streamUri
            ? { streamUriEncrypted: this.crypto.encrypt(profile.streamUri) }
            : {}),
          ...(profile.snapshotUri
            ? { snapshotUriEncrypted: this.crypto.encrypt(profile.snapshotUri) }
            : {}),
        },
      ];
      if (existing) {
        existing.profiles = profiles;
        existing.capabilities = profile.capabilities;
        existing.status = 'ONLINE';
        existing.lastSeenAt = now;
        existing.missingSince = undefined;
        existing.deletedAt = undefined;
        if (!existing.administratorNamed)
          existing.displayName = profile.name ?? `Channel ${profile.channelId}`;
        await existing.save();
        updated += 1;
      } else {
        await CameraModel.create({
          organizationId,
          deviceId: id,
          channelId: profile.channelId,
          displayName: profile.name ?? `Channel ${profile.channelId}`,
          administratorNamed: false,
          profiles,
          status: 'ONLINE',
          capabilities: profile.capabilities,
          lastSeenAt: now,
        });
        created += 1;
      }
    }
    await CameraModel.updateMany(
      { organizationId, deviceId: id, channelId: { $nin: seen }, deletedAt: { $exists: false } },
      { status: 'OFFLINE', missingSince: now },
    );
    await this.audit.record({
      actorId,
      action: 'CAMERA_CHANNELS_DISCOVERED',
      targetType: 'Device',
      targetId: id.toString(),
      organizationId,
      metadata: { created, updated, missingMarked: true },
    });
    return { created, updated, channels: seen.length, warnings: result.warnings };
  }
}
