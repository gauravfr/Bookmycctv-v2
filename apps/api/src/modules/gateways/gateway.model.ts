import { Schema, model, type Types } from 'mongoose';

export interface GatewayRecord {
  organizationId: Types.ObjectId;
  createdBy: Types.ObjectId;
  name: string;
  publicId: string;
  credentialHash?: string;
  credentialVersion: number;
  status: 'PENDING' | 'ONLINE' | 'OFFLINE' | 'REVOKED';
  capabilities: string[];
  lastSeenAt?: Date;
  revokedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
const schema = new Schema<GatewayRecord>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true, trim: true },
    publicId: { type: String, required: true, unique: true },
    credentialHash: { type: String, select: false },
    credentialVersion: { type: Number, default: 0 },
    status: { type: String, enum: ['PENDING', 'ONLINE', 'OFFLINE', 'REVOKED'], default: 'PENDING' },
    capabilities: { type: [String], default: [] },
    lastSeenAt: Date,
    revokedAt: Date,
  },
  { timestamps: true, versionKey: false },
);
schema.index({ organizationId: 1, createdAt: -1 });
export const GatewayModel = model<GatewayRecord>('Gateway', schema);

export interface GatewayEnrollmentRecord {
  organizationId: Types.ObjectId;
  gatewayId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
}
const enrollmentSchema = new Schema<GatewayEnrollmentRecord>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    gatewayId: { type: Schema.Types.ObjectId, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    usedAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);
export const GatewayEnrollmentModel = model<GatewayEnrollmentRecord>(
  'GatewayEnrollment',
  enrollmentSchema,
);

export const safeGateway = (
  g: GatewayRecord & { _id: Types.ObjectId },
  offlineAfterSeconds: number,
) => {
  const connected =
    g.status !== 'REVOKED' &&
    !!g.lastSeenAt &&
    Date.now() - g.lastSeenAt.getTime() <= offlineAfterSeconds * 1000;
  return {
    id: g._id.toString(),
    name: g.name,
    publicId: g.publicId,
    status:
      g.status === 'REVOKED'
        ? 'REVOKED'
        : connected
          ? 'ONLINE'
          : g.credentialVersion
            ? 'OFFLINE'
            : 'PENDING',
    capabilities: g.capabilities,
    credentialVersion: g.credentialVersion,
    lastSeenAt: g.lastSeenAt ?? null,
    createdAt: g.createdAt,
  };
};
