import * as XLSX from 'xlsx';
import mongoose from 'mongoose';
import { ImportJobModel } from '../../models/importJob.model.js';
import { TeacherModel } from '../../models/teacher.model.js';
import { SubjectModel } from '../../models/subject.model.js';
import { ClassroomModel } from '../../models/classroom.model.js';
import { SemesterModel } from '../../models/semester.model.js';
import { TimeSlotModel } from '../../models/timeslot.model.js';
import { TeachingAssignmentModel } from '../../models/assignment.model.js';
import { BatchModel } from '../../models/batch.model.js';
import { DepartmentModel } from '../../models/department.model.js';
import { ApiError } from '../../middleware/error.middleware.js';
import { ERROR_CODES, DAYS_OF_WEEK, STANDARD_PERIOD_TIMES } from '@schedulai/config';
import { ImportType, IUser, IImportError, IImportSheetResult, QueryParams } from '@schedulai/shared-types';
import { Logger } from '../../utils/logger.js';

const logger = new Logger('ImportService');

export class ImportService {
  suggestMappingForHeaders(headers: string[]): Record<string, string> {
    const suggestedMapping: Record<string, string> = {};
    const lowerHeaders = headers.map((h) => ({ original: h, lower: h.toLowerCase().trim().replace(/[^a-z0-9]/g, '') }));

    const patterns: Record<string, string[]> = {
      name: ['name', 'fullname', 'teachername', 'facultyname', 'subjectname', 'roomname', 'semestername', 'semester'],
      email: ['email', 'emailaddress', 'mail'],
      employeeId: ['employeeid', 'empid', 'facultyid', 'teacheremployeeid', 'id'],
      code: ['code', 'subjectcode', 'coursecode'],
      credits: ['credits', 'credit', 'creditpoints'],
      weeklyPeriods: ['weeklyperiods', 'periods', 'periodsperweek', 'hours'],
      capacity: ['capacity', 'seats', 'studentcapacity', 'size'],
      building: ['building', 'block', 'hall'],
      roomNumber: ['roomnumber', 'roomno', 'room', 'roomnum'],
      type: ['type', 'roomtype'],
      day: ['day', 'dayofweek', 'weekday'],
      startTime: ['starttime', 'start', 'from'],
      endTime: ['endtime', 'end', 'to'],
      periodNumber: ['periodnumber', 'period', 'slot', 'periodno'],
      studentCount: ['studentcount', 'students', 'strength', 'enrolled'],
      designation: ['designation', 'role', 'title', 'position'],
      departmentCode: ['department', 'dept', 'deptcode', 'departmentcode'],
      batchCode: ['batch', 'batchcode', 'batchname', 'group', 'cohort'],
      location: ['location', 'classroom', 'room', 'roomnumber', 'lab'],
      isLab: ['islab', 'lab', 'ispractical', 'practical'],
      number: ['number', 'semesternumber', 'semno', 'sem'],
      section: ['section', 'division', 'div'],
      academicYear: ['academicyear', 'year', 'ay', 'session'],
      isBreak: ['isbreak', 'break'],
      label: ['label', 'slotname'],
        semesterId: ['semesterid', 'semid'],
    };

    for (const [targetKey, synonyms] of Object.entries(patterns)) {
      const match = lowerHeaders.find((h) => synonyms.includes(h.lower));
      if (match) {
        suggestedMapping[targetKey] = match.original;
      }
    }

    return suggestedMapping;
  }

  parseUploadedBuffer(buffer: Buffer, originalName: string) {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetNames = workbook.SheetNames;
      if (sheetNames.length === 0) {
        throw new ApiError('Uploaded file contains no sheets or data', 400, ERROR_CODES.INVALID_IMPORT);
      }

      // Parse all sheets in the workbook
      const sheets: Record<string, {
        headers: string[];
        totalRows: number;
        sampleRows: Record<string, unknown>[];
        allRows: Record<string, unknown>[];
      }> = {};

      for (const name of sheetNames) {
        const sheet = workbook.Sheets[name];
        const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        sheets[name] = {
          headers: rows.length > 0 ? Object.keys(rows[0]) : [],
          totalRows: rows.length,
          sampleRows: rows.slice(0, 5),
          allRows: rows,
        };
      }

      const firstSheetName = sheetNames[0];
      const defaultRows = sheets[firstSheetName].allRows;

      if (defaultRows.length === 0 && sheetNames.length === 1) {
        throw new ApiError('Uploaded sheet is empty', 400, ERROR_CODES.INVALID_IMPORT);
      }

      const headers = sheets[firstSheetName].headers;
      const sampleRows = sheets[firstSheetName].sampleRows;
      const suggestedMapping = this.suggestMappingForHeaders(headers);

      // Detect recognized sheets for Master Workbook
      const masterSheetsDetected = {
        teachers: sheetNames.find((s) => /teacher|faculty/i.test(s)),
        subjects: sheetNames.find((s) => /subject|course/i.test(s)),
        classrooms: sheetNames.find((s) => /classroom|room|lab/i.test(s)),
        semesters: sheetNames.find((s) => /semester/i.test(s)),
        batches: sheetNames.find((s) => /batch/i.test(s)),
        assignments: sheetNames.find((s) => /assignment|workload|allotment/i.test(s)),
        timeslots: sheetNames.find((s) => /timeslot|timing|slot/i.test(s)),
      };

      const isMasterWorkbook =
        Boolean(masterSheetsDetected.teachers) &&
        Boolean(masterSheetsDetected.subjects) &&
        Boolean(masterSheetsDetected.semesters);

      return {
        fileName: originalName,
        sheetNames,
        sheets,
        masterSheetsDetected,
        isMasterWorkbook,
        headers,
        totalRows: defaultRows.length,
        sampleRows,
        suggestedMapping,
        allRows: defaultRows,
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(`Failed to parse file: ${(error as Error).message}`, 400, ERROR_CODES.INVALID_IMPORT);
    }
  }

