import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@schedulai/shared-types';
import { ApiError } from './error.middleware.js';
import { ERROR_CODES } from '@schedulai/config';

export function requireRoles(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(
        new ApiError('Authentication required', 401, ERROR_CODES.UNAUTHORIZED)
      );
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ApiError(
          `Access denied. Requires one of roles: ${allowedRoles.join(', ')}`,
          403,
          ERROR_CODES.FORBIDDEN
        )
      );
    }

    next();
  };
}
