import { createHash } from 'node:crypto';
import type { Types } from 'mongoose';
import type { AppConfig } from '../../config/env.js';
import { ApiError } from '../../utils/api-error.js';
import { CameraModel } from '../cameras/camera.model.js';
import { DeviceModel } from '../devices/device.model.js';
import { AlertRuleModel, type AlertRuleRecord } from './alert-rule.model.js';
import {
  SecurityEventModel,
  type EventSource,
  type EventType,
  type Severity,
} from './security-event.model.js';
import { JobModel } from '../jobs/job.model.js';
export interface IngestEvent {
  organizationId: Types.ObjectId;
  cameraId?: Types.ObjectId;
  deviceId?: Types.ObjectId;
  gatewayId?: Types.ObjectId;
  eventType: EventType;
  source: EventSource;
  occurredAt: Date;
  sourceEventId: string;
  confidence?: number;
  detectorId?: string;
  detectorVersion?: string;
  metadata?: Record<string, unknown>;
  evidenceReference?: string;
}
const defaults: Record<EventType, Severity> = {
  MOTION_DETECTED: 'LOW',
  NO_MOVEMENT_DETECTED: 'MEDIUM',
  PERSON_DETECTED: 'MEDIUM',
  VEHICLE_DETECTED: 'MEDIUM',
  INTRUSION_DETECTED: 'HIGH',
  CAMERA_OFFLINE: 'HIGH',
  CAMERA_ONLINE: 'INFO',
  GATEWAY_OFFLINE: 'HIGH',
  GATEWAY_ONLINE: 'INFO',
  AFTER_HOURS_ACTIVITY: 'HIGH',
  CROWD_GATHERING: 'HIGH',
  FIRE_VISUAL_INDICATOR: 'CRITICAL',
  SMOKE_VISUAL_INDICATOR: 'CRITICAL',
  SMOKING_ACTIVITY: 'MEDIUM',
  SHARP_OBJECT_DETECTED: 'HIGH',
  CAMERA_TAMPER: 'HIGH',
  STORAGE_FAILURE: 'HIGH',
  SYSTEM_WARNING: 'MEDIUM',
};
const localParts = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const value = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return {
    date: `${value('year')}-${value('month')}-${value('day')}`,
    minutes: Number(value('hour')) * 60 + Number(value('minute')),
    day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(value('weekday')),
  };
};
const minutes = (value: string) => {
  const [h, m] = value.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};
export const isAfterHours = (date: Date, rule: Pick<AlertRuleRecord, 'timeZone' | 'schedule'>) => {
  const p = localParts(date, rule.timeZone);
  if (rule.schedule.holidays.includes(p.date) || !rule.schedule.days.includes(p.day)) return true;
  const start = minutes(rule.schedule.start),
    end = minutes(rule.schedule.end);
  const inside =
    start <= end ? p.minutes >= start && p.minutes < end : p.minutes >= start || p.minutes < end;
  return !inside;
};
const safeMetadata = (input: Record<string, unknown> = {}) =>
  Object.fromEntries(
    Object.entries(input)
      .filter(
        ([, v]) =>
          typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || v === null,
      )
      .slice(0, 20),
  );
export class EventPipelineService {
  public constructor(private readonly config: AppConfig) {}
  public async ingest(input: IngestEvent) {
    const now = new Date();
    if (
      input.occurredAt.getTime() < now.getTime() - this.config.EVENT_MAX_AGE_SECONDS * 1000 ||
      input.occurredAt.getTime() > now.getTime() + this.config.EVENT_FUTURE_SKEW_SECONDS * 1000
    )
      throw new ApiError(
        422,
        'EVENT_TIMESTAMP_INVALID',
        'Event timestamp is outside the accepted window',
      );
    if (input.confidence !== undefined && (input.confidence < 0 || input.confidence > 1))
      throw new ApiError(422, 'INVALID_CONFIDENCE', 'Confidence must be between 0 and 1');
    if (
      input.cameraId &&
      !(await CameraModel.exists({
        _id: input.cameraId,
        organizationId: input.organizationId,
        deletedAt: { $exists: false },
      }))
    )
      throw new ApiError(404, 'CAMERA_NOT_FOUND', 'Camera not found');
    if (
      input.deviceId &&
      !(await DeviceModel.exists({
        _id: input.deviceId,
        organizationId: input.organizationId,
        deletedAt: { $exists: false },
      }))
    )
      throw new ApiError(404, 'DEVICE_NOT_FOUND', 'Device not found');
    const deduplicationKey = createHash('sha256')
      .update(
        `${input.source}:${input.sourceEventId}:${input.eventType}:${input.cameraId?.toString() ?? ''}`,
      )
      .digest('hex');
    const existing = await SecurityEventModel.findOne({
      organizationId: input.organizationId,
      deduplicationKey,
    });
    if (existing) return { event: existing, duplicate: true };
    const rules = await AlertRuleModel.find({
      organizationId: input.organizationId,
      enabled: true,
      eventTypes: input.eventType,
      $or: [{ cameraId: input.cameraId }, { cameraId: { $exists: false } }],
    }).sort({ cameraId: -1 });
    const rule = rules.find(
      (r) =>
        input.confidence === undefined ||
        r.minimumConfidence === undefined ||
        input.confidence >= r.minimumConfidence,
    );
    const severity = rule?.severity ?? defaults[input.eventType];
    const cooldownDuplicate = rule?.cooldownSeconds
      ? await SecurityEventModel.exists({
          organizationId: input.organizationId,
          cameraId: input.cameraId,
          eventType: input.eventType,
          processingStatus: 'PROCESSED',
          occurredAt: { $gte: new Date(input.occurredAt.getTime() - rule.cooldownSeconds * 1000) },
        })
      : false;
    const event = await SecurityEventModel.create({
      ...input,
      severity,
      deduplicationKey,
      metadata: safeMetadata(input.metadata),
      processingStatus: cooldownDuplicate ? 'SUPPRESSED' : 'PROCESSED',
      ingestedAt: now,
      acknowledged: false,
      resolved: false,
      retentionExpiresAt: new Date(now.getTime() + this.config.EVENT_RETENTION_DAYS * 86400000),
    });
    if (rule?.notificationsEnabled && !cooldownDuplicate)
      await JobModel.updateOne(
        { deduplicationKey: `notify:${event.id}` },
        {
          $setOnInsert: {
            type: 'NOTIFICATION_DISPATCH',
            payload: { eventId: event.id, ruleId: rule.id },
            status: 'PENDING',
            attempts: 0,
            maxAttempts: 5,
            availableAt: now,
            retentionExpiresAt: new Date(now.getTime() + this.config.JOB_RETENTION_DAYS * 86400000),
          },
        },
        { upsert: true },
      );
    if (
      rule &&
      !cooldownDuplicate &&
      ['MOTION_DETECTED', 'PERSON_DETECTED', 'INTRUSION_DETECTED'].includes(input.eventType) &&
      isAfterHours(input.occurredAt, rule)
    ) {
      await this.ingest({
        ...input,
        eventType: 'AFTER_HOURS_ACTIVITY',
        source: 'SYSTEM_EVENT',
        sourceEventId: `after-hours:${event.id}`,
        metadata: { originalEventId: event.id, originalType: input.eventType },
      });
    }
    return { event, duplicate: false };
  }
}
