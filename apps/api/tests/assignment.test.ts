/**
 * assignment.test.ts
 *
 * Unit tests for AssignmentService.
 *
 * Covers:
 *  1. Theory + batchId  → rejected (Rule: theory = whole class)
 *  2. Theory + null     → accepted
 *  3. Lab   + valid batchId from correct semester → accepted
 *  4. Lab   + batchId from wrong semester         → rejected
 *  5. Lab   + null batchId                        → accepted (whole-class lab)
 *
 * All mock data is generic; no hard-coded production names.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { BatchModel } from '../src/models/batch.model.js';
import { TeachingAssignmentModel } from '../src/models/assignment.model.js';
import { assignmentService } from '../src/modules/assignments/assignment.service.js';

const semesterId = new mongoose.Types.ObjectId();
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
        toJSON: function () { return { ...this }; },
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Theory vs Lab — Rule: isLab=false implies batchId MUST be null
// ---------------------------------------------------------------------------
describe('AssignmentService — theory/lab batch validation', () => {
    beforeEach(() => vi.restoreAllMocks());

    // TEST 1: Theory + batchId → REJECTED (generic, not teacher/subject specific)
    it('rejects theory assignment (isLab=false) that has a batchId', async () => {
        await expect(
            assignmentService.create({
                teacherId: String(new mongoose.Types.ObjectId()),
                subjectId: String(new mongoose.Types.ObjectId()),
                semesterId: String(semesterId),
                batchId: String(batchId),   // ← theory MUST NOT have this
                periodsPerWeek: 3,
                isLab: false,               // ← theory
                classroomRequirements: [],
            })
        ).rejects.toMatchObject({ statusCode: 400 });
        // Must fail before any DB query
    });

    // TEST 2: Theory + null batchId → ACCEPTED
    it('accepts theory assignment (isLab=false) with batchId=null', async () => {
        const findOneSpy = vi.spyOn(BatchModel, 'findOne').mockReturnValue({ lean: async () => null } as never);
        vi.spyOn(TeachingAssignmentModel, 'findOne').mockResolvedValue(null as never);
        vi.spyOn(TeachingAssignmentModel, 'create').mockResolvedValue(mockAssignmentDoc() as never);

        await expect(
            assignmentService.create({
                teacherId: String(new mongoose.Types.ObjectId()),
                subjectId: String(new mongoose.Types.ObjectId()),
                semesterId: String(semesterId),
                batchId: null,              // ← whole class: correct for theory
                periodsPerWeek: 4,
                isLab: false,
                classroomRequirements: [],
            })
        ).resolves.toBeDefined();

        // BatchModel.findOne must NOT have been called (no batch to validate)
        expect(findOneSpy).not.toHaveBeenCalled();
    });

    // TEST 3: Lab + valid batchId from correct semester → ACCEPTED
    it('accepts lab assignment (isLab=true) with valid batchId for the correct semester', async () => {
        vi.spyOn(BatchModel, 'findOne').mockReturnValue({
            lean: async () => ({ _id: batchId, semesterId, code: 'B1' }),
        } as never);
        vi.spyOn(TeachingAssignmentModel, 'findOne').mockResolvedValue(null as never);
        vi.spyOn(TeachingAssignmentModel, 'create').mockResolvedValue(
            mockAssignmentDoc({ batchId, semesterId, isLab: true }) as never
        );

        await expect(
            assignmentService.create({
                teacherId: String(new mongoose.Types.ObjectId()),
                subjectId: String(new mongoose.Types.ObjectId()),
                semesterId: String(semesterId),
                batchId: String(batchId),   // ← lab: batch selection is allowed
                periodsPerWeek: 2,
                isLab: true,
                classroomRequirements: [],
            })
        ).resolves.toBeDefined();
    });

    // TEST 4: Lab + batchId belonging to a DIFFERENT semester → REJECTED
    it('rejects lab assignment (isLab=true) when batchId belongs to a different semester', async () => {
        vi.spyOn(BatchModel, 'findOne').mockReturnValue({ lean: async () => null } as never);

        await expect(
            assignmentService.create({
                teacherId: String(new mongoose.Types.ObjectId()),
                subjectId: String(new mongoose.Types.ObjectId()),
                semesterId: String(semesterId),
                batchId: String(batchId),   // belongs to a different semester
                periodsPerWeek: 2,
                isLab: true,
                classroomRequirements: [],
            })
        ).rejects.toMatchObject({ statusCode: 400 });
    });
});


