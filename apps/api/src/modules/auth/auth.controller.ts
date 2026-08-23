import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service.js';
import { sendSuccess, sendCreated } from '../../utils/apiResponse.js';
import { logAudit } from '../../middleware/audit.middleware.js';

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.register(req.body);
      await logAudit({
        userId: result.user._id,
        userEmail: result.user.email,
        userName: result.user.name,
        action: 'CREATE',
        entity: 'User',
        entityId: result.user._id,
        newValue: { email: result.user.email, role: result.user.role },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      return sendCreated(res, result, 'User registered successfully');
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.login(req.body);
      await logAudit({
        userId: result.user._id,
        userEmail: result.user.email,
        userName: result.user.name,
        action: 'LOGIN',
        entity: 'User',
        entityId: result.user._id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      return sendSuccess(res, result, 'Logged in successfully');
    } catch (error) {
      next(error);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;
      const result = await authService.refreshToken(refreshToken);
      return sendSuccess(res, result, 'Token refreshed successfully');
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      if (req.user) {
        await logAudit({
          userId: req.user._id,
          userEmail: req.user.email,
          userName: req.user.name,
          action: 'LOGOUT',
          entity: 'User',
          entityId: req.user._id,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      }
      return sendSuccess(res, { message: 'Logged out successfully' });
    } catch (error) {
      next(error);
    }
  }

  async getMe(req: Request, res: Response, next: NextFunction) {
    try {
      return sendSuccess(res, { user: req.user }, 'Current user profile');
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
