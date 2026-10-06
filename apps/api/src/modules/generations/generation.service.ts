import mongoose from 'mongoose';
import { GenerationModel } from '../../models/generation.model.js';
import { TimetableEntryModel } from '../../models/timetable.model.js';
import { SemesterModel } from '../../models/semester.model.js';
import { TeacherModel } from '../../models/teacher.model.js';
import { SubjectModel } from '../../models/subject.model.js';
import { ClassroomModel } from '../../models/classroom.model.js';
import { TimeSlotModel } from '../../models/timeslot.model.js';
import { TeachingAssignmentModel } from '../../models/assignment.model.js';
import { BatchModel } from '../../models/batch.model.js';
import { RoomReservationModel } from '../../models/roomReservation.model.js';
import { timeSlotService } from '../timeslots/timeslot.service.js';
import { schedulerClient } from '../../utils/schedulerClient.js';
import { ApiError } from '../../middleware/error.middleware.js';
import { ERROR_CODES, DEFAULT_HARD_CONSTRAINTS, DEFAULT_SOFT_CONSTRAINTS, DAYS_OF_WEEK, STANDARD_PERIOD_TIMES } from '@schedulai/config';
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
import { preFlightValidator, PreFlightContext } from './pre-flight-validator.js';

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
  private async ensureReferenceTimeSlots(timeslots: Array<Record<string, any>>): Promise<Array<Record<string, any>>> {
    const teachingTimes = STANDARD_PERIOD_TIMES.filter((slot) => !slot.isBreak);
    const expected = new Set(
      DAYS_OF_WEEK.flatMap((day) => teachingTimes.map((slot) => `${day}|${slot.period}|${slot.startTime}|${slot.endTime}`))
    );
    const actual = timeslots.map((slot) => `${slot.day}|${slot.periodNumber}|${slot.startTime}|${slot.endTime}`);
    const isMatching = actual.length === expected.size && !actual.some((slot) => !expected.has(slot)) && new Set(actual).size === actual.length;

    if (!isMatching) {
      logger.info('Active teaching time slots do not match the fixed Monday-Saturday reference schedule. Auto-repairing with standard reference schedule...');
      await timeSlotService.bulkGenerateStandard(DAYS_OF_WEEK);
      const freshSlots = await TimeSlotModel.find({ isActive: true, isBreak: false }).lean();
      logger.info(`Reference schedule auto-applied: ${freshSlots.length} active teaching slots ready.`);
      return freshSlots as Array<Record<string, any>>;
    }

    return timeslots;
  }

  private validateAssignmentReferences(
    assignments: Array<Record<string, any>>,
    semesterIds: Set<string>,
    batchIds: Set<string> = new Set(),
    classroomIds: Set<string> = new Set()
  ) {
    const invalid: Array<{ assignmentId: string; missing: string; detail: string; metadata: Record<string, unknown> }> = [];

    for (const assignment of assignments) {
      const assignmentId = assignment?._id ? String(assignment._id) : 'unknown';
      const semesterId = assignment?.semesterId ? String(assignment.semesterId) : '';
      const teacher = assignment?.teacherId as Record<string, unknown> | null | undefined;
      const subject = assignment?.subjectId as Record<string, unknown> | null | undefined;
      const batchId = assignment?.batchId ? String(assignment.batchId) : null;
      const classroom = assignment?.classroomId as Record<string, unknown> | null | undefined;
      const classroomId = assignment?.classroomId
        ? String(classroom?._id ?? assignment.classroomId)
        : null;

      if (!semesterId || !semesterIds.has(semesterId)) {
        invalid.push({
          assignmentId,
          missing: 'semester',
          detail: `Generation blocked: Assignment ${assignmentId} references a missing semester.`,
          metadata: { assignmentId, semesterId: semesterId || 'missing', subject: subject?.name || subject?.code || 'unknown' },
        });
      }

      if (!teacher || !teacher._id) {
        invalid.push({
          assignmentId,
          missing: 'teacher',
          detail: `Generation blocked: Assignment ${assignmentId} references a missing teacher.`,
          metadata: { assignmentId, teacherId: teacher ? String(teacher._id ?? 'missing') : 'missing', subject: subject?.name || subject?.code || 'unknown', semester: semesterId || 'missing' },
        });
      }

      if (!subject || !subject._id) {
        invalid.push({
          assignmentId,
          missing: 'subject',
          detail: `Generation blocked: Assignment ${assignmentId} references a missing subject.`,
          metadata: { assignmentId, subjectId: subject ? String(subject._id ?? 'missing') : 'missing', semester: semesterId || 'missing' },
        });
      }

      if (batchId && !batchIds.has(batchId)) {
        invalid.push({
          assignmentId,
          missing: 'batch',
          detail: `Generation blocked: Assignment ${assignmentId} references a missing batch.`,
          metadata: { assignmentId, batchId, semester: semesterId || 'missing' },
        });
      }

      if (classroomId && (!classroom || !classroom._id || !classroomIds.has(classroomId))) {
        invalid.push({
          assignmentId,
          missing: 'classroom',
          detail: `Generation blocked: Assignment ${assignmentId} references a missing classroom.`,
          metadata: { assignmentId, classroomId, semester: semesterId || 'missing' },
        });
      }
    }

    if (invalid.length > 0) {
      const unique = invalid.filter(
        (item, index, list) => list.findIndex((candidate) => candidate.assignmentId === item.assignmentId && candidate.missing === item.missing) === index
      );

      const first = unique[0];

      throw new ApiError(
        first.detail,
        400,
        ERROR_CODES.BAD_REQUEST,
        {
          type: 'INVALID_ASSIGNMENT_REFERENCE',
          invalidAssignments: unique.map((item) => ({
            assignmentId: item.assignmentId,
            missing: item.missing,
            detail: item.detail,
            ...item.metadata,
          })),
        }
      );
    }
  }

  private sanitizeAssignmentsForScheduler(assignments: Array<Record<string, any>>) {
    const seen = new Set<string>();
    const sanitized = assignments
      .map((a) => {
        const teacher = a.teacherId as Record<string, unknown> | null | undefined;
        const subject = a.subjectId as Record<string, unknown> | null | undefined;

        if (!teacher || !subject || !teacher._id || !subject._id) {
          logger.warn(
            `Skipping assignment ${String(a._id ?? 'unknown')} because teacher/subject reference is missing: teacher=${teacher ? String(teacher._id ?? 'missing') : 'null'}, subject=${subject ? String(subject._id ?? 'missing') : 'null'}`
          );
          return null;
        }

        const classroomIdRaw = a.classroomId as Record<string, unknown> | string | null | undefined;
        const classroomIdStr = classroomIdRaw && typeof classroomIdRaw === 'object' && '_id' in classroomIdRaw
          ? String(classroomIdRaw._id)
          : (classroomIdRaw ? String(classroomIdRaw) : undefined);

        const batchIdRaw = a.batchId as Record<string, unknown> | string | null | undefined;
        const batchIdStr = batchIdRaw && typeof batchIdRaw === 'object' && '_id' in batchIdRaw
          ? String(batchIdRaw._id)
          : (batchIdRaw ? String(batchIdRaw) : undefined);

        const record = {
          id: a._id?.toString?.() ?? String(a._id ?? ''),
          teacherId: String(teacher._id),
          subjectId: String(subject._id),
          semesterId: a.semesterId?.toString?.() ?? String(a.semesterId),
          ...(batchIdStr ? { batchId: batchIdStr } : {}),
          ...(classroomIdStr ? { classroomId: classroomIdStr } : {}),
          classroomRequirements: a.classroomRequirements || [],
          periodsPerWeek: a.periodsPerWeek,
          isLab: Boolean(a.isLab || subject.isLab),
          key: `${String(teacher._id)}|${String(subject._id)}|${a.semesterId?.toString?.() ?? String(a.semesterId)}|${batchIdStr ?? 'ALL'}`,
        };

        return record;
      })
      .filter((a): a is NonNullable<typeof a> => a !== null)
      .filter((a) => {
        if (seen.has(a.key)) {
          logger.warn(`Deduplication: Skipping duplicate assignment ${a.id} (teacher: ${a.teacherId}, subject: ${a.subjectId}, semester: ${a.semesterId})`);
          return false;
        }
        seen.add(a.key);
        return true;
      })
      .map(({ key, ...rest }) => rest);

    return sanitized;
  }

  async generate(data: GenerateDTO, user: IUser) {
    logger.info(`Starting timetable generation '${data.name}' for ${data.semesterIds.length} semester(s)`);
    logger.info(`Semester IDs received: ${data.semesterIds.join(', ')}`);

    // Convert string IDs to MongoDB ObjectIds
    const semesterObjectIds = data.semesterIds.map((id) =>
      typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id
    );

    // 1. Fetch relevant academic data from MongoDB
    const [semesters, classrooms, timeslots, assignments, batches, roomReservations] = await Promise.all([
      SemesterModel.find({ _id: { $in: semesterObjectIds }, isActive: true }).lean(),
      ClassroomModel.find({ isAvailable: true }).lean(),
      TimeSlotModel.find({ isActive: true, isBreak: false }).lean(),
      TeachingAssignmentModel.find({ semesterId: { $in: semesterObjectIds } })
        .populate('teacherId')
        .populate('subjectId')
        .populate('classroomId')
        .lean(),
      BatchModel.find({ semesterId: { $in: semesterObjectIds }, isActive: true }).lean(),
      RoomReservationModel.find({ isActive: true }).lean(),
    ]);

    const semesterIdSet = new Set(semesters.map((semester) => String(semester._id)));
    const batchIdSet = new Set(batches.map((batch) => String(batch._id)));
    const classroomIdSet = new Set(classrooms.map((classroom) => String(classroom._id)));

    this.validateAssignmentReferences(assignments as Array<Record<string, any>>, semesterIdSet, batchIdSet, classroomIdSet);

    logger.info(`Found ${semesters.length} active semesters`);
    logger.info(`Found ${assignments.length} teaching assignments`);

    if (semesters.length === 0) {
      throw new ApiError('No active semesters found for the selected IDs', 400, ERROR_CODES.BAD_REQUEST);
    }
    const activeTimeslots = await this.ensureReferenceTimeSlots(timeslots as Array<Record<string, any>>);
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

    const teacherPeriods = new Map<string, number>();
    for (const assignment of assignments) {
      const teacher = assignment.teacherId as unknown as Record<string, unknown>;
      const teacherId = String(teacher._id);
      teacherPeriods.set(
        teacherId,
        (teacherPeriods.get(teacherId) || 0) + Number(assignment.periodsPerWeek || 0)
      );
    }

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
      constraints: DEFAULT_HARD_CONSTRAINTS,
      preferences: { ...DEFAULT_SOFT_CONSTRAINTS, ...(data.softConstraints || {}) },
      createdBy: user._id,
      version: nextVersion,
    });

    // ── Pre-flight data-integrity check ────────────────────────────────────
    // Build context from the data we already fetched and run the validator
    // BEFORE constructing the scheduler payload.  This catches stale teacher
    // or classroom references early with a clear diagnostic message, instead
    // of forwarding corrupt data to the solver which would just say "INFEASIBLE".
    {
      const validTeacherIds = new Set(
        (await TeacherModel.find({}, '_id').lean()).map((t) => t._id.toString())
      );
      const validSubjectIds = new Set(
        Array.from(subjectMap.keys())
      );
      const availableClassroomIds = new Set(
        classrooms.map((c) => c._id.toString())
      );

      // Build semesterId -> total batch students map
      const semesterBatchStudentSum = new Map<string, number>();
      const invalidBatchCountSemesters = new Set<string>();
      const batchStudentCountMap = new Map<string, number>();
      for (const b of batches) {
        const sid = b.semesterId.toString();
        const studentCount = Number(b.studentCount);
        if (!Number.isFinite(studentCount) || studentCount <= 0) {
          invalidBatchCountSemesters.add(sid);
          continue;
        }
        batchStudentCountMap.set(b._id.toString(), studentCount);
        semesterBatchStudentSum.set(sid, (semesterBatchStudentSum.get(sid) ?? 0) + studentCount);
      }
      for (const semesterId of invalidBatchCountSemesters) {
        semesterBatchStudentSum.set(semesterId, 0);
      }

      // Max capacity of any available non-lab lecture room
      const maxLectureRoomCapacity = classrooms
        .filter((c) => !c.isLab)
        .reduce((max, c) => Math.max(max, c.capacity), 0);

      const classroomCapacityMap = new Map<string, number>(
        classrooms.map((c) => [c._id.toString(), c.capacity])
      );

      const preFlightCtx: PreFlightContext = {
        assignments: assignments as Array<Record<string, unknown>>,
        validTeacherIds,
        validSubjectIds,
        validSemesterIds: semesterIdSet,
        validBatchIds: batchIdSet,
        batchSemesterMap: new Map(batches.map((batch) => [batch._id.toString(), batch.semesterId.toString()])),
        batchCodeMap: new Map(batches.map((batch) => [batch._id.toString(), batch.code])),
        availableClassroomIds,
        classroomIsLabMap: new Map(classrooms.map((classroom) => [classroom._id.toString(), Boolean(classroom.isLab)])),
        classroomTypeMap: new Map(classrooms.map((classroom) => [classroom._id.toString(), String(classroom.type)])),
        classroomEquipmentMap: new Map(classrooms.map((classroom) => [classroom._id.toString(), classroom.equipment || []])),
        semesterBatchStudentSum,
        semesterStudentCountMap: new Map(semesters.map((semester) => [
          semester._id.toString(),
          Number.isFinite(Number(semester.studentCount)) && Number(semester.studentCount) > 0
            ? Number(semester.studentCount)
            : 0,
        ])),
        batchStudentCountMap,
        maxLectureRoomCapacity,
        maxLabRoomCapacity: classrooms
          .filter((classroom) => classroom.isLab)
          .reduce((max, classroom) => Math.max(max, Number(classroom.capacity) || 0), 0),
        classroomCapacityMap,
        enforceClassroomCapacity: true,
      };

      const preFlightResult = preFlightValidator.validate(preFlightCtx);

      if (preFlightResult.warnings.length > 0) {
        logger.warn(
          `Pre-flight warnings (${preFlightResult.warnings.length}): ` +
          preFlightResult.warnings.map((w) => `[${w.assignmentId}] ${w.problem}`).join(' | ')
        );
      }

      if (!preFlightResult.ok) {
        const report = preFlightValidator.formatReport(preFlightResult);
        logger.error('Pre-flight check FAILED — aborting generation');
        logger.error(report);

        // Mark generation as FAILED with the diagnostic report
        generation.status = 'FAILED';
        generation.completedAt = new Date();
        generation.errorMessage =
          `DATA INTEGRITY ERROR: ${preFlightResult.errors.length} assignment(s) have stale or invalid references. ` +
          preFlightResult.errors.map((e) => `[${e.assignmentId}] ${e.field}: ${e.problem}`).join(' | ');
        generation.violations = preFlightResult.errors.map((e) => ({
          type: 'DATA_INTEGRITY_ERROR',
          severity: 'ERROR',
          message: `Assignment ${e.assignmentId} — ${e.field}: ${e.problem}`,
          details: { action: e.action },
        }));
        await generation.save();

        return {
          generation: generation.toJSON(),
          timetable: [],
          score: 0,
          violations: preFlightResult.errors.map((e) => ({
            type: 'DATA_INTEGRITY_ERROR',
            severity: 'ERROR',
            message: `Assignment ${e.assignmentId} — ${e.field}: ${e.problem}`,
            details: { action: e.action },
          })),
          errorMessage: generation.errorMessage,
        };
      }

      logger.info(
        `Pre-flight check PASSED: ${preFlightResult.summary.validAssignments}/${preFlightResult.summary.totalAssignments} assignments are valid`
      );
    }
    // ─────────────────────────────────────────────────────────────────────────

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
        isMaxWeeklySourceDefined: false, // By default, treat as not source-defined (from import/allocations)
      })),
      subjects: subjects.map((s) => ({
        id: String(s._id),
        name: String(s.name || ''),
        code: String(s.code || ''),
        weeklyPeriods: Number(s.weeklyPeriods) || 4,
        lecturePeriods: s.lecturePeriods !== undefined ? Number(s.lecturePeriods) : 3,
        labPeriods: s.labPeriods !== undefined ? Number(s.labPeriods) : 2,
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
      batches: batches.map((b) => ({
        id: b._id.toString(),
        semesterId: b.semesterId.toString(),
        code: b.code,
        studentCount: b.studentCount,
      })),
      timeslots: activeTimeslots.map((ts) => ({
        id: ts._id.toString(),
        day: ts.day as DayOfWeek,
        startTime: ts.startTime,
        endTime: ts.endTime,
        periodNumber: ts.periodNumber,
        isBreak: Boolean(ts.isBreak),
        isActive: true,
      })),
      teachingAssignments: (() => {
        const deduplicated = this.sanitizeAssignmentsForScheduler(assignments as Array<Record<string, any>>);

        if (deduplicated.length < assignments.length) {
          logger.info(`Assignment sanitization: Reduced from ${assignments.length} to ${deduplicated.length} (removed ${assignments.length - deduplicated.length} invalid or duplicate assignments)`);
        }

        return deduplicated;
      })(),
      // Convert room reservations into roomBlocks for the OR-Tools solver.
      // Each reservation [startPeriod, endPeriod] becomes a block with
      // startPeriod and duration so the solver can enforce per-period
      // unavailability as a hard constraint.
      roomBlocks: roomReservations.map((r) => ({
        id: r._id.toString(),
        classroomId: r.classroomId.toString(),
        departmentId: r.departmentId.toString(),
        dayOfWeek: r.dayOfWeek as DayOfWeek,
        startPeriod: r.startPeriod,
        duration: r.endPeriod - r.startPeriod + 1,
        reason: r.reason || '',
      })),
      hardConstraints: DEFAULT_HARD_CONSTRAINTS,
      softConstraints: { ...DEFAULT_SOFT_CONSTRAINTS, ...(data.softConstraints || {}) },
      timeLimitSeconds: data.timeLimitSeconds || 60,
    };

    try {
      // Call Scheduler microservice
      const solverResult = await schedulerClient.generate(schedulerPayload);

      if (solverResult.success && solverResult.timetable.length > 0) {
        // Save Timetable Entries into MongoDB
        const entriesToInsert = solverResult.timetable.map((entry) => ({
          ...(entry.assignmentId ? { assignmentId: new mongoose.Types.ObjectId(entry.assignmentId) } : {}),
          semesterId: new mongoose.Types.ObjectId(entry.semesterId),
          ...(entry.batchId ? { batchId: new mongoose.Types.ObjectId(entry.batchId) } : {}),
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
        const violationMessage =
          solverResult.violations && solverResult.violations.length > 0
            ? solverResult.violations.map((violation) => violation.message).join(' ')
            : solverResult.errorMessage || 'Scheduler could not find a feasible solution.';

        generation.errorMessage = violationMessage;
        generation.violations = solverResult.violations;
        generation.statistics = solverResult.statistics || {};
        await generation.save();

        logger.warn(`Timetable generation failed: ${generation.errorMessage}`);

        return {
          generation: generation.toJSON(),
          timetable: [],
          score: 0,
          violations: solverResult.violations || [],
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
      ...(e.batchId ? { batchId: e.batchId } : {}),
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
