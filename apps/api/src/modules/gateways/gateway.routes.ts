import { Router } from 'express';
import { z } from 'zod';
import { requirePasswordChanged, requireRole } from '../../middleware/auth.js';
import { asyncHandler, objectId, routeParam } from '../../utils/http.js';
import { sendSuccess } from '../../utils/responses.js';
import { ApiError } from '../../utils/api-error.js';
import { GatewayModel, safeGateway } from './gateway.model.js';
import type { GatewayService } from './gateway.service.js';
import type { AppConfig } from '../../config/env.js';
const caps = z
  .array(z.enum(['HEARTBEAT', 'RTSP_RELAY', 'ONVIF_CONTROL']))
  .max(10)
  .default([]);
export const createGatewayAdminRouter = (service: GatewayService, config: AppConfig) => {
  const r = Router();
  r.use(requireRole('INSTALLER_ADMIN'), requirePasswordChanged);
  r.post(
    '/gateways/enrollments',
    asyncHandler(async (req, res) => {
      const body = z.object({ name: z.string().trim().min(1).max(120) }).parse(req.body);
      const out = await service.createEnrollment(
        req.authUser!.organizationId!,
        req.authUser!._id,
        body.name,
      );
      return sendSuccess(res, 201, {
        gateway: safeGateway(out.gateway, config.GATEWAY_OFFLINE_AFTER_SECONDS),
        enrollmentToken: out.enrollmentToken,
        expiresAt: out.expiresAt,
      });
    }),
  );
  r.get(
    '/gateways',
    asyncHandler(async (req, res) => {
      const items = await GatewayModel.find({
        organizationId: req.authUser!.organizationId,
      }).lean();
      return sendSuccess(res, 200, {
        items: items.map((g) => safeGateway(g as never, config.GATEWAY_OFFLINE_AFTER_SECONDS)),
      });
    }),
  );
  r.get(
    '/gateways/:id',
    asyncHandler(async (req, res) => {
      const g = await GatewayModel.findOne({
        _id: objectId(routeParam(req, 'id')),
        organizationId: req.authUser!.organizationId,
      });
      if (!g) throw new ApiError(404, 'GATEWAY_NOT_FOUND', 'Gateway not found');
      return sendSuccess(res, 200, {
        gateway: safeGateway(g, config.GATEWAY_OFFLINE_AFTER_SECONDS),
      });
    }),
  );
  r.get(
    '/gateways/:id/health',
    asyncHandler(async (req, res) => {
      const g = await GatewayModel.findOne({
        _id: objectId(routeParam(req, 'id')),
        organizationId: req.authUser!.organizationId,
      });
      if (!g) throw new ApiError(404, 'GATEWAY_NOT_FOUND', 'Gateway not found');
      return sendSuccess(res, 200, {
        health: safeGateway(g, config.GATEWAY_OFFLINE_AFTER_SECONDS),
      });
    }),
  );
  r.post(
    '/gateways/:id/rotate-credentials',
    asyncHandler(async (req, res) => {
      const out = await service.rotate(
        req.authUser!.organizationId!,
        objectId(routeParam(req, 'id')),
      );
      return sendSuccess(res, 200, {
        gatewayId: out.gateway.publicId,
        gatewaySecret: out.gatewaySecret,
        credentialVersion: out.gateway.credentialVersion,
      });
    }),
  );
  r.post(
    '/gateways/:id/revoke',
    asyncHandler(async (req, res) => {
      await service.revoke(req.authUser!.organizationId!, objectId(routeParam(req, 'id')));
      return sendSuccess(res, 200, { revoked: true });
    }),
  );
  return r;
};
export const createGatewayServiceRouter = (service: GatewayService) => {
  const r = Router();
  r.post(
    '/enroll',
    asyncHandler(async (req, res) => {
      const b = z
        .object({ enrollmentToken: z.string().min(20), capabilities: caps })
        .parse(req.body);
      return sendSuccess(res, 201, await service.enroll(b.enrollmentToken, b.capabilities));
    }),
  );
  r.post(
    '/heartbeat',
    asyncHandler(async (req, res) => {
      const b = z.object({ capabilities: caps }).parse(req.body);
      return sendSuccess(
        res,
        200,
        await service.heartbeat(req.header('authorization'), b.capabilities),
      );
    }),
  );
  r.post('/commands/poll', (_req, _res, next) =>
    next(new ApiError(422, 'NO_GATEWAY_COMMANDS', 'No allowlisted gateway commands are queued')),
  );
  return r;
};
