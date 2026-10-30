import { Router, type Request } from 'express';
import { z } from 'zod';
import { asyncHandler, objectId, routeParam } from '../../utils/http.js';
import { sendSuccess } from '../../utils/responses.js';
import { ApiError } from '../../utils/api-error.js';
import type { AppConfig } from '../../config/env.js';
import type { GatewayService } from '../gateways/gateway.service.js';
import type { EventPipelineService } from '../security-events/event-pipeline.service.js';
import { detectorStates, detectorTypes, DetectorModel } from './detector.model.js';
import { eventTypes } from '../security-events/security-event.model.js';
import { requirePasswordChanged, requireRole } from '../../middleware/auth.js';
import type { JobRunner } from '../jobs/job-runner.service.js';
import { GatewayModel } from '../gateways/gateway.model.js';
import { timingSafeEqual } from 'node:crypto';
import { CameraModel } from '../cameras/camera.model.js';
import { AlertRuleModel } from '../security-events/alert-rule.model.js';
import type { CredentialCryptoService } from '../devices/credential-crypto.service.js';
import type { EncryptedValue } from '../devices/device.model.js';

const workerSecretMatches = (header: string | undefined, expected: string) => {
  if (!header?.startsWith('Bearer ')) return false;
  const actual = Buffer.from(header.slice(7));
  const wanted = Buffer.from(expected);
  return actual.length === wanted.length && timingSafeEqual(actual, wanted);
};
const event = z.object({
  cameraId: z.string().optional(),
  deviceId: z.string().optional(),
  eventType: z.enum(eventTypes),
  occurredAt: z.coerce.date(),
  sourceEventId: z.string().min(1).max(200),
  confidence: z.number().min(0).max(1).optional(),
  detectorId: z.string().max(120).optional(),
  detectorVersion: z.string().max(120).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export const createDetectorAdminRouter = (jobs: JobRunner) => {
  const r = Router();
  r.use(requireRole('INSTALLER_ADMIN'), requirePasswordChanged);
  r.get(
    '/detectors',
    asyncHandler(async (req, res) =>
      sendSuccess(res, 200, {
        items: await DetectorModel.find({ organizationId: req.authUser!.organizationId }),
      }),
    ),
  );
  r.get(
    '/operations/status',
    asyncHandler(async (req, res) => {
      const organizationId = req.authUser!.organizationId;
      const staleBefore = new Date(Date.now() - 90_000);
      const [queue, unavailableDetectors, staleGateways] = await Promise.all([
        jobs.health(),
        DetectorModel.countDocuments({
          organizationId,
          state: { $nin: ['READY', 'RUNNING'] },
        }),
        GatewayModel.countDocuments({
          organizationId,
          status: { $ne: 'REVOKED' },
          $or: [{ lastSeenAt: { $lt: staleBefore } }, { lastSeenAt: { $exists: false } }],
        }),
      ]);
      return sendSuccess(res, 200, {
        status: queue.dead || staleGateways || unavailableDetectors ? 'DEGRADED' : 'HEALTHY',
        queue,
        unavailableDetectors,
        staleGateways,
        hardwareEventSubscriptions: 'UNVERIFIED',
        aiInference: 'UNAVAILABLE_UNLESS_MODEL_VALIDATED',
      });
    }),
  );
  r.get(
    '/detectors/:id/status',
    asyncHandler(async (req, res) => {
      const detector = await DetectorModel.findOne({
        _id: objectId(routeParam(req, 'id')),
        organizationId: req.authUser!.organizationId,
      });
      if (!detector) throw new ApiError(404, 'DETECTOR_NOT_FOUND', 'Detector not found');
      return sendSuccess(res, 200, { detector });
    }),
  );
  return r;
};
export const createTrustedIngestionRouter = (
  config: AppConfig,
  gateway: GatewayService,
  pipeline: EventPipelineService,
  credentials: CredentialCryptoService,
) => {
  const r = Router();
  const workerIdentity = (req: Request) => {
    if (!workerSecretMatches(req.header('authorization'), config.AI_WORKER_SHARED_SECRET))
      throw new ApiError(401, 'INVALID_WORKER_CREDENTIAL', 'Worker credential is invalid');
    const workerId = req.header('x-worker-id');
    const organizationId = req.header('x-organization-id');
    if (!workerId || !organizationId)
      throw new ApiError(400, 'WORKER_IDENTITY_REQUIRED', 'Worker identity headers are required');
    return { workerId, organizationId: objectId(organizationId, 'organizationId') };
  };
  r.post(
    '/gateway/events',
    asyncHandler(async (req, res) => {
      const identity = await gateway.authenticate(req.header('authorization'));
      const b = event.parse(req.body);
      const result = await pipeline.ingest({
        organizationId: identity.organizationId,
        gatewayId: identity._id,
        cameraId: b.cameraId ? objectId(b.cameraId) : undefined,
        deviceId: b.deviceId ? objectId(b.deviceId) : undefined,
        eventType: b.eventType,
        source: 'GATEWAY_EVENT',
        occurredAt: b.occurredAt,
        sourceEventId: b.sourceEventId,
        confidence: b.confidence,
        metadata: b.metadata,
      });
      return sendSuccess(res, result.duplicate ? 200 : 201, result);
    }),
  );
  r.post(
    '/ai/events',
    asyncHandler(async (req, res) => {
      const identity = workerIdentity(req);
      const b = event
        .extend({ detectorId: z.string().min(1), detectorVersion: z.string().min(1) })
        .parse(req.body);
      const detector = await DetectorModel.findOne({
        organizationId: identity.organizationId,
        detectorId: b.detectorId,
        workerId: identity.workerId,
        state: { $in: ['READY', 'RUNNING'] },
      });
      if (!detector)
        throw new ApiError(403, 'DETECTOR_UNAVAILABLE', 'Detector is not authorized and ready');
      const result = await pipeline.ingest({
        organizationId: detector.organizationId,
        cameraId: b.cameraId ? objectId(b.cameraId) : undefined,
        eventType: b.eventType,
        source: 'AI_INFERENCE',
        occurredAt: b.occurredAt,
        sourceEventId: b.sourceEventId,
        confidence: b.confidence,
        detectorId: b.detectorId,
        detectorVersion: b.detectorVersion,
        metadata: b.metadata,
      });
      return sendSuccess(res, result.duplicate ? 200 : 201, result);
    }),
  );
  r.post(
    '/ai/health',
    asyncHandler(async (req, res) => {
      const identity = workerIdentity(req);
      const b = z
        .object({
          organizationId: z.string(),
          workerId: z.string(),
          detectors: z.array(
            z.object({
              detectorId: z.string(),
              type: z.enum(detectorTypes),
              state: z.enum(detectorStates),
              modelId: z.string().optional(),
              modelVersion: z.string().optional(),
              errorCode: z.string().optional(),
            }),
          ),
        })
        .parse(req.body);
      if (
        b.organizationId !== identity.organizationId.toString() ||
        b.workerId !== identity.workerId
      )
        throw new ApiError(403, 'WORKER_IDENTITY_MISMATCH', 'Worker identity does not match headers');
      for (const d of b.detectors)
        await DetectorModel.findOneAndUpdate(
          { organizationId: identity.organizationId, detectorId: d.detectorId },
          { ...d, workerId: identity.workerId, lastHealthAt: new Date() },
          { upsert: true, new: true },
        );
      return sendSuccess(res, 200, { accepted: true });
    }),
  );
  r.get(
    '/ai/cameras',
    asyncHandler(async (req, res) => {
      const identity = workerIdentity(req);
      const authorized = await DetectorModel.exists({
        organizationId: identity.organizationId,
        workerId: identity.workerId,
        state: { $in: ['READY', 'RUNNING', 'DEGRADED'] },
      });
      if (!authorized)
        throw new ApiError(403, 'WORKER_NOT_READY', 'Worker has no ready detectors');
      const [cameras, rules] = await Promise.all([
        CameraModel.find({ organizationId: identity.organizationId, deletedAt: { $exists: false } }),
        AlertRuleModel.find({ organizationId: identity.organizationId, enabled: true }).lean(),
      ]);
      const items = cameras.flatMap((camera) => {
        const profile = camera.profiles.find((candidate) => candidate.streamUriEncrypted);
        if (!profile?.streamUriEncrypted) return [];
        const applicable = rules.filter(
          (rule) => !rule.cameraId || rule.cameraId.toString() === camera.id,
        );
        const aiEventTypes = new Set<string>([
          'PERSON_DETECTED',
          'VEHICLE_DETECTED',
          'CROWD_GATHERING',
          'FIRE_VISUAL_INDICATOR',
          'SMOKE_VISUAL_INDICATOR',
          'SMOKING_ACTIVITY',
          'SHARP_OBJECT_DETECTED',
          'NO_MOVEMENT_DETECTED',
        ]);
        const detectorRules = applicable.flatMap((rule) =>
          rule.eventTypes
            .filter((eventType) => aiEventTypes.has(eventType))
            .map((eventType) => ({
              eventType,
              confidence: rule.minimumConfidence ?? 0.5,
              crowdCount: rule.crowdCount ?? 3,
              persistenceSeconds: rule.persistenceSeconds ?? 3,
              inactivitySeconds: rule.inactivitySeconds ?? 300,
              cooldownSeconds: rule.cooldownSeconds,
            })),
        );
        if (!detectorRules.length) return [];
        return [{
          cameraId: camera.id,
          displayName: camera.displayName,
          rtspUri: credentials.decrypt(profile.streamUriEncrypted as EncryptedValue),
          detectors: detectorRules,
        }];
      });
      return sendSuccess(res, 200, { items, refreshAfterSeconds: 30 });
    }),
  );
  return r;
};
