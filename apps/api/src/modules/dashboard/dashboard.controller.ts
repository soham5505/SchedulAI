import { Request, Response, NextFunction } from 'express';
import { dashboardService } from './dashboard.service.js';
import { sendSuccess } from '../../utils/apiResponse.js';

export class DashboardController {
  async getStats(_req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await dashboardService.getStats();
      return sendSuccess(res, stats, 'Dashboard statistics');
    } catch (error) {
      next(error);
    }
  }
}

export const dashboardController = new DashboardController();
