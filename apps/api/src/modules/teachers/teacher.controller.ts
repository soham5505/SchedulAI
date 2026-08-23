import { Request, Response, NextFunction } from 'express';
import { teacherService } from './teacher.service.js';
import { sendSuccess, sendCreated } from '../../utils/apiResponse.js';
import { logAudit } from '../../middleware/audit.middleware.js';

export class TeacherController {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await teacherService.getAll(req.query);
      return sendSuccess(res, result.teachers, 'Teachers retrieved', result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const teacher = await teacherService.getById(req.params.id);
      return sendSuccess(res, teacher, 'Teacher retrieved');
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const teacher = await teacherService.create(req.body);
      if (req.user) {
        await logAudit({
          userId: req.user._id,
          userEmail: req.user.email,
          userName: req.user.name,
          action: 'CREATE',
          entity: 'Teacher',
          entityId: String(teacher._id),
          newValue: teacher,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      }
      return sendCreated(res, teacher, 'Teacher created successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const oldTeacher = await teacherService.getById(req.params.id);
      const teacher = await teacherService.update(req.params.id, req.body);
      if (req.user) {
        await logAudit({
          userId: req.user._id,
          userEmail: req.user.email,
          userName: req.user.name,
          action: 'UPDATE',
          entity: 'Teacher',
          entityId: req.params.id,
          oldValue: oldTeacher,
          newValue: req.body,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      }
      return sendSuccess(res, teacher, 'Teacher updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await teacherService.delete(req.params.id);
      if (req.user) {
        await logAudit({
          userId: req.user._id,
          userEmail: req.user.email,
          userName: req.user.name,
          action: 'DELETE',
          entity: 'Teacher',
          entityId: req.params.id,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      }
      return sendSuccess(res, result, 'Teacher deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const teacherController = new TeacherController();
