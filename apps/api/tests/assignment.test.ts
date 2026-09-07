/**
 * assignment.test.ts
 *
 * Unit tests for AssignmentService — focuses on batch validation behaviour.
 *
 * All mock data is generic; no hard-coded production values.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { BatchModel } from '../src/models/batch.model.js';
import { TeachingAssignmentModel } from '../src/models/assignment.model.js';
import { assignmentService } from '../src/modules/assignments/assignment.service.js';

const semesterId = new mongoose.Types.ObjectId();
const otherSemesterId = new mongoose.Types.ObjectId();
const batchId = new mongoose.Types.ObjectId();

function mockAssignmentDoc(overrides: Record<string, unknown> = {}) {
    return {
        _id: new mongoose.Types.ObjectId(),
        teacherId: new mongoose.Types.ObjectId(),
        subjectId: new mongoose.Types.ObjectId(),
        semesterId,
        batchId: null,
        periodsPerWeek: 4,
        isLab: false,
        classroomRequirements: [],
        save: vi.fn(),
        toJSON: function () {
            return { ...this };
        },
        ...overrides,
    };
}

describe('AssignmentService — batch validation', () => {
    beforeEach(() => vi.restoreAllMocks());

    it('rejects a batchId that does not belong to the assignment semester (cross-semester)', async () => {
        // BatchModel.findOne returns null → batch not in this semester
        vi.spyOn(BatchModel, 'findOne').mockReturnValue({ lean: async () => null } as never);

        await expect(
            assignmentService.create({
                teacherId: String(new mongoose.Types.ObjectId()),
                subjectId: String(new mongoose.Types.ObjectId()),
                semesterId: String(semesterId),
                batchId: String(batchId), // batch belongs to otherSemesterId, not semesterId
                periodsPerWeek: 3,
                isLab: false,
                classroomRequirements: [],
            })
        ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('accepts null batchId (whole-class assignment — no batch validation needed)', async () => {
        // validateBatch should not call BatchModel.findOne when batchId is null
        const findOneSpy = vi.spyOn(BatchModel, 'findOne').mockReturnValue({ lean: async () => null } as never);
        vi.spyOn(TeachingAssignmentModel, 'findOne').mockResolvedValue(null as never);
        vi.spyOn(TeachingAssignmentModel, 'create').mockResolvedValue(mockAssignmentDoc() as never);

        await expect(
            assignmentService.create({
                teacherId: String(new mongoose.Types.ObjectId()),
                subjectId: String(new mongoose.Types.ObjectId()),
                semesterId: String(semesterId),
                batchId: null, // whole-class
                periodsPerWeek: 4,
                isLab: false,
                classroomRequirements: [],
            })
        ).resolves.toBeDefined();

        // BatchModel.findOne must NOT have been called because batchId is null
        expect(findOneSpy).not.toHaveBeenCalled();
    });

    it('accepts a valid batchId that belongs to the correct semester', async () => {
        // BatchModel.findOne returns a batch document → validation passes
        vi.spyOn(BatchModel, 'findOne').mockReturnValue({
            lean: async () => ({ _id: batchId, semesterId, code: 'GRP-V' }),
        } as never);
        vi.spyOn(TeachingAssignmentModel, 'findOne').mockResolvedValue(null as never);
        vi.spyOn(TeachingAssignmentModel, 'create').mockResolvedValue(
            mockAssignmentDoc({ batchId, semesterId }) as never
        );

        await expect(
            assignmentService.create({
                teacherId: String(new mongoose.Types.ObjectId()),
                subjectId: String(new mongoose.Types.ObjectId()),
                semesterId: String(semesterId),
                batchId: String(batchId),
                periodsPerWeek: 3,
                isLab: false,
                classroomRequirements: [],
            })
        ).resolves.toBeDefined();
    });
});
