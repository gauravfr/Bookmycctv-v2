import { Router } from 'express';
import { requirePasswordChanged, requireRole } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/http.js';
import { sendSuccess } from '../../utils/responses.js';
import { CameraAssignmentModel } from '../assignments/camera-assignment.model.js';
import { CameraModel, safeCamera, type CameraRecord } from './camera.model.js';
import type { Types } from 'mongoose';
export const createClientRouter = (): Router => {
  const router = Router();
  router.use(requireRole('CLIENT'), requirePasswordChanged);
  router.get(
    '/cameras',
    asyncHandler(async (req, res) => {
      const assignments = await CameraAssignmentModel.find({
        organizationId: req.authUser!.organizationId,
        clientId: req.authUser!._id,
      })
        .select('cameraId permissions assignedAt updatedAt')
        .lean();
      const cameras = await CameraModel.find({
        _id: { $in: assignments.map((item) => item.cameraId) },
        organizationId: req.authUser!.organizationId,
        deletedAt: { $exists: false },
      }).lean();
      const byId = new Map(cameras.map((camera) => [camera._id.toString(), camera]));
      const items = assignments.flatMap((assignment) => {
        const camera = byId.get(assignment.cameraId.toString());
        return camera
          ? [
              {
                camera: safeCamera(camera as CameraRecord & { _id: Types.ObjectId }),
                permissions: assignment.permissions,
                assignedAt: assignment.assignedAt,
              },
            ]
          : [];
      });
      return sendSuccess(res, 200, { items });
    }),
  );
  return router;
};
