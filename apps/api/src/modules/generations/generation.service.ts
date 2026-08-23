import mongoose from 'mongoose';
import { GenerationModel } from '../../models/generation.model.js';
import { TimetableEntryModel } from '../../models/timetable.model.js';
import { SemesterModel } from '../../models/semester.model.js';
import { TeacherModel } from '../../models/teacher.model.js';
import { SubjectModel } from '../../models/subject.model.js';
import { ClassroomModel } from '../../models/classroom.model.js';
import { TimeSlotModel } from '../../models/timeslot.model.js';
import { TeachingAssignmentModel } from '../../models/assignment.model.js';
import { schedulerClient } from '../../utils/schedulerClient.js';
import { ApiError } from '../../middleware/error.middleware.js';
import { ERROR_CODES, DEFAULT_HARD_CONSTRAINTS, DEFAULT_SOFT_CONSTRAINTS } from '@schedulai/config';
import {
  IHardConstraints,
  ISoftConstraints,
  ISchedulerInput,
  IUser,
  QueryParams,
  DayOfWeek,
  PeriodType,
} from '@schedulai/shared-types';
import { Logger } from '../../utils/logger.js';

const logger = new Logger('GenerationService');

export interface GenerateDTO {
  name: string;
  departmentId?: string;
  academicYear?: string;
  semesterIds: string[];
  hardConstraints?: Partial<IHardConstraints>;
  softConstraints?: Partial<ISoftConstraints>;
  timeLimitSeconds?: number;
}

