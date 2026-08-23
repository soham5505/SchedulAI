import { SemesterModel } from '../../models/semester.model.js';
import { ApiError } from '../../middleware/error.middleware.js';
import { ERROR_CODES } from '@schedulai/config';
import { QueryParams } from '@schedulai/shared-types';

export class SemesterService {
  async getAll(params: QueryParams) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (params.search) {
      filter.$or = [
        { name: { $regex: params.search, $options: 'i' } },
        { academicYear: { $regex: params.search, $options: 'i' } },
        { section: { $regex: params.search, $options: 'i' } },
      ];
    }
    if (params.departmentId) {
      filter.departmentId = params.departmentId;
    }
    if (params.academicYear) {
      filter.academicYear = params.academicYear;
    }
    if (typeof params.isActive === 'boolean') {
      filter.isActive = params.isActive;
    }

    const sortField = (params.sort as string) || 'number';
    const sortOrder = params.order === 'desc' ? -1 : 1;

    const [semesters, total] = await Promise.all([
      SemesterModel.find(filter)
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limit)
        .populate('departmentId', 'name code')
        .lean(),
      SemesterModel.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      semesters,
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
    const semester = await SemesterModel.findById(id).populate('departmentId', 'name code').lean();
    if (!semester) {
      throw new ApiError('Semester not found', 404, ERROR_CODES.SEMESTER_NOT_FOUND);
    }
    return semester;
  }

  async create(data: Record<string, unknown>) {
    const existing = await SemesterModel.findOne({
      departmentId: data.departmentId,
      number: data.number,
      section: data.section,
      academicYear: data.academicYear,
    });
    if (existing) {
      throw new ApiError('A semester with this department, number, section, and academic year already exists', 409, ERROR_CODES.CONFLICT);
    }

    const semester = await SemesterModel.create(data);
    return semester.toJSON();
  }

  async update(id: string, data: Record<string, unknown>) {
    const semester = await SemesterModel.findById(id);
    if (!semester) {
      throw new ApiError('Semester not found', 404, ERROR_CODES.SEMESTER_NOT_FOUND);
    }

    Object.assign(semester, data);
    await semester.save();
    return semester.toJSON();
  }

  async delete(id: string) {
    const semester = await SemesterModel.findByIdAndDelete(id);
    if (!semester) {
      throw new ApiError('Semester not found', 404, ERROR_CODES.SEMESTER_NOT_FOUND);
    }
    return { deletedId: id };
  }
}

export const semesterService = new SemesterService();
