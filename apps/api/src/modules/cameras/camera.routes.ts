import { Router, type Request } from 'express';
import { ApiError } from '../../utils/api-error.js';
import { objectId, routeParam, asyncHandler } from '../../utils/http.js';
import { sendSuccess } from '../../utils/responses.js';
import { CameraAssignmentModel } from '../assignments/camera-assignment.model.js';
import { CameraModel, safeCamera, type CameraRecord } from './camera.model.js';
import type { Types } from 'mongoose';

export const createCameraRouter = (): Router => {
  const router = Router();
  const accessibleIds = async (userId: Types.ObjectId) =>
    (await CameraAssignmentModel.find({ clientId: userId }).select('cameraId').lean()).map(
      (item) => item.cameraId,
    );
  const filter = async (req: Request, id?: Types.ObjectId) => {
    if (!req.authUser || req.authUser.role === 'PLATFORM_ADMIN')
      throw new ApiError(403, 'FORBIDDEN', 'Camera access is not permitted');
    const base: Record<string, unknown> = {
      organizationId: req.authUser.organizationId,
      deletedAt: { $exists: false },
    };
    if (id) base._id = id;
    if (req.authUser.role === 'CLIENT')
      base._id = { $in: await accessibleIds(req.authUser._id), ...(id ? { $eq: id } : {}) };
    return base;
  };
  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const items = await CameraModel.find(await filter(req)).lean();
      return sendSuccess(res, 200, {
        items: items.map((item) => safeCamera(item as CameraRecord & { _id: Types.ObjectId })),
      });
    }),
  );
  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const camera = await CameraModel.findOne(await filter(req, objectId(routeParam(req, 'id'))));
      if (!camera) throw new ApiError(404, 'CAMERA_NOT_FOUND', 'Camera not found');
      return sendSuccess(res, 200, { camera: safeCamera(camera) });
    }),
  );
  router.get(
    '/:id/capabilities',
    asyncHandler(async (req, res) => {
      const camera = await CameraModel.findOne(
        await filter(req, objectId(routeParam(req, 'id'))),
      ).select('capabilities');
      if (!camera) throw new ApiError(404, 'CAMERA_NOT_FOUND', 'Camera not found');
      return sendSuccess(res, 200, { capabilities: camera.capabilities });
    }),
  );
  router.get(
    '/:id/status',
    asyncHandler(async (req, res) => {
      const camera = await CameraModel.findOne(
        await filter(req, objectId(routeParam(req, 'id'))),
      ).select('status lastSeenAt');
      if (!camera) throw new ApiError(404, 'CAMERA_NOT_FOUND', 'Camera not found');
      return sendSuccess(res, 200, {
        status: camera.status,
        lastSeenAt: camera.lastSeenAt ?? null,
        streamMediaVerified: false,
      });
    }),
  );
  return router;
};
