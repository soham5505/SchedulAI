import { TeacherModel } from '../../models/teacher.model.js';
import { ApiError } from '../../middleware/error.middleware.js';
import { ERROR_CODES } from '@schedulai/config';
import { QueryParams } from '@schedulai/shared-types';

export class TeacherService {
  async getAll(params: QueryParams) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (params.search) {
      filter.$or = [
        { name: { $regex: params.search, $options: 'i' } },
        { email: { $regex: params.search, $options: 'i' } },
        { employeeId: { $regex: params.search, $options: 'i' } },
        { designation: { $regex: params.search, $options: 'i' } },
      ];
    }
    if (params.departmentId) {
      filter.departmentId = params.departmentId;
    }
    if (typeof params.isActive === 'boolean') {
      filter.isActive = params.isActive;
    }

    const sortField = (params.sort as string) || 'name';
    const sortOrder = params.order === 'desc' ? -1 : 1;

    const [teachers, total] = await Promise.all([
      TeacherModel.find(filter)
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limit)
        .populate('departmentId', 'name code')
        .populate('subjects', 'name code credits isLab')
        .populate('preferredTimeSlots', 'day startTime endTime periodNumber')
        .populate('unavailableTimeSlots', 'day startTime endTime periodNumber')
        .lean(),
      TeacherModel.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      teachers,
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
    const teacher = await TeacherModel.findById(id)
      .populate('departmentId', 'name code')
      .populate('subjects', 'name code credits isLab')
      .populate('preferredTimeSlots', 'day startTime endTime periodNumber')
      .populate('unavailableTimeSlots', 'day startTime endTime periodNumber')
      .lean();
    if (!teacher) {
      throw new ApiError('Teacher not found', 404, ERROR_CODES.TEACHER_NOT_FOUND);
    }
    return teacher;
  }

  async create(data: Record<string, unknown>) {
    const existing = await TeacherModel.findOne({
      $or: [
        { email: (data.email as string).toLowerCase() },
        { employeeId: data.employeeId },
      ],
    });
    if (existing) {
      throw new ApiError('A teacher with this email or employee ID already exists', 409, ERROR_CODES.TEACHER_ALREADY_EXISTS);
    }

    const teacher = await TeacherModel.create({
      ...data,
      email: (data.email as string).toLowerCase(),
    });

    return teacher.toJSON();
  }

  async update(id: string, data: Record<string, unknown>) {
    const teacher = await TeacherModel.findById(id);
    if (!teacher) {
      throw new ApiError('Teacher not found', 404, ERROR_CODES.TEACHER_NOT_FOUND);
    }

    if (data.email && (data.email as string).toLowerCase() !== teacher.email) {
      const duplicate = await TeacherModel.findOne({
        email: (data.email as string).toLowerCase(),
        _id: { $ne: id },
      });
      if (duplicate) {
        throw new ApiError('Email is already taken', 409, ERROR_CODES.TEACHER_ALREADY_EXISTS);
      }
      teacher.email = (data.email as string).toLowerCase();
    }

    if (data.employeeId && data.employeeId !== teacher.employeeId) {
      const duplicate = await TeacherModel.findOne({
        employeeId: data.employeeId,
        _id: { $ne: id },
      });
      if (duplicate) {
        throw new ApiError('Employee ID is already taken', 409, ERROR_CODES.TEACHER_ALREADY_EXISTS);
      }
      teacher.employeeId = data.employeeId as string;
    }

    Object.assign(teacher, data);
    await teacher.save();
    return teacher.toJSON();
  }

  async delete(id: string) {
    const teacher = await TeacherModel.findByIdAndDelete(id);
    if (!teacher) {
      throw new ApiError('Teacher not found', 404, ERROR_CODES.TEACHER_NOT_FOUND);
    }
    return { deletedId: id };
  }
}

export const teacherService = new TeacherService();