  generateMasterTemplate(): Buffer {
    const wb = XLSX.utils.book_new();

    // 1. Teachers Sheet
    const teachersData = [
      { name: 'Dr. Rajesh Sharma', email: 'rajesh.sharma@college.edu', employeeId: 'EMP001', designation: 'Professor', departmentCode: 'IT' },
      { name: 'Prof. Sneha Patil', email: 'sneha.patil@college.edu', employeeId: 'EMP002', designation: 'Assistant Professor', departmentCode: 'IT' },
      { name: 'Prof. Amit Kulkarni', email: 'amit.kulkarni@college.edu', employeeId: 'EMP003', designation: 'Associate Professor', departmentCode: 'IT' },
      { name: 'Prof. Priya Deshmukh', email: 'priya.deshmukh@college.edu', employeeId: 'EMP004', designation: 'Assistant Professor', departmentCode: 'IT' },
    ];
    const wsTeachers = XLSX.utils.json_to_sheet(teachersData);
    XLSX.utils.book_append_sheet(wb, wsTeachers, 'Teachers');

    // 2. Subjects Sheet
    const subjectsData = [
      { code: 'ITC501', name: 'Computer Networks', isLab: false, weeklyPeriods: 3, credits: 3, departmentCode: 'IT' },
      { code: 'ITL501', name: 'Computer Networks Lab', isLab: true, weeklyPeriods: 2, credits: 1, departmentCode: 'IT' },
      { code: 'ITC502', name: 'Database Management Systems', isLab: false, weeklyPeriods: 3, credits: 3, departmentCode: 'IT' },
      { code: 'ITL502', name: 'Database Management Systems Lab', isLab: true, weeklyPeriods: 2, credits: 1, departmentCode: 'IT' },
      { code: 'ITC503', name: 'Operating Systems', isLab: false, weeklyPeriods: 3, credits: 3, departmentCode: 'IT' },
    ];
    const wsSubjects = XLSX.utils.json_to_sheet(subjectsData);
    XLSX.utils.book_append_sheet(wb, wsSubjects, 'Subjects');

    // 3. Classrooms Sheet (Capacity >= 80 for lecture halls to satisfy generator pre-flight)
    const classroomsData = [
      { roomNumber: 'CR-01', name: 'Lecture Hall 1', building: 'IT Block', type: 'LECTURE', capacity: 100 },
      { roomNumber: 'CR-02', name: 'Lecture Hall 2', building: 'IT Block', type: 'LECTURE', capacity: 100 },
      { roomNumber: 'LAB-11', name: 'Computer Networks Lab', building: 'IT Block', type: 'LAB', capacity: 30 },
      { roomNumber: 'LAB-01', name: 'Advanced Software Lab', building: 'IT Block', type: 'LAB', capacity: 30 },
      { roomNumber: 'LAB-02', name: 'Database Systems Lab', building: 'IT Block', type: 'LAB', capacity: 30 },
    ];
    const wsClassrooms = XLSX.utils.json_to_sheet(classroomsData);
    XLSX.utils.book_append_sheet(wb, wsClassrooms, 'Classrooms');

    // 4. Semesters Sheet
    const semestersData = [
      { name: 'SEM 5', number: 5, section: 'A', studentCount: 60, academicYear: '2025-2026', departmentCode: 'IT' },
      { name: 'SEM 3', number: 3, section: 'A', studentCount: 60, academicYear: '2025-2026', departmentCode: 'IT' },
    ];
    const wsSemesters = XLSX.utils.json_to_sheet(semestersData);
    XLSX.utils.book_append_sheet(wb, wsSemesters, 'Semesters');

    // 5. Assignments Sheet (Full compliant set: lectures whole-class, labs with all 4 batches B1, B2, B3, B4)
    const assignmentsData = [
      // Theory Courses (3 weekly periods each in Lecture Hall CR-01)
      { employeeId: 'EMP001', code: 'ITC501', name: 'SEM 5', departmentCode: 'IT', academicYear: '2025-2026', number: 5, section: 'A', batchCode: '', location: 'CR-01', weeklyPeriods: 3 },
      { employeeId: 'EMP002', code: 'ITC502', name: 'SEM 5', departmentCode: 'IT', academicYear: '2025-2026', number: 5, section: 'A', batchCode: '', location: 'CR-01', weeklyPeriods: 3 },
      { employeeId: 'EMP004', code: 'ITC503', name: 'SEM 5', departmentCode: 'IT', academicYear: '2025-2026', number: 5, section: 'A', batchCode: '', location: 'CR-01', weeklyPeriods: 3 },

      // Computer Networks Lab (ITL501) - 4 batches B1, B2, B3, B4 in LAB-11
      { employeeId: 'EMP001', code: 'ITL501', name: 'SEM 5', departmentCode: 'IT', academicYear: '2025-2026', number: 5, section: 'A', batchCode: 'B1', location: 'LAB-11', weeklyPeriods: 2 },
      { employeeId: 'EMP001', code: 'ITL501', name: 'SEM 5', departmentCode: 'IT', academicYear: '2025-2026', number: 5, section: 'A', batchCode: 'B2', location: 'LAB-11', weeklyPeriods: 2 },
      { employeeId: 'EMP002', code: 'ITL501', name: 'SEM 5', departmentCode: 'IT', academicYear: '2025-2026', number: 5, section: 'A', batchCode: 'B3', location: 'LAB-11', weeklyPeriods: 2 },
      { employeeId: 'EMP002', code: 'ITL501', name: 'SEM 5', departmentCode: 'IT', academicYear: '2025-2026', number: 5, section: 'A', batchCode: 'B4', location: 'LAB-11', weeklyPeriods: 2 },

      // Database Systems Lab (ITL502) - 4 batches B1, B2, B3, B4 in LAB-02
      { employeeId: 'EMP003', code: 'ITL502', name: 'SEM 5', departmentCode: 'IT', academicYear: '2025-2026', number: 5, section: 'A', batchCode: 'B1', location: 'LAB-02', weeklyPeriods: 2 },
      { employeeId: 'EMP003', code: 'ITL502', name: 'SEM 5', departmentCode: 'IT', academicYear: '2025-2026', number: 5, section: 'A', batchCode: 'B2', location: 'LAB-02', weeklyPeriods: 2 },
      { employeeId: 'EMP003', code: 'ITL502', name: 'SEM 5', departmentCode: 'IT', academicYear: '2025-2026', number: 5, section: 'A', batchCode: 'B3', location: 'LAB-02', weeklyPeriods: 2 },
      { employeeId: 'EMP003', code: 'ITL502', name: 'SEM 5', departmentCode: 'IT', academicYear: '2025-2026', number: 5, section: 'A', batchCode: 'B4', location: 'LAB-02', weeklyPeriods: 2 },
    ];
    const wsAssignments = XLSX.utils.json_to_sheet(assignmentsData);
    XLSX.utils.book_append_sheet(wb, wsAssignments, 'Assignments');

    // 6. TimeSlots Sheet (Full reference timetable schedule Monday-Saturday)
    const timeslotsData = DAYS_OF_WEEK.flatMap((day) =>
      STANDARD_PERIOD_TIMES.map((slot) => ({
        day,
        periodNumber: slot.period,
        startTime: slot.startTime,
        endTime: slot.endTime,
        isBreak: Boolean(slot.isBreak),
        label: slot.label || `Period ${slot.period}`,
      }))
    );
    const wsTimeSlots = XLSX.utils.json_to_sheet(timeslotsData);
    XLSX.utils.book_append_sheet(wb, wsTimeSlots, 'TimeSlots');

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  private getMasterEntityType(sheetName: string): ImportType | null {
    if (/teacher|faculty/i.test(sheetName)) return 'TEACHERS';
    if (/subject|course/i.test(sheetName)) return 'SUBJECTS';
    if (/semester/i.test(sheetName)) return 'SEMESTERS';
    if (/assignment|workload|allotment/i.test(sheetName)) return 'ASSIGNMENTS';
    if (/batch/i.test(sheetName)) return 'BATCHES';
    if (/classroom|room|lab/i.test(sheetName)) return 'CLASSROOMS';
    if (/timeslot|timing|slot/i.test(sheetName)) return 'TIMESLOTS';
    return null;
  }

  private getMasterStageOrder(type: ImportType | null): number {
    const stageOrder: Partial<Record<ImportType, number>> = {
      TEACHERS: 0,
      SUBJECTS: 1,
      CLASSROOMS: 2,
      SEMESTERS: 3,
      BATCHES: 4,
      ASSIGNMENTS: 5,
      TIMESLOTS: 6,
    };
    return type ? stageOrder[type] ?? 99 : 99;
  }

  private getImportErrorField(type: ImportType, message: string): string {
    const normalized = message.toLowerCase();
    const fieldRules: Array<[RegExp, string]> = [
      [/student.?count|students?/, 'studentCount'],
      [/employee.?id/, 'employeeId'],
      [/e-?mail/, 'email'],
      [/teacher name|subject name/, 'name'],
      [/subject code|course code/, 'code'],
      [/semester (?:name|id|number)|semester.*ambiguous/, 'semester'],
      [/department/, 'departmentCode'],
      [/batch/, 'batchCode'],
      [/room number/, 'roomNumber'],
      [/classroom|location|room/, type === 'ASSIGNMENTS' ? 'location' : 'classroom'],
      [/weekly periods|periods per week|period number/, 'weeklyPeriods'],
      [/capacity/, 'capacity'],
      [/start time/, 'startTime'],
      [/end time/, 'endTime'],
      [/day /, 'day'],
    ];
    return fieldRules.find(([pattern]) => pattern.test(normalized))?.[1] || 'row';
  }

  private async resolveSemesterReference(
    row: Record<string, unknown>,
    columnMapping: Record<string, string>,
    selectedDepartmentId: mongoose.Types.ObjectId | undefined,
    rowNumber: number
  ) {
    const rawSemesterId = String(row[columnMapping.semesterId || 'semesterId'] || '').trim();
    const semesterName = String(row[columnMapping.name || 'name'] || '').trim();
    const departmentCode = String(row[columnMapping.departmentCode || 'departmentCode'] || '').trim().toUpperCase();
    const academicYear = String(row[columnMapping.academicYear || 'academicYear'] || '').trim();
    let rawNumber = String(row[columnMapping.number || 'number'] || '').trim();
    const section = String(row[columnMapping.section || 'section'] || '').trim();

    let departmentId = selectedDepartmentId;
    if (departmentCode) {
      const department = await DepartmentModel.findOne({ code: departmentCode });
      if (!department) {
        throw new Error(`Row ${rowNumber}: Department '${departmentCode}' not found`);
      }
      if (departmentId && String(departmentId) !== String(department._id)) {
        throw new Error(`Row ${rowNumber}: Department Code '${departmentCode}' conflicts with the selected department`);
      }
      departmentId = department._id;
    }

    if (!rawSemesterId && !semesterName) {
      throw new Error(`Row ${rowNumber}: Semester name or Semester ID is required`);
    }

    let numericIdUsedAsSemesterNumber = false;
    if (rawSemesterId && !mongoose.Types.ObjectId.isValid(rawSemesterId)) {
      const numericSemesterNumber = Number(rawSemesterId);
      if (/^[1-9]\d*$/.test(rawSemesterId) && Number.isInteger(numericSemesterNumber) && numericSemesterNumber <= 12) {
        if (rawNumber && Number(rawNumber) !== numericSemesterNumber) {
          throw new Error(`Row ${rowNumber}: Semester ID '${rawSemesterId}' conflicts with Semester Number '${rawNumber}'`);
        }
        if (!departmentId || !academicYear || !section) {
          throw new Error(
            `Row ${rowNumber}: Semester ID '${rawSemesterId}' is a semester number, not a MongoDB ID; provide Department Code, Academic Year, and Section, or map this value to Semester Number`
          );
        }
        rawNumber = rawSemesterId;
        numericIdUsedAsSemesterNumber = true;
      } else {
        throw new Error(`Row ${rowNumber}: Semester ID '${rawSemesterId}' is invalid; use a MongoDB ID or Semester Number`);
      }
    }

    const semesterQuery: Record<string, unknown> = {};
    if (rawSemesterId) {
      if (!numericIdUsedAsSemesterNumber) {
        semesterQuery._id = new mongoose.Types.ObjectId(rawSemesterId);
      }
    }
    if (semesterName) {
          const escapedName = semesterName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      semesterQuery.name = { $regex: new RegExp(`^${escapedName}$`, 'i') };
    }
    if (departmentId) semesterQuery.departmentId = departmentId;
    if (academicYear) semesterQuery.academicYear = academicYear;
    if (rawNumber) {
      const number = Number(rawNumber);
      if (!Number.isInteger(number) || number < 1) {
        throw new Error(`Row ${rowNumber}: Semester number '${rawNumber}' is invalid`);
      }
      semesterQuery.number = number;
    }
    if (section) semesterQuery.section = section;
    semesterQuery.isActive = true;

    const matches = await SemesterModel.find(semesterQuery).lean();
    if (matches.length === 0) {
      const identity = rawSemesterId || semesterName;
      throw new Error(`Row ${rowNumber}: No semester matches '${identity}' and the supplied department/year/section`);
    }
    if (matches.length > 1) {
      throw new Error(
        `Row ${rowNumber}: Semester '${semesterName}' is ambiguous; provide Semester ID or departmentCode, academicYear, number, and section`
      );
    }
    return matches[0];
  }

  private async processEntityRows(
    type: ImportType,
    columnMapping: Record<string, string>,
    rows: Record<string, unknown>[],
    defaultDeptId: mongoose.Types.ObjectId | undefined,
    selectedDepartmentId: mongoose.Types.ObjectId | undefined,
    deptMapByCode: Map<string, mongoose.Types.ObjectId>,
    processedAssignments: Map<string, { rowNumber: number }>,
    sheetName?: string
  ): Promise<{ successCount: number; errors: IImportError[] }> {
    const errors: IImportError[] = [];
    let successCount = 0;

    const normalizeBatchCode = (value: string) => {
      const trimmed = value.trim().toUpperCase();
      if (!trimmed || trimmed === '--' || trimmed === 'ALL') return null;
      const normalized = trimmed.replace(/^([A-Z])-([0-9]+)$/, '$1$2');
      if (!/^[A-Z0-9][A-Z0-9_-]*$/.test(normalized)) {
        throw new Error(`Invalid batch code '${value}'`);
      }
      return normalized;
    };

    const getBaseCourseCode = (code: string, batchCodes: string[]) => {
      const orderedCodes = [...batchCodes].sort((left, right) => right.length - left.length);
      for (const batchCode of orderedCodes) {
        const escapedBatchCode = batchCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const suffix = new RegExp(`[\\s_-]+${escapedBatchCode}$`, 'i');
        if (suffix.test(code)) {
          return code.replace(suffix, '').trim();
        }
      }
      return code.trim();
    };

    const resolveDepartment = async (code: string): Promise<mongoose.Types.ObjectId | undefined> => {
      const cleanCode = (code || '').trim().toUpperCase();
      if (cleanCode && deptMapByCode.has(cleanCode)) return deptMapByCode.get(cleanCode);
      if (cleanCode) {
        const found = await DepartmentModel.findOne({ code: cleanCode });
        if (found) {
          deptMapByCode.set(cleanCode, found._id);
          return found._id;
        }
        const created = await DepartmentModel.create({
          name: cleanCode === 'IT' ? 'Information Technology' : `Department of ${cleanCode}`,
          code: cleanCode,
          isActive: true,
        });
        deptMapByCode.set(cleanCode, created._id);
        return created._id;
      }
      if (defaultDeptId) return defaultDeptId;
      const fallback = await DepartmentModel.findOne({ isActive: true });
      if (fallback) {
        return fallback._id;
      }
      const createdDefault = await DepartmentModel.create({
        name: 'Information Technology',
        code: 'IT',
        isActive: true,
      });
      deptMapByCode.set('IT', createdDefault._id);
      return createdDefault._id;
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // header is row 1, 1-indexed

      try {
        if (type === 'TEACHERS') {
          const name = String(row[columnMapping.name || 'name'] || '').trim();
          const email = String(row[columnMapping.email || 'email'] || '').trim().toLowerCase();
          const employeeId = String(row[columnMapping.employeeId || 'employeeId'] || '').trim();
          const designation = String(row[columnMapping.designation || 'designation'] || 'Assistant Professor').trim();
          const deptCode = String(row[columnMapping.departmentCode || 'departmentCode'] || '').trim().toUpperCase();

          if (!name) throw new Error('Teacher name is required');
          if (!email || !email.includes('@')) throw new Error('Valid email is required');
          if (!employeeId) throw new Error('Employee ID is required');

          const deptId = await resolveDepartment(deptCode);
          if (!deptId) throw new Error('No valid department found');

          await TeacherModel.findOneAndUpdate(
            { $or: [{ email }, { employeeId }] },
            {
              name,
              email,
              employeeId,
              designation,
              departmentId: deptId,
              isActive: true,
              availability: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'],
            },
            { upsert: true, new: true }
          );
          successCount++;
        } else if (type === 'SUBJECTS') {
          const name = String(row[columnMapping.name || 'name'] || '').trim();
          const code = String(row[columnMapping.code || 'code'] || '').trim().toUpperCase();
          const credits = Number(row[columnMapping.credits || 'credits']) || 3;
          const rawWeeklyPeriods = row[columnMapping.weeklyPeriods || 'weeklyPeriods'];
          const isLab = String(row[columnMapping.isLab || 'isLab'] || '').toLowerCase() === 'true' || String(row[columnMapping.isLab || 'isLab']) === '1';
          const weeklyPeriods = isLab ? 2 : 3;
          const deptCode = String(row[columnMapping.departmentCode || 'departmentCode'] || '').trim().toUpperCase();

          if (!name) throw new Error('Subject name is required');
          if (!code) throw new Error('Subject code is required');
          if (String(rawWeeklyPeriods ?? '').trim() && Number(rawWeeklyPeriods) !== weeklyPeriods) {
            throw new Error(`${isLab ? 'Lab' : 'Lecture'} subjects must have exactly ${weeklyPeriods} weekly period(s)`);
          }

          const deptId = await resolveDepartment(deptCode);
          if (!deptId) throw new Error('No valid department found');

          await SubjectModel.findOneAndUpdate(
            { code },
            {
              name,
              code,
              credits,
              weeklyPeriods,
              lecturePeriods: isLab ? 0 : 3,
              labPeriods: isLab ? 2 : 0,
              isLab,
              departmentId: deptId,
              isActive: true,
            },
            { upsert: true, new: true }
          );
          successCount++;
        } else if (type === 'CLASSROOMS') {
          const name = String(row[columnMapping.name || 'name'] || '').trim();
          const building = String(row[columnMapping.building || 'building'] || 'Main').trim();
          const roomNumber = String(row[columnMapping.roomNumber || 'roomNumber'] || '').trim();
          const capacity = Number(row[columnMapping.capacity || 'capacity']) || 40;
          const typeVal = String(row[columnMapping.type || 'type'] || 'LECTURE').toUpperCase();
          const isLab = typeVal === 'LAB' || String(row[columnMapping.isLab || 'isLab']).toLowerCase() === 'true';

          if (!roomNumber) throw new Error('Room number is required');
          const finalName = name || `${building} - ${roomNumber}`;

          await ClassroomModel.findOneAndUpdate(
            { building, roomNumber },
            {
              name: finalName,
              building,
              roomNumber,
              capacity,
              type: typeVal === 'LAB' ? 'LAB' : typeVal === 'SEMINAR' ? 'SEMINAR' : 'LECTURE',
              isLab,
              isAvailable: true,
            },
            { upsert: true, new: true }
          );
          successCount++;
        } else if (type === 'SEMESTERS') {
          const name = String(row[columnMapping.name || 'name'] || '').trim();
          const number = Number(row[columnMapping.number || 'number']) || 1;
          const academicYear = String(row[columnMapping.academicYear || 'academicYear'] || '2025-2026').trim();
          const section = String(row[columnMapping.section || 'section'] || 'A').trim();
          const studentCount = Number(row[columnMapping.studentCount || 'studentCount']) || 30;
          const deptCode = String(row[columnMapping.departmentCode || 'departmentCode'] || '').trim().toUpperCase();

          if (!name) throw new Error('Semester name is required');
          const deptId = await resolveDepartment(deptCode);
          if (!deptId) throw new Error('No valid department found');

          const semDoc = await SemesterModel.findOneAndUpdate(
            { departmentId: deptId, number, section, academicYear },
            {
              name,
              number,
              departmentId: deptId,
              academicYear,
              section,
              studentCount,
              isActive: true,
            },
            { upsert: true, new: true }
          );

          // Auto-generate default batches B1-B4 for the semester
          const BATCH_COUNT = 4;
          const safeCount = Math.max(1, studentCount);
          const baseCount = Math.floor(safeCount / BATCH_COUNT);
          const remainder = safeCount % BATCH_COUNT;

          for (let bIdx = 0; bIdx < BATCH_COUNT; bIdx++) {
            const bCode = `B${bIdx + 1}`;
            const count = baseCount + (bIdx < remainder ? 1 : 0);
            await BatchModel.findOneAndUpdate(
              { semesterId: semDoc._id, code: bCode },
              {
                semesterId: semDoc._id,
                name: `${semDoc.name} - Batch ${bCode}`,
                code: bCode,
                studentCount: count,
                isActive: true,
              },
              { upsert: true, new: true }
            );
          }

          successCount++;
        } else if (type === 'BATCHES') {
          const semester = await this.resolveSemesterReference(
            row,
            columnMapping,
            selectedDepartmentId,
            rowNumber
          );
          const batchCode = normalizeBatchCode(
            String(row[columnMapping.batchCode || columnMapping.code || 'batchCode'] || '')
          );
          const studentCount = Number(row[columnMapping.studentCount || 'studentCount']);
          if (!batchCode) throw new Error(`Row ${rowNumber}: Batch code is required`);
          if (!Number.isInteger(studentCount) || studentCount < 1) {
            throw new Error(`Row ${rowNumber}: Batch studentCount must be a positive integer`);
          }

          await BatchModel.findOneAndUpdate(
            { semesterId: semester._id, code: batchCode },
            {
              semesterId: semester._id,
              code: batchCode,
              studentCount,
              isActive: true,
            },
            { upsert: true, new: true }
          );
          successCount++;
        } else if (type === 'ASSIGNMENTS') {
          const teacherEmpId = String(row[columnMapping.employeeId || 'employeeId'] || '').trim();
          const teacherEmail = String(row[columnMapping.email || 'email'] || '').trim().toLowerCase();
          const rawSubjectCode = String(row[columnMapping.code || 'code'] || '').trim().toUpperCase();
          const rawPeriodsPerWeek = row[columnMapping.weeklyPeriods || 'weeklyPeriods'];

          if (!teacherEmpId && !teacherEmail)
            throw new Error(`Row ${rowNumber}: Teacher Employee ID is missing — check the column mapping for 'Teacher Employee ID'`);
          if (!rawSubjectCode)
            throw new Error(`Row ${rowNumber}: Subject Code is missing — check the column mapping for 'Subject Code'`);
          const teacher = await TeacherModel.findOne(
            teacherEmpId
              ? { employeeId: teacherEmpId }
              : { email: teacherEmail }
          );
          if (!teacher)
            throw new Error(`Row ${rowNumber}: Teacher with Employee ID '${teacherEmpId || teacherEmail}' not found in the database`);

          const semester = await this.resolveSemesterReference(
            row,
            columnMapping,
            selectedDepartmentId,
            rowNumber
          );
          const semesterName = semester.name;

          const batchRecords = await BatchModel.find({ semesterId: semester._id, isActive: true }).lean();
          const explicitBatchColumn = Boolean(columnMapping.batchCode);
          const explicitBatch = explicitBatchColumn
            ? String(row[columnMapping.batchCode] || '')
            : '';
          const normalizedExplicitBatch = normalizeBatchCode(explicitBatch);
          const embeddedBatchCode = !explicitBatchColumn
            ? batchRecords
              .map((batch) => normalizeBatchCode(batch.code))
              .filter((code): code is string => Boolean(code))
              .find((code) => new RegExp(`[\\s_-]+${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i').test(rawSubjectCode))
            : null;
          const batchCode = normalizedExplicitBatch || embeddedBatchCode;
          const baseCourseCode = getBaseCourseCode(rawSubjectCode, batchCode ? [batchCode] : []);
          const subject = await SubjectModel.findOne({ code: baseCourseCode });
          if (!subject)
            throw new Error(`Row ${rowNumber}: Subject with code '${baseCourseCode}' not found in the database`);
          const expectedPeriods = subject.isLab ? 2 : 3;
          const periodsPerWeek = String(rawPeriodsPerWeek ?? '').trim()
            ? Number(rawPeriodsPerWeek)
            : expectedPeriods;
          if (periodsPerWeek !== expectedPeriods) {
            throw new Error(
              `Row ${rowNumber}: ${subject.isLab ? 'Lab' : 'Lecture'} assignments must have exactly ${expectedPeriods} periods per week`
            );
          }

          let batchId: mongoose.Types.ObjectId | undefined;
          if (batchCode) {
            const batch = await BatchModel.findOne({ semesterId: semester._id, code: batchCode, isActive: true }).lean();
            if (!batch) throw new Error(`Row ${rowNumber}: Batch '${batchCode}' not found in semester '${semesterName}'`);
            batchId = batch._id;
          }

          if (subject.isLab && !batchId) {
            throw new Error(`Row ${rowNumber}: Lab assignment for '${subject.code}' requires a valid B1-B4 batchCode`);
          }
          if (!subject.isLab && batchId) {
            throw new Error(`Row ${rowNumber}: Theory assignment '${subject.code}' must be semester-level; leave batchCode blank`);
          }

          const location = String(row[columnMapping.location || 'location'] || '').trim();
          let classroomId: mongoose.Types.ObjectId | undefined;
          if (location) {
            const classroom = await ClassroomModel.findOne({
              $or: [
                { name: { $regex: `^${location.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
                { roomNumber: location },
              ],
            }).lean();
            if (!classroom) throw new Error(`Row ${rowNumber}: Classroom/location '${location}' not found`);
            classroomId = classroom._id;
          }

          const assignmentKey = `${subject._id}|${semester._id}|${batchId?.toString() || 'ALL'}`;

          if (processedAssignments.has(assignmentKey)) {
            const existing = processedAssignments.get(assignmentKey)!;
            throw new Error(`Row ${rowNumber}: Duplicate assignment for this course, semester, and batch (first seen on row ${existing.rowNumber})`);
          } else {
            const existingAssignment = await TeachingAssignmentModel.findOne({
              subjectId: subject._id,
              semesterId: semester._id,
              batchId: batchId || null,
            }).lean();
            if (existingAssignment && String(existingAssignment.teacherId) !== String(teacher._id)) {
              throw new Error(
                `Row ${rowNumber}: This course, semester, and batch already has an assignment with a different teacher; update the existing assignment before importing`
              );
            }

            await TeachingAssignmentModel.findOneAndUpdate(
              { teacherId: teacher._id, subjectId: subject._id, semesterId: semester._id, batchId: batchId || null },
              {
                teacherId: teacher._id,
                subjectId: subject._id,
                semesterId: semester._id,
                batchId: batchId || null,
                classroomId: classroomId || null,
                periodsPerWeek,
                isLab: subject.isLab,
              },
              { upsert: true, new: true }
            );

            processedAssignments.set(assignmentKey, { rowNumber });
            successCount++;
          }
        } else if (type === 'TIMESLOTS') {
          const VALID_DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
          const day = String(row[columnMapping.day || 'day'] || '').trim().toUpperCase();
          const startTime = String(row[columnMapping.startTime || 'startTime'] || '').trim();
          const endTime = String(row[columnMapping.endTime || 'endTime'] || '').trim();
          const periodNumber = Number(row[columnMapping.periodNumber || 'periodNumber']) || 0;
          const isBreak = String(row[columnMapping.isBreak || 'isBreak'] || '').toLowerCase() === 'true';
          const label = String(row[columnMapping.label || 'label'] || '').trim();

          if (!day || !VALID_DAYS.includes(day))
            throw new Error(`Row ${rowNumber}: Day '${day}' is invalid — must be one of: ${VALID_DAYS.join(', ')}`);
          if (!startTime)
            throw new Error(`Row ${rowNumber}: Start Time is required`);
          if (!endTime)
            throw new Error(`Row ${rowNumber}: End Time is required`);
          if (!periodNumber || periodNumber < 1)
            throw new Error(`Row ${rowNumber}: Period Number must be a positive integer`);

          await TimeSlotModel.findOneAndUpdate(
            { day, startTime, endTime },
            { day, startTime, endTime, periodNumber, isBreak, label, isActive: true },
            { upsert: true, new: true }
          );
          successCount++;
        }
      } catch (err) {
        const errMsg = (err as Error).message;
        const prefix = sheetName ? `[${sheetName}] ` : '';
        logger.warn(`Import row ${rowNumber} failed: ${prefix}${errMsg}`);
        errors.push({
          row: rowNumber,
          field: this.getImportErrorField(type, errMsg),
          message: `${prefix}${errMsg}`,
          value: row,
          sheetName,
          entityType: type,
        });
      }
    }

    return { successCount, errors };
  }

