import { Request, Response, NextFunction } from 'express';
import { importService } from './import.service.js';
import { sendSuccess, sendCreated } from '../../utils/apiResponse.js';
import { ApiError } from '../../middleware/error.middleware.js';
import { ERROR_CODES } from '@schedulai/config';
import { logAudit } from '../../middleware/audit.middleware.js';

export class ImportController {
  async uploadAndParse(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        throw new ApiError('No file uploaded. Please upload a .xlsx, .xls, or .csv file.', 400, ERROR_CODES.BAD_REQUEST);
      }

      const parsed = importService.parseUploadedBuffer(req.file.buffer, req.file.originalname);
      return sendSuccess(res, parsed, 'File parsed successfully');
    } catch (error) {
      next(error);
    }
  }

  async execute(req: Request, res: Response, next: NextFunction) {
    try {
      const { type, columnMapping, data, fileName, departmentId } = req.body;
      if (!type || !columnMapping || !Array.isArray(data)) {
        throw new ApiError('Invalid import request parameters', 400, ERROR_CODES.BAD_REQUEST);
      }

      const job = await importService.executeImport(
        type,
        columnMapping,
        data,
        fileName || `${type.toLowerCase()}-import.xlsx`,
        departmentId,
        req.user!
      );

      if (req.user) {
        await logAudit({
          userId: req.user._id,
          userEmail: req.user.email,
          userName: req.user.name,
          action: 'IMPORT_DATA',
          entity: 'ImportJob',
          entityId: String(job._id),
          newValue: { type, successRows: job.successRows, errorRows: job.errorRows },
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      }

      return sendCreated(res, job, 'Import executed');
    } catch (error) {
      next(error);
    }
  }

  async getJobs(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await importService.getJobs(req.query);
      return sendSuccess(res, result.jobs, 'Import jobs retrieved', result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getJobById(req: Request, res: Response, next: NextFunction) {
    try {
      const job = await importService.getJobById(req.params.id);
      return sendSuccess(res, job, 'Import job details');
    } catch (error) {
      next(error);
    }
  }
}

export const importController = new ImportController();
