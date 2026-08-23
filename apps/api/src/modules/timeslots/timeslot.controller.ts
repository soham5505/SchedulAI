import { Request, Response, NextFunction } from 'express';
import { timeSlotService } from './timeslot.service.js';
import { sendSuccess, sendCreated } from '../../utils/apiResponse.js';
import { logAudit } from '../../middleware/audit.middleware.js';

export class TimeSlotController {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await timeSlotService.getAll(req.query);
      return sendSuccess(res, result.timeslots, 'Time slots retrieved', result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const timeslot = await timeSlotService.getById(req.params.id);
      return sendSuccess(res, timeslot, 'Time slot retrieved');
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const timeslot = await timeSlotService.create(req.body);
      if (req.user) {
        await logAudit({
          userId: req.user._id,
          userEmail: req.user.email,
          userName: req.user.name,
          action: 'CREATE',
          entity: 'TimeSlot',
          entityId: String(timeslot._id),
          newValue: timeslot,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      }
      return sendCreated(res, timeslot, 'Time slot created successfully');
    } catch (error) {
      next(error);
    }
  }

  async bulkStandard(req: Request, res: Response, next: NextFunction) {
    try {
      const { days } = req.body;
      const result = await timeSlotService.bulkGenerateStandard(days);
      if (req.user) {
        await logAudit({
          userId: req.user._id,
          userEmail: req.user.email,
          userName: req.user.name,
          action: 'CREATE',
          entity: 'TimeSlot',
          newValue: { createdCount: result.createdCount },
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      }
      return sendCreated(res, result, `Generated ${result.createdCount} standard time slots`);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const oldSlot = await timeSlotService.getById(req.params.id);
      const timeslot = await timeSlotService.update(req.params.id, req.body);
      if (req.user) {
        await logAudit({
          userId: req.user._id,
          userEmail: req.user.email,
          userName: req.user.name,
          action: 'UPDATE',
          entity: 'TimeSlot',
          entityId: req.params.id,
          oldValue: oldSlot,
          newValue: req.body,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      }
      return sendSuccess(res, timeslot, 'Time slot updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await timeSlotService.delete(req.params.id);
      if (req.user) {
        await logAudit({
          userId: req.user._id,
          userEmail: req.user.email,
          userName: req.user.name,
          action: 'DELETE',
          entity: 'TimeSlot',
          entityId: req.params.id,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      }
      return sendSuccess(res, result, 'Time slot deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const timeSlotController = new TimeSlotController();
