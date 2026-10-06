/**
 * pre_flight.test.ts
 *
 * Unit tests for PreFlightValidator and the data-integrity logic
 * used in generation.service.ts.
 *
 * Tests cover:
 *  1. Stale classroomId          → ERROR
 *  2. Stale teacherId            → ERROR
 *  3. Missing teacher (null)     → ERROR
 *  4. Valid repaired assignment  → PASS
 *  5. Missing subject            → ERROR
 *  6. Missing semester           → ERROR
 *  7. periodsPerWeek = 0        → ERROR
 *  8. Stale batchId on lab       → ERROR
 *  9. Lecture capacity too small → ERROR
 * 10. Teacher no availability    → WARNING (not error)
 * 11. Multiple errors on one assignment → all reported
 * 12. Mix of valid and invalid   → only invalid flagged
 * 13. GenerationService.validateAssignmentReferences detects stale teacher
 * 14. GenerationService.validateAssignmentReferences detects stale classroom
 * 15. GenerationService.sanitizeAssignmentsForScheduler strips stale entries
 */

import { describe, it, expect } from 'vitest';
import { PreFlightValidator, PreFlightContext } from '../src/modules/generations/pre-flight-validator.js';
import { GenerationService } from '../src/modules/generations/generation.service.js';
import mongoose from 'mongoose';

// ─── Test helpers ────────────────────────────────────────────────────────────

const NEW_ID = () => new mongoose.Types.ObjectId().toString();

/** Build a minimal valid PreFlightContext with overrides */
function makeCtx(overrides: Partial<PreFlightContext> = {}): PreFlightContext {
  const teacherId = NEW_ID();
  const subjectId = NEW_ID();
  const semesterId = NEW_ID();
  const batchId = NEW_ID();
  const classroomId = NEW_ID();

  return {
    assignments: [
      {
        _id: NEW_ID(),
        teacherId: { _id: teacherId, availability: ['MONDAY', 'TUESDAY'] },
        subjectId: { _id: subjectId },
        semesterId,
        batchId: null,
        classroomId: null,
        periodsPerWeek: 3,
        isLab: false,
      },
    ],
    validTeacherIds: new Set([teacherId]),
    validSubjectIds: new Set([subjectId]),
    validSemesterIds: new Set([semesterId]),
    validBatchIds: new Set([batchId]),
    batchSemesterMap: new Map([[batchId, semesterId]]),
    batchCodeMap: new Map([[batchId, 'B1']]),
    availableClassroomIds: new Set([classroomId]),
    classroomIsLabMap: new Map([[classroomId, false]]),
    classroomTypeMap: new Map([[classroomId, 'LECTURE']]),
    classroomEquipmentMap: new Map([[classroomId, []]]),
    semesterBatchStudentSum: new Map([[semesterId, 0]]),
    semesterStudentCountMap: new Map([[semesterId, 60]]),
    batchStudentCountMap: new Map([[batchId, 20]]),
    maxLectureRoomCapacity: 80,
    maxLabRoomCapacity: 30,
    classroomCapacityMap: new Map([[classroomId, 80]]),
    enforceClassroomCapacity: true,
    ...overrides,
  };
}

/** Convenience: make a single-assignment context with given assignment overrides */
function makeCtxWithAssignment(
  assignmentOverrides: Record<string, unknown>,
  ctxOverrides: Partial<PreFlightContext> = {}
): PreFlightContext {
  const base = makeCtx(ctxOverrides);
  base.assignments = [{ ...base.assignments[0], ...assignmentOverrides }];
  return base;
}

