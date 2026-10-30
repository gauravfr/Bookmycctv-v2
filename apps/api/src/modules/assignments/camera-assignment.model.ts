import { Schema, model, type Types } from 'mongoose';
export const cameraPermissions = [
  'camera:view',
  'camera:snapshot',
  'camera:ptz',
  'camera:audio',
  'camera:events',
] as const;
export type CameraPermission = (typeof cameraPermissions)[number];
export interface CameraAssignmentRecord {
  organizationId: Types.ObjectId;
  clientId: Types.ObjectId;
  cameraId: Types.ObjectId;
  permissions: CameraPermission[];
  assignedBy: Types.ObjectId;
  assignedAt: Date;
  updatedAt: Date;
}
const schema = new Schema<CameraAssignmentRecord>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    clientId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    cameraId: { type: Schema.Types.ObjectId, required: true },
    permissions: [{ type: String, enum: cameraPermissions, required: true }],
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    assignedAt: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: false, updatedAt: true }, versionKey: false },
);
schema.index({ organizationId: 1, clientId: 1, cameraId: 1 }, { unique: true });
schema.index({ clientId: 1, cameraId: 1 });
export const CameraAssignmentModel = model<CameraAssignmentRecord>('CameraAssignment', schema);
