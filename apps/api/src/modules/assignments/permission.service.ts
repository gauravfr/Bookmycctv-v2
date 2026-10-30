import { ApiError } from '../../utils/api-error.js';
import { CameraAssignmentModel, type CameraPermission } from './camera-assignment.model.js';
export class CameraPermissionService {
  public async require(
    userId: string,
    cameraId: string,
    permission: CameraPermission,
  ): Promise<void> {
    const assignment = await CameraAssignmentModel.exists({
      clientId: userId,
      cameraId,
      permissions: permission,
    });
    if (!assignment)
      throw new ApiError(403, 'CAMERA_ACCESS_DENIED', 'Camera access is not permitted');
  }
}
