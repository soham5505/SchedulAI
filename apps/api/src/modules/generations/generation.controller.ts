import { Request, Response, NextFunction } from 'express';
import { generationService } from './generation.service.js';
import { sendSuccess, sendCreated } from '../../utils/apiResponse.js';
import { logAudit } from '../../middleware/audit.middleware.js';

export class GenerationController {
  async generate(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await generationService.generate(req.body, req.user!);
      if (req.user) {
        await logAudit({
          userId: req.user._id,
          userEmail: req.user.email,
          userName: req.user.name,
          action: 'GENERATE_TIMETABLE',
          entity: 'Generation',
          entityId: String(result.generation._id),
          newValue: {
            name: result.generation.name,
            status: result.generation.status,
            resultCount: result.timetable.length,
            score: result.score,
          },
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      }
      return sendCreated(res, result, 'Timetable generation processed');
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await generationService.getAll(req.query);
      return sendSuccess(res, result.generations, 'Generations history retrieved', result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await generationService.getById(req.params.id);
      return sendSuccess(res, result, 'Generation details retrieved');
    } catch (error) {
      next(error);
    }
  }

  async restore(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await generationService.restoreVersion(req.params.id, req.user!);
      if (req.user) {
        await logAudit({
          userId: req.user._id,
          userEmail: req.user.email,
          userName: req.user.name,
          action: 'RESTORE_VERSION',
          entity: 'Generation',
          entityId: req.params.id,
          newValue: { restoredId: String(result.restoredGeneration._id) },
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      }
      return sendSuccess(res, result, 'Version restored successfully');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await generationService.delete(req.params.id);
      if (req.user) {
        await logAudit({
          userId: req.user._id,
          userEmail: req.user.email,
          userName: req.user.name,
          action: 'DELETE',
          entity: 'Generation',
          entityId: req.params.id,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      }
      return sendSuccess(res, result, 'Generation and entries deleted');
    } catch (error) {
      next(error);
    }
  }
}

export const generationController = new GenerationController();
