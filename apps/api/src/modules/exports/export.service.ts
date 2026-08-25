import * as XLSX from 'xlsx';
import { TimetableEntryModel } from '../../models/timetable.model.js';
import { SemesterModel } from '../../models/semester.model.js';
import { TeacherModel } from '../../models/teacher.model.js';
import { ClassroomModel } from '../../models/classroom.model.js';
import { TimeSlotModel } from '../../models/timeslot.model.js';
import { BatchModel } from '../../models/batch.model.js';
import { ApiError } from '../../middleware/error.middleware.js';
import { ERROR_CODES, DAYS_OF_WEEK } from '@schedulai/config';
import { DayOfWeek } from '@schedulai/shared-types';

export class ExportService {
  async generateExcel(filter: {
    generationId?: string;
    semesterId?: string;
    teacherId?: string;
    classroomId?: string;
  }) {
    const query: Record<string, unknown> = {};
    if (filter.generationId) query.generationId = filter.generationId;
    if (filter.semesterId) query.semesterId = filter.semesterId;
    if (filter.teacherId) query.teacherId = filter.teacherId;
    if (filter.classroomId) query.classroomId = filter.classroomId;

    const entries = await TimetableEntryModel.find(query)
      .populate('semesterId', 'name number section academicYear')
      .populate('batchId', 'code')
      .populate('subjectId', 'name code credits isLab')
      .populate('teacherId', 'name email designation employeeId')
      .populate('classroomId', 'name building roomNumber capacity')
      .populate('timeSlotId', 'day startTime endTime periodNumber')
      .lean();

    if (entries.length === 0) {
      throw new ApiError('No timetable entries found matching criteria to export', 404, ERROR_CODES.TIMETABLE_NOT_FOUND);
    }

    const workbook = XLSX.utils.book_new();

    // 1. Detailed tabular sheet
    const tabularData = entries.map((e) => {
      const sem = e.semesterId as unknown as Record<string, unknown>;
      const sub = e.subjectId as unknown as Record<string, unknown>;
      const tea = e.teacherId as unknown as Record<string, unknown>;
      const rm = e.classroomId as unknown as Record<string, unknown>;
      const bat = e.batchId as unknown as Record<string, unknown>;
      return {
        Day: e.day,
        'Start Time': e.startTime,
        'End Time': e.endTime,
        Semester: sem ? `${sem.name} (${sem.section})` : '',
        Batch: bat ? String(bat.code) : 'ALL',
        'Subject Code': sub ? String(sub.code) : '',
        'Subject Name': sub ? String(sub.name) : '',
        Faculty: tea ? String(tea.name) : '',
        'Faculty ID': tea ? String(tea.employeeId) : '',
        Classroom: rm ? `${rm.building} - ${rm.roomNumber}` : '',
        'Period Type': e.periodType,
      };
    });

    const tabularSheet = XLSX.utils.json_to_sheet(tabularData);
    XLSX.utils.book_append_sheet(workbook, tabularSheet, 'Schedule List');

    // 2. Matrix Grid Sheet (Time Slots as Rows, Days as Columns)
    const timeSlots = await TimeSlotModel.find({ isActive: true, isBreak: false }).lean();
    const dayOrder: Record<DayOfWeek, number> = {
      MONDAY: 0,
      TUESDAY: 1,
      WEDNESDAY: 2,
      THURSDAY: 3,
      FRIDAY: 4,
      SATURDAY: 5,
    };
    timeSlots.sort((a, b) => (dayOrder[a.day as DayOfWeek] ?? 99) - (dayOrder[b.day as DayOfWeek] ?? 99) || a.periodNumber - b.periodNumber);

    // Unique time ranges
    const timeRanges = Array.from(new Set(timeSlots.map((ts) => `${ts.startTime} - ${ts.endTime}`)));

    const gridRows = timeRanges.map((timeRange) => {
      const row: Record<string, string> = { 'Time Slot': timeRange };
      for (const day of DAYS_OF_WEEK) {
        const matchingEntries = entries.filter(
          (e) => e.day === day && `${e.startTime} - ${e.endTime}` === timeRange
        );
        if (matchingEntries.length > 0) {
          row[day] = matchingEntries
            .map((e) => {
              const sub = e.subjectId as unknown as Record<string, unknown>;
              const tea = e.teacherId as unknown as Record<string, unknown>;
              const rm = e.classroomId as unknown as Record<string, unknown>;
              return `${sub ? sub.code : ''} | ${tea ? tea.name : ''} | ${rm ? rm.roomNumber : ''}`;
            })
            .join(' \n');
        } else {
          row[day] = '-';
        }
      }
      return row;
    });

    const matrixSheet = XLSX.utils.json_to_sheet(gridRows);
    XLSX.utils.book_append_sheet(workbook, matrixSheet, 'Timetable Grid');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return buffer;
  }