const validator = new PreFlightValidator();

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('PreFlightValidator', () => {

  // ── 1. Stale classroomId ───────────────────────────────────────────────────
  it('flags a stale classroomId as an error', () => {
    const staleRoomId = NEW_ID();
    const ctx = makeCtxWithAssignment({ classroomId: staleRoomId });
    // staleRoomId is NOT in availableClassroomIds
    const result = validator.validate(ctx);
    expect(result.ok).toBe(false);
    const err = result.errors.find((e) => e.field === 'classroomId');
    expect(err).toBeDefined();
    expect(err?.problem).toContain(staleRoomId);
    expect(err?.action).toContain('migration 004');
  });

  it('accepts a populated classroom reference when its id is available', () => {
    const ctx = makeCtx();
    const roomId = [...ctx.availableClassroomIds][0];
    ctx.assignments[0].classroomId = { _id: roomId, name: 'Lecture Hall' };

    const result = validator.validate(ctx);

    expect(result.errors.filter((error) => error.field === 'classroomId')).toHaveLength(0);
    expect(result.ok).toBe(true);
  });

  // ── 2. Stale teacherId ─────────────────────────────────────────────────────
  it('flags a stale teacherId (id not in Teacher collection) as an error', () => {
    const staleTeacherId = NEW_ID();
    const ctx = makeCtxWithAssignment({
      teacherId: { _id: staleTeacherId, availability: ['MONDAY'] },
    });
    // staleTeacherId is NOT in validTeacherIds
    const result = validator.validate(ctx);
    expect(result.ok).toBe(false);
    const err = result.errors.find((e) => e.field === 'teacherId');
    expect(err).toBeDefined();
    expect(err?.problem).toContain(staleTeacherId);
    expect(err?.action).toContain('migration 004');
  });

  // ── 3. Missing teacher (null teacherId) ────────────────────────────────────
  it('flags a null teacherId as an error', () => {
    const ctx = makeCtxWithAssignment({ teacherId: null });
    const result = validator.validate(ctx);
    expect(result.ok).toBe(false);
    const err = result.errors.find((e) => e.field === 'teacherId');
    expect(err).toBeDefined();
    expect(err?.problem).toContain('no teacher reference');
  });

  // ── 4. Valid repaired assignment passes ────────────────────────────────────
  it('passes a fully valid assignment without errors or warnings', () => {
    const ctx = makeCtx();
    // The default makeCtx builds a valid assignment
    const result = validator.validate(ctx);
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
    // No warnings expected on a fully configured assignment
    expect(result.warnings).toHaveLength(0);
  });

  // ── 5. Missing subject ─────────────────────────────────────────────────────
  it('flags a stale subjectId as an error', () => {
    const staleSubjectId = NEW_ID();
    const ctx = makeCtxWithAssignment({
      subjectId: { _id: staleSubjectId },
    });
    // staleSubjectId not in validSubjectIds
    const result = validator.validate(ctx);
    expect(result.ok).toBe(false);
    const err = result.errors.find((e) => e.field === 'subjectId');
    expect(err).toBeDefined();
    expect(err?.problem).toContain(staleSubjectId);
  });

  // ── 6. Missing semester ────────────────────────────────────────────────────
  it('flags a semesterId not in the selected set as an error', () => {
    const ctx = makeCtxWithAssignment({ semesterId: NEW_ID() });
    // New random ID won't be in validSemesterIds
    const result = validator.validate(ctx);
    expect(result.ok).toBe(false);
    const err = result.errors.find((e) => e.field === 'semesterId');
    expect(err).toBeDefined();
  });

  // ── 7. periodsPerWeek = 0 ─────────────────────────────────────────────────
  it('flags periodsPerWeek = 0 as an error', () => {
    const ctx = makeCtxWithAssignment({ periodsPerWeek: 0 });
    const result = validator.validate(ctx);
    expect(result.ok).toBe(false);
    const err = result.errors.find((e) => e.field === 'periodsPerWeek');
    expect(err).toBeDefined();
    expect(err?.problem).toContain('0');
  });

  // ── 8. Stale batchId on lab assignment ────────────────────────────────────
  it('flags a lab assignment with a stale batchId as an error', () => {
    const staleBatchId = NEW_ID();
    // staleBatchId is NOT in validBatchIds of the base context
    const ctx = makeCtxWithAssignment({
      isLab: true,
      batchId: staleBatchId,
    });
    const result = validator.validate(ctx);
    expect(result.ok).toBe(false);
    const err = result.errors.find((e) => e.field === 'batchId');
    expect(err).toBeDefined();
    expect(err?.problem).toContain(staleBatchId);
  });

  it('accepts one lab assignment per active batch regardless of batch code', () => {
    const ctx = makeCtx();
    const semesterId = String(ctx.assignments[0].semesterId);
    const subjectId = (ctx.assignments[0].subjectId as { _id: string })._id;
    const teacherId = (ctx.assignments[0].teacherId as { _id: string })._id;
    const batchIds = Array.from({ length: 4 }, () => NEW_ID());
    const batchCodes = ['A', 'B', 'C', 'D'];

    ctx.validBatchIds = new Set(batchIds);
    ctx.batchSemesterMap = new Map(batchIds.map((batchId) => [batchId, semesterId]));
    ctx.batchCodeMap = new Map(batchIds.map((batchId, index) => [batchId, batchCodes[index]]));
    ctx.batchStudentCountMap = new Map(batchIds.map((batchId) => [batchId, 20]));
    ctx.enforceClassroomCapacity = false;
    ctx.assignments = batchIds.map((batchId) => ({
      _id: NEW_ID(),
      teacherId: { _id: teacherId, availability: ['MONDAY', 'TUESDAY'] },
      subjectId: { _id: subjectId },
      semesterId,
      batchId,
      classroomId: null,
      periodsPerWeek: 2,
      isLab: true,
    }));

    const result = validator.validate(ctx);

    expect(result.errors.some((error) => error.field === 'batchAssignments')).toBe(false);
    expect(result.ok).toBe(true);
  });

  it('requires lab assignments to cover every active batch in the semester', () => {
    const ctx = makeCtx();
    const semesterId = String(ctx.assignments[0].semesterId);
    const subjectId = (ctx.assignments[0].subjectId as { _id: string })._id;
    const teacherId = (ctx.assignments[0].teacherId as { _id: string })._id;
    const batchIds = Array.from({ length: 4 }, () => NEW_ID());

    ctx.validBatchIds = new Set(batchIds);
    ctx.batchSemesterMap = new Map(batchIds.map((batchId) => [batchId, semesterId]));
    ctx.batchStudentCountMap = new Map(batchIds.map((batchId) => [batchId, 20]));
    ctx.enforceClassroomCapacity = false;
    ctx.assignments = batchIds.slice(0, 3).map((batchId) => ({
      _id: NEW_ID(),
      teacherId: { _id: teacherId, availability: ['MONDAY', 'TUESDAY'] },
      subjectId: { _id: subjectId },
      semesterId,
      batchId,
      classroomId: null,
      periodsPerWeek: 2,
      isLab: true,
    }));

    const result = validator.validate(ctx);

    expect(result.errors.some((error) => error.field === 'batchAssignments')).toBe(true);
  });

  // ── 9. Lecture capacity too small ─────────────────────────────────────────
  it('flags a lecture when all available rooms are smaller than the total batch student count', () => {
    const semesterId = NEW_ID();
    const teacherId = NEW_ID();
    const subjectId = NEW_ID();
    const ctx = makeCtxWithAssignment(
      {
        teacherId: { _id: teacherId, availability: ['MONDAY'] },
        subjectId: { _id: subjectId },
        semesterId,
        batchId: null,
        isLab: false,
        periodsPerWeek: 3,
      },
      {
        validTeacherIds: new Set([teacherId]),
        validSubjectIds: new Set([subjectId]),
        validSemesterIds: new Set([semesterId]),
        // 4 batches × 20 = 80 students; max room is only 60
        semesterBatchStudentSum: new Map([[semesterId, 80]]),
        maxLectureRoomCapacity: 60,
        enforceClassroomCapacity: true,
      }
    );
    const roomId = [...ctx.availableClassroomIds][0];
    ctx.classroomCapacityMap.set(roomId, 60);
    const result = validator.validate(ctx);
    expect(result.ok).toBe(false);
    const err = result.errors.find((e) => e.field === 'roomCapacity');
    expect(err).toBeDefined();
    expect(err?.problem).toContain('80');
    expect(err?.problem).toContain('60');
  });

  it('allows a 40-student lecture in a 60-seat room', () => {
    const semesterId = NEW_ID();
    const teacherId = NEW_ID();
    const subjectId = NEW_ID();
    const ctx = makeCtxWithAssignment(
      { teacherId: { _id: teacherId }, subjectId: { _id: subjectId }, semesterId, batchId: null },
      {
        validTeacherIds: new Set([teacherId]),
        validSubjectIds: new Set([subjectId]),
        validSemesterIds: new Set([semesterId]),
        semesterBatchStudentSum: new Map([[semesterId, 40]]),
        semesterStudentCountMap: new Map([[semesterId, 90]]),
        maxLectureRoomCapacity: 60,
      }
    );

    const result = validator.validate(ctx);

    expect(result.errors.some((error) => error.field === 'roomCapacity')).toBe(false);
    expect(result.ok).toBe(true);
  });

  it('rejects a fixed 60-seat lecture room for an 80-student cohort', () => {
    const ctx = makeCtx();
    const roomId = [...ctx.availableClassroomIds][0];
    const semesterId = String(ctx.assignments[0].semesterId);
    ctx.assignments[0].classroomId = roomId;
    ctx.semesterBatchStudentSum.set(semesterId, 80);
    ctx.maxLectureRoomCapacity = 100;
    ctx.classroomCapacityMap.set(roomId, 60);

    const result = validator.validate(ctx);

    expect(result.errors.find((error) => error.field === 'roomCapacity')?.problem).toContain('assigned room capacity is 60');
  });

  it('rejects a fixed lab smaller than its assigned batch', () => {
    const ctx = makeCtx();
    const roomId = [...ctx.availableClassroomIds][0];
    const batchId = [...ctx.validBatchIds][0];
    ctx.assignments[0].isLab = true;
    ctx.assignments[0].batchId = batchId;
    ctx.assignments[0].classroomId = roomId;
    ctx.classroomIsLabMap.set(roomId, true);
    ctx.classroomCapacityMap.set(roomId, 18);
    ctx.batchStudentCountMap.set(batchId, 20);

    const result = validator.validate(ctx);

    expect(result.errors.find((error) => error.field === 'classroomId')?.problem).toContain('needs 20 seats');
  });

  it('rejects a lab assignment when batch strength is missing or invalid', () => {
    const ctx = makeCtx();
    const batchId = [...ctx.validBatchIds][0];
    ctx.assignments[0].isLab = true;
    ctx.assignments[0].batchId = batchId;
    ctx.batchStudentCountMap.delete(batchId);

    const result = validator.validate(ctx);

    expect(result.errors.some((error) => error.field === 'batchId' && error.problem.includes('no valid positive student count'))).toBe(true);
  });

  it('rejects a fixed room that does not meet the assignment equipment requirements', () => {
    const ctx = makeCtx();
    const roomId = [...ctx.availableClassroomIds][0];
    ctx.assignments[0].classroomId = roomId;
    ctx.assignments[0].classroomRequirements = ['PROJECTOR'];

    const result = validator.validate(ctx);

    expect(result.errors.some((error) => error.field === 'classroomRequirements')).toBe(true);
  });

  it('uses only equipment-compatible rooms when checking dynamic lecture capacity', () => {
    const ctx = makeCtx();
    const roomId = [...ctx.availableClassroomIds][0];
    const semesterId = String(ctx.assignments[0].semesterId);
    const compatibleRoomId = NEW_ID();
    ctx.assignments[0].classroomRequirements = ['PROJECTOR'];
    ctx.semesterBatchStudentSum.set(semesterId, 80);
    ctx.availableClassroomIds.add(compatibleRoomId);
    ctx.classroomIsLabMap.set(compatibleRoomId, false);
    ctx.classroomTypeMap.set(compatibleRoomId, 'LECTURE');
    ctx.classroomEquipmentMap.set(compatibleRoomId, ['PROJECTOR']);
    ctx.classroomCapacityMap.set(compatibleRoomId, 60);
    ctx.classroomCapacityMap.set(roomId, 100);

    const result = validator.validate(ctx);

    expect(result.errors.find((error) => error.field === 'roomCapacity')?.problem).toContain('compatible lecture room holds 60');
  });

  // ── 10. Teacher has no availability days → WARNING only ───────────────────
  it('issues a warning (not error) when teacher has no availability days', () => {
    const teacherId = NEW_ID();
    const ctx = makeCtxWithAssignment({
      teacherId: { _id: teacherId, availability: [] }, // empty array
    }, {
      validTeacherIds: new Set([teacherId]),
    });
    const result = validator.validate(ctx);
    // Should be ok=true (warnings don't block), but have a warning
    expect(result.ok).toBe(true);
    const warn = result.warnings.find((w) => w.field === 'teacher.availability');
    expect(warn).toBeDefined();
  });

  // ── 11. Multiple errors on the same assignment ────────────────────────────
  it('reports all errors on a single badly-formed assignment', () => {
    const ctx = makeCtxWithAssignment({
      teacherId: null,
      subjectId: null,
      periodsPerWeek: 0,
    });
    const result = validator.validate(ctx);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
    const fields = result.errors.map((e) => e.field);
    expect(fields).toContain('teacherId');
    expect(fields).toContain('subjectId');
    expect(fields).toContain('periodsPerWeek');
  });

  // ── 12. Mix of valid and invalid assignments ───────────────────────────────
  it('correctly flags only invalid assignments in a mixed list', () => {
    const base = makeCtx();
    const goodAssignment = { ...base.assignments[0] };

    const staleTeacherId = NEW_ID();
    const badAssignment = {
      ...base.assignments[0],
      _id: NEW_ID(),
      subjectId: { _id: NEW_ID() },
      teacherId: { _id: staleTeacherId, availability: ['MONDAY'] },
    };

    const ctx: PreFlightContext = {
      ...base,
      assignments: [goodAssignment, badAssignment],
    };

    const result = validator.validate(ctx);
    expect(result.ok).toBe(false);
    // Only the bad assignment should have an error
    expect(result.summary.assignmentsWithErrors).toBe(1);
    expect(result.summary.validAssignments).toBe(1);
    const err = result.errors.find((e) => e.field === 'teacherId');
    expect(err?.assignmentId).toBe(String(badAssignment._id));
  });

  // ── 13. formatReport produces readable output ─────────────────────────────
  it('formatReport includes the assignment ID, field, and action for each error', () => {
    const staleTeacherId = NEW_ID();
    const asgId = NEW_ID();
    const ctx = makeCtxWithAssignment({
      _id: asgId,
      teacherId: { _id: staleTeacherId, availability: ['MONDAY'] },
    });
    const result = validator.validate(ctx);
    const report = validator.formatReport(result);
    expect(report).toContain(asgId);
    expect(report).toContain('teacherId');
    expect(report).toContain('migration 004');
    expect(report).toContain('ERRORS');
  });
});

