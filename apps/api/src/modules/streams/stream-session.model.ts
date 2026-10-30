import { Schema, model, type Types } from 'mongoose';
export type StreamTransport = 'WEBRTC' | 'HLS';
export interface StreamSessionRecord {
  organizationId: Types.ObjectId;
  cameraId: Types.ObjectId;
  userId: Types.ObjectId;
  gatewayId?: Types.ObjectId;
  sessionId: string;
  transport: StreamTransport;
  playbackMode: 'LOCAL' | 'REMOTE';
  status: 'PROVISIONING' | 'READY' | 'FAILED' | 'REVOKED' | 'EXPIRED';
  mediaPath: string;
  tokenHash: string;
  expiresAt: Date;
  lastActivityAt: Date;
  revokedAt?: Date;
  diagnosticCode?: string;
  createdAt: Date;
  updatedAt: Date;
}
const schema = new Schema<StreamSessionRecord>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    cameraId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    gatewayId: Schema.Types.ObjectId,
    sessionId: { type: String, required: true, unique: true },
    transport: { type: String, enum: ['WEBRTC', 'HLS'], required: true },
    playbackMode: { type: String, enum: ['LOCAL', 'REMOTE'], required: true },
    status: {
      type: String,
      enum: ['PROVISIONING', 'READY', 'FAILED', 'REVOKED', 'EXPIRED'],
      required: true,
    },
    mediaPath: { type: String, required: true },
    tokenHash: { type: String, required: true, select: false },
    expiresAt: { type: Date, required: true, index: { expires: 86400 } },
    lastActivityAt: { type: Date, required: true },
    revokedAt: Date,
    diagnosticCode: String,
  },
  { timestamps: true, versionKey: false },
);
schema.index({ organizationId: 1, userId: 1, status: 1 });
schema.index({ cameraId: 1, status: 1 });
export const StreamSessionModel = model<StreamSessionRecord>('StreamSession', schema);