export class GenerationService {
  async generate(data: GenerateDTO, user: IUser) {
    logger.info(`Starting timetable generation '${data.name}' for ${data.semesterIds.length} semester(s)`);

    // 1. Fetch relevant academic data from MongoDB
    const [semesters, classrooms, timeslots, assignments] = await Promise.all([
      SemesterModel.find({ _id: { $in: data.semesterIds }, isActive: true }).lean(),
      ClassroomModel.find({ isAvailable: true }).lean(),
      TimeSlotModel.find({ isActive: true, isBreak: false }).lean(),
      TeachingAssignmentModel.find({ semesterId: { $in: data.semesterIds } })
        .populate('teacherId')
        .populate('subjectId')
        .lean(),
    ]);

    if (semesters.length === 0) {
      throw new ApiError('No active semesters found for the selected IDs', 400, ERROR_CODES.BAD_REQUEST);
    }
    if (timeslots.length === 0) {
      throw new ApiError('No active non-break time slots found. Please configure time slots first.', 400, ERROR_CODES.TIMESLOT_NOT_FOUND);
    }
    if (assignments.length === 0) {
      throw new ApiError('No teaching assignments found for the selected semester(s). Please create teaching assignments first.', 400, ERROR_CODES.ASSIGNMENT_NOT_FOUND);
    }
    if (classrooms.length === 0) {
      throw new ApiError('No available classrooms found. Please add classrooms first.', 400, ERROR_CODES.CLASSROOM_NOT_FOUND);
    }

    // Extract unique teachers and subjects from assignments
    const teacherMap = new Map<string, Record<string, unknown>>();
    const subjectMap = new Map<string, Record<string, unknown>>();

    for (const a of assignments) {
      if (a.teacherId) {
        const t = a.teacherId as unknown as Record<string, unknown>;
        teacherMap.set(String(t._id), t);
      }
      if (a.subjectId) {
        const s = a.subjectId as unknown as Record<string, unknown>;
        subjectMap.set(String(s._id), s);
      }
    }

    const teachers = Array.from(teacherMap.values());
    const subjects = Array.from(subjectMap.values());

    // Compute latest version number for these semesters
    const latestGen = await GenerationModel.findOne({
      semesterIds: { $in: data.semesterIds },
    }).sort({ version: -1 });
    const nextVersion = latestGen ? (latestGen.version || 1) + 1 : 1;

    // Create Initial Generation Record in PENDING status
    const generation = await GenerationModel.create({
      name: data.name,
      status: 'RUNNING',
      semesterIds: data.semesterIds,
      departmentId: data.departmentId || null,
      academicYear: data.academicYear || (semesters[0] ? semesters[0].academicYear : ''),
      startedAt: new Date(),
      constraints: { ...DEFAULT_HARD_CONSTRAINTS, ...(data.hardConstraints || {}) },
      preferences: { ...DEFAULT_SOFT_CONSTRAINTS, ...(data.softConstraints || {}) },
      createdBy: user._id,
      version: nextVersion,
    });

    // Format scheduler payload
    const schedulerPayload: ISchedulerInput = {
      teachers: teachers.map((t) => ({
        id: String(t._id),
        name: String(t.name || ''),
        availability: (t.availability as DayOfWeek[]) || ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
        preferredTimeSlots: ((t.preferredTimeSlots as Array<unknown>) || []).map((id) => String(id)),
        unavailableTimeSlots: ((t.unavailableTimeSlots as Array<unknown>) || []).map((id) => String(id)),
        maxClassesPerDay: Number(t.maxClassesPerDay) || 4,
        maxClassesPerWeek: Number(t.maxClassesPerWeek) || 20,
      })),
      subjects: subjects.map((s) => ({
        id: String(s._id),
        name: String(s.name || ''),
        code: String(s.code || ''),
        weeklyPeriods: Number(s.weeklyPeriods) || 4,
        lecturePeriods: s.lecturePeriods !== undefined ? Number(s.lecturePeriods) : 3,
        labPeriods: s.labPeriods !== undefined ? Number(s.labPeriods) : 1,
        isLab: Boolean(s.isLab),
      })),
      classrooms: classrooms.map((c) => ({
        id: c._id.toString(),
        name: `${c.building} - ${c.roomNumber} (${c.name})`,
        capacity: c.capacity,
        type: c.type,
        equipment: c.equipment || [],
        isLab: c.isLab || false,
        isAvailable: c.isAvailable,
      })),
      semesters: semesters.map((m) => ({
        id: m._id.toString(),
        name: `${m.name} (${m.section})`,
        studentCount: m.studentCount,
      })),
      timeslots: timeslots.map((ts) => ({
        id: ts._id.toString(),
        day: ts.day as DayOfWeek,
        startTime: ts.startTime,
        endTime: ts.endTime,
        periodNumber: ts.periodNumber,
        isBreak: ts.isBreak,
        isActive: ts.isActive,
      })),
      teachingAssignments: assignments.map((a) => {
        const tObj = a.teacherId as unknown as Record<string, unknown>;
        const sObj = a.subjectId as unknown as Record<string, unknown>;
        return {
          id: a._id.toString(),
          teacherId: String(tObj._id),
          subjectId: String(sObj._id),
          semesterId: a.semesterId.toString(),
          classroomRequirements: a.classroomRequirements || [],
          periodsPerWeek: a.periodsPerWeek,
          isLab: a.isLab || false,
        };
      }),
      hardConstraints: { ...DEFAULT_HARD_CONSTRAINTS, ...(data.hardConstraints || {}) },
      softConstraints: { ...DEFAULT_SOFT_CONSTRAINTS, ...(data.softConstraints || {}) },
      timeLimitSeconds: data.timeLimitSeconds || 60,
    };

    try {
      // Call Scheduler microservice
      const solverResult = await schedulerClient.generate(schedulerPayload);

      if (solverResult.success && solverResult.timetable.length > 0) {
        // Save Timetable Entries into MongoDB
        const entriesToInsert = solverResult.timetable.map((entry) => ({
          semesterId: new mongoose.Types.ObjectId(entry.semesterId),
          subjectId: new mongoose.Types.ObjectId(entry.subjectId),
          teacherId: new mongoose.Types.ObjectId(entry.teacherId),
          classroomId: new mongoose.Types.ObjectId(entry.classroomId),
          timeSlotId: new mongoose.Types.ObjectId(entry.timeSlotId),
          day: entry.day,
          startTime: entry.startTime,
          endTime: entry.endTime,
          periodType: entry.periodType,
          generationId: generation._id,
        }));

        await TimetableEntryModel.insertMany(entriesToInsert);

        // Update generation record to COMPLETED
        generation.status = 'COMPLETED';
        generation.completedAt = new Date();
        generation.resultCount = entriesToInsert.length;
        generation.score = solverResult.score;
        generation.violations = solverResult.violations;
        generation.statistics = solverResult.statistics;
        await generation.save();

        logger.info(`Timetable generation successful! Inserted ${entriesToInsert.length} entries. Score: ${solverResult.score}`);

        return {
          generation: generation.toJSON(),
          timetable: entriesToInsert,
          score: solverResult.score,
          statistics: solverResult.statistics,
        };
      } else {
        // Mark Generation as FAILED with diagnostic violations
        generation.status = 'FAILED';
        generation.completedAt = new Date();
        generation.errorMessage = solverResult.errorMessage || 'Scheduler could not find a feasible solution.';
        generation.violations = solverResult.violations;
        generation.statistics = solverResult.statistics || {};
        await generation.save();

        logger.warn(`Timetable generation failed: ${generation.errorMessage}`);

        return {
          generation: generation.toJSON(),
          timetable: [],
          score: 0,
          violations: solverResult.violations,
          errorMessage: generation.errorMessage,
        };
      }
    } catch (err) {
      generation.status = 'FAILED';
      generation.completedAt = new Date();
      generation.errorMessage = (err as Error).message;
      await generation.save();
      throw err;
    }
  }

