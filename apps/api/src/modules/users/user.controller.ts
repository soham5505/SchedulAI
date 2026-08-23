import { Request, Response, NextFunction } from 'express';
import { userService } from './user.service.js';
import { sendSuccess, sendCreated } from '../../utils/apiResponse.js';
import { logAudit } from '../../middleware/audit.middleware.js';

export class UserController {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await userService.getAll(req.query);
      return sendSuccess(res, result.users, 'Users retrieved successfully', result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await userService.getById(req.params.id);
      return sendSuccess(res, user, 'User retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await userService.create(req.body);
      if (req.user) {
        await logAudit({
          userId: req.user._id,
          userEmail: req.user.email,
          userName: req.user.name,
          action: 'CREATE',
          entity: 'User',
          entityId: String(user._id),
          newValue: { email: user.email, role: user.role },
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      }
      return sendCreated(res, user, 'User created successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const oldUser = await userService.getById(req.params.id);
      const user = await userService.update(req.params.id, req.body);
      if (req.user) {
        await logAudit({
          userId: req.user._id,
          userEmail: req.user.email,
          userName: req.user.name,
          action: 'UPDATE',
          entity: 'User',
          entityId: req.params.id,
          oldValue: { name: oldUser.name, role: oldUser.role, isActive: oldUser.isActive },
          newValue: req.body,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      }
      return sendSuccess(res, user, 'User updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await userService.delete(req.params.id);
      if (req.user) {
        await logAudit({
          userId: req.user._id,
          userEmail: req.user.email,
          userName: req.user.name,
          action: 'DELETE',
          entity: 'User',
          entityId: req.params.id,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      }
      return sendSuccess(res, result, 'User deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const userController = new UserController();
