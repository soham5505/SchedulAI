import { Request, Response, NextFunction } from 'express';
import { roomReservationService } from './roomReservation.service.js';
import { sendCreated, sendSuccess } from '../../utils/apiResponse.js';
import { logAudit } from '../../middleware/audit.middleware.js';

export class RoomReservationController {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await roomReservationService.getAll(req.query);
      return sendSuccess(res, result.reservations, 'Room reservations retrieved', result.meta);
    } catch (error) { next(error); }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      return sendSuccess(res, await roomReservationService.getById(req.params.id), 'Room reservation retrieved');
    } catch (error) { next(error); }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const reservation = await roomReservationService.create(req.body);
      if (req.user) {
        await logAudit({
          userId: req.user._id,
          userEmail: req.user.email,
          userName: req.user.name,
          action: 'CREATE',
          entity: 'RoomReservation',
          entityId: String(reservation._id),
          newValue: reservation,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      }
      return sendCreated(res, reservation, 'Room reservation created successfully');
    } catch (error) { next(error); }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const oldReservation = await roomReservationService.getById(req.params.id);
      const reservation = await roomReservationService.update(req.params.id, req.body);
      if (req.user) {
        await logAudit({
          userId: req.user._id,
          userEmail: req.user.email,
          userName: req.user.name,
          action: 'UPDATE',
          entity: 'RoomReservation',
          entityId: req.params.id,
          oldValue: oldReservation,
          newValue: req.body,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      }
      return sendSuccess(res, reservation, 'Room reservation updated successfully');
    } catch (error) { next(error); }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await roomReservationService.delete(req.params.id);
      if (req.user) {
        await logAudit({
          userId: req.user._id,
          userEmail: req.user.email,
          userName: req.user.name,
          action: 'DELETE',
          entity: 'RoomReservation',
          entityId: req.params.id,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      }
      return sendSuccess(res, result, 'Room reservation deleted successfully');
    } catch (error) { next(error); }
  }
}

export const roomReservationController = new RoomReservationController();
