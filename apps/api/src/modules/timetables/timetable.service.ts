import mongoose from 'mongoose';
import { TimetableEntryModel } from '../../models/timetable.model.js';
import { TimeSlotModel } from '../../models/timeslot.model.js';
import { ClassroomModel } from '../../models/classroom.model.js';
import { TeacherModel } from '../../models/teacher.model.js';
import { SubjectModel } from '../../models/subject.model.js';
import { SemesterModel } from '../../models/semester.model.js';
import { TeachingAssignmentModel } from '../../models/assignment.model.js';
import { schedulerClient } from '../../utils/schedulerClient.js';
import { ApiError } from '../../middleware/error.middleware.js';
import { ERROR_CODES } from '@schedulai/config';
import {
  ITimetableEntry,
  IProposedMoveRequest,
  IValidateTimetableRequest,
  DayOfWeek,
  PeriodType,
} from '@schedulai/shared-types';
import { Logger } from '../../utils/logger.js';

const logger = new Logger('TimetableService');

export interface MoveEntryDTO {
  entryId: string;
  targetTimeSlotId: string;
  targetClassroomId?: string;
  generationId: string;
}

export class TimetableService {
  async getEntries(filter: {
    generationId?: string;
    semesterId?: string;
    teacherId?: string;
    classroomId?: string;
    day?: string;
  }) {
    const query: Record<string, unknown> = {};

    if (filter.generationId) query.generationId = filter.generationId;
    if (filter.semesterId) query.semesterId = filter.semesterId;
    if (filter.teacherId) query.teacherId = filter.teacherId;
    if (filter.classroomId) query.classroomId = filter.classroomId;
    if (filter.day) query.day = filter.day;

    const entries = await TimetableEntryModel.find(query)
      .populate('semesterId', 'name number section academicYear studentCount')
      .populate('subjectId', 'name code credits isLab')
      .populate('teacherId', 'name email designation employeeId')
      .populate('classroomId', 'name building roomNumber capacity type isLab')
      .populate('timeSlotId', 'day startTime endTime periodNumber isBreak')
      .lean();

    return entries;
  }

  async moveEntry(data: MoveEntryDTO) {
    const entry = await TimetableEntryModel.findById(data.entryId);
    if (!entry) {
      throw new ApiError('Timetable entry not found', 404, ERROR_CODES.TIMETABLE_NOT_FOUND);
    }

    const targetTimeSlot = await TimeSlotModel.findById(data.targetTimeSlotId);
    if (!targetTimeSlot || !targetTimeSlot.isActive || targetTimeSlot.isBreak) {
      throw new ApiError('Target time slot is invalid, inactive, or a break period', 400, ERROR_CODES.BAD_REQUEST);
    }

    const targetClassroomId = data.targetClassroomId || entry.classroomId.toString();
    const targetClassroom = await ClassroomModel.findById(targetClassroomId);
    if (!targetClassroom || !targetClassroom.isAvailable) {
      throw new ApiError('Target classroom is invalid or unavailable', 400, ERROR_CODES.CLASSROOM_NOT_FOUND);
    }

    // Fetch all current entries for this generation to validate
    const allGenEntries = await TimetableEntryModel.find({ generationId: entry.generationId }).lean();
    const [teachers, subjects, classrooms, semesters, timeslots, assignments] = await Promise.all([
      TeacherModel.find({}).lean(),
      SubjectModel.find({}).lean(),
      ClassroomModel.find({}).lean(),
      SemesterModel.find({}).lean(),
      TimeSlotModel.find({ isActive: true, isBreak: false }).lean(),
      TeachingAssignmentModel.find({}).lean(),
    ]);

    const suggestPayload: IProposedMoveRequest = {
      entryId: entry._id.toString(),
      targetTimeSlotId: data.targetTimeSlotId,
      targetClassroomId,
      currentTimetable: allGenEntries.map((e) => ({
        _id: e._id.toString(),
        semesterId: e.semesterId.toString(),
        subjectId: e.subjectId.toString(),
        teacherId: e.teacherId.toString(),
        classroomId: e.classroomId.toString(),
        timeSlotId: e.timeSlotId.toString(),
        day: e.day as DayOfWeek,
        startTime: e.startTime,
        endTime: e.endTime,
        periodType: e.periodType as PeriodType,
        generationId: e.generationId.toString(),
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
      })),
      teachers: teachers.map((t) => ({
        id: t._id.toString(),
        name: t.name,
        availability: t.availability,
        preferredTimeSlots: (t.preferredTimeSlots || []).map((id) => id.toString()),
        unavailableTimeSlots: (t.unavailableTimeSlots || []).map((id) => id.toString()),
        maxClassesPerDay: t.maxClassesPerDay,
        maxClassesPerWeek: t.maxClassesPerWeek,
      })),
      subjects: subjects.map((s) => ({
        id: s._id.toString(),
        name: s.name,
        code: s.code,
        weeklyPeriods: s.weeklyPeriods,
        lecturePeriods: s.lecturePeriods,
        labPeriods: s.labPeriods,
        isLab: s.isLab,
      })),
      classrooms: classrooms.map((c) => ({
        id: c._id.toString(),
        name: `${c.building} - ${c.roomNumber} (${c.name})`,
        capacity: c.capacity,
        type: c.type,
        equipment: c.equipment,
        isLab: c.isLab,
        isAvailable: c.isAvailable,
      })),
      semesters: semesters.map((m) => ({
        id: m._id.toString(),
        name: `${m.name} (${m.section})`,
        studentCount: m.studentCount,
      })),
      timeslots: timeslots.map((ts) => ({
        id: ts._id.toString(),
        day: ts.day,
        startTime: ts.startTime,
        endTime: ts.endTime,
        periodNumber: ts.periodNumber,
        isBreak: ts.isBreak,
        isActive: ts.isActive,
      })),
    };

    // Ask scheduler to validate proposed move and generate alternatives if invalid
    const validationResult = await schedulerClient.suggest(suggestPayload);

    if (!validationResult.valid) {
      logger.warn(`Proposed move for entry ${data.entryId} has ${validationResult.conflicts.length} conflict(s).`);
      return {
        success: false,
        valid: false,
        message: 'Move rejected due to schedule conflicts.',
        conflicts: validationResult.conflicts,
        suggestions: validationResult.suggestions,
      };
    }

    // Move is valid! Update MongoDB
    entry.timeSlotId = new mongoose.Types.ObjectId(data.targetTimeSlotId);
    entry.day = targetTimeSlot.day;
    entry.startTime = targetTimeSlot.startTime;
    entry.endTime = targetTimeSlot.endTime;
    entry.classroomId = new mongoose.Types.ObjectId(targetClassroomId);
    await entry.save();

    logger.info(`Timetable entry ${data.entryId} successfully moved to ${targetTimeSlot.day} ${targetTimeSlot.startTime}-${targetTimeSlot.endTime}`);

    const updatedPopulated = await TimetableEntryModel.findById(entry._id)
      .populate('semesterId', 'name number section academicYear studentCount')
      .populate('subjectId', 'name code credits isLab')
      .populate('teacherId', 'name email designation employeeId')
      .populate('classroomId', 'name building roomNumber capacity type isLab')
      .populate('timeSlotId', 'day startTime endTime periodNumber isBreak')
      .lean();

    return {
      success: true,
      valid: true,
      message: 'Timetable entry moved successfully.',
      entry: updatedPopulated,
    };
  }

