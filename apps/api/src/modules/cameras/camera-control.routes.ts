import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, objectId, routeParam } from '../../utils/http.js';
import { sendSuccess } from '../../utils/responses.js';
import type { CameraControlService } from './camera-control.service.js';
export const createCameraControlRouter = (service: CameraControlService) => {
  const r = Router();
  r.post(
    '/:id/ptz/move',
    asyncHandler(async (req, res) => {
      const b = z
        .object({
          x: z.number().min(-1).max(1).default(0),
          y: z.number().min(-1).max(1).default(0),
          zoom: z.number().min(-1).max(1).default(0),
          durationMs: z.number().int().min(50).max(5000).default(500),
        })
        .parse(req.body);
      return sendSuccess(
        res,
        200,
        await service.move(req.authUser!, objectId(routeParam(req, 'id')), b),
      );
    }),
  );
  r.post(
    '/:id/ptz/stop',
    asyncHandler(async (req, res) =>
      sendSuccess(res, 200, await service.stop(req.authUser!, objectId(routeParam(req, 'id')))),
    ),
  );
  r.get(
    '/:id/ptz/presets',
    asyncHandler(async (req, res) =>
      sendSuccess(res, 200, {
        presets: await service.presets(req.authUser!, objectId(routeParam(req, 'id'))),
      }),
    ),
  );
  r.post(
    '/:id/ptz/presets/:presetId/goto',
    asyncHandler(async (req, res) =>
      sendSuccess(
        res,
        200,
        await service.gotoPreset(
          req.authUser!,
          objectId(routeParam(req, 'id')),
          routeParam(req, 'presetId'),
        ),
      ),
    ),
  );
  r.post(
    '/:id/snapshots',
    asyncHandler(async (req, res) => {
      const shot = await service.snapshot(req.authUser!, objectId(routeParam(req, 'id')));
      res.setHeader('cache-control', 'no-store');
      res.type(shot.type);
      res.send(shot.data);
    }),
  );
  return r;
};
