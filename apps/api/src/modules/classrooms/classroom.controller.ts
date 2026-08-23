import { Request, Response, NextFunction } from 'express';
import { classroomService } from './classroom.service.js';
import { sendSuccess, sendCreated } from '../../utils/apiResponse.js';
import { logAudit } from '../../middleware/audit.middleware.js';

export class ClassroomController {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await classroomService.getAll(req.query);
      return sendSuccess(res, result.classrooms, 'Classrooms retrieved', result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const classroom = await classroomService.getById(req.params.id);
      return sendSuccess(res, classroom, 'Classroom retrieved');
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const classroom = await classroomService.create(req.body);
      if (req.user) {
        await logAudit({
          userId: req.user._id,
          userEmail: req.user.email,
          userName: req.user.name,
          action: 'CREATE',
          entity: 'Classroom',
          entityId: String(classroom._id),
          newValue: classroom,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      }
      return sendCreated(res, classroom, 'Classroom created successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const oldClass = await classroomService.getById(req.params.id);
      const classroom = await classroomService.update(req.params.id, req.body);
      if (req.user) {
        await logAudit({
          userId: req.user._id,
          userEmail: req.user.email,
          userName: req.user.name,
          action: 'UPDATE',
          entity: 'Classroom',
          entityId: req.params.id,
          oldValue: oldClass,
          newValue: req.body,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      }
      return sendSuccess(res, classroom, 'Classroom updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await classroomService.delete(req.params.id);
      if (req.user) {
        await logAudit({
          userId: req.user._id,
          userEmail: req.user.email,
          userName: req.user.name,
          action: 'DELETE',
          entity: 'Classroom',
          entityId: req.params.id,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      }
      return sendSuccess(res, result, 'Classroom deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const classroomController = new ClassroomController();
