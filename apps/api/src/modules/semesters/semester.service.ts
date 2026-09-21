import mongoose from 'mongoose';

import { SemesterModel } from '../../models/semester.model.js';
import { BatchModel } from '../../models/batch.model.js';
import { TeachingAssignmentModel } from '../../models/assignment.model.js';
import { ApiError } from '../../middleware/error.middleware.js';

import { ERROR_CODES } from '@schedulai/config';
import { QueryParams } from '@schedulai/shared-types';

export class SemesterService {
  /**
   * Automatically creates/updates 4 batches for a semester.
   *
   * Example:
   * 60 students:
   * B1 = 15
   * B2 = 15
   * B3 = 15
   * B4 = 15
   *
   * 59 students:
   * B1 = 15
   * B2 = 15
   * B3 = 15
   * B4 = 14
   */
  private async syncDefaultBatches(
    semesterId: mongoose.Types.ObjectId,
    studentCount: number
  ) {
    const BATCH_COUNT = 4;

    const safeStudentCount = Math.max(1, Number(studentCount) || 1);

    const baseCount = Math.floor(safeStudentCount / BATCH_COUNT);
    const remainder = safeStudentCount % BATCH_COUNT;

    const batches = Array.from({ length: BATCH_COUNT }, (_, index) => ({
      code: `B${index + 1}`,
      studentCount:
        baseCount + (index < remainder ? 1 : 0),
    }));

    const results = [];

    for (const batch of batches) {
      const existingBatch = await BatchModel.findOne({
        semesterId,
        code: batch.code,
      });

      if (existingBatch) {
        existingBatch.studentCount = batch.studentCount;
        existingBatch.isActive = true;

        await existingBatch.save();

        results.push(existingBatch);
      } else {
        const createdBatch = await BatchModel.create({
          semesterId,
          code: batch.code,
          studentCount: batch.studentCount,
          isActive: true,
        });

        results.push(createdBatch);
      }
    }

    return results;
  }

  async getAll(params: QueryParams) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number(params.limit) || 20)
    );

    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};

    if (params.search) {
      filter.$or = [
        {
          name: {
            $regex: params.search,
            $options: 'i',
          },
        },
        {
          section: {
            $regex: params.search,
            $options: 'i',
          },
        },
        {
          academicYear: {
            $regex: params.search,
            $options: 'i',
          },
        },
      ];
    }

    if (params.departmentId) {
      filter.departmentId = params.departmentId;
    }

    if (params.status) {
      if (params.status === 'ACTIVE') {
        filter.isActive = true;
      }

      if (params.status === 'INACTIVE') {
        filter.isActive = false;
      }
    }

    const [semesters, total] = await Promise.all([
      SemesterModel.find(filter)
        .sort({
          number: 1,
          section: 1,
          createdAt: -1,
        })
        .skip(skip)
        .limit(limit)
        .populate(
          'departmentId',
          'name code'
        )
        .lean(),

      SemesterModel.countDocuments(filter),
    ]);

    const totalPages =
      Math.ceil(total / limit) || 1;

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
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(
        'Invalid semester ID',
        400,
        ERROR_CODES.BAD_REQUEST
      );
    }

    const semester = await SemesterModel.findById(id)
      .populate(
        'departmentId',
        'name code'
      )
      .lean();

    if (!semester) {
      throw new ApiError(
        'Semester not found',
        404,
        ERROR_CODES.SEMESTER_NOT_FOUND
      );
    }

    return semester;
  }

  async create(data: Record<string, unknown>) {
    const semester = await SemesterModel.create(data);

    /*
     * Automatically create:
     *
     * B1
     * B2
     * B3
     * B4
     *
     * according to semester.studentCount.
     */
    await this.syncDefaultBatches(
      semester._id,
      semester.studentCount
    );

    const createdSemester =
      await SemesterModel.findById(semester._id)
        .populate(
          'departmentId',
          'name code'
        )
        .lean();

    return createdSemester;
  }

  async update(
    id: string,
    data: Record<string, unknown>
  ) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(
        'Invalid semester ID',
        400,
        ERROR_CODES.BAD_REQUEST
      );
    }

    const semester =
      await SemesterModel.findById(id);

    if (!semester) {
      throw new ApiError(
        'Semester not found',
        404,
        ERROR_CODES.SEMESTER_NOT_FOUND
      );
    }

    Object.assign(semester, data);

    await semester.save();

    /*
     * If studentCount changes, automatically
     * rebalance B1-B4.
     *
     * Example:
     * 60 -> 4 x 15
     * 61 -> 16,15,15,15
     */
    await this.syncDefaultBatches(
      semester._id,
      semester.studentCount
    );

    const updatedSemester =
      await SemesterModel.findById(semester._id)
        .populate(
          'departmentId',
          'name code'
        )
        .lean();

    return updatedSemester;
  }

  async delete(id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(
        'Invalid semester ID',
        400,
        ERROR_CODES.BAD_REQUEST
      );
    }

    const semester =
      await SemesterModel.findById(id);

    if (!semester) {
      throw new ApiError(
        'Semester not found',
        404,
        ERROR_CODES.SEMESTER_NOT_FOUND
      );
    }

    /*
     * Remove assignments belonging to this semester
     * before removing its batches and semester.
     */
    await TeachingAssignmentModel.deleteMany({
      semesterId: semester._id,
    });

    await BatchModel.deleteMany({
      semesterId: semester._id,
    });

    await SemesterModel.findByIdAndDelete(id);

    return {
      deletedId: id,
    };
  }
}

export const semesterService =
  new SemesterService();