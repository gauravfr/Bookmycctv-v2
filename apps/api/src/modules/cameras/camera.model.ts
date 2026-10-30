import { Schema, model, type Types } from 'mongoose';
export const capabilityStates = [
  'SUPPORTED',
  'UNSUPPORTED',
  'UNKNOWN',
  'REQUIRES_CONFIGURATION',
] as const;
export interface Capability {
  state: (typeof capabilityStates)[number];
  source: string;
  verifiedAt?: Date;
}
export interface CameraRecord {
  organizationId: Types.ObjectId;
  deviceId: Types.ObjectId;
  channelId: string;
  displayName: string;
  administratorNamed: boolean;
  profiles: Array<{
    token: string;
    name?: string;
    codec?: string;
    width?: number;
    height?: number;
    streamUriEncrypted?: unknown;
    snapshotUriEncrypted?: unknown;
  }>;
  status: 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'UNKNOWN' | 'CONNECTING';
  mediaStatus?: 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'UNKNOWN' | 'CONNECTING';
  lastSuccessfulVideoAt?: Date;
  lastMediaErrorCategory?: string;
  capabilities: Map<string, Capability> | Record<string, Capability>;
  lastSeenAt?: Date;
  missingSince?: Date;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
const capabilitySchema = new Schema<Capability>(
  {
    state: { type: String, enum: capabilityStates, required: true },
    source: { type: String, required: true },
    verifiedAt: Date,
  },
  { _id: false },
);
const profileSchema = new Schema(
  {
    token: { type: String, required: true },
    name: String,
    codec: String,
    width: Number,
    height: Number,
    streamUriEncrypted: Schema.Types.Mixed,
    snapshotUriEncrypted: Schema.Types.Mixed,
  },
  { _id: false },
);
const schema = new Schema<CameraRecord>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    deviceId: { type: Schema.Types.ObjectId, required: true, index: true },
    channelId: { type: String, required: true },
    displayName: { type: String, required: true },
    administratorNamed: { type: Boolean, default: false },
    profiles: { type: [profileSchema], default: [] },
    status: {
      type: String,
      enum: ['ONLINE', 'OFFLINE', 'DEGRADED', 'UNKNOWN', 'CONNECTING'],
      default: 'UNKNOWN',
    },
    mediaStatus: {
      type: String,
      enum: ['ONLINE', 'OFFLINE', 'DEGRADED', 'UNKNOWN', 'CONNECTING'],
      default: 'UNKNOWN',
    },
    lastSuccessfulVideoAt: Date,
    lastMediaErrorCategory: String,
    capabilities: { type: Map, of: capabilitySchema, default: {} },
    lastSeenAt: Date,
    missingSince: Date,
    deletedAt: Date,
  },
  { timestamps: true, versionKey: false },
);
schema.index({ organizationId: 1, deviceId: 1, channelId: 1 }, { unique: true });
schema.index({ organizationId: 1, status: 1, deletedAt: 1 });
export const CameraModel = model<CameraRecord>('Camera', schema);
export const capabilityValue = (
  capabilities: Map<string, Capability> | Record<string, Capability>,
  name: string,
): Capability | undefined =>
  capabilities instanceof Map ? capabilities.get(name) : capabilities[name];

export const serializedCapabilities = (
  capabilities: Map<string, Capability> | Record<string, Capability>,
): Record<string, Capability> =>
  capabilities instanceof Map ? Object.fromEntries(capabilities.entries()) : { ...capabilities };
export const safeCamera = (camera: CameraRecord & { _id: Types.ObjectId }) => ({
  id: camera._id.toString(),
  deviceId: camera.deviceId.toString(),
  channelId: camera.channelId,
  displayName: camera.displayName,
  profiles: camera.profiles.map((profile) => ({
    token: profile.token,
    name: profile.name,
    codec: profile.codec,
    width: profile.width,
    height: profile.height,
  })),
  status: camera.status,
  mediaStatus: camera.mediaStatus ?? 'UNKNOWN',
  lastSuccessfulVideoAt: camera.lastSuccessfulVideoAt ?? null,
  lastMediaErrorCategory: camera.lastMediaErrorCategory ?? null,
  capabilities: serializedCapabilities(camera.capabilities),
  audio: {
    input: capabilityValue(camera.capabilities, 'audioInput')?.state ?? 'UNKNOWN',
    output: capabilityValue(camera.capabilities, 'audioOutput')?.state ?? 'UNKNOWN',
    twoWay: 'UNSUPPORTED',
    talkbackImplemented: false,
    codec: null,
    transport: null,
  },
  lastSeenAt: camera.lastSeenAt ?? null,
  createdAt: camera.createdAt,
  updatedAt: camera.updatedAt,
});
