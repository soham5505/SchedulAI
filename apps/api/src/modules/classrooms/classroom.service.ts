import { ClassroomModel } from '../../models/classroom.model.js';
import { ApiError } from '../../middleware/error.middleware.js';
import { ERROR_CODES } from '@schedulai/config';
import { QueryParams } from '@schedulai/shared-types';

export class ClassroomService {
  async getAll(params: QueryParams) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (params.search) {
      filter.$or = [
        { name: { $regex: params.search, $options: 'i' } },
        { building: { $regex: params.search, $options: 'i' } },
        { roomNumber: { $regex: params.search, $options: 'i' } },
      ];
    }
    if (params.type) {
      filter.type = params.type;
    }
    if (typeof params.isLab === 'boolean') {
      filter.isLab = params.isLab;
    }
    if (typeof params.isAvailable === 'boolean') {
      filter.isAvailable = params.isAvailable;
    }

    const sortField = (params.sort as string) || 'name';
    const sortOrder = params.order === 'desc' ? -1 : 1;

    const [classrooms, total] = await Promise.all([
      ClassroomModel.find(filter)
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      ClassroomModel.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      classrooms,
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
    const classroom = await ClassroomModel.findById(id).lean();
    if (!classroom) {
      throw new ApiError('Classroom not found', 404, ERROR_CODES.CLASSROOM_NOT_FOUND);
    }
    return classroom;
  }

  async create(data: Record<string, unknown>) {
    const existing = await ClassroomModel.findOne({
      building: data.building,
      roomNumber: data.roomNumber,
    });
    if (existing) {
      throw new ApiError(`Classroom ${data.building} - ${data.roomNumber} already exists`, 409, ERROR_CODES.CONFLICT);
    }

    const classroom = await ClassroomModel.create(data);
    return classroom.toJSON();
  }

  async update(id: string, data: Record<string, unknown>) {
    const classroom = await ClassroomModel.findById(id);
    if (!classroom) {
      throw new ApiError('Classroom not found', 404, ERROR_CODES.CLASSROOM_NOT_FOUND);
    }

    if (
      (data.building && data.building !== classroom.building) ||
      (data.roomNumber && data.roomNumber !== classroom.roomNumber)
    ) {
      const bldg = data.building || classroom.building;
      const roomNum = data.roomNumber || classroom.roomNumber;
      const duplicate = await ClassroomModel.findOne({
        building: bldg,
        roomNumber: roomNum,
        _id: { $ne: id },
      });
      if (duplicate) {
        throw new ApiError(`Classroom ${bldg} - ${roomNum} already exists`, 409, ERROR_CODES.CONFLICT);
      }
    }

    Object.assign(classroom, data);
    await classroom.save();
    return classroom.toJSON();
  }

  async delete(id: string) {
    const classroom = await ClassroomModel.findByIdAndDelete(id);
    if (!classroom) {
      throw new ApiError('Classroom not found', 404, ERROR_CODES.CLASSROOM_NOT_FOUND);
    }
    return { deletedId: id };
  }
}

export const classroomService = new ClassroomService();
