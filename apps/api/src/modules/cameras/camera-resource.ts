import type { Types } from 'mongoose';
import { ApiError } from '../../utils/api-error.js';
import type { CameraPermission } from '../assignments/camera-assignment.model.js';
import { CameraModel, capabilityValue } from './camera.model.js';
export interface CameraResourceValidator {
  validate(
    organizationId: Types.ObjectId,
    cameraId: Types.ObjectId,
    permissions: CameraPermission[],
  ): Promise<void>;
}
export class UnavailableCameraResourceValidator implements CameraResourceValidator {
  public validate(): Promise<void> {
    return Promise.reject(
      new ApiError(
        503,
        'CAMERA_INTEGRATION_PENDING',
        'Camera assignments become available after camera integration',
      ),
    );
  }
}
export class MongoCameraResourceValidator implements CameraResourceValidator {
  public async validate(
    organizationId: Types.ObjectId,
    cameraId: Types.ObjectId,
    permissions: CameraPermission[],
  ): Promise<void> {
    const camera = await CameraModel.findOne({
      _id: cameraId,
      organizationId,
      deletedAt: { $exists: false },
    });
    if (!camera) throw new ApiError(404, 'CAMERA_NOT_FOUND', 'Camera not found');
    const mapping: Partial<Record<CameraPermission, string>> = {
      'camera:view': 'liveVideo',
      'camera:snapshot': 'snapshot',
      'camera:ptz': 'ptz',
      'camera:audio': 'audioInput',
      'camera:events': 'events',
    };
    for (const permission of permissions) {
      const capabilityName = mapping[permission];
      const capability = capabilityName
        ? capabilityValue(camera.capabilities, capabilityName)
        : undefined;
      if (!capability || capability.state !== 'SUPPORTED')
        throw new ApiError(
          422,
          'CAMERA_CAPABILITY_UNAVAILABLE',
          `${permission} is not verified as supported`,
        );
    }
  }
}
