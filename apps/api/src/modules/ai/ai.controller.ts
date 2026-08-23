import { Request, Response, NextFunction } from 'express';
import { aiService } from './ai.service.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { logAudit } from '../../middleware/audit.middleware.js';

export class AIController {
  async extractPreferences(req: Request, res: Response, next: NextFunction) {
    try {
      const { prompt, departmentId } = req.body;
      const result = await aiService.extractPreferences(prompt, departmentId);
      if (req.user) {
        await logAudit({
          userId: req.user._id,
          userEmail: req.user.email,
          userName: req.user.name,
          action: 'AI_QUERY',
          entity: 'AIPreference',
          newValue: { prompt, count: result.preferences.length },
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      }
      return sendSuccess(res, result, 'Preferences extracted successfully');
    } catch (error) {
      next(error);
    }
  }

  async explainConflict(req: Request, res: Response, next: NextFunction) {
    try {
      const { conflict } = req.body;
      const result = await aiService.explainConflict(conflict);
      return sendSuccess(res, result, 'Conflict analysis completed');
    } catch (error) {
      next(error);
    }
  }

  async summarizeTimetable(req: Request, res: Response, next: NextFunction) {
    try {
      const { generationId } = req.body;
      const result = await aiService.summarizeTimetable(generationId);
      return sendSuccess(res, result, 'Timetable summary generated');
    } catch (error) {
      next(error);
    }
  }
}

export const aiController = new AIController();
