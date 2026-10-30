import { Schema, model, type Types } from 'mongoose';
export const detectorTypes = [
  'PERSON',
  'VEHICLE',
  'CROWD',
  'FIRE',
  'SMOKE',
  'SMOKING',
  'SHARP_OBJECT',
] as const;
export const detectorStates = [
  'NOT_CONFIGURED',
  'MODEL_UNAVAILABLE',
  'READY',
  'RUNNING',
  'DEGRADED',
  'FAILED',
  'UNSUPPORTED',
] as const;
export interface DetectorRecord {
  organizationId: Types.ObjectId;
  detectorId: string;
  type: (typeof detectorTypes)[number];
  state: (typeof detectorStates)[number];
  workerId?: string;
  modelId?: string;
  modelVersion?: string;
  lastHealthAt?: Date;
  errorCode?: string;
  createdAt: Date;
  updatedAt: Date;
}
const schema = new Schema<DetectorRecord>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    detectorId: { type: String, required: true },
    type: { type: String, enum: detectorTypes, required: true },
    state: { type: String, enum: detectorStates, default: 'NOT_CONFIGURED' },
    workerId: String,
    modelId: String,
    modelVersion: String,
    lastHealthAt: Date,
    errorCode: String,
  },
  { timestamps: true, versionKey: false },
);
schema.index({ organizationId: 1, detectorId: 1 }, { unique: true });
export const DetectorModel = model<DetectorRecord>('Detector', schema);
