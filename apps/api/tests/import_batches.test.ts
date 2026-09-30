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
    rowErrors: [],
    progress: 0,
    status: 'PROCESSING',
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
    vi.spyOn(SubjectModel, 'findOne').mockResolvedValue({ _id: subjectId, isLab: true } as never);
    vi.spyOn(SemesterModel, 'findOne').mockResolvedValue({ _id: semesterId } as never);
    vi.spyOn(BatchModel, 'find').mockReturnValue(queryResult([]) as never);
    vi.spyOn(ClassroomModel, 'findOne').mockReturnValue(queryResult({ _id: classroomId }) as never);
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
    const job = await importService.executeImport(
      'ASSIGNMENTS',
      { employeeId: 'Faculty ID', code: 'Course Code', name: 'Semester' },
      [{ 'Faculty ID': 'T1', 'Course Code': 'IOE', Semester: 'Sem A' }],
      'legacy.xlsx', undefined, { _id: new mongoose.Types.ObjectId() } as never
    );

    expect(job.successRows).toBe(1);
    expect(TeachingAssignmentModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ batchId: null }), expect.objectContaining({ batchId: null }), expect.anything()
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
});