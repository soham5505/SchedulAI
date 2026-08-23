import { Request, Response, NextFunction } from 'express';
import { semesterService } from './semester.service.js';
import { sendSuccess, sendCreated } from '../../utils/apiResponse.js';
import { logAudit } from '../../middleware/audit.middleware.js';

export class SemesterController {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await semesterService.getAll(req.query);
      return sendSuccess(res, result.semesters, 'Semesters retrieved', result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const semester = await semesterService.getById(req.params.id);
      return sendSuccess(res, semester, 'Semester retrieved');
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const semester = await semesterService.create(req.body);
      if (req.user) {
        await logAudit({
          userId: req.user._id,
          userEmail: req.user.email,
          userName: req.user.name,
          action: 'CREATE',
          entity: 'Semester',
          entityId: String(semester._id),
          newValue: semester,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      }
      return sendCreated(res, semester, 'Semester created successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const oldSem = await semesterService.getById(req.params.id);
      const semester = await semesterService.update(req.params.id, req.body);
      if (req.user) {
        await logAudit({
          userId: req.user._id,
          userEmail: req.user.email,
          userName: req.user.name,
          action: 'UPDATE',
          entity: 'Semester',
          entityId: req.params.id,
          oldValue: oldSem,
          newValue: req.body,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      }
      return sendSuccess(res, semester, 'Semester updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await semesterService.delete(req.params.id);
      if (req.user) {
        await logAudit({
          userId: req.user._id,
          userEmail: req.user.email,
          userName: req.user.name,
          action: 'DELETE',
          entity: 'Semester',
          entityId: req.params.id,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      }
      return sendSuccess(res, result, 'Semester deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const semesterController = new SemesterController();
