import { Schema, model, type Types } from 'mongoose';
import {
  eventTypes,
  severities,
  type EventType,
  type Severity,
} from '../security-events/security-event.model.js';
export interface NotificationRecord {
  organizationId: Types.ObjectId;
  recipientUserId: Types.ObjectId;
  securityEventId: Types.ObjectId;
  type: 'SECURITY_EVENT';
  title: string;
  body: string;
  severity: Severity;
  read: boolean;
  readAt?: Date;
  deliveryState: 'IN_APP' | 'QUEUED' | 'ACCEPTED' | 'CONFIRMED' | 'FAILED' | 'UNKNOWN';
  deliveryAttempts: number;
  providerTicketId?: string;
  retentionExpiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
const notificationSchema = new Schema<NotificationRecord>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    recipientUserId: { type: Schema.Types.ObjectId, required: true, index: true },
    securityEventId: { type: Schema.Types.ObjectId, required: true },
    type: { type: String, enum: ['SECURITY_EVENT'], default: 'SECURITY_EVENT' },
    title: { type: String, required: true },
    body: { type: String, required: true },
    severity: { type: String, enum: severities, required: true },
    read: { type: Boolean, default: false },
    readAt: Date,
    deliveryState: {
      type: String,
      enum: ['IN_APP', 'QUEUED', 'ACCEPTED', 'CONFIRMED', 'FAILED', 'UNKNOWN'],
      default: 'IN_APP',
    },
    deliveryAttempts: { type: Number, default: 0 },
    providerTicketId: String,
    retentionExpiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true, versionKey: false },
);
notificationSchema.index({ recipientUserId: 1, securityEventId: 1, type: 1 }, { unique: true });
notificationSchema.index({ recipientUserId: 1, read: 1, createdAt: -1 });
export const NotificationModel = model<NotificationRecord>('Notification', notificationSchema);
export interface PushTokenRecord {
  organizationId: Types.ObjectId;
  userId: Types.ObjectId;
  tokenHash: string;
  tokenEncrypted: unknown;
  deviceId: string;
  platform: 'ANDROID' | 'IOS';
  active: boolean;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
const pushSchema = new Schema<PushTokenRecord>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    tokenEncrypted: { type: Schema.Types.Mixed, required: true, select: false },
    deviceId: { type: String, required: true },
    platform: { type: String, enum: ['ANDROID', 'IOS'], required: true },
    active: { type: Boolean, default: true },
    lastUsedAt: Date,
  },
  { timestamps: true, versionKey: false },
);
pushSchema.index({ userId: 1, deviceId: 1 }, { unique: true });
export const PushTokenModel = model<PushTokenRecord>('PushToken', pushSchema);
export interface NotificationPreferenceRecord {
  organizationId: Types.ObjectId;
  userId: Types.ObjectId;
  pushEnabled: boolean;
  eventTypes: EventType[];
  minimumSeverity: Severity;
  quietHours?: { start: string; end: string };
  timeZone: string;
  cameraIds: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}
const prefSchema = new Schema<NotificationPreferenceRecord>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, required: true, unique: true },
    pushEnabled: { type: Boolean, default: true },
    eventTypes: [{ type: String, enum: eventTypes }],
    minimumSeverity: { type: String, enum: severities, default: 'LOW' },
    quietHours: { start: String, end: String },
    timeZone: { type: String, default: 'UTC' },
    cameraIds: [Schema.Types.ObjectId],
  },
  { timestamps: true, versionKey: false },
);
export const NotificationPreferenceModel = model<NotificationPreferenceRecord>(
  'NotificationPreference',
  prefSchema,
);
