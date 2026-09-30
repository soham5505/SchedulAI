import mongoose from 'mongoose';
import { RoomReservationModel } from '../../models/roomReservation.model.js';
import { ClassroomModel } from '../../models/classroom.model.js';
import { DepartmentModel } from '../../models/department.model.js';
import { ApiError } from '../../middleware/error.middleware.js';
import { ERROR_CODES } from '@schedulai/config';

export class RoomReservationService {
  /**
   * Check whether a proposed reservation overlaps any existing active
   * reservation on the same classroom + day.  Uses half-open interval
   * semantics:  [startPeriod, endPeriod] is inclusive on both ends.
   * Two intervals overlap when: existingStart <= newEnd AND newStart <= existingEnd
   */
  private async checkOverlap(
    classroomId: string,
    dayOfWeek: string,
    startPeriod: number,
    endPeriod: number,
    excludeId?: string
  ) {
    const filter: Record<string, unknown> = {
      classroomId: new mongoose.Types.ObjectId(classroomId),
      dayOfWeek,
      isActive: true,
      // Overlap condition: existing.startPeriod <= newEnd AND existing.endPeriod >= newStart
      startPeriod: { $lte: endPeriod },
      endPeriod: { $gte: startPeriod },
    };

    if (excludeId) {
      filter._id = { $ne: new mongoose.Types.ObjectId(excludeId) };
    }

    const conflicting = await RoomReservationModel.findOne(filter)
      .populate('classroomId', 'name building roomNumber')
      .populate('departmentId', 'name code')
      .lean();

    return conflicting;
  }

  async getAll(params: Record<string, unknown>) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 50));
    const filter: Record<string, unknown> = {};

    if (params.classroomId) {
      filter.classroomId = new mongoose.Types.ObjectId(String(params.classroomId));
    }
    if (params.departmentId) {
      filter.departmentId = new mongoose.Types.ObjectId(String(params.departmentId));
    }
    if (params.dayOfWeek) {
      filter.dayOfWeek = params.dayOfWeek;
    }
    if (params.search) {
      filter.reason = { $regex: params.search, $options: 'i' };
    }
    if (typeof params.isActive === 'boolean') {
      filter.isActive = params.isActive;
    }

    const sortField = (params.sort as string) || 'dayOfWeek';
    const sortOrder = params.order === 'desc' ? -1 : 1;
    const skip = (page - 1) * limit;

    const [reservations, total] = await Promise.all([
      RoomReservationModel.find(filter)
        .sort({ [sortField]: sortOrder, startPeriod: 1 })
        .skip(skip)
        .limit(limit)
        .populate('classroomId', 'name building roomNumber capacity type isLab')
        .populate('departmentId', 'name code')
        .lean(),
      RoomReservationModel.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;
    return {
      reservations,
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
    const reservation = await RoomReservationModel.findById(id)
      .populate('classroomId', 'name building roomNumber capacity type isLab')
      .populate('departmentId', 'name code')
      .lean();
    if (!reservation) {
      throw new ApiError('Room reservation not found', 404, ERROR_CODES.RESERVATION_NOT_FOUND);
    }
    return reservation;
  }

  async create(data: Record<string, unknown>) {
    // Validate references
    const [classroom, department] = await Promise.all([
      ClassroomModel.exists({ _id: data.classroomId }),
      DepartmentModel.exists({ _id: data.departmentId }),
    ]);
    if (!classroom) {
      throw new ApiError('Classroom not found', 404, ERROR_CODES.CLASSROOM_NOT_FOUND);
    }
    if (!department) {
      throw new ApiError('Department not found', 404, ERROR_CODES.DEPARTMENT_NOT_FOUND);
    }

    // Check overlap
    const overlap = await this.checkOverlap(
      String(data.classroomId),
      String(data.dayOfWeek),
      Number(data.startPeriod),
      Number(data.endPeriod)
    );

    if (overlap) {
      const classroomDoc = overlap.classroomId as unknown as { name?: string } | null;
      const deptDoc = overlap.departmentId as unknown as { name?: string } | null;
      const classroomName = classroomDoc?.name || 'Unknown';
      const deptName = deptDoc?.name || 'Unknown';
      throw new ApiError(
        `${classroomName} is already reserved on ${data.dayOfWeek} during Period ${overlap.startPeriod}-${overlap.endPeriod} by ${deptName}.`,
        409,
        ERROR_CODES.RESERVATION_OVERLAP,
        {
          existingReservation: {
            id: String(overlap._id),
            classroomId: String(data.classroomId),
            dayOfWeek: overlap.dayOfWeek,
            startPeriod: overlap.startPeriod,
            endPeriod: overlap.endPeriod,
          },
        }
      );
    }

    const reservation = await RoomReservationModel.create(data);
    return reservation.toJSON();
  }

  async update(id: string, data: Record<string, unknown>) {
    const reservation = await RoomReservationModel.findById(id);
    if (!reservation) {
      throw new ApiError('Room reservation not found', 404, ERROR_CODES.RESERVATION_NOT_FOUND);
    }

    // If any scheduling-relevant fields change, check overlap
    const classroomId = data.classroomId ? String(data.classroomId) : reservation.classroomId.toString();
    const dayOfWeek = (data.dayOfWeek as string) || reservation.dayOfWeek;
    const startPeriod = data.startPeriod !== undefined ? Number(data.startPeriod) : reservation.startPeriod;
    const endPeriod = data.endPeriod !== undefined ? Number(data.endPeriod) : reservation.endPeriod;

    if (endPeriod < startPeriod) {
      throw new ApiError('End period must be >= start period', 400, ERROR_CODES.BAD_REQUEST);
    }

    const overlap = await this.checkOverlap(classroomId, dayOfWeek, startPeriod, endPeriod, id);
    if (overlap) {
      const classroomDoc = overlap.classroomId as unknown as { name?: string } | null;
      const deptDoc = overlap.departmentId as unknown as { name?: string } | null;
      const classroomName = classroomDoc?.name || 'Unknown';
      const deptName = deptDoc?.name || 'Unknown';
      throw new ApiError(
        `${classroomName} is already reserved on ${dayOfWeek} during Period ${overlap.startPeriod}-${overlap.endPeriod} by ${deptName}.`,
        409,
        ERROR_CODES.RESERVATION_OVERLAP
      );
    }

    // Validate references if they changed
    if (data.classroomId) {
      const classroom = await ClassroomModel.exists({ _id: data.classroomId });
      if (!classroom) throw new ApiError('Classroom not found', 404, ERROR_CODES.CLASSROOM_NOT_FOUND);
    }
    if (data.departmentId) {
      const department = await DepartmentModel.exists({ _id: data.departmentId });
      if (!department) throw new ApiError('Department not found', 404, ERROR_CODES.DEPARTMENT_NOT_FOUND);
    }

    Object.assign(reservation, data);
    await reservation.save();
    return reservation.toJSON();
  }

  async delete(id: string) {
    const reservation = await RoomReservationModel.findById(id);
    if (!reservation) {
      throw new ApiError('Room reservation not found', 404, ERROR_CODES.RESERVATION_NOT_FOUND);
    }
    await reservation.deleteOne();
    return { deletedId: id };
  }
}

export const roomReservationService = new RoomReservationService();
