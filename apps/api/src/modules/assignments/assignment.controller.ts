import { Request, Response, NextFunction } from 'express';
import { assignmentService } from './assignment.service.js';
import { sendSuccess, sendCreated } from '../../utils/apiResponse.js';
import { logAudit } from '../../middleware/audit.middleware.js';

export class AssignmentController {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await assignmentService.getAll(req.query);
      return sendSuccess(res, result.assignments, 'Teaching assignments retrieved', result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const assignment = await assignmentService.getById(req.params.id);
      return sendSuccess(res, assignment, 'Teaching assignment retrieved');
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const assignment = await assignmentService.create(req.body);
      if (req.user) {
        await logAudit({
          userId: req.user._id,
          userEmail: req.user.email,
          userName: req.user.name,
          action: 'CREATE',
          entity: 'TeachingAssignment',
          entityId: String(assignment._id),
          newValue: assignment,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      }
      return sendCreated(res, assignment, 'Teaching assignment created successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const oldAssignment = await assignmentService.getById(req.params.id);
      const assignment = await assignmentService.update(req.params.id, req.body);
      if (req.user) {
        await logAudit({
          userId: req.user._id,
          userEmail: req.user.email,
          userName: req.user.name,
          action: 'UPDATE',
          entity: 'TeachingAssignment',
          entityId: req.params.id,
          oldValue: oldAssignment,
          newValue: req.body,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      }
      return sendSuccess(res, assignment, 'Teaching assignment updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await assignmentService.delete(req.params.id);
      if (req.user) {
        await logAudit({
          userId: req.user._id,
          userEmail: req.user.email,
          userName: req.user.name,
          action: 'DELETE',
          entity: 'TeachingAssignment',
          entityId: req.params.id,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      }
      return sendSuccess(res, result, 'Teaching assignment deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const assignmentController = new AssignmentController();
