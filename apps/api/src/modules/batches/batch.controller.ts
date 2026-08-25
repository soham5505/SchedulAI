import { Request, Response, NextFunction } from 'express';
import { batchService } from './batch.service.js';
import { sendCreated, sendSuccess } from '../../utils/apiResponse.js';
import { logAudit } from '../../middleware/audit.middleware.js';

export class BatchController {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await batchService.getAll(req.query);
      return sendSuccess(res, result.batches, 'Batches retrieved', result.meta);
    } catch (error) { next(error); }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try { return sendSuccess(res, await batchService.getById(req.params.id), 'Batch retrieved'); }
    catch (error) { next(error); }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const batch = await batchService.create(req.body);
      if (req.user) await logAudit({ userId: req.user._id, userEmail: req.user.email, userName: req.user.name, action: 'CREATE', entity: 'Batch', entityId: String(batch._id), newValue: batch, ipAddress: req.ip, userAgent: req.get('user-agent') });
      return sendCreated(res, batch, 'Batch created successfully');
    } catch (error) { next(error); }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const oldBatch = await batchService.getById(req.params.id);
      const batch = await batchService.update(req.params.id, req.body);
      if (req.user) await logAudit({ userId: req.user._id, userEmail: req.user.email, userName: req.user.name, action: 'UPDATE', entity: 'Batch', entityId: req.params.id, oldValue: oldBatch, newValue: req.body, ipAddress: req.ip, userAgent: req.get('user-agent') });
      return sendSuccess(res, batch, 'Batch updated successfully');
    } catch (error) { next(error); }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await batchService.delete(req.params.id);
      if (req.user) await logAudit({ userId: req.user._id, userEmail: req.user.email, userName: req.user.name, action: 'DELETE', entity: 'Batch', entityId: req.params.id, ipAddress: req.ip, userAgent: req.get('user-agent') });
      return sendSuccess(res, result, 'Batch deleted successfully');
    } catch (error) { next(error); }
  }
}

export const batchController = new BatchController();