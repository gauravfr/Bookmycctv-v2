import { Schema, model, type Types } from 'mongoose';
export const eventSources = [
  'DEVICE_EVENT',
  'ONVIF_EVENT',
  'VENDOR_EVENT',
  'GATEWAY_EVENT',
  'HEALTH_MONITOR',
  'AI_INFERENCE',
  'SYSTEM_EVENT',
] as const;
export const eventTypes = [
  'MOTION_DETECTED',
  'NO_MOVEMENT_DETECTED',
  'PERSON_DETECTED',
  'VEHICLE_DETECTED',
  'INTRUSION_DETECTED',
  'CAMERA_OFFLINE',
  'CAMERA_ONLINE',
  'GATEWAY_OFFLINE',
  'GATEWAY_ONLINE',
  'AFTER_HOURS_ACTIVITY',
  'CROWD_GATHERING',
  'FIRE_VISUAL_INDICATOR',
  'SMOKE_VISUAL_INDICATOR',
  'SMOKING_ACTIVITY',
  'SHARP_OBJECT_DETECTED',
  'CAMERA_TAMPER',
  'STORAGE_FAILURE',
  'SYSTEM_WARNING',
] as const;
export const severities = ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type EventType = (typeof eventTypes)[number];
export type EventSource = (typeof eventSources)[number];
export type Severity = (typeof severities)[number];
export interface SecurityEventRecord {
  organizationId: Types.ObjectId;
  cameraId?: Types.ObjectId;
  deviceId?: Types.ObjectId;
  gatewayId?: Types.ObjectId;
  eventType: EventType;
  source: EventSource;
  severity: Severity;
  occurredAt: Date;
  ingestedAt: Date;
  detectorId?: string;
  detectorVersion?: string;
  confidence?: number;
  processingStatus: 'PROCESSED' | 'SUPPRESSED' | 'FAILED';
  deduplicationKey: string;
  metadata: Record<string, unknown>;
  evidenceReference?: string;
  originalEventId?: Types.ObjectId;
  acknowledged: boolean;
  acknowledgedBy?: Types.ObjectId;
  acknowledgedAt?: Date;
  resolved: boolean;
  resolvedBy?: Types.ObjectId;
  resolvedAt?: Date;
  retentionExpiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
const schema = new Schema<SecurityEventRecord>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    cameraId: { type: Schema.Types.ObjectId, index: true },
    deviceId: Schema.Types.ObjectId,
    gatewayId: Schema.Types.ObjectId,
    eventType: { type: String, enum: eventTypes, required: true },
    source: { type: String, enum: eventSources, required: true },
    severity: { type: String, enum: severities, required: true },
    occurredAt: { type: Date, required: true },
    ingestedAt: { type: Date, default: Date.now },
    detectorId: String,
    detectorVersion: String,
    confidence: { type: Number, min: 0, max: 1 },
    processingStatus: {
      type: String,
      enum: ['PROCESSED', 'SUPPRESSED', 'FAILED'],
      default: 'PROCESSED',
    },
    deduplicationKey: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    evidenceReference: String,
    originalEventId: Schema.Types.ObjectId,
    acknowledged: { type: Boolean, default: false },
    acknowledgedBy: Schema.Types.ObjectId,
    acknowledgedAt: Date,
    resolved: { type: Boolean, default: false },
    resolvedBy: Schema.Types.ObjectId,
    resolvedAt: Date,
    retentionExpiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true, versionKey: false },
);
schema.index({ organizationId: 1, deduplicationKey: 1 }, { unique: true });
schema.index({ organizationId: 1, occurredAt: -1 });
schema.index({ organizationId: 1, cameraId: 1, occurredAt: -1 });
schema.index({ organizationId: 1, eventType: 1, severity: 1, occurredAt: -1 });
schema.index({ organizationId: 1, acknowledged: 1, resolved: 1, occurredAt: -1 });
export const SecurityEventModel = model<SecurityEventRecord>('SecurityEvent', schema);
