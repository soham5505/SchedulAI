import { Request, Response, NextFunction } from 'express';
import { auditService } from './audit.service.js';
import { sendSuccess } from '../../utils/apiResponse.js';

export class AuditController {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await auditService.getAll(req.query);
      return sendSuccess(res, result.logs, 'Audit logs retrieved', result.meta);
    } catch (error) {
      next(error);
    }
  }
}

export const auditController = new AuditController();
