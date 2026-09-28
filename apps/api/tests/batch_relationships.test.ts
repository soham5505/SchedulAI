import { beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { BatchModel } from '../src/models/batch.model.js';
import { TeachingAssignmentModel } from '../src/models/assignment.model.js';
import { TimetableEntryModel } from '../src/models/timetable.model.js';
import { assignmentService } from '../src/modules/assignments/assignment.service.js';
import { timetableService } from '../src/modules/timetables/timetable.service.js';

const semesterId = new mongoose.Types.ObjectId();
const otherSemesterId = new mongoose.Types.ObjectId();
const batchB1 = new mongoose.Types.ObjectId();
const batchB2 = new mongoose.Types.ObjectId();

function batchLookup(result: unknown) {
  return vi.spyOn(BatchModel, 'findOne').mockReturnValue({ lean: async () => result } as never);
}

function assignmentDocument(batchId?: mongoose.Types.ObjectId) {
  return {
    _id: new mongoose.Types.ObjectId(),
    semesterId,
    ...(batchId ? { batchId } : {}),
    save: vi.fn(),
    toJSON: function () { return { semesterId: this.semesterId, batchId: this.batchId }; },
  };
}

function timetableDocument(batchId?: mongoose.Types.ObjectId) {
  return {
    _id: new mongoose.Types.ObjectId(),
    semesterId,
    ...(batchId ? { batchId } : {}),
    save: vi.fn(),
    toJSON: function () { return { semesterId: this.semesterId, batchId: this.batchId }; },
  };
}

describe('batch relationships on assignments and timetable entries', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('keeps legacy assignments without a batch and accepts whole-class semantics', async () => {
    const assignment = assignmentDocument();
    vi.spyOn(TeachingAssignmentModel, 'findOne').mockResolvedValue(null);
    vi.spyOn(TeachingAssignmentModel, 'create').mockResolvedValue(assignment as never);

    const result = await assignmentService.create({ semesterId, teacherId: 'teacher', subjectId: 'subject' });
    expect(result.batchId).toBeUndefined();
  });

  it.each([['B1', batchB1], ['B2', batchB2]])('accepts an assignment for %s', async (_code, id) => {
    const assignment = assignmentDocument(id);
    batchLookup({ _id: id, semesterId });
    vi.spyOn(TeachingAssignmentModel, 'findOne').mockResolvedValue(null);
    vi.spyOn(TeachingAssignmentModel, 'create').mockResolvedValue(assignment as never);

    const result = await assignmentService.create({ semesterId, batchId: id, isLab: true, teacherId: 'teacher', subjectId: 'subject' });
    expect(result.batchId).toBe(id);
  });

  it('rejects an invalid batch reference', async () => {
    batchLookup(null);
    await expect(assignmentService.create({ semesterId, batchId: new mongoose.Types.ObjectId(), isLab: true, teacherId: 'teacher', subjectId: 'subject' })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects a batch belonging to another semester', async () => {
    batchLookup(null);
    vi.spyOn(TeachingAssignmentModel, 'findOne').mockResolvedValue(null);
    await expect(assignmentService.create({ semesterId, batchId: batchB1, isLab: true, teacherId: 'teacher', subjectId: 'subject' })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('preserves the existing duplicate assignment behavior', async () => {
    batchLookup({ _id: batchB1, semesterId });
    vi.spyOn(TeachingAssignmentModel, 'findOne').mockResolvedValue({ _id: new mongoose.Types.ObjectId() } as never);
    await expect(assignmentService.create({ semesterId, batchId: batchB1, isLab: true, teacherId: 'teacher', subjectId: 'subject' })).rejects.toMatchObject({ statusCode: 409 });
  });

  it('keeps legacy timetable entries without a batch', async () => {
    const entry = timetableDocument();
    vi.spyOn(TimetableEntryModel, 'findById').mockResolvedValue(entry as never);
    entry.save.mockResolvedValue(entry as never);
    await expect(timetableService.updateEntry(String(entry._id), {})).resolves.toMatchObject({ batchId: undefined });
  });

  it.each([['B1', batchB1], ['B2', batchB2]])('updates a timetable entry with %s', async (_code, id) => {
    const entry = timetableDocument();
    vi.spyOn(TimetableEntryModel, 'findById').mockResolvedValue(entry as never);
    batchLookup({ _id: id, semesterId });
    entry.save.mockResolvedValue(entry as never);

    const result = await timetableService.updateEntry(String(entry._id), { batchId: id });
    expect(result.batchId).toBe(id);
  });

  it('rejects a timetable batch from another semester', async () => {
    const entry = timetableDocument();
    vi.spyOn(TimetableEntryModel, 'findById').mockResolvedValue(entry as never);
    batchLookup(null);
    await expect(timetableService.updateEntry(String(entry._id), { batchId: batchB1 })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('preserves batch information through service serialization', async () => {
    const entry = timetableDocument(batchB1);
    vi.spyOn(TimetableEntryModel, 'findById').mockResolvedValue(entry as never);
    const result = await timetableService.updateEntry(String(entry._id), {});
    expect(result).toEqual(expect.objectContaining({ batchId: batchB1 }));
  });
});