  async executeImport(
    type: ImportType,
    columnMapping: Record<string, string>,
    rows: Record<string, unknown>[],
    fileName: string,
    departmentId: string | undefined,
    user: IUser
  ) {
    const job = await ImportJobModel.create({
      type,
      fileName,
      status: 'PROCESSING',
      progress: 0,
      totalRows: rows.length,
      processedRows: 0,
      successRows: 0,
      errorRows: 0,
      skippedRows: 0,
      totalSheets: 1,
      warnings: [],
      worksheetResults: [],
      rowErrors: [],
      createdBy: user._id,
      startedAt: new Date(),
    });

    const departments = await DepartmentModel.find({}).lean();
    const deptMapByCode = new Map(departments.map((d) => [d.code.toUpperCase(), d._id]));
    const defaultDeptId = departmentId
      ? new mongoose.Types.ObjectId(departmentId)
      : departments[0]?._id;
    const selectedDepartmentId = departmentId ? new mongoose.Types.ObjectId(departmentId) : undefined;

    const processedAssignments = new Map<string, { rowNumber: number }>();

    const { successCount, errors } = await this.processEntityRows(
      type,
      columnMapping,
      rows,
      defaultDeptId,
      selectedDepartmentId,
      deptMapByCode,
      processedAssignments
    );

    job.processedRows = rows.length;
    job.successRows = successCount;
    job.errorRows = errors.length;
    job.skippedRows = 0;
    job.totalSheets = 1;
    job.worksheetResults = [{
      sheetName: fileName,
      entityType: type,
      foundRows: rows.length,
      processedRows: rows.length,
      importedRows: successCount,
      skippedRows: 0,
      failedRows: errors.length,
      warnings: [],
    }];
    job.rowErrors = errors;
    job.progress = 100;
    job.status = successCount === 0 ? 'FAILED' : errors.length > 0 ? 'PARTIAL' : 'COMPLETED';
    job.completedAt = new Date();
    await job.save();

    logger.info(`Import ${type} finished: ${successCount} successful, ${errors.length} errors.`);

    return job.toJSON();
  }

