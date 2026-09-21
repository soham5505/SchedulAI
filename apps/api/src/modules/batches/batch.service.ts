import mongoose from 'mongoose';
import { BatchModel } from '../../models/batch.model.js';
import { SemesterModel } from '../../models/semester.model.js';
import { TeachingAssignmentModel } from '../../models/assignment.model.js';
import { TimetableEntryModel } from '../../models/timetable.model.js';
import { ApiError } from '../../middleware/error.middleware.js';
import { ERROR_CODES } from '@schedulai/config';

export class BatchService {
  async getAll(params: Record<string, unknown>) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const filter: Record<string, unknown> = {};

    if (params.semesterId) {
      const semesterId = String(params.semesterId);
      if (!mongoose.isValidObjectId(semesterId)) {
        throw new ApiError('Invalid semesterId', 400, ERROR_CODES.BAD_REQUEST);
      }
      filter.semesterId = new mongoose.Types.ObjectId(semesterId);
    }
    if (params.search) filter.code = { $regex: params.search, $options: 'i' };
    if (typeof params.isActive === 'boolean') filter.isActive = params.isActive;

    const sortField = (params.sort as string) || 'code';
    const sortOrder = params.order === 'desc' ? -1 : 1;
    const skip = (page - 1) * limit;

    const [batches, total] = await Promise.all([
      BatchModel.find(filter)
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limit)
        .populate('semesterId', 'name number section academicYear')
        .lean(),
      BatchModel.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;
    return {
      batches,
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
    const batch = await BatchModel.findById(id)
      .populate('semesterId', 'name number section academicYear')
      .lean();
    if (!batch) throw new ApiError('Batch not found', 404, ERROR_CODES.RESOURCE_NOT_FOUND);
    return batch;
  }

  async create(data: Record<string, unknown>) {
    const semester = await SemesterModel.exists({ _id: data.semesterId });
    if (!semester) throw new ApiError('Semester not found', 404, ERROR_CODES.SEMESTER_NOT_FOUND);

    const code = String(data.code).toUpperCase();
    const existing = await BatchModel.exists({ semesterId: data.semesterId, code });
    if (existing) throw new ApiError('A batch with this code already exists in the semester', 409, ERROR_CODES.CONFLICT);

    const batch = await BatchModel.create({ ...data, code });
    return batch.toJSON();
  }

  async update(id: string, data: Record<string, unknown>) {
    const batch = await BatchModel.findById(id);
    if (!batch) throw new ApiError('Batch not found', 404, ERROR_CODES.RESOURCE_NOT_FOUND);

    if (data.code !== undefined) {
      const code = String(data.code).toUpperCase();
      const duplicate = await BatchModel.exists({ semesterId: batch.semesterId, code, _id: { $ne: id } });
      if (duplicate) throw new ApiError('A batch with this code already exists in the semester', 409, ERROR_CODES.CONFLICT);
      data.code = code;
    }

    Object.assign(batch, data);
    await batch.save();
    return batch.toJSON();
  }

  async delete(id: string) {
    const batch = await BatchModel.findById(id);
    if (!batch) throw new ApiError('Batch not found', 404, ERROR_CODES.RESOURCE_NOT_FOUND);

    const batchReference = { $in: [batch._id] };
    const [assignmentReference, timetableReference] = await Promise.all([
      TeachingAssignmentModel.collection.findOne({ $or: [{ batchId: batch._id }, { batchIds: batchReference }] }),
      TimetableEntryModel.collection.findOne({ $or: [{ batchId: batch._id }, { batchIds: batchReference }] }),
    ]);
    if (assignmentReference || timetableReference) {
      throw new ApiError('Batch cannot be deleted while it is referenced by assignments or timetable entries', 409, ERROR_CODES.CONFLICT);
    }

    await batch.deleteOne();
    return { deletedId: id };
  }
}

export const batchService = new BatchService();