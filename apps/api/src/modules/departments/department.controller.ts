import { Request, Response, NextFunction } from 'express';
import { departmentService } from './department.service.js';
import { sendSuccess, sendCreated } from '../../utils/apiResponse.js';
import { logAudit } from '../../middleware/audit.middleware.js';

export class DepartmentController {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await departmentService.getAll(req.query);
      return sendSuccess(res, result.departments, 'Departments retrieved', result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const department = await departmentService.getById(req.params.id);
      return sendSuccess(res, department, 'Department retrieved');
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const department = await departmentService.create(req.body);
      if (req.user) {
        await logAudit({
          userId: req.user._id,
          userEmail: req.user.email,
          userName: req.user.name,
          action: 'CREATE',
          entity: 'Department',
          entityId: String(department._id),
          newValue: department,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      }
      return sendCreated(res, department, 'Department created successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const oldDept = await departmentService.getById(req.params.id);
      const department = await departmentService.update(req.params.id, req.body);
      if (req.user) {
        await logAudit({
          userId: req.user._id,
          userEmail: req.user.email,
          userName: req.user.name,
          action: 'UPDATE',
          entity: 'Department',
          entityId: req.params.id,
          oldValue: oldDept,
          newValue: req.body,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      }
      return sendSuccess(res, department, 'Department updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await departmentService.delete(req.params.id);
      if (req.user) {
        await logAudit({
          userId: req.user._id,
          userEmail: req.user.email,
          userName: req.user.name,
          action: 'DELETE',
          entity: 'Department',
          entityId: req.params.id,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      }
      return sendSuccess(res, result, 'Department deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const departmentController = new DepartmentController();
