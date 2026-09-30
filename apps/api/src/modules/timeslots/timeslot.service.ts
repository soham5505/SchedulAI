import { TimeSlotModel } from '../../models/timeslot.model.js';
import { ApiError } from '../../middleware/error.middleware.js';
import { ERROR_CODES, DAYS_OF_WEEK, STANDARD_PERIOD_TIMES } from '@schedulai/config';
import { QueryParams, DayOfWeek } from '@schedulai/shared-types';

export class TimeSlotService {
  async getAll(params: QueryParams) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 100));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (params.day) {
      filter.day = params.day;
    }
    if (typeof params.isBreak === 'boolean') {
      filter.isBreak = params.isBreak;
    }
    if (typeof params.isActive === 'boolean') {
      filter.isActive = params.isActive;
    }

    const dayOrder: Record<DayOfWeek, number> = {
      MONDAY: 0,
      TUESDAY: 1,
      WEDNESDAY: 2,
      THURSDAY: 3,
      FRIDAY: 4,
      SATURDAY: 5,
    };

    const timeslots = await TimeSlotModel.find(filter).lean();

    // Sort chronologically by day then periodNumber
    timeslots.sort((a, b) => {
      const dayDiff = (dayOrder[a.day as DayOfWeek] ?? 99) - (dayOrder[b.day as DayOfWeek] ?? 99);
      if (dayDiff !== 0) return dayDiff;
      return a.periodNumber - b.periodNumber;
    });

    const total = timeslots.length;
    const paginated = timeslots.slice(skip, skip + limit);
    const totalPages = Math.ceil(total / limit) || 1;

    return {
      timeslots: paginated,
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
    const timeslot = await TimeSlotModel.findById(id).lean();
    if (!timeslot) {
      throw new ApiError('Time slot not found', 404, ERROR_CODES.TIMESLOT_NOT_FOUND);
    }
    return timeslot;
  }

  async create(data: Record<string, unknown>) {
    const existing = await TimeSlotModel.findOne({
      day: data.day,
      startTime: data.startTime,
      endTime: data.endTime,
    });
    if (existing) {
      throw new ApiError(`Time slot on ${data.day} (${data.startTime}-${data.endTime}) already exists`, 409, ERROR_CODES.CONFLICT);
    }

    const timeslot = await TimeSlotModel.create(data);
    return timeslot.toJSON();
  }

  async bulkGenerateStandard(days: DayOfWeek[] = DAYS_OF_WEEK) {
    const slots = [];
    const activeSlotIds = [];
    let createdCount = 0;
    for (const day of days) {
      for (const slot of STANDARD_PERIOD_TIMES) {
        const existing = await TimeSlotModel.findOne({ day, startTime: slot.startTime, endTime: slot.endTime });
        const values = {
          day,
          startTime: slot.startTime,
          endTime: slot.endTime,
          periodNumber: slot.period,
          isBreak: slot.isBreak || false,
          label: slot.label || `Period ${slot.period}`,
          isActive: true,
        };

        if (existing) {
          Object.assign(existing, values);
          await existing.save();
          slots.push(existing);
          activeSlotIds.push(existing._id);
        } else {
          const created = await TimeSlotModel.create(values);
          slots.push(created);
          activeSlotIds.push(created._id);
          createdCount++;
        }
      }
    }

    await TimeSlotModel.updateMany(
      { day: { $in: days }, _id: { $nin: activeSlotIds }, isActive: true },
      { $set: { isActive: false } }
    );

    return { createdCount, slots };
  }

  async update(id: string, data: Record<string, unknown>) {
    const timeslot = await TimeSlotModel.findById(id);
    if (!timeslot) {
      throw new ApiError('Time slot not found', 404, ERROR_CODES.TIMESLOT_NOT_FOUND);
    }

    Object.assign(timeslot, data);
    await timeslot.save();
    return timeslot.toJSON();
  }

  async delete(id: string) {
    const timeslot = await TimeSlotModel.findByIdAndDelete(id);
    if (!timeslot) {
      throw new ApiError('Time slot not found', 404, ERROR_CODES.TIMESLOT_NOT_FOUND);
    }
    return { deletedId: id };
  }
}

export const timeSlotService = new TimeSlotService();
