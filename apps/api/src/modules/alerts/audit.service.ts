import type { Types } from 'mongoose';
import { AuditLogModel } from './audit-log.model.js';
export interface AuditEvent {
  actorId: Types.ObjectId | null;
  action: string;
  targetType: string;
  targetId?: string;
  organizationId: Types.ObjectId | null;
  metadata?: Record<string, unknown>;
}
export class AuditService {
  public async record(event: AuditEvent): Promise<void> {
    await AuditLogModel.create({ ...event, metadata: event.metadata ?? {} });
  }
}
