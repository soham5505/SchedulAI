import { AuditLogModel } from '../../models/audit.model.js';
import { QueryParams } from '@schedulai/shared-types';

export class AuditService {
  async getAll(params: QueryParams) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (params.action) filter.action = params.action;
    if (params.entity) filter.entity = params.entity;
    if (params.userId) filter.userId = params.userId;
    if (params.search) {
      filter.$or = [
        { userName: { $regex: params.search, $options: 'i' } },
        { userEmail: { $regex: params.search, $options: 'i' } },
        { entity: { $regex: params.search, $options: 'i' } },
        { action: { $regex: params.search, $options: 'i' } },
      ];
    }

    const [logs, total] = await Promise.all([
      AuditLogModel.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'name email role')
        .lean(),
      AuditLogModel.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      logs,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }
}

export const auditService = new AuditService();
