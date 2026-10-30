import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Types } from 'mongoose';
import type { AppConfig } from '../../config/env.js';
import { ApiError } from '../../utils/api-error.js';
import { GatewayEnrollmentModel, GatewayModel } from './gateway.model.js';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const matches = (value: string, expected: string) => {
  const a = Buffer.from(hash(value), 'hex');
  const b = Buffer.from(expected, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
};
export class GatewayService {
  public constructor(
    private readonly config: Pick<
      AppConfig,
      'GATEWAY_ENROLLMENT_TTL_SECONDS' | 'GATEWAY_OFFLINE_AFTER_SECONDS'
    >,
  ) {}
  public async createEnrollment(
    organizationId: Types.ObjectId,
    actorId: Types.ObjectId,
    name: string,
  ) {
    const gateway = await GatewayModel.create({
      organizationId,
      createdBy: actorId,
      name,
      publicId: randomUUID(),
      status: 'PENDING',
    });
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.config.GATEWAY_ENROLLMENT_TTL_SECONDS * 1000);
    await GatewayEnrollmentModel.create({
      organizationId,
      gatewayId: gateway._id,
      tokenHash: hash(token),
      expiresAt,
    });
    return { gateway, enrollmentToken: token, expiresAt };
  }
  public async enroll(token: string, capabilities: string[]) {
    const enrollment = await GatewayEnrollmentModel.findOne({ tokenHash: hash(token) });
    if (!enrollment || enrollment.usedAt || enrollment.expiresAt <= new Date())
      throw new ApiError(
        401,
        'INVALID_ENROLLMENT_TOKEN',
        'Enrollment credential is invalid or expired',
      );
    const secret = randomBytes(48).toString('base64url');
    const gateway = await GatewayModel.findOneAndUpdate(
      {
        _id: enrollment.gatewayId,
        organizationId: enrollment.organizationId,
        status: { $ne: 'REVOKED' },
      },
      { credentialHash: hash(secret), credentialVersion: 1, capabilities, status: 'OFFLINE' },
      { new: true },
    );
    if (!gateway)
      throw new ApiError(
        401,
        'INVALID_ENROLLMENT_TOKEN',
        'Enrollment credential is invalid or expired',
      );
    enrollment.usedAt = new Date();
    await enrollment.save();
    return {
      gatewayId: gateway.publicId,
      gatewaySecret: secret,
      credentialVersion: gateway.credentialVersion,
    };
  }
  public async authenticate(header?: string) {
    if (!header?.startsWith('Gateway '))
      throw new ApiError(401, 'GATEWAY_AUTH_REQUIRED', 'Gateway authentication is required');
    const raw = header.slice(8);
    const dot = raw.indexOf('.');
    if (dot < 1)
      throw new ApiError(401, 'INVALID_GATEWAY_CREDENTIAL', 'Gateway credential is invalid');
    const publicId = raw.slice(0, dot),
      secret = raw.slice(dot + 1);
    const gateway = await GatewayModel.findOne({ publicId }).select('+credentialHash');
    if (
      !gateway ||
      gateway.status === 'REVOKED' ||
      !gateway.credentialHash ||
      !matches(secret, gateway.credentialHash)
    )
      throw new ApiError(401, 'INVALID_GATEWAY_CREDENTIAL', 'Gateway credential is invalid');
    return gateway;
  }
  public async heartbeat(header: string | undefined, capabilities: string[]) {
    const g = await this.authenticate(header);
    g.lastSeenAt = new Date();
    g.status = 'ONLINE';
    g.capabilities = capabilities;
    await g.save();
    return { serverTime: new Date(), credentialVersion: g.credentialVersion };
  }
  public async rotate(organizationId: Types.ObjectId, id: Types.ObjectId) {
    const secret = randomBytes(48).toString('base64url');
    const g = await GatewayModel.findOneAndUpdate(
      { _id: id, organizationId, status: { $ne: 'REVOKED' } },
      { $set: { credentialHash: hash(secret) }, $inc: { credentialVersion: 1 } },
      { new: true },
    ).select('+credentialHash');
    if (!g) throw new ApiError(404, 'GATEWAY_NOT_FOUND', 'Gateway not found');
    return { gateway: g, gatewaySecret: secret };
  }
  public async revoke(organizationId: Types.ObjectId, id: Types.ObjectId) {
    const g = await GatewayModel.findOneAndUpdate(
      { _id: id, organizationId },
      { $set: { status: 'REVOKED', revokedAt: new Date() }, $unset: { credentialHash: 1 } },
      { new: true },
    );
    if (!g) throw new ApiError(404, 'GATEWAY_NOT_FOUND', 'Gateway not found');
    return g;
  }
}
