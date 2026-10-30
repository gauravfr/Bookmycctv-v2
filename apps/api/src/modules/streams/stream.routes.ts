import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, objectId, routeParam } from '../../utils/http.js';
import { sendSuccess } from '../../utils/responses.js';
import { ApiError } from '../../utils/api-error.js';
import type { StreamService } from './stream.service.js';
import { StreamSessionModel } from './stream-session.model.js';

export const createStreamRouter = (service: StreamService) => {
  const r = Router();
  r.post(
    '/cameras/:id/streams',
    asyncHandler(async (req, res) => {
      const body = z
        .object({ transport: z.enum(['WEBRTC', 'HLS']).default('WEBRTC') })
        .parse(req.body);
      const out = await service.create(
        req.authUser!,
        objectId(routeParam(req, 'id')),
        body.transport,
      );
      return sendSuccess(res, 201, { stream: service.descriptor(out.session, out.token) });
    }),
  );
  r.get(
    '/cameras/:id/streams',
    asyncHandler(async (req, res) => {
      const cameraId = objectId(routeParam(req, 'id'));
      await service.access.require(req.authUser!, cameraId, 'camera:view');
      const items = await StreamSessionModel.find({
        cameraId,
        organizationId: req.authUser!.organizationId,
        userId: req.authUser!._id,
      })
        .sort({ createdAt: -1 })
        .limit(50);
      return sendSuccess(res, 200, { items: items.map((s) => service.descriptor(s)) });
    }),
  );
  r.get(
    '/streams/:sessionId',
    asyncHandler(async (req, res) => {
      const s = await service.get(req.authUser!, routeParam(req, 'sessionId'));
      return sendSuccess(res, 200, { stream: service.descriptor(s) });
    }),
  );
  r.post(
    '/streams/:sessionId/refresh',
    asyncHandler(async (req, res) => {
      const out = await service.refresh(req.authUser!, routeParam(req, 'sessionId'));
      return sendSuccess(res, 200, { stream: service.descriptor(out.session, out.token) });
    }),
  );
  r.delete(
    '/streams/:sessionId',
    asyncHandler(async (req, res) => {
      await service.revoke(req.authUser!, routeParam(req, 'sessionId'));
      return sendSuccess(res, 200, { revoked: true });
    }),
  );
  r.get(
    '/streams/:sessionId/health',
    asyncHandler(async (req, res) => {
      return sendSuccess(res, 200, {
        health: await service.health(req.authUser!, routeParam(req, 'sessionId')),
      });
    }),
  );
  return r;
};

export const createMediaAuthRouter = (service: StreamService) => {
  const r = Router();
  r.post(
    '/auth',
    asyncHandler(async (req, res) => {
      const body = z
        .object({ token: z.string(), action: z.string(), path: z.string() })
        .parse(req.body);
      if (!['read', 'playback'].includes(body.action))
        throw new ApiError(403, 'MEDIA_ACTION_DENIED', 'Media action is not permitted');
      await service.authorizeMedia(body.token, body.path);
      res.sendStatus(204);
    }),
  );
  return r;
};
