import { Router, type Request } from 'express';
import { z } from 'zod';
import type { Types } from 'mongoose';
import { asyncHandler, objectId, routeParam } from '../../utils/http.js';
import { sendSuccess } from '../../utils/responses.js';
import { ApiError } from '../../utils/api-error.js';
import { requirePasswordChanged, requireRole } from '../../middleware/auth.js';
import { AlertRuleModel } from './alert-rule.model.js';
import { eventTypes, severities, SecurityEventModel } from './security-event.model.js';
import { CameraAssignmentModel } from '../assignments/camera-assignment.model.js';
import type { AuditService } from '../alerts/audit.service.js';
import type { AppConfig } from '../../config/env.js';
import { basename, resolve, sep } from 'node:path';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const zone = z
  .string()
  .min(1)
  .refine((v) => {
    try {
      new Intl.DateTimeFormat('en', { timeZone: v });
      return true;
    } catch {
      return false;
    }
  }, 'Invalid IANA time zone');
const ruleSchema = z.object({
  name: z.string().trim().min(1).max(120),
  cameraId: z.string().optional(),
  eventTypes: z.array(z.enum(eventTypes)).min(1),
  enabled: z.boolean().default(true),
  severity: z.enum(severities),
  timeZone: zone,
  schedule: z.object({
    days: z.array(z.number().int().min(0).max(6)).min(1),
    start: time,
    end: time,
    holidays: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).default([]),
  }),
  minimumConfidence: z.number().min(0).max(1).optional(),
  crowdCount: z.number().int().min(2).optional(),
  persistenceSeconds: z.number().min(0).max(300).default(3),
  inactivitySeconds: z.number().int().min(60).max(86400).default(300),
  cooldownSeconds: z.number().int().min(0).max(86400).default(60),
  notificationsEnabled: z.boolean().default(true),
  recipientPolicy: z.enum(['ASSIGNED_CLIENTS', 'ORGANIZATION_ADMINS', 'BOTH']).default('BOTH'),
  evidenceRetentionDays: z.number().int().min(0).max(365).default(7),
  clientsMayAcknowledge: z.boolean().default(true),
});
export const createAlertAdminRouter = (audit: AuditService) => {
  const r = Router();
  r.use(requireRole('INSTALLER_ADMIN'), requirePasswordChanged);
  r.post(
    '/alert-rules',
    asyncHandler(async (req, res) => {
      const b = ruleSchema.parse(req.body);
      const organizationId = req.authUser!.organizationId;
      if (!organizationId)
        throw new ApiError(403, 'ORGANIZATION_REQUIRED', 'Organization is required');
      if (
        b.cameraId &&
        !(await (
          await import('../cameras/camera.model.js')
        ).CameraModel.exists({
          _id: objectId(b.cameraId, 'cameraId'),
          organizationId,
        }))
      )
        throw new ApiError(404, 'CAMERA_NOT_FOUND', 'Camera not found');
      const rule = await AlertRuleModel.create({
        ...b,
        cameraId: b.cameraId ? objectId(b.cameraId) : undefined,
        organizationId,
        createdBy: req.authUser!._id,
        updatedBy: req.authUser!._id,
      });
      await audit.record({
        actorId: req.authUser!._id,
        organizationId: req.authUser!.organizationId,
        action: 'ALERT_RULE_CREATED',
        targetType: 'AlertRule',
        targetId: rule.id,
      });
      return sendSuccess(res, 201, { rule });
    }),
  );
  r.get(
    '/alert-rules',
    asyncHandler(async (req, res) =>
      sendSuccess(res, 200, {
        items: await AlertRuleModel.find({ organizationId: req.authUser!.organizationId }).sort({
          createdAt: -1,
        }),
      }),
    ),
  );
  r.get(
    '/alert-rules/:id',
    asyncHandler(async (req, res) => {
      const rule = await AlertRuleModel.findOne({
        _id: objectId(routeParam(req, 'id')),
        organizationId: req.authUser!.organizationId,
      });
      if (!rule) throw new ApiError(404, 'ALERT_RULE_NOT_FOUND', 'Alert rule not found');
      return sendSuccess(res, 200, { rule });
    }),
  );
  r.patch(
    '/alert-rules/:id',
    asyncHandler(async (req, res) => {
      const b = ruleSchema.partial().parse(req.body);
      const rule = await AlertRuleModel.findOneAndUpdate(
        { _id: objectId(routeParam(req, 'id')), organizationId: req.authUser!.organizationId },
        { ...b, updatedBy: req.authUser!._id },
        { new: true },
      );
      if (!rule) throw new ApiError(404, 'ALERT_RULE_NOT_FOUND', 'Alert rule not found');
      await audit.record({
        actorId: req.authUser!._id,
        organizationId: req.authUser!.organizationId,
        action: 'ALERT_RULE_UPDATED',
        targetType: 'AlertRule',
        targetId: rule.id,
      });
      return sendSuccess(res, 200, { rule });
    }),
  );
  r.delete(
    '/alert-rules/:id',
    asyncHandler(async (req, res) => {
      const rule = await AlertRuleModel.findOneAndDelete({
        _id: objectId(routeParam(req, 'id')),
        organizationId: req.authUser!.organizationId,
      });
      if (!rule) throw new ApiError(404, 'ALERT_RULE_NOT_FOUND', 'Alert rule not found');
      await audit.record({
        actorId: req.authUser!._id,
        organizationId: req.authUser!.organizationId,
        action: 'ALERT_RULE_DELETED',
        targetType: 'AlertRule',
        targetId: rule.id,
      });
      return sendSuccess(res, 200, { deleted: true });
    }),
  );
  r.get(
    '/security-events',
    asyncHandler(async (req, res) =>
      sendSuccess(res, 200, {
        items: await SecurityEventModel.find({ organizationId: req.authUser!.organizationId })
          .sort({ occurredAt: -1 })
          .limit(100),
      }),
    ),
  );
  return r;
};
export const createSecurityEventRouter = (audit: AuditService, config: AppConfig) => {
  const r = Router();
  const filter = async (req: Request, id?: Types.ObjectId) => {
    const user = req.authUser!;
    const q: Record<string, unknown> = { organizationId: user.organizationId };
    if (id) q._id = id;
    if (user.role === 'CLIENT') {
      const ids = (
        await CameraAssignmentModel.find({
          clientId: user._id,
          permissions: 'camera:events',
        })
          .select('cameraId')
          .lean()
      ).map((a) => a.cameraId);
      q.cameraId = { $in: ids };
    }
    return q;
  };
  r.get(
    '/',
    asyncHandler(async (req, res) =>
      sendSuccess(res, 200, {
        items: await SecurityEventModel.find(await filter(req))
          .sort({ occurredAt: -1 })
          .limit(100),
      }),
    ),
  );
  r.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const event = await SecurityEventModel.findOne(
        await filter(req, objectId(routeParam(req, 'id'))),
      );
      if (!event) throw new ApiError(404, 'SECURITY_EVENT_NOT_FOUND', 'Security event not found');
      return sendSuccess(res, 200, { event });
    }),
  );
  r.get(
    '/:id/evidence',
    asyncHandler(async (req, res) => {
      const event = await SecurityEventModel.findOne(
        await filter(req, objectId(routeParam(req, 'id'))),
      ).lean();
      if (!event) throw new ApiError(404, 'SECURITY_EVENT_NOT_FOUND', 'Security event not found');
      const fileName = event.metadata?.evidenceFile;
      const expectedHash = event.metadata?.evidenceSha256;
      if (typeof fileName !== 'string' || basename(fileName) !== fileName)
        throw new ApiError(404, 'EVIDENCE_NOT_FOUND', 'Evidence is not available');
      const root = resolve(config.EVIDENCE_DIR);
      const filePath = resolve(root, fileName);
      if (!filePath.startsWith(`${root}${sep}`))
        throw new ApiError(400, 'INVALID_EVIDENCE_REFERENCE', 'Evidence reference is invalid');
      let payload: Buffer;
      try {
        payload = await readFile(filePath);
      } catch {
        throw new ApiError(404, 'EVIDENCE_NOT_FOUND', 'Evidence is not available');
      }
      if (payload.length > config.SNAPSHOT_MAX_BYTES)
        throw new ApiError(413, 'EVIDENCE_TOO_LARGE', 'Evidence exceeds the configured limit');
      if (
        typeof expectedHash !== 'string' ||
        createHash('sha256').update(payload).digest('hex') !== expectedHash
      )
        throw new ApiError(409, 'EVIDENCE_INTEGRITY_FAILED', 'Evidence integrity check failed');
      res.setHeader('cache-control', 'private, no-store');
      res.type('image/jpeg').send(payload);
    }),
  );
  r.post(
    '/:id/acknowledge',
    asyncHandler(async (req, res) => {
      const event = await SecurityEventModel.findOneAndUpdate(
        await filter(req, objectId(routeParam(req, 'id'))),
        { acknowledged: true, acknowledgedBy: req.authUser!._id, acknowledgedAt: new Date() },
        { new: true },
      );
      if (!event) throw new ApiError(404, 'SECURITY_EVENT_NOT_FOUND', 'Security event not found');
      await audit.record({
        actorId: req.authUser!._id,
        organizationId: req.authUser!.organizationId,
        action: 'SECURITY_EVENT_ACKNOWLEDGED',
        targetType: 'SecurityEvent',
        targetId: event.id,
      });
      return sendSuccess(res, 200, { event });
    }),
  );
  r.post(
    '/:id/resolve',
    requireRole('INSTALLER_ADMIN'),
    asyncHandler(async (req, res) => {
      const event = await SecurityEventModel.findOneAndUpdate(
        await filter(req, objectId(routeParam(req, 'id'))),
        { resolved: true, resolvedBy: req.authUser!._id, resolvedAt: new Date() },
        { new: true },
      );
      if (!event) throw new ApiError(404, 'SECURITY_EVENT_NOT_FOUND', 'Security event not found');
      await audit.record({
        actorId: req.authUser!._id,
        organizationId: req.authUser!.organizationId,
        action: 'SECURITY_EVENT_RESOLVED',
        targetType: 'SecurityEvent',
        targetId: event.id,
      });
      return sendSuccess(res, 200, { event });
    }),
  );
  return r;
};
