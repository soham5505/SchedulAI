import mongoose from 'mongoose';
import { TeachingAssignmentModel } from '../../models/assignment.model.js';
import { BatchModel } from '../../models/batch.model.js';
import { ApiError } from '../../middleware/error.middleware.js';
import { ERROR_CODES } from '@schedulai/config';
import { QueryParams } from '@schedulai/shared-types';

export class AssignmentService {
  /**
   * Validate that a batch exists and belongs to the selected semester.
   *
   * Important:
   * - batchId comes from the frontend as a string.
   * - semesterId also comes from the frontend as a string.
   * - MongoDB stores both as ObjectId.
   */
  private async validateBatch(semesterId: unknown, batchId: unknown) {
    // Whole-class assignment: no batch is required.
    if (batchId === undefined || batchId === null || batchId === '') {
      return;
    }

    if (!semesterId) {
      throw new ApiError(
        'Semester is required when a batch is selected',
        400,
        ERROR_CODES.BAD_REQUEST
      );
    }

    const batchIdString = String(batchId);
    const semesterIdString = String(semesterId);

    // Validate ObjectId format before querying MongoDB.
    if (!mongoose.Types.ObjectId.isValid(batchIdString)) {
      throw new ApiError(
        `Invalid batch ID: ${batchIdString}`,
        400,
        ERROR_CODES.BAD_REQUEST
      );
    }

    if (!mongoose.Types.ObjectId.isValid(semesterIdString)) {
      throw new ApiError(
        `Invalid semester ID: ${semesterIdString}`,
        400,
        ERROR_CODES.BAD_REQUEST
      );
    }

    const batchObjectId = new mongoose.Types.ObjectId(batchIdString);
    const semesterObjectId = new mongoose.Types.ObjectId(semesterIdString);

    // First find the batch using its actual _id.
    const batch = await BatchModel.findById(batchObjectId).lean();

    if (!batch) {
      throw new ApiError(
        `Batch not found: ${batchIdString}`,
        404,
        ERROR_CODES.RESOURCE_NOT_FOUND
      );
    }

    // Explicitly compare the semester IDs.
    const batchSemesterId = String(batch.semesterId);

    if (batchSemesterId !== semesterIdString) {
      throw new ApiError(
        `Batch ${batch.code} belongs to semester ${batchSemesterId}, not ${semesterIdString}`,
        400,
        ERROR_CODES.BAD_REQUEST
      );
    }

    // Keep the ObjectId conversion here so the values are known-good.
    void semesterObjectId;
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
          populate: {
            path: 'departmentId',
            select: 'name code',
          },
        })
        .populate({
          path: 'subjectId',
          select: 'name code credits weeklyPeriods isLab departmentId',
          populate: {
            path: 'departmentId',
            select: 'name code',
          },
        })
        .populate({
          path: 'semesterId',
          select: 'name number section academicYear studentCount departmentId',
          populate: {
            path: 'departmentId',
            select: 'name code',
          },
        })
        .populate(
          'batchId',
          'code studentCount isActive semesterId'
        )
        .populate(
          'classroomId',
          'name building roomNumber capacity type isLab'
        )
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
      .populate(
        'teacherId',
        'name email employeeId designation'
      )
      .populate(
        'subjectId',
        'name code credits weeklyPeriods isLab'
      )
      .populate(
        'semesterId',
        'name number section academicYear studentCount'
      )
      .populate(
        'batchId',
        'code studentCount isActive semesterId'
      )
      .populate(
        'classroomId',
        'name building roomNumber capacity type isLab'
      )
      .lean();

    if (!assignment) {
      throw new ApiError(
        'Teaching assignment not found',
        404,
        ERROR_CODES.ASSIGNMENT_NOT_FOUND
      );
    }

    return assignment;
  }

  async create(data: Record<string, unknown>) {
    await this.validateBatch(
      data.semesterId,
      data.batchId
    );

    const batchId = data.batchId ?? null;

    const existing = await TeachingAssignmentModel.findOne({
      teacherId: data.teacherId,
      subjectId: data.subjectId,
      semesterId: data.semesterId,
      batchId,
    });

    if (existing) {
      throw new ApiError(
        'This teacher is already assigned to this subject and semester',
        409,
        ERROR_CODES.CONFLICT
      );
    }

    const assignment =
      await TeachingAssignmentModel.create(data);

    return assignment.toJSON();
  }

  async update(
    id: string,
    data: Record<string, unknown>
  ) {
    const assignment =
      await TeachingAssignmentModel.findById(id);

    if (!assignment) {
      throw new ApiError(
        'Teaching assignment not found',
        404,
        ERROR_CODES.ASSIGNMENT_NOT_FOUND
      );
    }

    const nextSemesterId =
      data.semesterId ?? assignment.semesterId;

    const nextBatchId =
      data.batchId !== undefined
        ? data.batchId
        : assignment.batchId;

    await this.validateBatch(
      nextSemesterId,
      nextBatchId
    );

    if (
      data.teacherId !== undefined ||
      data.subjectId !== undefined ||
      data.semesterId !== undefined ||
      data.batchId !== undefined
    ) {
      const duplicate =
        await TeachingAssignmentModel.findOne({
          _id: { $ne: id },
          teacherId:
            data.teacherId ?? assignment.teacherId,
          subjectId:
            data.subjectId ?? assignment.subjectId,
          semesterId: nextSemesterId,
          batchId: nextBatchId ?? null,
        });

      if (duplicate) {
        throw new ApiError(
          'This teacher is already assigned to this subject, semester, and batch',
          409,
          ERROR_CODES.CONFLICT
        );
      }
    }

    Object.assign(assignment, data);

    await assignment.save();

    return assignment.toJSON();
  }

  async delete(id: string) {
    const assignment =
      await TeachingAssignmentModel.findByIdAndDelete(id);

    if (!assignment) {
      throw new ApiError(
        'Teaching assignment not found',
        404,
        ERROR_CODES.ASSIGNMENT_NOT_FOUND
      );
    }

    return {
      deletedId: id,
    };
  }
}

export const assignmentService =
  new AssignmentService();