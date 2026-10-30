import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Types } from 'mongoose';
import type { AppConfig } from '../../config/env.js';
import { ApiError } from '../../utils/api-error.js';
import type { UserDocument } from '../users/user.model.js';
import { UserModel } from '../users/user.model.js';
import { OrganizationModel } from '../organizations/organization.model.js';
import type { CameraAccessService } from '../cameras/camera-access.service.js';
import { DeviceModel } from '../devices/device.model.js';
import type { CredentialCryptoService } from '../devices/credential-crypto.service.js';
import type { MediaGateway } from './media-gateway.service.js';
import {
  StreamSessionModel,
  type StreamSessionRecord,
  type StreamTransport,
} from './stream-session.model.js';

const digest = (v: string) => createHash('sha256').update(v).digest('hex');
const equal = (v: string, h: string) => {
  const a = Buffer.from(digest(v), 'hex'),
    b = Buffer.from(h, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
};
export class StreamService {
  public constructor(
    private readonly config: AppConfig,
    public readonly access: CameraAccessService,
    private readonly crypto: CredentialCryptoService,
    private readonly media: MediaGateway,
  ) {}
  private async enforceLimits(org: Types.ObjectId, user: Types.ObjectId) {
    const now = new Date();
    const [global, organization, perUser] = await Promise.all([
      StreamSessionModel.countDocuments({
        status: 'READY',
        expiresAt: { $gt: now },
        revokedAt: { $exists: false },
      }),
      StreamSessionModel.countDocuments({
        status: 'READY',
        expiresAt: { $gt: now },
        revokedAt: { $exists: false },
        organizationId: org,
      }),
      StreamSessionModel.countDocuments({
        status: 'READY',
        expiresAt: { $gt: now },
        revokedAt: { $exists: false },
        userId: user,
      }),
    ]);
    if (
      global >= this.config.STREAM_MAX_GLOBAL ||
      organization >= this.config.STREAM_MAX_PER_ORGANIZATION ||
      perUser >= this.config.STREAM_MAX_PER_USER
    )
      throw new ApiError(429, 'STREAM_LIMIT_REACHED', 'Active stream limit reached');
  }
  public async create(user: UserDocument, cameraId: Types.ObjectId, transport: StreamTransport) {
    const camera = await this.access.require(user, cameraId, 'camera:view');
    if (camera.status === 'OFFLINE') throw new ApiError(409, 'CAMERA_OFFLINE', 'Camera is offline');
    await this.enforceLimits(user.organizationId!, user._id);
    const profile = camera.profiles[0];
    if (!profile?.streamUriEncrypted)
      throw new ApiError(
        422,
        'STREAM_SOURCE_UNAVAILABLE',
        'Camera has no discovered stream source',
      );
    if (transport === 'WEBRTC' && (profile.codec ?? '').toUpperCase().includes('265'))
      throw new ApiError(
        422,
        'CODEC_UNSUPPORTED_FOR_TRANSPORT',
        'H.265 WebRTC playback is not supported; request HLS or configure H.264',
      );
    const device = await DeviceModel.findOne({
      _id: camera.deviceId,
      organizationId: user.organizationId!,
      deletedAt: { $exists: false },
    }).select('+usernameEncrypted +passwordEncrypted');
    if (!device) throw new ApiError(404, 'DEVICE_NOT_FOUND', 'Camera device not found');
    if (device.connectionMethod === 'SECURE_GATEWAY')
      throw new ApiError(
        503,
        'GATEWAY_MEDIA_ROUTE_UNAVAILABLE',
        'The enrolled gateway has not established a verified media relay route',
      );
    const uri = new URL(this.crypto.decrypt(profile.streamUriEncrypted as never));
    uri.username = this.crypto.decrypt(device.usernameEncrypted);
    uri.password = this.crypto.decrypt(device.passwordEncrypted);
    const sessionId = randomUUID(),
      token = randomBytes(32).toString('base64url'),
      mediaPath = `camera-${camera._id.toString()}`,
      expiresAt = new Date(Date.now() + this.config.STREAM_SESSION_TTL_SECONDS * 1000);
    const session = await StreamSessionModel.create({
      organizationId: user.organizationId!,
      cameraId,
      userId: user._id,
      sessionId,
      transport,
      playbackMode: 'REMOTE',
      status: 'PROVISIONING',
      mediaPath,
      tokenHash: digest(token),
      expiresAt,
      lastActivityAt: new Date(),
      ...(device.gatewayId ? { gatewayId: device.gatewayId } : {}),
    });
    try {
      const health = await this.media.provision(mediaPath, uri.toString());
      session.status = 'READY';
      await session.save();
      await camera.updateOne({
        mediaStatus: 'ONLINE',
        lastSuccessfulVideoAt: new Date(),
        $unset: { lastMediaErrorCategory: 1 },
      });
      return { session, token, health };
    } catch (error) {
      session.status = 'FAILED';
      session.diagnosticCode = error instanceof ApiError ? error.code : 'MEDIA_GATEWAY_UNAVAILABLE';
      await session.save();
      await camera.updateOne({
        mediaStatus: 'OFFLINE',
        lastMediaErrorCategory: session.diagnosticCode,
      });
      throw error;
    }
  }
  public descriptor(session: StreamSessionRecord & { _id: Types.ObjectId }, token?: string) {
    return {
      sessionId: session.sessionId,
      cameraId: session.cameraId.toString(),
      protocol: session.transport,
      playbackMode: session.playbackMode,
      status: session.status,
      expiresAt: session.expiresAt,
      endpoint:
        session.status === 'READY'
          ? this.media.playback(session.mediaPath, session.transport)
          : null,
      authorization: token ? { scheme: 'Bearer', token } : undefined,
      playerRequirements:
        session.transport === 'HLS'
          ? ['HLS player', 'Authorization header on playlist and segment requests']
          : ['WHEP WebRTC client', 'Authorization header on signaling requests'],
      diagnosticCode: session.diagnosticCode ?? null,
    };
  }
  public async get(user: UserDocument, sessionId: string, permission = true) {
    const s = await StreamSessionModel.findOne({
      sessionId,
      userId: user._id,
      organizationId: user.organizationId!,
    });
    if (!s) throw new ApiError(404, 'STREAM_SESSION_NOT_FOUND', 'Stream session not found');
    if (permission) await this.access.require(user, s.cameraId, 'camera:view');
    if (s.expiresAt <= new Date() && s.status === 'READY') {
      s.status = 'EXPIRED';
      await s.save();
    }
    return s;
  }
  public async refresh(user: UserDocument, id: string) {
    const old = await this.get(user, id);
    if (old.status !== 'READY')
      throw new ApiError(409, 'STREAM_SESSION_INACTIVE', 'Stream session is not active');
    const token = randomBytes(32).toString('base64url');
    old.tokenHash = digest(token);
    old.expiresAt = new Date(Date.now() + this.config.STREAM_SESSION_TTL_SECONDS * 1000);
    old.lastActivityAt = new Date();
    await old.save();
    return { session: old, token };
  }
  public async revoke(user: UserDocument, id: string) {
    const s = await this.get(user, id);
    s.status = 'REVOKED';
    s.revokedAt = new Date();
    await s.save();
    if (
      (await StreamSessionModel.countDocuments({
        cameraId: s.cameraId,
        status: 'READY',
        expiresAt: { $gt: new Date() },
        revokedAt: { $exists: false },
      })) === 0
    )
      await this.media.remove(s.mediaPath).catch(() => undefined);
  }
  public async health(user: UserDocument, id: string) {
    const session = await this.get(user, id);
    if (session.status !== 'READY')
      return {
        status: session.status,
        online: false,
        tracks: [],
        diagnosticCode: session.diagnosticCode ?? null,
      };
    const media = await this.media
      .health(session.mediaPath)
      .catch(() => ({ online: false, tracks: [] }));
    return {
      status: media.online ? 'ONLINE' : 'OFFLINE',
      ...media,
      diagnosticCode: media.online ? null : 'MEDIA_GATEWAY_UNAVAILABLE',
    };
  }
  public async authorizeMedia(token: string, path: string) {
    const sessions = await StreamSessionModel.find({
      mediaPath: path,
      status: 'READY',
      expiresAt: { $gt: new Date() },
      revokedAt: { $exists: false },
    }).select('+tokenHash');
    for (const s of sessions)
      if (equal(token, s.tokenHash)) {
        const user = await UserModel.findById(s.userId);
        if (!user || user.status !== 'ACTIVE') break;
        const organization = user.organizationId
          ? await OrganizationModel.findById(user.organizationId).select('status').lean()
          : null;
        if (!organization || organization.status !== 'ACTIVE') break;
        await this.access.require(user, s.cameraId, 'camera:view');
        s.lastActivityAt = new Date();
        await s.save();
        return;
      }
    throw new ApiError(
      401,
      'INVALID_PLAYBACK_TOKEN',
      'Playback authorization is invalid or expired',
    );
  }
}
