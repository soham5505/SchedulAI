import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { UserModel } from '../models/user.model.js';
import { ApiError } from './error.middleware.js';
import { ERROR_CODES } from '@schedulai/config';
import { IUser } from '@schedulai/shared-types';

interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError('Authentication token missing or invalid', 401, ERROR_CODES.UNAUTHORIZED);
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new ApiError('Authentication token missing', 401, ERROR_CODES.UNAUTHORIZED);
    }

    const decoded = jwt.verify(token, env.JWT_SECRET) as TokenPayload;
    const user = await UserModel.findById(decoded.userId).lean();

    if (!user) {
      throw new ApiError('User account no longer exists', 401, ERROR_CODES.USER_NOT_FOUND);
    }

    if (!user.isActive) {
      throw new ApiError('User account is deactivated', 403, ERROR_CODES.INACTIVE_USER);
    }

    req.user = {
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      departmentId: user.departmentId ? user.departmentId.toString() : undefined,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt,
    } as IUser;

    next();
  } catch (error) {
    next(error);
  }
}

export function optionalAuthenticate(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as TokenPayload;
    UserModel.findById(decoded.userId)
      .lean()
      .then((user) => {
        if (user && user.isActive) {
          req.user = {
            _id: user._id.toString(),
            name: user.name,
            email: user.email,
            role: user.role,
            isActive: user.isActive,
            departmentId: user.departmentId ? user.departmentId.toString() : undefined,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            lastLoginAt: user.lastLoginAt,
          } as IUser;
        }
        next();
      })
      .catch(() => next());
  } catch {
    next();
  }
}
