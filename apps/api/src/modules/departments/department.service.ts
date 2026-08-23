import { DepartmentModel } from '../../models/department.model.js';
import { ApiError } from '../../middleware/error.middleware.js';
import { ERROR_CODES } from '@schedulai/config';
import { QueryParams } from '@schedulai/shared-types';

export class DepartmentService {
  async getAll(params: QueryParams) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (params.search) {
      filter.$or = [
        { name: { $regex: params.search, $options: 'i' } },
        { code: { $regex: params.search, $options: 'i' } },
      ];
    }
    if (typeof params.isActive === 'boolean') {
      filter.isActive = params.isActive;
    }

    const sortField = (params.sort as string) || 'name';
    const sortOrder = params.order === 'desc' ? -1 : 1;

    const [departments, total] = await Promise.all([
      DepartmentModel.find(filter)
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      DepartmentModel.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      departments,
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
    const department = await DepartmentModel.findById(id).lean();
    if (!department) {
      throw new ApiError('Department not found', 404, ERROR_CODES.DEPARTMENT_NOT_FOUND);
    }
    return department;
  }

  async create(data: { name: string; code: string; description?: string; isActive?: boolean }) {
    const existing = await DepartmentModel.findOne({ code: data.code.toUpperCase() });
    if (existing) {
      throw new ApiError(`Department with code '${data.code.toUpperCase()}' already exists`, 409, ERROR_CODES.DEPARTMENT_ALREADY_EXISTS);
    }

    const department = await DepartmentModel.create({
      name: data.name,
      code: data.code.toUpperCase(),
      description: data.description || '',
      isActive: data.isActive !== undefined ? data.isActive : true,
    });

    return department.toJSON();
  }

  async update(id: string, data: Partial<{ name: string; code: string; description: string; isActive: boolean }>) {
    const department = await DepartmentModel.findById(id);
    if (!department) {
      throw new ApiError('Department not found', 404, ERROR_CODES.DEPARTMENT_NOT_FOUND);
    }

    if (data.code && data.code.toUpperCase() !== department.code) {
      const duplicate = await DepartmentModel.findOne({
        code: data.code.toUpperCase(),
        _id: { $ne: id },
      });
      if (duplicate) {
        throw new ApiError(`Department code '${data.code.toUpperCase()}' is already in use`, 409, ERROR_CODES.DEPARTMENT_ALREADY_EXISTS);
      }
      department.code = data.code.toUpperCase();
    }

    if (data.name) department.name = data.name;
    if (data.description !== undefined) department.description = data.description;
    if (typeof data.isActive === 'boolean') department.isActive = data.isActive;

    await department.save();
    return department.toJSON();
  }

  async delete(id: string) {
    const department = await DepartmentModel.findByIdAndDelete(id);
    if (!department) {
      throw new ApiError('Department not found', 404, ERROR_CODES.DEPARTMENT_NOT_FOUND);
    }
    return { deletedId: id };
  }
}

export const departmentService = new DepartmentService();
