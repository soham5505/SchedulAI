import { Request, Response, NextFunction } from 'express';
import { subjectService } from './subject.service.js';
import { sendSuccess, sendCreated } from '../../utils/apiResponse.js';
import { logAudit } from '../../middleware/audit.middleware.js';

export class SubjectController {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await subjectService.getAll(req.query);
      return sendSuccess(res, result.subjects, 'Subjects retrieved', result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const subject = await subjectService.getById(req.params.id);
      return sendSuccess(res, subject, 'Subject retrieved');
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const subject = await subjectService.create(req.body);
      if (req.user) {
        await logAudit({
          userId: req.user._id,
          userEmail: req.user.email,
          userName: req.user.name,
          action: 'CREATE',
          entity: 'Subject',
          entityId: String(subject._id),
          newValue: subject,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      }
      return sendCreated(res, subject, 'Subject created successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const oldSub = await subjectService.getById(req.params.id);
      const subject = await subjectService.update(req.params.id, req.body);
      if (req.user) {
        await logAudit({
          userId: req.user._id,
          userEmail: req.user.email,
          userName: req.user.name,
          action: 'UPDATE',
          entity: 'Subject',
          entityId: req.params.id,
          oldValue: oldSub,
          newValue: req.body,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      }
      return sendSuccess(res, subject, 'Subject updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await subjectService.delete(req.params.id);
      if (req.user) {
        await logAudit({
          userId: req.user._id,
          userEmail: req.user.email,
          userName: req.user.name,
          action: 'DELETE',
          entity: 'Subject',
          entityId: req.params.id,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      }
      return sendSuccess(res, result, 'Subject deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const subjectController = new SubjectController();
