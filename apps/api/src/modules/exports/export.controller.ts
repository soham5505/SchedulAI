import { Request, Response, NextFunction } from 'express';
import { exportService } from './export.service.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { logAudit } from '../../middleware/audit.middleware.js';

export class ExportController {
  async exportExcel(req: Request, res: Response, next: NextFunction) {
    try {
      const buffer = await exportService.generateExcel(req.query as Record<string, string>);
      if (req.user) {
        await logAudit({
          userId: req.user._id,
          userEmail: req.user.email,
          userName: req.user.name,
          action: 'EXPORT_DATA',
          entity: 'TimetableExcel',
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      }

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="timetable-export.xlsx"');
      return res.send(buffer);
    } catch (error) {
      next(error);
    }
  }

  async exportCSV(req: Request, res: Response, next: NextFunction) {
    try {
      const buffer = await exportService.generateCSV(req.query as Record<string, string>);
      if (req.user) {
        await logAudit({
          userId: req.user._id,
          userEmail: req.user.email,
          userName: req.user.name,
          action: 'EXPORT_DATA',
          entity: 'TimetableCSV',
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="timetable-export.csv"');
      return res.send(buffer);
    } catch (error) {
      next(error);
    }
  }

  async getPrintable(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await exportService.getPrintableTimetable(req.query as Record<string, string>);
      return sendSuccess(res, data, 'Printable timetable data');
    } catch (error) {
      next(error);
    }
  }
}

export const exportController = new ExportController();
