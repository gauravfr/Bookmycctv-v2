import { Schema, model } from 'mongoose';
export interface JobRecord {
  type: 'NOTIFICATION_DISPATCH' | 'PUSH_RECEIPTS' | 'HEALTH_MONITOR' | 'RETENTION_CLEANUP';
  deduplicationKey: string;
  payload: Record<string, unknown>;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'DEAD';
  attempts: number;
  maxAttempts: number;
  availableAt: Date;
  lockedAt?: Date;
  lastErrorCode?: string;
  retentionExpiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
const schema = new Schema<JobRecord>(
  {
    type: {
      type: String,
      enum: ['NOTIFICATION_DISPATCH', 'PUSH_RECEIPTS', 'HEALTH_MONITOR', 'RETENTION_CLEANUP'],
      required: true,
      index: true,
    },
    deduplicationKey: { type: String, required: true, unique: true },
    payload: { type: Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'DEAD'],
      default: 'PENDING',
      index: true,
    },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },
    availableAt: { type: Date, default: Date.now, index: true },
    lockedAt: Date,
    lastErrorCode: String,
    retentionExpiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true, versionKey: false },
);
schema.index({ status: 1, availableAt: 1, createdAt: 1 });
export const JobModel = model<JobRecord>('BackgroundJob', schema);