  async validateGeneration(generationId: string) {
    const entries = await TimetableEntryModel.find({ generationId }).lean();
    if (entries.length === 0) {
      throw new ApiError('No timetable entries found for this generation', 404, ERROR_CODES.TIMETABLE_NOT_FOUND);
    }

    const [teachers, subjects, classrooms, semesters, timeslots, assignments] = await Promise.all([
      TeacherModel.find({}).lean(),
      SubjectModel.find({}).lean(),
      ClassroomModel.find({}).lean(),
      SemesterModel.find({}).lean(),
      TimeSlotModel.find({}).lean(),
      TeachingAssignmentModel.find({}).lean(),
    ]);

    const reqPayload: IValidateTimetableRequest = {
      timetable: entries.map((e) => ({
        semesterId: e.semesterId.toString(),
        subjectId: e.subjectId.toString(),
        teacherId: e.teacherId.toString(),
        classroomId: e.classroomId.toString(),
        timeSlotId: e.timeSlotId.toString(),
        day: e.day as DayOfWeek,
        startTime: e.startTime,
        endTime: e.endTime,
        periodType: e.periodType as PeriodType,
      })),
      teachers: teachers.map((t) => ({
        id: t._id.toString(),
        name: t.name,
        availability: t.availability,
        preferredTimeSlots: (t.preferredTimeSlots || []).map((id) => id.toString()),
        unavailableTimeSlots: (t.unavailableTimeSlots || []).map((id) => id.toString()),
        maxClassesPerDay: t.maxClassesPerDay,
        maxClassesPerWeek: t.maxClassesPerWeek,
      })),
      subjects: subjects.map((s) => ({
        id: s._id.toString(),
        name: s.name,
        code: s.code,
        weeklyPeriods: s.weeklyPeriods,
        lecturePeriods: s.lecturePeriods,
        labPeriods: s.labPeriods,
        isLab: s.isLab,
      })),
      classrooms: classrooms.map((c) => ({
        id: c._id.toString(),
        name: `${c.building} - ${c.roomNumber} (${c.name})`,
        capacity: c.capacity,
        type: c.type,
        equipment: c.equipment,
        isLab: c.isLab,
        isAvailable: c.isAvailable,
      })),
      semesters: semesters.map((m) => ({
        id: m._id.toString(),
        name: `${m.name} (${m.section})`,
        studentCount: m.studentCount,
      })),
      timeslots: timeslots.map((ts) => ({
        id: ts._id.toString(),
        day: ts.day,
        startTime: ts.startTime,
        endTime: ts.endTime,
        periodNumber: ts.periodNumber,
        isBreak: ts.isBreak,
        isActive: ts.isActive,
      })),
      teachingAssignments: assignments.map((a) => ({
        id: a._id.toString(),
        teacherId: a.teacherId.toString(),
        subjectId: a.subjectId.toString(),
        semesterId: a.semesterId.toString(),
        classroomRequirements: a.classroomRequirements || [],
        periodsPerWeek: a.periodsPerWeek,
        isLab: a.isLab || false,
      })),
    };

    return schedulerClient.validate(reqPayload);
  }

  async updateEntry(id: string, data: Record<string, unknown>) {
    const entry = await TimetableEntryModel.findById(id);
    if (!entry) {
      throw new ApiError('Timetable entry not found', 404, ERROR_CODES.TIMETABLE_NOT_FOUND);
    }
    Object.assign(entry, data);
    await entry.save();
    return entry.toJSON();
  }

  async deleteEntry(id: string) {
    const entry = await TimetableEntryModel.findByIdAndDelete(id);
    if (!entry) {
      throw new ApiError('Timetable entry not found', 404, ERROR_CODES.TIMETABLE_NOT_FOUND);
    }
    return { deletedId: id };
  }
}

export const timetableService = new TimetableService();