  async executeMasterImport(
    sheetsData: Record<string, Record<string, unknown>[]>,
    fileName: string,
    departmentId: string | undefined,
    user: IUser
  ) {
    const sheetNames = Object.keys(sheetsData);
    let totalAllRows = 0;
    for (const name of sheetNames) {
      totalAllRows += (sheetsData[name] || []).length;
    }

    const job = await ImportJobModel.create({
      type: 'MASTER',
      fileName,
      status: 'PROCESSING',
      progress: 0,
      totalRows: totalAllRows,
      processedRows: 0,
      successRows: 0,
      errorRows: 0,
      skippedRows: 0,
      totalSheets: sheetNames.length,
      warnings: [],
      worksheetResults: [],
      rowErrors: [],
      createdBy: user._id,
      startedAt: new Date(),
    });

    const departments = await DepartmentModel.find({}).lean();
    const deptMapByCode = new Map(departments.map((d) => [d.code.toUpperCase(), d._id]));
    const defaultDeptId = departmentId
      ? new mongoose.Types.ObjectId(departmentId)
      : departments[0]?._id;
    const selectedDepartmentId = departmentId ? new mongoose.Types.ObjectId(departmentId) : undefined;

    const allErrors: IImportError[] = [];
    let totalSuccess = 0;
    const processedAssignments = new Map<string, { rowNumber: number }>();

    // Sequential topological order: Teachers -> Subjects -> Classrooms -> Semesters -> Assignments -> TimeSlots
    const worksheetResults: IImportSheetResult[] = [];
    const sheetEntries = sheetNames
      .map((sheetName) => ({ sheetName, type: this.getMasterEntityType(sheetName), rows: sheetsData[sheetName] || [] }))
      .sort((left, right) => this.getMasterStageOrder(left.type) - this.getMasterStageOrder(right.type));
    const warningMessages: string[] = [];

    for (const sheet of sheetEntries) {
      const sheetResult: IImportSheetResult = {
        sheetName: sheet.sheetName,
        entityType: sheet.type ?? undefined,
        foundRows: sheet.rows.length,
        processedRows: 0,
        importedRows: 0,
        skippedRows: 0,
        failedRows: 0,
        warnings: [],
      };

      if (!sheet.type) {
        if (sheet.rows.length > 0) {
          const warning = `Worksheet '${sheet.sheetName}' was skipped because its name does not identify a supported entity`;
          sheetResult.skippedRows = sheet.rows.length;
          sheetResult.warnings.push(warning);
          warningMessages.push(warning);
        } else {
          sheetResult.warnings.push(`Empty worksheet '${sheet.sheetName}' was skipped`);
          warningMessages.push(`Empty worksheet '${sheet.sheetName}' was skipped`);
        }
        worksheetResults.push(sheetResult);
        continue;
      }

      if (sheet.rows.length === 0) {
        const warning = `Supported worksheet '${sheet.sheetName}' is empty and was skipped`;
        sheetResult.warnings.push(warning);
        warningMessages.push(warning);
        worksheetResults.push(sheetResult);
        continue;
      }

      const headers = Object.keys(sheet.rows[0] || {});
      const mapping = this.suggestMappingForHeaders(headers);
      const result = await this.processEntityRows(
        sheet.type,
        mapping,
        sheet.rows,
        defaultDeptId,
        selectedDepartmentId,
        deptMapByCode,
        processedAssignments,
        sheet.sheetName
      );
      sheetResult.processedRows = sheet.rows.length;
      sheetResult.importedRows = result.successCount;
      sheetResult.failedRows = result.errors.length;
      totalSuccess += result.successCount;
      allErrors.push(...result.errors);
      worksheetResults.push(sheetResult);
    }

    job.totalRows = totalAllRows;
    job.processedRows = worksheetResults.reduce((sum, sheet) => sum + sheet.processedRows, 0);
    job.successRows = totalSuccess;
    job.errorRows = allErrors.length;
    job.skippedRows = worksheetResults.reduce((sum, sheet) => sum + sheet.skippedRows, 0);
    job.totalSheets = sheetNames.length;
    job.warnings = warningMessages;
    job.worksheetResults = worksheetResults;
    job.rowErrors = allErrors;
    job.progress = 100;
    job.status = totalSuccess === 0
      ? 'FAILED'
      : allErrors.length > 0 || job.skippedRows > 0 || warningMessages.length > 0
        ? 'PARTIAL'
        : 'COMPLETED';
    job.completedAt = new Date();
    await job.save();

    logger.info(`Master import finished: ${totalSuccess} successful, ${allErrors.length} errors across all sheets.`);

    return job.toJSON();
  }

  async getJobs(params: QueryParams) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const skip = (page - 1) * limit;

    const [jobs, total] = await Promise.all([
      ImportJobModel.find({})
        .select('-rowErrors')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'name email')
        .lean(),
      ImportJobModel.countDocuments({}),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      jobs,
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

  async getJobById(id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError('Import job not found', 404, ERROR_CODES.IMPORT_JOB_NOT_FOUND);
    }
    const job = await ImportJobModel.findById(id).populate('createdBy', 'name email').lean();
    if (!job) {
      throw new ApiError('Import job not found', 404, ERROR_CODES.IMPORT_JOB_NOT_FOUND);
    }
    return {
      ...job,
      rowErrors: (job.rowErrors || []).map(({ row, field, message, sheetName, entityType }) => ({
        row,
        field,
        message,
        sheetName,
        entityType,
      })),
    };
  }
}

export const importService = new ImportService();