  async generateCSV(filter: {
    generationId?: string;
    semesterId?: string;
    teacherId?: string;
    classroomId?: string;
  }) {
    const query: Record<string, unknown> = {};
    if (filter.generationId) query.generationId = filter.generationId;
    if (filter.semesterId) query.semesterId = filter.semesterId;
    if (filter.teacherId) query.teacherId = filter.teacherId;
    if (filter.classroomId) query.classroomId = filter.classroomId;

    const entries = await TimetableEntryModel.find(query)
      .populate('semesterId', 'name number section academicYear')
      .populate('batchId', 'code')
      .populate('subjectId', 'name code credits isLab')
      .populate('teacherId', 'name email designation employeeId')
      .populate('classroomId', 'name building roomNumber capacity')
      .lean();

    const tabularData = entries.map((e) => {
      const sem = e.semesterId as unknown as Record<string, unknown>;
      const sub = e.subjectId as unknown as Record<string, unknown>;
      const tea = e.teacherId as unknown as Record<string, unknown>;
      const rm = e.classroomId as unknown as Record<string, unknown>;
      const bat = e.batchId as unknown as Record<string, unknown>;
      return {
        Day: e.day,
        StartTime: e.startTime,
        EndTime: e.endTime,
        Semester: sem ? `${sem.name} (${sem.section})` : '',
        Batch: bat ? String(bat.code) : 'ALL',
        SubjectCode: sub ? sub.code : '',
        SubjectName: sub ? sub.name : '',
        FacultyName: tea ? tea.name : '',
        FacultyId: tea ? tea.employeeId : '',
        Classroom: rm ? `${rm.building} - ${rm.roomNumber}` : '',
        Type: e.periodType,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(tabularData);
    const csvString = XLSX.utils.sheet_to_csv(worksheet);
    return Buffer.from(csvString, 'utf-8');
  }

  async getPrintableTimetable(filter: {
    generationId?: string;
    semesterId?: string;
    teacherId?: string;
    classroomId?: string;
  }) {
    const query: Record<string, unknown> = {};
    if (filter.generationId) query.generationId = filter.generationId;
    if (filter.semesterId) query.semesterId = filter.semesterId;
    if (filter.teacherId) query.teacherId = filter.teacherId;
    if (filter.classroomId) query.classroomId = filter.classroomId;

    const [entries, timeslots, semester, teacher, classroom] = await Promise.all([
      TimetableEntryModel.find(query)
        .populate('semesterId', 'name number section academicYear')
        .populate('subjectId', 'name code credits isLab')
        .populate('teacherId', 'name email designation employeeId')
        .populate('classroomId', 'name building roomNumber capacity')
        .populate('timeSlotId', 'day startTime endTime periodNumber isBreak')
        .lean(),
      TimeSlotModel.find({ isActive: true, isBreak: false }).lean(),
      filter.semesterId ? SemesterModel.findById(filter.semesterId).populate('departmentId').lean() : null,
      filter.teacherId ? TeacherModel.findById(filter.teacherId).populate('departmentId').lean() : null,
      filter.classroomId ? ClassroomModel.findById(filter.classroomId).lean() : null,
    ]);

    return {
      title: semester
        ? `Academic Timetable — ${semester.name} (${semester.section})`
        : teacher
        ? `Faculty Timetable — ${teacher.name} (${teacher.designation})`
        : classroom
        ? `Classroom Timetable — ${classroom.building} - ${classroom.roomNumber}`
        : 'Institution Master Timetable',
      filter,
      meta: {
        semester,
        teacher,
        classroom,
        totalEntries: entries.length,
        exportedAt: new Date().toISOString(),
      },
      entries,
      timeslots,
    };
  }
}

export const exportService = new ExportService();