  async getAll(params: QueryParams) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (params.search) {
      filter.name = { $regex: params.search, $options: 'i' };
    }
    if (params.status) {
      filter.status = params.status;
    }
    if (params.departmentId) {
      filter.departmentId = params.departmentId;
    }

    const [generations, total] = await Promise.all([
      GenerationModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('semesterIds', 'name number section academicYear')
        .populate('departmentId', 'name code')
        .populate('createdBy', 'name email role')
        .lean(),
      GenerationModel.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      generations,
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
    const generation = await GenerationModel.findById(id)
      .populate('semesterIds', 'name number section academicYear studentCount')
      .populate('departmentId', 'name code')
      .populate('createdBy', 'name email role')
      .lean();

    if (!generation) {
      throw new ApiError('Generation not found', 404, ERROR_CODES.GENERATION_NOT_FOUND);
    }

    const entries = await TimetableEntryModel.find({ generationId: id })
      .populate('semesterId', 'name number section academicYear')
      .populate('subjectId', 'name code credits isLab')
      .populate('teacherId', 'name email designation employeeId')
      .populate('classroomId', 'name building roomNumber capacity type isLab')
      .populate('timeSlotId', 'day startTime endTime periodNumber isBreak')
      .lean();

    return {
      generation,
      entries,
    };
  }

  async restoreVersion(generationId: string, user: IUser) {
    const targetGen = await GenerationModel.findById(generationId).lean();
    if (!targetGen) {
      throw new ApiError('Generation to restore not found', 404, ERROR_CODES.GENERATION_NOT_FOUND);
    }

    const entries = await TimetableEntryModel.find({ generationId }).lean();
    if (entries.length === 0) {
      throw new ApiError('Target generation has no timetable entries to restore', 400, ERROR_CODES.BAD_REQUEST);
    }

    // Compute next version
    const latestGen = await GenerationModel.findOne({
      semesterIds: { $in: targetGen.semesterIds },
    }).sort({ version: -1 });
    const nextVersion = latestGen ? (latestGen.version || 1) + 1 : 1;

    // Create a new restored Generation record
    const restoredGen = await GenerationModel.create({
      name: `${targetGen.name} (Restored from v${targetGen.version || 1})`,
      status: 'COMPLETED',
      semesterIds: targetGen.semesterIds,
      departmentId: targetGen.departmentId,
      academicYear: targetGen.academicYear,
      startedAt: new Date(),
      completedAt: new Date(),
      constraints: targetGen.constraints,
      preferences: targetGen.preferences,
      resultCount: entries.length,
      score: targetGen.score,
      violations: targetGen.violations,
      statistics: targetGen.statistics,
      createdBy: user._id,
      version: nextVersion,
    });

    // Clone entries to the new generation
    const clonedEntries = entries.map((e) => ({
      semesterId: e.semesterId,
      subjectId: e.subjectId,
      teacherId: e.teacherId,
      classroomId: e.classroomId,
      timeSlotId: e.timeSlotId,
      day: e.day,
      startTime: e.startTime,
      endTime: e.endTime,
      periodType: e.periodType,
      generationId: restoredGen._id,
    }));

    await TimetableEntryModel.insertMany(clonedEntries);

    logger.info(`Restored generation ${generationId} into new version v${nextVersion}`);

    return {
      restoredGeneration: restoredGen.toJSON(),
      entriesCount: clonedEntries.length,
    };
  }

  async delete(id: string) {
    const generation = await GenerationModel.findByIdAndDelete(id);
    if (!generation) {
      throw new ApiError('Generation not found', 404, ERROR_CODES.GENERATION_NOT_FOUND);
    }
    await TimetableEntryModel.deleteMany({ generationId: id });
    return { deletedId: id };
  }
}

export const generationService = new GenerationService();
