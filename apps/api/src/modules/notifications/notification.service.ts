import { createHash } from 'node:crypto';
import type { Types } from 'mongoose';
import type { AppConfig } from '../../config/env.js';
import type { CredentialCryptoService } from '../devices/credential-crypto.service.js';
import { CameraAssignmentModel } from '../assignments/camera-assignment.model.js';
import { UserModel, type UserDocument } from '../users/user.model.js';
import {
  SecurityEventModel,
  severities,
  type EventType,
  type Severity,
} from '../security-events/security-event.model.js';
import { AlertRuleModel } from '../security-events/alert-rule.model.js';
import {
  NotificationModel,
  NotificationPreferenceModel,
  PushTokenModel,
} from './notification.model.js';
import { JobModel } from '../jobs/job.model.js';
import { ApiError } from '../../utils/api-error.js';
const rank = (s: Severity) => severities.indexOf(s);
const tokenHash = (v: string) => createHash('sha256').update(v).digest('hex');
export class NotificationService {
  public constructor(
    private readonly config: AppConfig,
    private readonly crypto: CredentialCryptoService,
  ) {}
  public async registerToken(
    user: UserDocument,
    input: { token: string; deviceId: string; platform: 'ANDROID' | 'IOS' },
  ) {
    if (!/^ExponentPushToken\[[\w-]+\]$|^ExpoPushToken\[[\w-]+\]$/.test(input.token))
      throw new ApiError(400, 'INVALID_EXPO_PUSH_TOKEN', 'Push token format is invalid');
    return PushTokenModel.findOneAndUpdate(
      { userId: user._id, deviceId: input.deviceId },
      {
        organizationId: user.organizationId!,
        userId: user._id,
        tokenHash: tokenHash(input.token),
        tokenEncrypted: this.crypto.encrypt(input.token),
        platform: input.platform,
        active: true,
        lastUsedAt: new Date(),
      },
      { upsert: true, new: true },
    );
  }
  public async recipients(eventId: Types.ObjectId, ruleId: Types.ObjectId) {
    const [event, rule] = await Promise.all([
      SecurityEventModel.findById(eventId),
      AlertRuleModel.findById(ruleId),
    ]);
    if (!event || !rule || !event.organizationId.equals(rule.organizationId))
      throw new ApiError(404, 'EVENT_OR_RULE_NOT_FOUND', 'Event or rule not found');
    const ids = new Set<string>();
    if (['ORGANIZATION_ADMINS', 'BOTH'].includes(rule.recipientPolicy)) {
      for (const u of await UserModel.find({
        organizationId: event.organizationId,
        role: 'INSTALLER_ADMIN',
        status: 'ACTIVE',
      })
        .select('_id')
        .lean())
        ids.add(u._id.toString());
    }
    if (event.cameraId && ['ASSIGNED_CLIENTS', 'BOTH'].includes(rule.recipientPolicy)) {
      for (const a of await CameraAssignmentModel.find({
        organizationId: event.organizationId,
        cameraId: event.cameraId,
        permissions: 'camera:events',
      })
        .select('clientId')
        .lean())
        ids.add(a.clientId.toString());
    }
    return { event, recipientIds: [...ids] };
  }
  public async dispatch(eventId: Types.ObjectId, ruleId: Types.ObjectId) {
    const { event, recipientIds } = await this.recipients(eventId, ruleId);
    for (const id of recipientIds) {
      const pref = await NotificationPreferenceModel.findOne({ userId: id });
      if (
        pref &&
        (rank(event.severity) < rank(pref.minimumSeverity) ||
          (pref.eventTypes.length && !pref.eventTypes.includes(event.eventType)))
      )
        continue;
      if (
        pref?.cameraIds.length &&
        event.cameraId &&
        !pref.cameraIds.some((c) => c.equals(event.cameraId!))
      )
        continue;
      const notification = await NotificationModel.findOneAndUpdate(
        { recipientUserId: id, securityEventId: event._id, type: 'SECURITY_EVENT' },
        {
          $setOnInsert: {
            organizationId: event.organizationId,
            title: event.eventType.replaceAll('_', ' '),
            body: `${event.severity} security event requires review`,
            severity: event.severity,
            read: false,
            deliveryState: 'QUEUED',
            deliveryAttempts: 0,
            retentionExpiresAt: new Date(
              Date.now() + this.config.NOTIFICATION_RETENTION_DAYS * 86400000,
            ),
          },
        },
        { upsert: true, new: true },
      );
      if (this.config.PUSH_ENABLED && pref?.pushEnabled !== false)
        await this.sendPush(notification._id, id, event.eventType);
    }
  }
  private async sendPush(notificationId: Types.ObjectId, userId: string, eventType: EventType) {
    const tokens = await PushTokenModel.find({ userId, active: true }).select('+tokenEncrypted');
    if (!tokens.length) {
      await NotificationModel.updateOne({ _id: notificationId }, { deliveryState: 'IN_APP' });
      return;
    }
    const messages = tokens.map((t) => ({
      to: this.crypto.decrypt(t.tokenEncrypted as never),
      title: 'BookMyCCTV security alert',
      body: 'A security event requires your attention.',
      data: { notificationId: notificationId.toString(), eventType },
    }));
    const response = await fetch(this.config.EXPO_PUSH_API_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(messages),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new ApiError(502, 'EXPO_PUSH_FAILED', 'Expo Push API request failed');
    const result = (await response.json()) as {
      data?: Array<{ status: string; id?: string; details?: { error?: string } }>;
    };
    const tickets = result.data ?? [];
    for (const [i, ticket] of tickets.entries()) {
      if (ticket.details?.error === 'DeviceNotRegistered')
        await PushTokenModel.updateOne({ _id: tokens[i]?._id }, { active: false });
    }
    const accepted = tickets.some((t) => t.status === 'ok');
    await NotificationModel.updateOne(
      { _id: notificationId },
      {
        $set: {
          deliveryState: accepted ? 'ACCEPTED' : 'FAILED',
          providerTicketId: tickets.find((t) => t.id)?.id,
        },
        $inc: { deliveryAttempts: 1 },
      },
    );
    if (accepted)
      await JobModel.updateOne(
        { deduplicationKey: `receipt:${notificationId}` },
        {
          $setOnInsert: {
            type: 'PUSH_RECEIPTS',
            payload: { notificationId },
            status: 'PENDING',
            attempts: 0,
            maxAttempts: 5,
            availableAt: new Date(Date.now() + 15 * 60 * 1000),
            retentionExpiresAt: new Date(Date.now() + this.config.JOB_RETENTION_DAYS * 86400000),
          },
        },
        { upsert: true },
      );
  }
}
