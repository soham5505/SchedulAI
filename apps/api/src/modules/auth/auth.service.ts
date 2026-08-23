import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { UserModel, IUserDocument } from '../../models/user.model.js';
import { ApiError } from '../../middleware/error.middleware.js';
import { ERROR_CODES } from '@schedulai/config';
import { UserRole } from '@schedulai/shared-types';

export interface RegisterDTO {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
  departmentId?: string;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export class AuthService {
  async register(data: RegisterDTO) {
    const existing = await UserModel.findOne({ email: data.email.toLowerCase() });
    if (existing) {
      throw new ApiError('Email is already registered', 409, ERROR_CODES.USER_ALREADY_EXISTS);
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);

    // If first user, make ADMIN
    const userCount = await UserModel.countDocuments();
    const assignedRole = userCount === 0 ? 'ADMIN' : (data.role || 'VIEWER');

    const user = await UserModel.create({
      name: data.name,
      email: data.email.toLowerCase(),
      passwordHash,
      role: assignedRole,
      departmentId: data.departmentId || null,
      isActive: true,
    });

    const tokens = this.generateTokens(user);
    return {
      user: {
        _id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        departmentId: user.departmentId ? user.departmentId.toString() : undefined,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      tokens,
    };
  }

  async login(data: LoginDTO) {
    const user = await UserModel.findOne({ email: data.email.toLowerCase() }).select('+passwordHash');
    if (!user) {
      throw new ApiError('Invalid email or password', 401, ERROR_CODES.INVALID_CREDENTIALS);
    }

    if (!user.isActive) {
      throw new ApiError('Your account has been deactivated', 403, ERROR_CODES.INACTIVE_USER);
    }

    const isMatch = await user.comparePassword(data.password);
    if (!isMatch) {
      throw new ApiError('Invalid email or password', 401, ERROR_CODES.INVALID_CREDENTIALS);
    }

    user.lastLoginAt = new Date();
    await user.save();

    const tokens = this.generateTokens(user);
    return {
      user: {
        _id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        departmentId: user.departmentId ? user.departmentId.toString() : undefined,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLoginAt: user.lastLoginAt,
      },
      tokens,
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as { userId: string };
      const user = await UserModel.findById(decoded.userId);
      if (!user || !user.isActive) {
        throw new ApiError('Invalid or expired refresh token', 401, ERROR_CODES.INVALID_TOKEN);
      }

      const tokens = this.generateTokens(user);
      return { tokens };
    } catch {
      throw new ApiError('Invalid or expired refresh token', 401, ERROR_CODES.INVALID_TOKEN);
    }
  }

  private generateTokens(user: IUserDocument) {
    const accessToken = jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions
    );

    const refreshToken = jwt.sign(
      {
        userId: user._id.toString(),
      },
      env.JWT_REFRESH_SECRET,
      { expiresIn: env.JWT_REFRESH_EXPIRES_IN } as jwt.SignOptions
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: env.JWT_EXPIRES_IN,
    };
  }
}

export const authService = new AuthService();
