import { Router } from 'express';
import type { Types } from 'mongoose';
import { rateLimit } from 'express-rate-limit';
import { requirePasswordChanged, requireRole } from '../../middleware/auth.js';
import type { AppConfig } from '../../config/env.js';
import { asyncHandler, objectId, routeParam } from '../../utils/http.js';
import { sendSuccess } from '../../utils/responses.js';
import { paginationSchema } from '../auth/auth.schemas.js';
import { CameraModel, safeCamera, type CameraRecord } from '../cameras/camera.model.js';
import { deviceRegistrationSchema, deviceUpdateSchema } from './device.schemas.js';
import type { DeviceService } from './device.service.js';

export const createDeviceAdminRouter = (devices: DeviceService, config: AppConfig): Router => {
  const router = Router();
  router.use(requireRole('INSTALLER_ADMIN'), requirePasswordChanged);
  const expensive = rateLimit({
    windowMs: config.DEVICE_OPERATION_RATE_LIMIT_WINDOW_MS,
    limit: config.DEVICE_OPERATION_RATE_LIMIT_MAX,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  });
  router.post(
    '/devices',
    asyncHandler(async (req, res) =>
      sendSuccess(res, 201, {
        device: await devices.create(
          req.authUser!.organizationId!,
          req.authUser!._id,
          deviceRegistrationSchema.parse(req.body),
        ),
      }),
    ),
  );
  router.get(
    '/devices',
    asyncHandler(async (req, res) => {
      const { page, limit } = paginationSchema.parse(req.query);
      return sendSuccess(res, 200, await devices.list(req.authUser!.organizationId!, page, limit));
    }),
  );
  router.get(
    '/devices/:id',
    asyncHandler(async (req, res) =>
      sendSuccess(res, 200, {
        device: await devices.get(req.authUser!.organizationId!, objectId(routeParam(req, 'id'))),
      }),
    ),
  );
  router.patch(
    '/devices/:id',
    asyncHandler(async (req, res) =>
      sendSuccess(res, 200, {
        device: await devices.update(
          req.authUser!.organizationId!,
          req.authUser!._id,
          objectId(routeParam(req, 'id')),
          deviceUpdateSchema.parse(req.body),
        ),
      }),
    ),
  );
  router.delete(
    '/devices/:id',
    asyncHandler(async (req, res) => {
      await devices.remove(
        req.authUser!.organizationId!,
        req.authUser!._id,
        objectId(routeParam(req, 'id')),
      );
      return sendSuccess(res, 200, { message: 'Device deleted' });
    }),
  );
  router.post(
    '/devices/:id/test-connection',
    expensive,
    asyncHandler(async (req, res) =>
      sendSuccess(
        res,
        200,
        await devices.testConnection(
          req.authUser!.organizationId!,
          req.authUser!._id,
          objectId(routeParam(req, 'id')),
        ),
      ),
    ),
  );
  router.post(
    '/devices/:id/discover',
    expensive,
    asyncHandler(async (req, res) =>
      sendSuccess(
        res,
        200,
        await devices.discover(
          req.authUser!.organizationId!,
          req.authUser!._id,
          objectId(routeParam(req, 'id')),
        ),
      ),
    ),
  );
  router.post(
    '/devices/:id/reconnect',
    expensive,
    asyncHandler(async (req, res) =>
      sendSuccess(
        res,
        200,
        await devices.testConnection(
          req.authUser!.organizationId!,
          req.authUser!._id,
          objectId(routeParam(req, 'id')),
        ),
      ),
    ),
  );
  router.get(
    '/devices/:id/health',
    asyncHandler(async (req, res) => {
      const device = await devices.get(
        req.authUser!.organizationId!,
        objectId(routeParam(req, 'id')),
      );
      return sendSuccess(res, 200, {
        connectionState: device.connectionState,
        lastSuccessfulConnectionAt: device.lastSuccessfulConnectionAt,
        lastConnectionErrorCategory: device.lastConnectionErrorCategory,
        lastHealthCheckAt: device.lastHealthCheckAt,
        playableStreamHealth: 'UNKNOWN',
      });
    }),
  );
  router.get(
    '/devices/:id/capabilities',
    asyncHandler(async (req, res) => {
      const id = objectId(routeParam(req, 'id'));
      await devices.get(req.authUser!.organizationId!, id);
      const cameras = await CameraModel.find({
        organizationId: req.authUser!.organizationId,
        deviceId: id,
        deletedAt: { $exists: false },
      })
        .select('channelId capabilities')
        .lean();
      return sendSuccess(res, 200, { cameras });
    }),
  );
  router.get(
    '/devices/:id/cameras',
    asyncHandler(async (req, res) => {
      const id = objectId(routeParam(req, 'id'));
      await devices.get(req.authUser!.organizationId!, id);
      const cameras = await CameraModel.find({
        organizationId: req.authUser!.organizationId,
        deviceId: id,
        deletedAt: { $exists: false },
      }).lean();
      return sendSuccess(res, 200, {
        items: cameras.map((camera) =>
          safeCamera(camera as CameraRecord & { _id: Types.ObjectId }),
        ),
      });
    }),
  );
  return router;
};