// ─── GenerationService reference validation integration ────────────────────

describe('GenerationService — validateAssignmentReferences (stale reference detection)', () => {
  const service = new GenerationService();

  // ── 13. Stale teacherId caught by validateAssignmentReferences ─────────────
  it('throws when teacherId is null (stale/missing teacher)', () => {
    const assignments = [{
      _id: 'asg-stale-teacher',
      teacherId: null,        // stale — populate() returned null
      subjectId: { _id: 'sub-1', name: 'Algorithms' },
      semesterId: 'sem-1',
      batchId: null,
      classroomId: null,
      classroomRequirements: [],
      periodsPerWeek: 3,
      isLab: false,
    }];
    expect(() =>
      (service as any).validateAssignmentReferences(assignments, new Set(['sem-1']))
    ).toThrow('references a missing teacher');
  });

  // ── 14. Stale classroomId caught by validateAssignmentReferences ──────────
  it('throws when classroomId points to a room not in the available list', () => {
    const staleRoomId = NEW_ID();
    const assignments = [{
      _id: 'asg-stale-room',
      teacherId: { _id: 'teacher-ok', name: 'Dr. Valid' },
      subjectId: { _id: 'sub-ok', name: 'Maths' },
      semesterId: 'sem-1',
      batchId: null,
      classroomId: { _id: staleRoomId },
      classroomRequirements: [],
      periodsPerWeek: 2,
      isLab: false,
    }];
    // classroomIdSet does NOT include staleRoomId
    expect(() =>
      (service as any).validateAssignmentReferences(
        assignments,
        new Set(['sem-1']),
        new Set(),             // batchIds
        new Set(['other-room']) // classroomIds — staleRoomId missing
      )
    ).toThrow('references a missing classroom');
  });

  it('accepts a populated classroom when its id is available', () => {
    const roomId = NEW_ID();
    const assignments = [{
      _id: 'asg-valid-room',
      teacherId: { _id: 'teacher-ok', name: 'Dr. Valid' },
      subjectId: { _id: 'sub-ok', name: 'Maths' },
      semesterId: 'sem-1',
      batchId: null,
      classroomId: { _id: roomId, name: 'Lecture Hall' },
      classroomRequirements: [],
      periodsPerWeek: 2,
      isLab: false,
    }];

    expect(() =>
      (service as any).validateAssignmentReferences(
        assignments,
        new Set(['sem-1']),
        new Set(),
        new Set([roomId])
      )
    ).not.toThrow();
  });

  // ── 15. sanitizeAssignmentsForScheduler skips entries missing teacher ──────
  it('sanitizeAssignmentsForScheduler returns empty for assignment with null teacher', () => {
    const assignments = [{
      _id: 'asg-no-teacher',
      teacherId: null,
      subjectId: { _id: 'sub-1', name: 'Physics' },
      semesterId: 'sem-1',
      batchId: null,
      classroomId: null,
      classroomRequirements: [],
      periodsPerWeek: 3,
      isLab: false,
    }];
    const result = (service as any).sanitizeAssignmentsForScheduler(assignments);
    expect(result).toHaveLength(0);
  });

  // ── 16. Valid repaired assignment passes through sanitize cleanly ──────────
  it('sanitizeAssignmentsForScheduler passes a fully valid assignment', () => {
    const assignments = [{
      _id: 'asg-valid',
      teacherId: { _id: 'teacher-1', name: 'Dr. Valid' },
      subjectId: { _id: 'sub-1', name: 'Algorithms' },
      semesterId: 'sem-1',
      batchId: null,
      classroomId: null,   // null = solver picks room dynamically
      classroomRequirements: [],
      periodsPerWeek: 3,
      isLab: false,
    }];
    const result = (service as any).sanitizeAssignmentsForScheduler(assignments);
    expect(result).toHaveLength(1);
    expect(result[0].teacherId).toBe('teacher-1');
    expect(result[0].semesterId).toBe('sem-1');
    // classroomId must NOT be in output when null
    expect(result[0].classroomId).toBeUndefined();
  });
});
