import { Schema, model, type Types } from 'mongoose';
import { eventTypes, severities, type EventType, type Severity } from './security-event.model.js';
export interface AlertRuleRecord {
  organizationId: Types.ObjectId;
  cameraId?: Types.ObjectId;
  name: string;
  eventTypes: EventType[];
  enabled: boolean;
  severity: Severity;
  timeZone: string;
  schedule: { days: number[]; start: string; end: string; holidays: string[] };
  minimumConfidence?: number;
  crowdCount?: number;
  persistenceSeconds: number;
  inactivitySeconds: number;
  cooldownSeconds: number;
  notificationsEnabled: boolean;
  recipientPolicy: 'ASSIGNED_CLIENTS' | 'ORGANIZATION_ADMINS' | 'BOTH';
  evidenceRetentionDays: number;
  clientsMayAcknowledge: boolean;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
const schedule = new Schema(
  {
    days: { type: [Number], default: [1, 2, 3, 4, 5] },
    start: { type: String, default: '09:00' },
    end: { type: String, default: '18:00' },
    holidays: { type: [String], default: [] },
  },
  { _id: false },
);
const schema = new Schema<AlertRuleRecord>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    cameraId: { type: Schema.Types.ObjectId, index: true },
    name: { type: String, required: true, trim: true },
    eventTypes: [{ type: String, enum: eventTypes, required: true }],
    enabled: { type: Boolean, default: true },
    severity: { type: String, enum: severities, required: true },
    timeZone: { type: String, required: true },
    schedule: { type: schedule, required: true },
    minimumConfidence: { type: Number, min: 0, max: 1 },
    crowdCount: { type: Number, min: 2 },
    persistenceSeconds: { type: Number, min: 0, max: 300, default: 3 },
    inactivitySeconds: { type: Number, min: 60, max: 86400, default: 300 },
    cooldownSeconds: { type: Number, min: 0, default: 60 },
    notificationsEnabled: { type: Boolean, default: true },
    recipientPolicy: {
      type: String,
      enum: ['ASSIGNED_CLIENTS', 'ORGANIZATION_ADMINS', 'BOTH'],
      default: 'BOTH',
    },
    evidenceRetentionDays: { type: Number, min: 0, default: 7 },
    clientsMayAcknowledge: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, required: true },
    updatedBy: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: true, versionKey: false },
);
schema.index({ organizationId: 1, cameraId: 1, enabled: 1 });
export const AlertRuleModel = model<AlertRuleRecord>('AlertRule', schema);
