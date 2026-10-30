import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, objectId, routeParam } from '../../utils/http.js';
import { sendSuccess } from '../../utils/responses.js';
import { ApiError } from '../../utils/api-error.js';
import {
  NotificationModel,
  NotificationPreferenceModel,
  PushTokenModel,
} from './notification.model.js';
import { eventTypes, severities } from '../security-events/security-event.model.js';
import type { NotificationService } from './notification.service.js';
import type { AuditService } from '../alerts/audit.service.js';
import { CameraAssignmentModel } from '../assignments/camera-assignment.model.js';
const zone = z.string().refine((v) => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: v });
    return true;
  } catch {
    return false;
  }
});
export const createNotificationRouter = (service: NotificationService, audit: AuditService) => {
  const r = Router();
  r.get(
    '/notifications',
    asyncHandler(async (req, res) =>
      sendSuccess(res, 200, {
        items: await NotificationModel.find({ recipientUserId: req.authUser!._id })
          .sort({ createdAt: -1 })
          .limit(100),
      }),
    ),
  );
  r.get(
    '/notifications/unread-count',
    asyncHandler(async (req, res) =>
      sendSuccess(res, 200, {
        count: await NotificationModel.countDocuments({
          recipientUserId: req.authUser!._id,
          read: false,
        }),
      }),
    ),
  );
  r.patch(
    '/notifications/:id/read',
    asyncHandler(async (req, res) => {
      const n = await NotificationModel.findOneAndUpdate(
        { _id: objectId(routeParam(req, 'id')), recipientUserId: req.authUser!._id },
        { read: true, readAt: new Date() },
        { new: true },
      );
      if (!n) throw new ApiError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found');
      return sendSuccess(res, 200, { notification: n });
    }),
  );
  r.post(
    '/notifications/mark-all-read',
    asyncHandler(async (req, res) => {
      const out = await NotificationModel.updateMany(
        { recipientUserId: req.authUser!._id, read: false },
        { read: true, readAt: new Date() },
      );
      return sendSuccess(res, 200, { updated: out.modifiedCount });
    }),
  );
  r.get(
    '/notification-preferences',
    asyncHandler(async (req, res) =>
      sendSuccess(res, 200, {
        preferences: await NotificationPreferenceModel.findOne({ userId: req.authUser!._id }),
      }),
    ),
  );
  r.put(
    '/notification-preferences',
    asyncHandler(async (req, res) => {
      const b = z
        .object({
          pushEnabled: z.boolean(),
          eventTypes: z.array(z.enum(eventTypes)),
          minimumSeverity: z.enum(severities),
          quietHours: z.object({ start: z.string(), end: z.string() }).optional(),
          timeZone: zone,
          cameraIds: z.array(z.string()).default([]),
        })
        .parse(req.body);
      if (req.authUser!.role === 'CLIENT' && b.cameraIds.length) {
        const count = await CameraAssignmentModel.countDocuments({
          clientId: req.authUser!._id,
          cameraId: { $in: b.cameraIds.map((v) => objectId(v)) },
          permissions: 'camera:events',
        });
        if (count !== b.cameraIds.length)
          throw new ApiError(
            403,
            'CAMERA_ACCESS_DENIED',
            'Cannot subscribe to an unassigned camera',
          );
      }
      const preferences = await NotificationPreferenceModel.findOneAndUpdate(
        { userId: req.authUser!._id },
        {
          ...b,
          cameraIds: b.cameraIds.map((v) => objectId(v)),
          organizationId: req.authUser!.organizationId,
        },
        { upsert: true, new: true },
      );
      return sendSuccess(res, 200, { preferences });
    }),
  );
  r.post(
    '/push-tokens',
    asyncHandler(async (req, res) => {
      const b = z
        .object({
          token: z.string().min(20).max(512),
          deviceId: z.string().min(1).max(200),
          platform: z.enum(['ANDROID', 'IOS']),
        })
        .parse(req.body);
      const token = await service.registerToken(req.authUser!, b);
      await audit.record({
        actorId: req.authUser!._id,
        organizationId: req.authUser!.organizationId,
        action: 'PUSH_TOKEN_REGISTERED',
        targetType: 'PushToken',
        targetId: token.id,
      });
      return sendSuccess(res, 201, {
        id: token.id,
        deviceId: token.deviceId,
        platform: token.platform,
      });
    }),
  );
  r.delete(
    '/push-tokens/:id',
    asyncHandler(async (req, res) => {
      const token = await PushTokenModel.findOneAndUpdate(
        { _id: objectId(routeParam(req, 'id')), userId: req.authUser!._id },
        { active: false },
        { new: true },
      );
      if (!token) throw new ApiError(404, 'PUSH_TOKEN_NOT_FOUND', 'Push token not found');
      await audit.record({
        actorId: req.authUser!._id,
        organizationId: req.authUser!.organizationId,
        action: 'PUSH_TOKEN_REVOKED',
        targetType: 'PushToken',
        targetId: token.id,
      });
      return sendSuccess(res, 200, { revoked: true });
    }),
  );
  return r;
};
