import { beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { BatchModel } from '../src/models/batch.model.js';
import { SemesterModel } from '../src/models/semester.model.js';
import { TeachingAssignmentModel } from '../src/models/assignment.model.js';
import { TimetableEntryModel } from '../src/models/timetable.model.js';
import { batchService } from '../src/modules/batches/batch.service.js';

const semesterOne = new mongoose.Types.ObjectId();
const semesterTwo = new mongoose.Types.ObjectId();

function batchDocument(code: string, semesterId = semesterOne) {
  return {
    _id: new mongoose.Types.ObjectId(),
    semesterId,
    code,
    studentCount: 30,
    isActive: true,
    save: vi.fn(),
    deleteOne: vi.fn(),
    toJSON: function () { return { code: this.code, semesterId: this.semesterId }; },
  };
}

describe('BatchService', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('creates B1 and B2 in the same semester', async () => {
    vi.spyOn(SemesterModel, 'exists').mockResolvedValue({ _id: semesterOne } as never);
    vi.spyOn(BatchModel, 'exists').mockResolvedValue(null);
    vi.spyOn(BatchModel, 'create')
      .mockResolvedValueOnce(batchDocument('B1') as never)
      .mockResolvedValueOnce(batchDocument('B2') as never);

    await expect(batchService.create({ semesterId: semesterOne, code: 'b1' })).resolves.toMatchObject({ code: 'B1' });
    await expect(batchService.create({ semesterId: semesterOne, code: 'B2' })).resolves.toMatchObject({ code: 'B2' });
  });

  it('rejects a duplicate code within one semester but allows it in another', async () => {
    vi.spyOn(SemesterModel, 'exists').mockResolvedValue({ _id: semesterOne } as never);
    vi.spyOn(BatchModel, 'exists')
      .mockResolvedValueOnce({ _id: new mongoose.Types.ObjectId() } as never)
      .mockResolvedValueOnce(null);
    vi.spyOn(BatchModel, 'create').mockResolvedValue(batchDocument('B1', semesterTwo) as never);

    await expect(batchService.create({ semesterId: semesterOne, code: 'B1' })).rejects.toMatchObject({ statusCode: 409 });
    await expect(batchService.create({ semesterId: semesterTwo, code: 'B1' })).resolves.toMatchObject({ code: 'B1' });
  });

  it('rejects an invalid semester reference', async () => {
    vi.spyOn(SemesterModel, 'exists').mockResolvedValue(null);
    await expect(batchService.create({ semesterId: semesterOne, code: 'B1' })).rejects.toMatchObject({ statusCode: 404 });
  });

  it('lists batches filtered by semester', async () => {
    const batches = [batchDocument('B1'), batchDocument('B2')];
    vi.spyOn(BatchModel, 'find').mockReturnValue({
      sort: () => ({ skip: () => ({ limit: () => ({ populate: () => ({ lean: async () => batches }) }) }) }),
    } as never);
    vi.spyOn(BatchModel, 'countDocuments').mockResolvedValue(2 as never);

    const result = await batchService.getAll({ semesterId: String(semesterOne), page: 1, limit: 20 });
    expect(result.batches).toHaveLength(2);
    expect(result.meta.total).toBe(2);
    expect(BatchModel.find).toHaveBeenCalledWith(expect.objectContaining({ semesterId: String(semesterOne) }));
  });

  it('updates a batch and prevents unsafe deletion', async () => {
    const batch = batchDocument('B1');
    vi.spyOn(BatchModel, 'findById').mockResolvedValue(batch as never);
    vi.spyOn(BatchModel, 'exists').mockResolvedValue(null);
    batch.save.mockResolvedValue(batch as never);
    await expect(batchService.update(String(batch._id), { code: 'B2' })).resolves.toMatchObject({ code: 'B2' });

    vi.spyOn(TeachingAssignmentModel.collection, 'findOne').mockResolvedValue({ _id: new mongoose.Types.ObjectId() } as never);
    vi.spyOn(TimetableEntryModel.collection, 'findOne').mockResolvedValue(null);
    await expect(batchService.delete(String(batch._id))).rejects.toMatchObject({ statusCode: 409 });
  });

  it('deletes a batch with no blocking relationships', async () => {
    const batch = batchDocument('B1');
    vi.spyOn(BatchModel, 'findById').mockResolvedValue(batch as never);
    vi.spyOn(TeachingAssignmentModel.collection, 'findOne').mockResolvedValue(null);
    vi.spyOn(TimetableEntryModel.collection, 'findOne').mockResolvedValue(null);
    batch.deleteOne.mockResolvedValue(batch as never);

    await expect(batchService.delete(String(batch._id))).resolves.toEqual({ deletedId: String(batch._id) });
    expect(batch.deleteOne).toHaveBeenCalledOnce();
  });
});