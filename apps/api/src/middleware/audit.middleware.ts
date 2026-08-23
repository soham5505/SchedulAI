import { AuditAction } from '@schedulai/shared-types';
import { AuditLogModel } from '../models/audit.model.js';
import { Logger } from '../utils/logger.js';
import mongoose from 'mongoose';

const logger = new Logger('AuditLogger');

export interface CreateAuditLogParams {
  userId?: string;
  userEmail?: string;
  userName?: string;
  action: AuditAction;
  entity: string;
  entityId?: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export async function logAudit(params: CreateAuditLogParams): Promise<void> {
  try {
    await AuditLogModel.create({
      userId: params.userId && mongoose.Types.ObjectId.isValid(params.userId) ? params.userId : null,
      userEmail: params.userEmail || '',
      userName: params.userName || '',
      action: params.action,
      entity: params.entity,
      entityId: params.entityId || null,
      oldValue: params.oldValue || null,
      newValue: params.newValue || null,
      ipAddress: params.ipAddress || '',
      userAgent: params.userAgent || '',
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error(`Failed to record audit log: ${(error as Error).message}`);
  }
}
