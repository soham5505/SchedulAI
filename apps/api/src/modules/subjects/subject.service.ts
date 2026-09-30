import { SubjectModel } from '../../models/subject.model.js';
import { ApiError } from '../../middleware/error.middleware.js';
import { ERROR_CODES } from '@schedulai/config';
import { QueryParams } from '@schedulai/shared-types';

export class SubjectService {
  private validateWeeklyStructure(isLab: unknown, weeklyPeriods: unknown, lecturePeriods: unknown, labPeriods: unknown) {
    const lab = Boolean(isLab);
    const expected = lab
      ? { weeklyPeriods: 2, lecturePeriods: 0, labPeriods: 2 }
      : { weeklyPeriods: 3, lecturePeriods: 3, labPeriods: 0 };
    if (
      Number(weeklyPeriods ?? expected.weeklyPeriods) !== expected.weeklyPeriods ||
      Number(lecturePeriods ?? expected.lecturePeriods) !== expected.lecturePeriods ||
      Number(labPeriods ?? expected.labPeriods) !== expected.labPeriods
    ) {
      throw new ApiError(
        lab
          ? 'Lab subjects must be configured as 2 weekly periods, 0 lecture periods, and 2 lab periods.'
          : 'Lecture subjects must be configured as 3 weekly periods, 3 lecture periods, and 0 lab periods.',
        400,
        ERROR_CODES.BAD_REQUEST
      );
    }
  }

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
    if (params.departmentId) {
      filter.departmentId = params.departmentId;
    }
    if (typeof params.isActive === 'boolean') {
      filter.isActive = params.isActive;
    }

    const sortField = (params.sort as string) || 'name';
    const sortOrder = params.order === 'desc' ? -1 : 1;

    const [subjects, total] = await Promise.all([
      SubjectModel.find(filter)
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limit)
        .populate('departmentId', 'name code')
        .populate('semesterIds', 'name number section academicYear')
        .lean(),
      SubjectModel.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      subjects,
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
    const subject = await SubjectModel.findById(id)
      .populate('departmentId', 'name code')
      .populate('semesterIds', 'name number section academicYear')
      .lean();
    if (!subject) {
      throw new ApiError('Subject not found', 404, ERROR_CODES.SUBJECT_NOT_FOUND);
    }
    return subject;
  }

  async create(data: Record<string, unknown>) {
    this.validateWeeklyStructure(data.isLab, data.weeklyPeriods, data.lecturePeriods, data.labPeriods);
    const existing = await SubjectModel.findOne({ code: (data.code as string).toUpperCase() });
    if (existing) {
      throw new ApiError(`Subject with code '${data.code}' already exists`, 409, ERROR_CODES.CONFLICT);
    }

    const subject = await SubjectModel.create({
      ...data,
      code: (data.code as string).toUpperCase(),
    });

    return subject.toJSON();
  }

  async update(id: string, data: Record<string, unknown>) {
    const subject = await SubjectModel.findById(id);
    if (!subject) {
      throw new ApiError('Subject not found', 404, ERROR_CODES.SUBJECT_NOT_FOUND);
    }

    this.validateWeeklyStructure(
      data.isLab ?? subject.isLab,
      data.weeklyPeriods ?? subject.weeklyPeriods,
      data.lecturePeriods ?? subject.lecturePeriods,
      data.labPeriods ?? subject.labPeriods
    );

    if (data.code && (data.code as string).toUpperCase() !== subject.code) {
      const duplicate = await SubjectModel.findOne({
        code: (data.code as string).toUpperCase(),
        _id: { $ne: id },
      });
      if (duplicate) {
        throw new ApiError(`Subject with code '${data.code}' already exists`, 409, ERROR_CODES.CONFLICT);
      }
      subject.code = (data.code as string).toUpperCase();
    }

    Object.assign(subject, data);
    await subject.save();
    return subject.toJSON();
  }

  async delete(id: string) {
    const subject = await SubjectModel.findByIdAndDelete(id);
    if (!subject) {
      throw new ApiError('Subject not found', 404, ERROR_CODES.SUBJECT_NOT_FOUND);
    }
    return { deletedId: id };
  }
}

export const subjectService = new SubjectService();
