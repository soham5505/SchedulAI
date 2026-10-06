import { beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { importService } from '../src/modules/imports/import.service.js';
import { ImportJobModel } from '../src/models/importJob.model.js';
import { DepartmentModel } from '../src/models/department.model.js';
import { TeacherModel } from '../src/models/teacher.model.js';
import { SubjectModel } from '../src/models/subject.model.js';
import { SemesterModel } from '../src/models/semester.model.js';
import { BatchModel } from '../src/models/batch.model.js';
import { ClassroomModel } from '../src/models/classroom.model.js';
import { TeachingAssignmentModel } from '../src/models/assignment.model.js';

const semesterId = new mongoose.Types.ObjectId();
const teacherId = new mongoose.Types.ObjectId();
const subjectId = new mongoose.Types.ObjectId();
const classroomId = new mongoose.Types.ObjectId();
const batches = new Map([
  ['B1', new mongoose.Types.ObjectId()],
  ['B2', new mongoose.Types.ObjectId()],
  ['B3', new mongoose.Types.ObjectId()],
]);

function queryResult(value: unknown) {
  return { lean: async () => value };
}

function createJob() {
  return {
    _id: new mongoose.Types.ObjectId(),
    processedRows: 0,
    successRows: 0,
    errorRows: 0,
    skippedRows: 0,
    totalSheets: 0,
    warnings: [],
    worksheetResults: [],
    rowErrors: [],
    progress: 0,
    status: 'PROCESSING',
    totalRows: 0,
    save: vi.fn(),
    toJSON: function () { return this; },
  };
}

describe('batch-aware Excel assignment import', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(ImportJobModel, 'create').mockResolvedValue(createJob() as never);
    vi.spyOn(DepartmentModel, 'find').mockReturnValue(queryResult([]) as never);
    vi.spyOn(TeacherModel, 'findOne').mockResolvedValue({ _id: teacherId } as never);
    vi.spyOn(SubjectModel, 'findOne').mockResolvedValue({ _id: subjectId, code: 'IOE', isLab: true } as never);
    vi.spyOn(SemesterModel, 'findOne').mockResolvedValue({ _id: semesterId } as never);
    vi.spyOn(SemesterModel, 'find').mockReturnValue(queryResult([{ _id: semesterId, name: 'Sem A' }]) as never);
    vi.spyOn(BatchModel, 'find').mockReturnValue(queryResult([]) as never);
    vi.spyOn(ClassroomModel, 'findOne').mockReturnValue(queryResult({ _id: classroomId }) as never);
    vi.spyOn(TeachingAssignmentModel, 'findOne').mockReturnValue(queryResult(null) as never);
    vi.spyOn(TeachingAssignmentModel, 'findOneAndUpdate').mockResolvedValue({} as never);
  });

  it('preserves the same course for B1, B2, and B3 with separate faculty rows', async () => {
    vi.spyOn(BatchModel, 'findOne').mockImplementation((filter: { code: string }) => queryResult({ _id: batches.get(filter.code) }) as never);
    const job = await importService.executeImport(
      'ASSIGNMENTS',
      { employeeId: 'Faculty ID', code: 'Course Code', name: 'Semester', batchCode: 'Batch', location: 'Location', weeklyPeriods: 'Hours' },
      ['B1', 'B2', 'B3'].map((batch) => ({ 'Faculty ID': batch, 'Course Code': 'IOE', Semester: 'Sem A', Batch: batch, Location: 'Lab A', Hours: 2 })),
      'assignments.xlsx', undefined, { _id: new mongoose.Types.ObjectId() } as never
    );

    expect(job.successRows).toBe(3);
    expect(job.errorRows).toBe(0);
    expect(TeachingAssignmentModel.findOneAndUpdate).toHaveBeenCalledTimes(3);
    expect(TeachingAssignmentModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ batchId: batches.get('B1') }), expect.objectContaining({ classroomId }), expect.anything()
    );
  });

  it('reports an exact duplicate batch row instead of silently discarding it', async () => {
    vi.spyOn(BatchModel, 'findOne').mockReturnValue(queryResult({ _id: batches.get('B1') }) as never);
    const job = await importService.executeImport(
      'ASSIGNMENTS',
      { employeeId: 'Faculty ID', code: 'Course Code', name: 'Semester', batchCode: 'Batch' },
      [
        { 'Faculty ID': 'T1', 'Course Code': 'IOE', Semester: 'Sem A', Batch: ' B-1 ' },
        { 'Faculty ID': 'T1', 'Course Code': 'IOE', Semester: 'Sem A', Batch: 'B1' },
      ],
      'assignments.xlsx', undefined, { _id: new mongoose.Types.ObjectId() } as never
    );

    expect(job.successRows).toBe(1);
    expect(job.errorRows).toBe(1);
    expect(job.rowErrors[0].message).toContain('Duplicate assignment');
  });

  it('rejects lab assignment imports unless weekly periods equal two', async () => {
    vi.spyOn(BatchModel, 'findOne').mockReturnValue(queryResult({ _id: batches.get('B1') }) as never);
    const job = await importService.executeImport(
      'ASSIGNMENTS',
      { employeeId: 'Faculty ID', code: 'Course Code', name: 'Semester', batchCode: 'Batch', weeklyPeriods: 'Hours' },
      [{ 'Faculty ID': 'T1', 'Course Code': 'IOE', Semester: 'Sem A', Batch: 'B1', Hours: 1 }],
      'assignments.xlsx', undefined, { _id: new mongoose.Types.ObjectId() } as never
    );

    expect(job.successRows).toBe(0);
    expect(job.errorRows).toBe(1);
    expect(job.rowErrors[0].message).toContain('exactly 2 periods per week');
    expect(TeachingAssignmentModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('keeps a legacy assignment without a batch as whole-class data', async () => {
    vi.spyOn(SubjectModel, 'findOne').mockResolvedValue({ _id: subjectId, code: 'IOE', isLab: false } as never);
    const job = await importService.executeImport(
      'ASSIGNMENTS',
      { employeeId: 'Faculty ID', code: 'Course Code', name: 'Semester' },
      [{ 'Faculty ID': 'T1', 'Course Code': 'IOE', Semester: 'Sem A' }],
      'legacy.xlsx', undefined, { _id: new mongoose.Types.ObjectId() } as never
    );

    expect(job.successRows).toBe(1);
    expect(TeachingAssignmentModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ subjectId, batchId: null }), expect.objectContaining({ batchId: null }), expect.anything()
    );
  });

  it('rejects an unknown batch for the resolved semester', async () => {
    vi.spyOn(BatchModel, 'findOne').mockReturnValue(queryResult(null) as never);
    const job = await importService.executeImport(
      'ASSIGNMENTS',
      { employeeId: 'Faculty ID', code: 'Course Code', name: 'Semester', batchCode: 'Batch' },
      [{ 'Faculty ID': 'T1', 'Course Code': 'IOE', Semester: 'Sem A', Batch: 'X99' }],
      'assignments.xlsx', undefined, { _id: new mongoose.Types.ObjectId() } as never
    );

    expect(job.successRows).toBe(0);
    expect(job.errorRows).toBe(1);
    expect(job.rowErrors[0].message).toContain("Batch 'X99' not found");
  });

  it('rejects an ambiguous semester name instead of selecting an arbitrary semester', async () => {
    vi.spyOn(SemesterModel, 'find').mockReturnValue(queryResult([
      { _id: semesterId, name: 'Sem A' },
      { _id: new mongoose.Types.ObjectId(), name: 'Sem A' },
    ]) as never);
    const job = await importService.executeImport(
      'ASSIGNMENTS',
      { employeeId: 'Faculty ID', code: 'Course Code', name: 'Semester' },
      [{ 'Faculty ID': 'T1', 'Course Code': 'IOE', Semester: 'Sem A' }],
      'assignments.xlsx', undefined, { _id: new mongoose.Types.ObjectId() } as never
    );

    expect(job.successRows).toBe(0);
    expect(job.status).toBe('FAILED');
    expect(job.rowErrors[0].message).toContain('ambiguous');
  });

  it('resolves a semester directly by semesterId without requiring its name', async () => {
    vi.spyOn(SubjectModel, 'findOne').mockResolvedValue({ _id: subjectId, code: 'IOE', isLab: false } as never);
    const job = await importService.executeImport(
      'ASSIGNMENTS',
      { employeeId: 'Faculty ID', code: 'Course Code', semesterId: 'Semester ID', weeklyPeriods: 'Hours' },
      [{ 'Faculty ID': 'T1', 'Course Code': 'IOE', 'Semester ID': semesterId.toString(), Hours: 3 }],
      'assignments.xlsx', undefined, { _id: new mongoose.Types.ObjectId() } as never
    );

    expect(job.successRows).toBe(1);
    expect(SemesterModel.find).toHaveBeenCalledWith(expect.objectContaining({ _id: semesterId, isActive: true }));
  });

  it('resolves a numeric value in Semester ID as a semester number only with full identity fields', async () => {
    const departmentId = new mongoose.Types.ObjectId();
    vi.spyOn(DepartmentModel, 'findOne').mockResolvedValue({ _id: departmentId } as never);
    vi.spyOn(SubjectModel, 'findOne').mockResolvedValue({ _id: subjectId, code: 'IOE', isLab: false } as never);
    const job = await importService.executeImport(
      'ASSIGNMENTS',
      {
        employeeId: 'Faculty ID', code: 'Course Code', semesterId: 'Semester ID',
        departmentCode: 'Department', academicYear: 'Year', section: 'Section',
      },
      [{
        'Faculty ID': 'T1', 'Course Code': 'IOE', 'Semester ID': '3',
        Department: 'IT', Year: '2026-2027', Section: 'A',
      }],
      'assignments.xlsx', undefined, { _id: new mongoose.Types.ObjectId() } as never
    );

    expect(job.successRows).toBe(1);
    expect(SemesterModel.find).toHaveBeenCalledWith(expect.objectContaining({
      departmentId,
      academicYear: '2026-2027',
      number: 3,
      section: 'A',
      isActive: true,
    }));
    expect(SemesterModel.find).not.toHaveBeenCalledWith(expect.objectContaining({ _id: expect.anything() }));
  });

  it('reports a row-level error when both semester name and ID are missing', async () => {
    vi.spyOn(SubjectModel, 'findOne').mockResolvedValue({ _id: subjectId, code: 'IOE', isLab: false } as never);
    const job = await importService.executeImport(
      'ASSIGNMENTS',
      { employeeId: 'Faculty ID', code: 'Course Code' },
      [{ 'Faculty ID': 'T1', 'Course Code': 'IOE' }],
      'assignments.xlsx', undefined, { _id: new mongoose.Types.ObjectId() } as never
    );

    expect(job.successRows).toBe(0);
    expect(job.errorRows).toBe(1);
    expect(job.rowErrors[0].message).toContain('Semester name or Semester ID is required');
  });

  it('filters semester resolution by department and academic year when provided', async () => {
    vi.spyOn(SubjectModel, 'findOne').mockResolvedValue({ _id: subjectId, code: 'IOE', isLab: false } as never);
    const departmentId = new mongoose.Types.ObjectId();
    vi.spyOn(DepartmentModel, 'findOne').mockResolvedValue({ _id: departmentId } as never);
    await importService.executeImport(
      'ASSIGNMENTS',
      {
        employeeId: 'Faculty ID', code: 'Course Code', name: 'Semester',
        departmentCode: 'Department', academicYear: 'Academic Year', number: 'Number', section: 'Section',
      },
      [{
        'Faculty ID': 'T1', 'Course Code': 'IOE', Semester: 'Sem A', Department: 'IT',
        'Academic Year': '2026-2027', Number: 3, Section: 'B',
      }],
      'assignments.xlsx', undefined, { _id: new mongoose.Types.ObjectId() } as never
    );

    expect(SemesterModel.find).toHaveBeenCalledWith(expect.objectContaining({
      name: expect.any(Object),
      departmentId,
      academicYear: '2026-2027',
      number: 3,
      section: 'B',
    }));
  });

  it('rejects a lab row without a valid batchCode', async () => {
    const job = await importService.executeImport(
      'ASSIGNMENTS',
      { employeeId: 'Faculty ID', code: 'Course Code', name: 'Semester', weeklyPeriods: 'Hours' },
      [{ 'Faculty ID': 'T1', 'Course Code': 'IOE', Semester: 'Sem A', Hours: 2 }],
      'assignments.xlsx', undefined, { _id: new mongoose.Types.ObjectId() } as never
    );

    expect(job.successRows).toBe(0);
    expect(job.rowErrors[0].message).toContain('requires a valid B1-B4 batchCode');
  });

  it('rejects duplicate course/semester/batch rows even when the faculty differs', async () => {
    vi.spyOn(BatchModel, 'findOne').mockReturnValue(queryResult({ _id: batches.get('B1') }) as never);
    const job = await importService.executeImport(
      'ASSIGNMENTS',
      { employeeId: 'Faculty ID', code: 'Course Code', name: 'Semester', batchCode: 'Batch', weeklyPeriods: 'Hours' },
      [
        { 'Faculty ID': 'T1', 'Course Code': 'IOE', Semester: 'Sem A', Batch: 'B1', Hours: 2 },
        { 'Faculty ID': 'T2', 'Course Code': 'IOE', Semester: 'Sem A', Batch: 'B1', Hours: 2 },
      ],
      'assignments.xlsx', undefined, { _id: new mongoose.Types.ObjectId() } as never
    );

    expect(job.successRows).toBe(1);
    expect(job.errorRows).toBe(1);
    expect(job.rowErrors[0].message).toContain('Duplicate assignment for this course, semester, and batch');
    expect(TeachingAssignmentModel.findOneAndUpdate).toHaveBeenCalledTimes(1);
  });

  it('does not insert a second assignment when the same course scope already belongs to another teacher', async () => {
    const existingTeacherId = new mongoose.Types.ObjectId();
    vi.spyOn(SubjectModel, 'findOne').mockResolvedValue({ _id: subjectId, code: 'IOE', isLab: false } as never);
    vi.spyOn(TeachingAssignmentModel, 'findOne').mockReturnValue(queryResult({ teacherId: existingTeacherId }) as never);
    const job = await importService.executeImport(
      'ASSIGNMENTS',
      { employeeId: 'Faculty ID', code: 'Course Code', name: 'Semester' },
      [{ 'Faculty ID': 'T2', 'Course Code': 'IOE', Semester: 'Sem A' }],
      'assignments.xlsx', undefined, { _id: new mongoose.Types.ObjectId() } as never
    );

    expect(job.successRows).toBe(0);
    expect(job.errorRows).toBe(1);
    expect(job.rowErrors[0].message).toContain('already has an assignment with a different teacher');
    expect(TeachingAssignmentModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('imports 5 theory courses and 4 labs across all four batches for three semester identities', async () => {
    const itDepartmentId = new mongoose.Types.ObjectId();
    const csDepartmentId = new mongoose.Types.ObjectId();
    const semesterRecords = [
      { _id: new mongoose.Types.ObjectId(), name: 'SEM 3', number: 3, section: 'A', academicYear: '2026-2027', departmentId: itDepartmentId, isActive: true },
      { _id: new mongoose.Types.ObjectId(), name: 'SEM 5', number: 5, section: 'A', academicYear: '2026-2027', departmentId: itDepartmentId, isActive: true },
      { _id: new mongoose.Types.ObjectId(), name: 'SEM 6', number: 6, section: 'A', academicYear: '2026-2027', departmentId: itDepartmentId, isActive: true },
      { _id: new mongoose.Types.ObjectId(), name: 'SEM 3', number: 3, section: 'A', academicYear: '2026-2027', departmentId: csDepartmentId, isActive: true },
    ];
    const batchRecords = semesterRecords.flatMap((semester) =>
      ['B1', 'B2', 'B3', 'B4'].map((code) => ({
        _id: new mongoose.Types.ObjectId(), semesterId: semester._id, code, isActive: true,
      }))
    );
    const batchSemesterById = new Map(batchRecords.map((batch) => [String(batch._id), String(batch.semesterId)]));
    const batchCodeById = new Map(batchRecords.map((batch) => [String(batch._id), batch.code]));
    const subjectIds = new Map<string, mongoose.Types.ObjectId>();
    const teacherIds = new Map<string, mongoose.Types.ObjectId>();

    vi.spyOn(DepartmentModel, 'findOne').mockImplementation(async ({ code }: { code: string }) => ({
      _id: code === 'IT' ? itDepartmentId : csDepartmentId,
    }) as never);
    vi.spyOn(SemesterModel, 'find').mockImplementation((query: Record<string, any>) => queryResult(
      semesterRecords.filter((semester) => {
        const namePattern = query.name?.$regex as RegExp | undefined;
        return (!namePattern || namePattern.test(semester.name)) &&
          (!query.number || query.number === semester.number) &&
          (!query.section || query.section === semester.section) &&
          (!query.academicYear || query.academicYear === semester.academicYear) &&
          (!query.departmentId || String(query.departmentId) === String(semester.departmentId)) &&
          query.isActive === semester.isActive;
      })
    ) as never);
    vi.spyOn(BatchModel, 'find').mockImplementation((query: Record<string, any>) => queryResult(
      batchRecords.filter((batch) => String(batch.semesterId) === String(query.semesterId) && batch.isActive)
    ) as never);
    vi.spyOn(BatchModel, 'findOne').mockImplementation((query: Record<string, any>) => queryResult(
      batchRecords.find((batch) => String(batch.semesterId) === String(query.semesterId) && batch.code === query.code && batch.isActive) || null
    ) as never);
    vi.spyOn(TeacherModel, 'findOne').mockImplementation(async (query: Record<string, any>) => {
      const key = query.employeeId as string;
      if (!teacherIds.has(key)) teacherIds.set(key, new mongoose.Types.ObjectId());
      return { _id: teacherIds.get(key) } as never;
    });
    vi.spyOn(SubjectModel, 'findOne').mockImplementation(async (query: Record<string, any>) => {
      const code = query.code as string;
      if (!subjectIds.has(code)) subjectIds.set(code, new mongoose.Types.ObjectId());
      return { _id: subjectIds.get(code), code, isLab: code.includes('-LAB-') } as never;
    });

    const rows: Record<string, unknown>[] = [];
    for (const semester of semesterRecords.slice(0, 3)) {
      const semesterNumber = semester.number;
      for (let subjectIndex = 1; subjectIndex <= 5; subjectIndex++) {
        rows.push({
          Employee: `T-${semesterNumber}-${subjectIndex}`,
          Subject: `${semesterNumber}-THEORY-${subjectIndex}`,
          Semester: semester.name,
          Department: 'IT',
          Year: semester.academicYear,
          Number: semester.number,
          Section: semester.section,
          Batch: '',
          Periods: 3,
        });
      }
      for (let labIndex = 1; labIndex <= 4; labIndex++) {
        for (const batchCode of ['B1', 'B2', 'B3', 'B4']) {
          rows.push({
            Employee: `L-${semesterNumber}-${labIndex}-${batchCode}`,
            Subject: `${semesterNumber}-LAB-${labIndex}`,
            Semester: semester.name,
            Department: 'IT',
            Year: semester.academicYear,
            Number: semester.number,
            Section: semester.section,
            Batch: batchCode,
            Periods: 2,
          });
        }
      }
    }

    const job = await importService.executeImport(
      'ASSIGNMENTS',
      {
        employeeId: 'Employee', code: 'Subject', name: 'Semester', departmentCode: 'Department',
        academicYear: 'Year', number: 'Number', section: 'Section', batchCode: 'Batch', weeklyPeriods: 'Periods',
      },
      rows,
      'assignments.xlsx', undefined, { _id: new mongoose.Types.ObjectId() } as never
    );

    expect(rows).toHaveLength(63);
    expect(job.successRows).toBe(63);
    expect(job.errorRows).toBe(0);
    expect(job.status).toBe('COMPLETED');
    expect(TeachingAssignmentModel.findOneAndUpdate).toHaveBeenCalledTimes(63);

    const writtenAssignments = (TeachingAssignmentModel.findOneAndUpdate as unknown as { mock: { calls: Array<[Record<string, any>, Record<string, any>]> } }).mock.calls;
    for (const semester of semesterRecords.slice(0, 3)) {
      const semesterWrites = writtenAssignments.filter(([filter]) => String(filter.semesterId) === String(semester._id));
      expect(semesterWrites.filter(([, update]) => update.isLab === false)).toHaveLength(5);
      const labWrites = semesterWrites.filter(([, update]) => update.isLab === true);
      expect(labWrites).toHaveLength(16);
      const assignedBatchIds = new Set(labWrites.map(([, update]) => String(update.batchId)));
      expect(assignedBatchIds.size).toBe(4);
      expect(new Set([...assignedBatchIds].map((batchId) => batchCodeById.get(batchId))).size).toBe(4);
      expect(labWrites.every(([, update]) => batchSemesterById.get(String(update.batchId)) === String(semester._id))).toBe(true);
    }
  });

  it('imports explicit batch worksheets using a semester identity and batch strength', async () => {
    const batchId = new mongoose.Types.ObjectId();
    vi.spyOn(BatchModel, 'findOneAndUpdate').mockResolvedValue({ _id: batchId } as never);
    const job = await importService.executeImport(
      'BATCHES',
      { name: 'Semester', batchCode: 'Batch', studentCount: 'Students' },
      [{ Semester: 'Sem A', Batch: 'B4', Students: 18 }],
      'batches.xlsx', undefined, { _id: new mongoose.Types.ObjectId() } as never
    );

    expect(job.successRows).toBe(1);
    expect(BatchModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ semesterId, code: 'B4' }),
      expect.objectContaining({ studentCount: 18, isActive: true }),
      expect.anything()
    );
  });

  it('processes every recognized master sheet and reports unknown worksheets as skipped', async () => {
    const processedTypes: string[] = [];
    const processRows = vi.spyOn(importService as any, 'processEntityRows').mockImplementation(
      async (type: string, _mapping: unknown, rows: unknown[]) => {
        processedTypes.push(type);
        return { successCount: rows.length, errors: [] };
      }
    );
    const job = await importService.executeMasterImport(
      {
        Teachers: [{ name: 'First' }],
        Faculty: [{ name: 'Second' }],
        Subjects: [{ code: 'S1' }],
        Classrooms: [{ roomNumber: 'R1' }],
        Semesters: [{ name: 'Sem A' }],
        Batches: [{ batchCode: 'B1' }],
        Assignments: [{ code: 'S1' }],
        TimeSlots: [{ day: 'MONDAY' }],
        Notes: [{ value: 'not imported' }],
      },
      'master.xlsx', undefined, { _id: new mongoose.Types.ObjectId() } as never
    );

    expect(processRows).toHaveBeenCalledTimes(8);
    expect(processedTypes).toEqual([
      'TEACHERS', 'TEACHERS', 'SUBJECTS', 'CLASSROOMS', 'SEMESTERS', 'BATCHES', 'ASSIGNMENTS', 'TIMESLOTS',
    ]);
    expect(job.totalRows).toBe(9);
    expect(job.processedRows).toBe(8);
    expect(job.successRows).toBe(8);
    expect(job.errorRows).toBe(0);
    expect(job.skippedRows).toBe(1);
    expect(job.status).toBe('PARTIAL');
    expect(job.worksheetResults.find((sheet: { sheetName: string }) => sheet.sheetName === 'Notes').warnings[0]).toContain('skipped');
  });

  it('marks an entirely invalid master import failed and an empty master import failed', async () => {
    vi.spyOn(importService as any, 'processEntityRows').mockResolvedValue({
      successCount: 0,
      errors: [{ row: 2, field: 'row', message: 'invalid row', sheetName: 'Teachers', entityType: 'TEACHERS' }],
    });
    const invalidJob = await importService.executeMasterImport(
      { Teachers: [{ name: 'bad' }] }, 'invalid.xlsx', undefined, { _id: new mongoose.Types.ObjectId() } as never
    );
    expect(invalidJob.status).toBe('FAILED');
    expect(invalidJob.successRows).toBe(0);
    expect(invalidJob.errorRows).toBe(1);

    const emptyJob = await importService.executeMasterImport(
      { Teachers: [] }, 'empty.xlsx', undefined, { _id: new mongoose.Types.ObjectId() } as never
    );
    expect(emptyJob.status).toBe('FAILED');
    expect(emptyJob.successRows).toBe(0);
  });

  it('returns import diagnostics without exposing original spreadsheet row values', async () => {
    const jobId = new mongoose.Types.ObjectId();
    const detail = {
      _id: jobId,
      rowErrors: [{
        row: 4,
        field: 'email',
        message: 'Valid email is required',
        sheetName: 'Teachers',
        entityType: 'TEACHERS',
        value: { email: 'private@example.edu' },
      }],
    };
    vi.spyOn(ImportJobModel, 'findById').mockReturnValue({
      populate: () => ({ lean: async () => detail }),
    } as never);

    const result = await importService.getJobById(jobId.toString());

    expect(result.rowErrors[0]).toMatchObject({ row: 4, field: 'email', sheetName: 'Teachers', entityType: 'TEACHERS' });
    expect(result.rowErrors[0]).not.toHaveProperty('value');
  });

  it('returns a not-found error for malformed import-job IDs', async () => {
    await expect(importService.getJobById('not-an-object-id')).rejects.toThrow('Import job not found');
  });
});