import type { Types } from 'mongoose';
import { ApiError } from '../../utils/api-error.js';
import type { UserDocument } from '../users/user.model.js';
import {
  CameraAssignmentModel,
  type CameraPermission,
} from '../assignments/camera-assignment.model.js';
import { CameraModel } from './camera.model.js';

export class CameraAccessService {
  public async require(user: UserDocument, cameraId: Types.ObjectId, permission: CameraPermission) {
    if (!user.organizationId || user.role === 'PLATFORM_ADMIN')
      throw new ApiError(403, 'CAMERA_ACCESS_DENIED', 'Camera access is not permitted');
    const camera = await CameraModel.findOne({
      _id: cameraId,
      organizationId: user.organizationId,
      deletedAt: { $exists: false },
    });
    if (!camera) throw new ApiError(404, 'CAMERA_NOT_FOUND', 'Camera not found');
    if (user.role === 'CLIENT') {
      const assignment = await CameraAssignmentModel.exists({
        organizationId: user.organizationId,
        clientId: user._id,
        cameraId,
        permissions: permission,
      });
      if (!assignment)
        throw new ApiError(403, 'CAMERA_ACCESS_DENIED', 'Camera access is not permitted');
    }
    return camera;
  }
}
