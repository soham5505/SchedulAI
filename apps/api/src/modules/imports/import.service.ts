import * as XLSX from 'xlsx';
import mongoose from 'mongoose';
import { ImportJobModel } from '../../models/importJob.model.js';
import { TeacherModel } from '../../models/teacher.model.js';
import { SubjectModel } from '../../models/subject.model.js';
import { ClassroomModel } from '../../models/classroom.model.js';
import { SemesterModel } from '../../models/semester.model.js';
import { TimeSlotModel } from '../../models/timeslot.model.js';
import { TeachingAssignmentModel } from '../../models/assignment.model.js';
import { DepartmentModel } from '../../models/department.model.js';
import { ApiError } from '../../middleware/error.middleware.js';
import { ERROR_CODES } from '@schedulai/config';
import { ImportType, IUser, IImportError, QueryParams } from '@schedulai/shared-types';
import { Logger } from '../../utils/logger.js';

const logger = new Logger('ImportService');

export class ImportService {
  parseUploadedBuffer(buffer: Buffer, originalName: string) {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetNames = workbook.SheetNames;
      if (sheetNames.length === 0) {
        throw new ApiError('Uploaded file contains no sheets or data', 400, ERROR_CODES.INVALID_IMPORT);
      }

      const firstSheet = workbook.Sheets[sheetNames[0]];
      const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

      if (rawRows.length === 0) {
        throw new ApiError('Uploaded sheet is empty', 400, ERROR_CODES.INVALID_IMPORT);
      }

      const headers = Object.keys(rawRows[0] || {});
      const sampleRows = rawRows.slice(0, 5);

      // Auto suggested column mapping based on standard names
      const suggestedMapping: Record<string, string> = {};
      const lowerHeaders = headers.map((h) => ({ original: h, lower: h.toLowerCase().trim().replace(/[^a-z0-9]/g, '') }));

      const patterns: Record<string, string[]> = {
        name: ['name', 'fullname', 'teachername', 'facultyname', 'subjectname', 'roomname', 'semestername'],
        email: ['email', 'emailaddress', 'mail'],
        employeeId: ['employeeid', 'empid', 'facultyid', 'teacheremployeeid', 'id'],
        code: ['code', 'subjectcode', 'deptcode', 'coursecode'],
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
      };

      for (const [targetKey, synonyms] of Object.entries(patterns)) {
        const match = lowerHeaders.find((h) => synonyms.includes(h.lower));
        if (match) {
          suggestedMapping[targetKey] = match.original;
        }
      }

      return {
        fileName: originalName,
        sheetNames,
        headers,
        totalRows: rawRows.length,
        sampleRows,
        suggestedMapping,
        allRows: rawRows,
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(`Failed to parse file: ${(error as Error).message}`, 400, ERROR_CODES.INVALID_IMPORT);
    }
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
      rowErrors: [],
      createdBy: user._id,
      startedAt: new Date(),
    });

    const errors: IImportError[] = [];
    let successCount = 0;

    // Cache departments for fast resolution
    const departments = await DepartmentModel.find({}).lean();
    const deptMapByCode = new Map(departments.map((d) => [d.code.toUpperCase(), d._id]));
    const defaultDeptId = departmentId
      ? new mongoose.Types.ObjectId(departmentId)
      : departments[0]?._id;

    // Track processed teaching assignments to detect and consolidate batch identifiers
    // Key: "${teacherId}|${baseCourseCode}|${semesterId}" (without batch suffix)
    const processedAssignments = new Map<string, { teacherId: string; subjectId: string; semesterId: string; periodsPerWeek: number; rowNumber: number }>();
    const batchConsolidationLog: Array<{ row: number; message: string }> = [];

    // Helper function to extract base course code (remove batch identifiers like B1-B4, W1-W4, D1-D2)
    // Also checks other fields in the row for batch indicators
    const getBaseCourseCode = (code: string, row?: Record<string, unknown>): { baseCourseCode: string; hasBatchIndicator: boolean } => {
      // First, remove batch patterns from the code itself
      let baseCourseCode = code
        .replace(/\s*[BWD]\d(?:-[BWD]?\d+)?$/i, '') // Matches B1-B4, W1-W4, D1-D2 at end
        .replace(/\s*\([BWD]\d(?:-[BWD]?\d+)?\)\s*$/i, '') // Matches (B1-B4) at end
        .trim();
      
      const codeHasBatch = baseCourseCode !== code;
      
      // Also check for batch indicators in other row fields
      let rowHasBatchField = false;
      if (row) {
        const rowValues = Object.values(row)
          .map(v => String(v || '').trim().toUpperCase())
          .join(' ');
        
        // Check for common batch patterns in row data
        if (/\b(B[1-4]|W[1-4]|D[1-2]|BATCH|SECTION|GROUP|COHORT)\b/.test(rowValues)) {
          rowHasBatchField = true;
        }
      }
      
      return {
        baseCourseCode,
        hasBatchIndicator: codeHasBatch || rowHasBatchField
      };
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

          const deptId = (deptCode && deptMapByCode.get(deptCode)) || defaultDeptId;
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
              availability: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
            },
            { upsert: true, new: true }
          );
          successCount++;
        } else if (type === 'SUBJECTS') {
          const name = String(row[columnMapping.name || 'name'] || '').trim();
          const code = String(row[columnMapping.code || 'code'] || '').trim().toUpperCase();
          const credits = Number(row[columnMapping.credits || 'credits']) || 3;
          const weeklyPeriods = Number(row[columnMapping.weeklyPeriods || 'weeklyPeriods']) || 4;
          const isLab = String(row[columnMapping.isLab || 'isLab'] || '').toLowerCase() === 'true' || String(row[columnMapping.isLab || 'isLab']) === '1';
          const deptCode = String(row[columnMapping.departmentCode || 'departmentCode'] || '').trim().toUpperCase();

          if (!name) throw new Error('Subject name is required');
          if (!code) throw new Error('Subject code is required');

          const deptId = (deptCode && deptMapByCode.get(deptCode)) || defaultDeptId;
          if (!deptId) throw new Error('No valid department found');

          await SubjectModel.findOneAndUpdate(
            { code },
            {
              name,
              code,
              credits,
              weeklyPeriods,
              lecturePeriods: isLab ? weeklyPeriods - 1 : weeklyPeriods,
              labPeriods: isLab ? 1 : 0,
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
          const deptId = (deptCode && deptMapByCode.get(deptCode)) || defaultDeptId;
          if (!deptId) throw new Error('No valid department found');

          await SemesterModel.findOneAndUpdate(
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
          successCount++;
        } else if (type === 'ASSIGNMENTS') {
          const teacherEmpId = String(row[columnMapping.employeeId || 'employeeId'] || '').trim();
          const teacherEmail = String(row[columnMapping.email || 'email'] || '').trim().toLowerCase();
          const subjectCode = String(row[columnMapping.code || 'code'] || '').trim().toUpperCase();
          const semesterName = String(row[columnMapping.name || 'name'] || '').trim();
          const periodsPerWeek = Number(row[columnMapping.weeklyPeriods || 'weeklyPeriods']) || 4;

          // Validate required fields before hitting DB
          if (!teacherEmpId && !teacherEmail)
            throw new Error(`Row ${rowNumber}: Teacher Employee ID is missing — check the column mapping for 'Teacher Employee ID'`);
          if (!subjectCode)
            throw new Error(`Row ${rowNumber}: Subject Code is missing — check the column mapping for 'Subject Code'`);
          if (!semesterName)
            throw new Error(`Row ${rowNumber}: Semester Name is missing — check the column mapping for 'Semester Name'`);

          const teacher = await TeacherModel.findOne(
            teacherEmpId
              ? { employeeId: teacherEmpId }
              : { email: teacherEmail }
          );
          if (!teacher)
            throw new Error(`Row ${rowNumber}: Teacher with Employee ID '${teacherEmpId || teacherEmail}' not found in the database`);

          const subject = await SubjectModel.findOne({ code: subjectCode });
          if (!subject)
            throw new Error(`Row ${rowNumber}: Subject with code '${subjectCode}' not found in the database`);

          // Case-insensitive, trim-safe semester lookup
          const escapedName = semesterName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const semester = await SemesterModel.findOne({
            name: { $regex: new RegExp(`^${escapedName}$`, 'i') },
          });
          if (!semester)
            throw new Error(`Row ${rowNumber}: Semester '${semesterName}' not found — ensure it exists in the Semesters & Batches table`);

          // Detect batch identifier patterns in subject code and row data
          const { baseCourseCode, hasBatchIndicator } = getBaseCourseCode(subjectCode, row);
          
          // Create deduplication key: treat all batch variants as the same assignment
          const assignmentKey = `${teacher._id}|${baseCourseCode}|${semester._id}`;
          
          if (processedAssignments.has(assignmentKey)) {
            // This is a duplicate batch assignment - log and skip
            const existing = processedAssignments.get(assignmentKey)!;
            if (hasBatchIndicator) {
              batchConsolidationLog.push({
                row: rowNumber,
                message: `Batch variant of assignment (row ${existing.rowNumber}) detected and skipped. Using first occurrence only.`
              });
              successCount++; // Count as success but don't insert
              logger.info(`Batch consolidation: Row ${rowNumber} skipped, using row ${existing.rowNumber} for ${baseCourseCode}`);
            }
          } else {
            // First occurrence - process normally
            await TeachingAssignmentModel.findOneAndUpdate(
              { teacherId: teacher._id, subjectId: subject._id, semesterId: semester._id },
              {
                teacherId: teacher._id,
                subjectId: subject._id,
                semesterId: semester._id,
                periodsPerWeek,
                isLab: subject.isLab,
              },
              { upsert: true, new: true }
            );
            
            // Track this assignment
            processedAssignments.set(assignmentKey, {
              teacherId: teacher._id.toString(),
              subjectId: subject._id.toString(),
              semesterId: semester._id.toString(),
              periodsPerWeek,
              rowNumber
            });
            
            if (hasBatchIndicator) {
              logger.info(`Assignment processed with batch consolidation enabled for ${baseCourseCode} (row ${rowNumber})`);
            }
            
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
        logger.warn(`Import row ${rowNumber} failed: ${errMsg}`);
        errors.push({
          row: rowNumber,
          field: 'general',
          message: errMsg,
          value: row,
        });
      }
    }

    job.processedRows = rows.length;
    job.successRows = successCount;
    job.errorRows = errors.length;
    job.rowErrors = errors;
    job.progress = 100;
    job.status = errors.length === rows.length ? 'FAILED' : 'COMPLETED';
    job.completedAt = new Date();
    await job.save();

    if (type === 'ASSIGNMENTS' && batchConsolidationLog.length > 0) {
      logger.info(`Batch consolidation: ${batchConsolidationLog.length} batch variants consolidated during import`);
      for (const log of batchConsolidationLog) {
        logger.info(`  Row ${log.row}: ${log.message}`);
      }
    }

    logger.info(`Import ${type} finished: ${successCount} successful, ${errors.length} errors.`);

    return job.toJSON();
  }

  async getJobs(params: QueryParams) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const skip = (page - 1) * limit;

    const [jobs, total] = await Promise.all([
      ImportJobModel.find({})
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
    const job = await ImportJobModel.findById(id).populate('createdBy', 'name email').lean();
    if (!job) {
      throw new ApiError('Import job not found', 404, ERROR_CODES.IMPORT_JOB_NOT_FOUND);
    }
    return job;
  }
}

export const importService = new ImportService();
