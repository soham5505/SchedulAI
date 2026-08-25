import { TeachingAssignmentModel } from '../../models/assignment.model.js';
import { BatchModel } from '../../models/batch.model.js';
import { ApiError } from '../../middleware/error.middleware.js';
import { ERROR_CODES } from '@schedulai/config';
import { QueryParams } from '@schedulai/shared-types';

export class AssignmentService {
  private async validateBatch(semesterId: unknown, batchId: unknown) {
    if (batchId === undefined || batchId === null) return;

    const batch = await BatchModel.findOne({ _id: batchId, semesterId }).lean();
    if (!batch) {
      throw new ApiError('Batch does not exist or does not belong to this semester', 400, ERROR_CODES.BAD_REQUEST);
    }
  }

  async getAll(params: QueryParams) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 50));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (params.teacherId) {
      filter.teacherId = params.teacherId;
    }
    if (params.subjectId) {
      filter.subjectId = params.subjectId;
    }
    if (params.semesterId) {
      filter.semesterId = params.semesterId;
    }

    const [assignments, total] = await Promise.all([
      TeachingAssignmentModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({
          path: 'teacherId',
          select: 'name email employeeId designation departmentId',
          populate: { path: 'departmentId', select: 'name code' },
        })
        .populate({
          path: 'subjectId',
          select: 'name code credits weeklyPeriods isLab departmentId',
          populate: { path: 'departmentId', select: 'name code' },
        })
        .populate({
          path: 'semesterId',
          select: 'name number section academicYear studentCount departmentId',
          populate: { path: 'departmentId', select: 'name code' },
        })
        .populate('batchId', 'code studentCount isActive semesterId')
        .populate('classroomId', 'name building roomNumber capacity type isLab')
        .lean(),
      TeachingAssignmentModel.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      assignments,
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
    const assignment = await TeachingAssignmentModel.findById(id)
      .populate('teacherId', 'name email employeeId designation')
      .populate('subjectId', 'name code credits weeklyPeriods isLab')
      .populate('semesterId', 'name number section academicYear studentCount')
      .populate('batchId', 'code studentCount isActive semesterId')
      .populate('classroomId', 'name building roomNumber capacity type isLab')
      .lean();
    if (!assignment) {
      throw new ApiError('Teaching assignment not found', 404, ERROR_CODES.ASSIGNMENT_NOT_FOUND);
    }
    return assignment;
  }

  async create(data: Record<string, unknown>) {
    await this.validateBatch(data.semesterId, data.batchId);
    const existing = await TeachingAssignmentModel.findOne({
      teacherId: data.teacherId,
      subjectId: data.subjectId,
      semesterId: data.semesterId,
    });
    if (existing) {
      throw new ApiError('This teacher is already assigned to this subject and semester', 409, ERROR_CODES.CONFLICT);
    }

    const assignment = await TeachingAssignmentModel.create(data);
    return assignment.toJSON();
  }

  async update(id: string, data: Record<string, unknown>) {
    const assignment = await TeachingAssignmentModel.findById(id);
    if (!assignment) {
      throw new ApiError('Teaching assignment not found', 404, ERROR_CODES.ASSIGNMENT_NOT_FOUND);
    }

    await this.validateBatch(assignment.semesterId, data.batchId);

    Object.assign(assignment, data);
    await assignment.save();
    return assignment.toJSON();
  }

  async delete(id: string) {
    const assignment = await TeachingAssignmentModel.findByIdAndDelete(id);
    if (!assignment) {
      throw new ApiError('Teaching assignment not found', 404, ERROR_CODES.ASSIGNMENT_NOT_FOUND);
    }
    return { deletedId: id };
  }
}

export const assignmentService = new AssignmentService();
