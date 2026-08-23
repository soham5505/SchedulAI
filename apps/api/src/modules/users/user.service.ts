import { UserModel } from '../../models/user.model.js';
import { ApiError } from '../../middleware/error.middleware.js';
import { ERROR_CODES } from '@schedulai/config';
import bcrypt from 'bcryptjs';
import { QueryParams, UserRole } from '@schedulai/shared-types';

export class UserService {
  async getAll(params: QueryParams) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (params.search) {
      filter.$or = [
        { name: { $regex: params.search, $options: 'i' } },
        { email: { $regex: params.search, $options: 'i' } },
      ];
    }
    if (params.role) {
      filter.role = params.role;
    }
    if (params.departmentId) {
      filter.departmentId = params.departmentId;
    }
    if (typeof params.isActive === 'boolean') {
      filter.isActive = params.isActive;
    }

    const sortField = (params.sort as string) || 'createdAt';
    const sortOrder = params.order === 'asc' ? 1 : -1;

    const [users, total] = await Promise.all([
      UserModel.find(filter)
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limit)
        .populate('departmentId', 'name code')
        .lean(),
      UserModel.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      users,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  async getById(id: string) {
    const user = await UserModel.findById(id).populate('departmentId', 'name code').lean();
    if (!user) {
      throw new ApiError('User not found', 404, ERROR_CODES.USER_NOT_FOUND);
    }
    return user;
  }

  async create(data: { name: string; email: string; password?: string; role?: UserRole; departmentId?: string }) {
    const existing = await UserModel.findOne({ email: data.email.toLowerCase() });
    if (existing) {
      throw new ApiError('A user with this email already exists', 409, ERROR_CODES.USER_ALREADY_EXISTS);
    }

    const passwordToHash = data.password || 'SchedulAI@2026';
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(passwordToHash, salt);

    const user = await UserModel.create({
      name: data.name,
      email: data.email.toLowerCase(),
      passwordHash,
      role: data.role || 'VIEWER',
      departmentId: data.departmentId || null,
      isActive: true,
    });

    return user.toJSON();
  }

  async update(id: string, data: Partial<{ name: string; email: string; role: UserRole; isActive: boolean; departmentId: string | null; password?: string }>) {
    const user = await UserModel.findById(id);
    if (!user) {
      throw new ApiError('User not found', 404, ERROR_CODES.USER_NOT_FOUND);
    }

    if (data.email && data.email.toLowerCase() !== user.email) {
      const duplicate = await UserModel.findOne({ email: data.email.toLowerCase(), _id: { $ne: id } });
      if (duplicate) {
        throw new ApiError('Email is already taken by another user', 409, ERROR_CODES.USER_ALREADY_EXISTS);
      }
      user.email = data.email.toLowerCase();
    }

    if (data.name) user.name = data.name;
    if (data.role) user.role = data.role;
    if (typeof data.isActive === 'boolean') user.isActive = data.isActive;
    if (data.departmentId !== undefined) user.departmentId = data.departmentId ? (data.departmentId as unknown as mongoose.Types.ObjectId) : undefined;

    if (data.password) {
      const salt = await bcrypt.genSalt(10);
      user.passwordHash = await bcrypt.hash(data.password, salt);
    }

    await user.save();
    return user.toJSON();
  }

  async delete(id: string) {
    const user = await UserModel.findByIdAndDelete(id);
    if (!user) {
      throw new ApiError('User not found', 404, ERROR_CODES.USER_NOT_FOUND);
    }
    return { deletedId: id };
  }
}

import mongoose from 'mongoose';
export const userService = new UserService();
