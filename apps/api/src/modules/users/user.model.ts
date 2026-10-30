import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

export const userRoles = ['PLATFORM_ADMIN', 'INSTALLER_ADMIN', 'CLIENT'] as const;
export const userStatuses = ['ACTIVE', 'SUSPENDED', 'DISABLED'] as const;
export type UserRole = (typeof userRoles)[number];
export type UserStatus = (typeof userStatuses)[number];
export interface UserRecord {
  organizationId: Types.ObjectId | null;
  username: string;
  displayName: string;
  email?: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  mustChangePassword: boolean;
  lastLoginAt?: Date;
  passwordChangedAt: Date;
  createdBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}
export type UserDocument = HydratedDocument<UserRecord>;

const schema = new Schema<UserRecord>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      default: null,
      index: true,
    },
    username: { type: String, required: true, lowercase: true, trim: true },
    displayName: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: userRoles, required: true },
    status: { type: String, enum: userStatuses, default: 'ACTIVE', required: true },
    mustChangePassword: { type: Boolean, default: true },
    lastLoginAt: Date,
    passwordChangedAt: { type: Date, default: Date.now },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, versionKey: false },
);
schema.index({ username: 1 }, { unique: true });
schema.index({ organizationId: 1, role: 1, status: 1 });
schema.pre('validate', function () {
  this.username = this.username.trim().toLowerCase();
  if (this.role !== 'PLATFORM_ADMIN' && this.organizationId === null)
    this.invalidate('organizationId', 'Organization is required');
  if (this.role === 'PLATFORM_ADMIN') this.organizationId = null;
});

export const UserModel = model<UserRecord>('User', schema);

export const safeUser = (user: UserDocument) => ({
  id: user.id,
  organizationId: user.organizationId?.toString() ?? null,
  username: user.username,
  displayName: user.displayName,
  email: user.email ?? null,
  role: user.role,
  status: user.status,
  mustChangePassword: user.mustChangePassword,
  lastLoginAt: user.lastLoginAt ?? null,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});
