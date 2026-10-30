import { Schema, model, type Types } from 'mongoose';
export interface RefreshSessionRecord {
  userId: Types.ObjectId;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date;
  replacedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
const schema = new Schema<RefreshSessionRecord>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    familyId: { type: String, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    revokedAt: Date,
    replacedBy: { type: Schema.Types.ObjectId, ref: 'RefreshSession' },
  },
  { timestamps: true, versionKey: false },
);
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
schema.index({ userId: 1, revokedAt: 1 });
export const RefreshSessionModel = model<RefreshSessionRecord>('RefreshSession', schema);
