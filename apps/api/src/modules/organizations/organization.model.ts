import { Schema, model, type Types } from 'mongoose';
export const organizationStatuses = ['ACTIVE', 'SUSPENDED', 'DISABLED'] as const;
export type OrganizationStatus = (typeof organizationStatuses)[number];
export interface OrganizationRecord {
  name: string;
  code: string;
  status: OrganizationStatus;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
const schema = new Schema<OrganizationRecord>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    status: { type: String, enum: organizationStatuses, default: 'ACTIVE' },
    contactName: { type: String, trim: true },
    contactEmail: { type: String, lowercase: true, trim: true },
    contactPhone: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, versionKey: false },
);
schema.index({ code: 1 }, { unique: true });
schema.index({ status: 1, createdAt: -1 });
export const OrganizationModel = model<OrganizationRecord>('Organization', schema);
