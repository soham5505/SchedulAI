import { Request, Response, NextFunction } from 'express';
import { timetableService } from './timetable.service.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { logAudit } from '../../middleware/audit.middleware.js';

export class TimetableController {
  async getEntries(req: Request, res: Response, next: NextFunction) {
    try {
      const entries = await timetableService.getEntries(req.query as Record<string, string>);
      return sendSuccess(res, entries, 'Timetable entries retrieved');
    } catch (error) {
      next(error);
    }
  }

  async moveEntry(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await timetableService.moveEntry(req.body);
      if (result.valid && req.user) {
        await logAudit({
          userId: req.user._id,
          userEmail: req.user.email,
          userName: req.user.name,
          action: 'UPDATE',
          entity: 'TimetableEntry',
          entityId: req.body.entryId,
          newValue: req.body,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      }
      return sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  async validateGeneration(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await timetableService.validateGeneration(req.params.generationId);
      return sendSuccess(res, result, 'Timetable validation complete');
    } catch (error) {
      next(error);
    }
  }

  async updateEntry(req: Request, res: Response, next: NextFunction) {
    try {
      const entry = await timetableService.updateEntry(req.params.id, req.body);
      return sendSuccess(res, entry, 'Timetable entry updated');
    } catch (error) {
      next(error);
    }
  }

  async deleteEntry(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await timetableService.deleteEntry(req.params.id);
      return sendSuccess(res, result, 'Timetable entry deleted');
    } catch (error) {
      next(error);
    }
  }
}

export const timetableController = new TimetableController();
