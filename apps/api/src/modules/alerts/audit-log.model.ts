import { Schema, model, type Types } from 'mongoose';
export interface AuditLogRecord {
  actorId: Types.ObjectId | null;
  action: string;
  targetType: string;
  targetId?: string;
  organizationId: Types.ObjectId | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}
const schema = new Schema<AuditLogRecord>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    action: { type: String, required: true },
    targetType: { type: String, required: true },
    targetId: String,
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);
schema.index({ organizationId: 1, createdAt: -1 });
schema.index({ actorId: 1, createdAt: -1 });
schema.index({ action: 1, createdAt: -1 });
export const AuditLogModel = model<AuditLogRecord>('AuditLog', schema);
