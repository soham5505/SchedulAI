/**
 * PreFlightValidator — validates all assignment data BEFORE calling the solver.
 *
 * Checks performed:
 *  1. Every assignment has a valid (non-stale) teacher reference
 *  2. Every assignment has a valid subject reference
 *  3. Every assignment has a valid semester reference
 *  4. classroomId is either null OR references a currently-available classroom
 *  5. Lab assignments must have a valid batchId (or explicitly null for whole-class)
 *  6. periodsPerWeek must be > 0
 *  7. Teacher must have at least one availability day
 *  8. If enforceClassroomCapacity: lecture room capacity >= total batch students
 *
 * Returns a PreFlightResult with:
 *   - ok: boolean
 *   - errors: string[]   (DATA INTEGRITY ERRORs that must be fixed)
 *   - warnings: string[] (non-blocking advisories)
 *   - summary: structured record counts
 */

import mongoose from 'mongoose';

export interface PreFlightIssue {
  assignmentId: string;
  field: string;
  problem: string;
  action: string;
}

export interface PreFlightResult {
  ok: boolean;
  errors: PreFlightIssue[];
  warnings: PreFlightIssue[];
  summary: {
    totalAssignments: number;
    validAssignments: number;
    assignmentsWithErrors: number;
    assignmentsWithWarnings: number;
  };
}

export interface PreFlightContext {
  /** Populated assignments (from generation.service.ts fetchAssignments) */
  assignments: Array<Record<string, unknown>>;
  /** Available teacher IDs (current Teacher._id values as strings) */
  validTeacherIds: Set<string>;
  /** Available subject IDs */
  validSubjectIds: Set<string>;
  /** Selected semester IDs */
  validSemesterIds: Set<string>;
  /** Selected batch IDs */
  validBatchIds: Set<string>;
  /** Available classroom IDs (isAvailable=true rooms) */
  availableClassroomIds: Set<string>;
  /** Map of semesterId -> total batch student count (sum of all batches) */
  semesterBatchStudentSum: Map<string, number>;
  /** Max capacity of any available non-lab classroom */
  maxLectureRoomCapacity: number;
  /** Map of classroomId -> capacity */
  classroomCapacityMap: Map<string, number>;
  /** Enforce classroom capacity constraint (from hardConstraints) */
  enforceClassroomCapacity: boolean;
}

export class PreFlightValidator {
  validate(ctx: PreFlightContext): PreFlightResult {
    const errors: PreFlightIssue[] = [];
    const warnings: PreFlightIssue[] = [];
    const errorAssignmentIds = new Set<string>();
    const warnAssignmentIds = new Set<string>();

    for (const raw of ctx.assignments) {
      const assignmentId = this._str(raw._id ?? raw.id);
      const teacherRef = raw.teacherId as Record<string, unknown> | null | undefined;
      const subjectRef = raw.subjectId as Record<string, unknown> | null | undefined;
      const semesterId = this._str(raw.semesterId);
      const batchId    = raw.batchId ? this._str(raw.batchId) : null;
      const classroomId = raw.classroomId ? this._str(raw.classroomId) : null;
      const periodsPerWeek = Number(raw.periodsPerWeek ?? 0);
      const isLab = Boolean(raw.isLab);

      // ── 1. Teacher reference ──────────────────────────────────────────────
      const teacherId = teacherRef?._id ? this._str(teacherRef._id) : null;
      if (!teacherId) {
        errors.push({
          assignmentId,
          field: 'teacherId',
          problem: 'Assignment has no teacher reference (null or unpopulated)',
          action: 'Run migration 004 to repair teacher references, then re-generate',
        });
        errorAssignmentIds.add(assignmentId);
      } else if (!ctx.validTeacherIds.has(teacherId)) {
        errors.push({
          assignmentId,
          field: 'teacherId',
          problem: `Stale teacher reference: Teacher _id ${teacherId} does not exist in current Teacher collection`,
          action: 'Run migration 004 to repair teacher references using employeeId, then re-generate',
        });
        errorAssignmentIds.add(assignmentId);
      }

      // ── 2. Subject reference ──────────────────────────────────────────────
      const subjectId = subjectRef?._id ? this._str(subjectRef._id) : null;
      if (!subjectId || !ctx.validSubjectIds.has(subjectId)) {
        errors.push({
          assignmentId,
          field: 'subjectId',
          problem: `Subject reference is missing or stale (subjectId=${subjectId ?? 'null'})`,
          action: 'Verify that the subject still exists in the database',
        });
        errorAssignmentIds.add(assignmentId);
      }

      // ── 3. Semester reference ─────────────────────────────────────────────
      if (!semesterId || !ctx.validSemesterIds.has(semesterId)) {
        errors.push({
          assignmentId,
          field: 'semesterId',
          problem: `Semester reference is missing or not included in this generation (semesterId=${semesterId ?? 'null'})`,
          action: 'Ensure the semester is active and selected for this generation run',
        });
        errorAssignmentIds.add(assignmentId);
      }

      // ── 4. Classroom reference ────────────────────────────────────────────
      if (classroomId) {
        if (!ctx.availableClassroomIds.has(classroomId)) {
          errors.push({
            assignmentId,
            field: 'classroomId',
            problem: `Stale classroomId ${classroomId}: room no longer exists or is unavailable`,
            action: 'Run migration 004 to clear stale classroomId — solver will choose room dynamically',
          });
          errorAssignmentIds.add(assignmentId);
        }
      }

      // ── 5. Lab batch requirement ──────────────────────────────────────────
      // (This is a warning only — whole-class labs are valid)
      if (isLab && batchId && !ctx.validBatchIds.has(batchId)) {
        errors.push({
          assignmentId,
          field: 'batchId',
          problem: `Lab assignment references batchId ${batchId} which is not in the active batch list`,
          action: 'Ensure the batch exists and is active for the selected semester',
        });
        errorAssignmentIds.add(assignmentId);
      }

      // ── 6. periodsPerWeek ─────────────────────────────────────────────────
      if (periodsPerWeek < 1) {
        errors.push({
          assignmentId,
          field: 'periodsPerWeek',
          problem: `periodsPerWeek is ${periodsPerWeek} — must be >= 1`,
          action: 'Update the assignment to have at least 1 period per week',
        });
        errorAssignmentIds.add(assignmentId);
      }

      // ── 7. Teacher availability ───────────────────────────────────────────
      const availability = teacherRef?.availability as string[] | undefined;
      if (teacherId && ctx.validTeacherIds.has(teacherId) && (!availability || availability.length === 0)) {
        warnings.push({
          assignmentId,
          field: 'teacher.availability',
          problem: `Teacher has no availability days configured — solver may find no valid slots`,
          action: 'Configure availability days for this teacher',
        });
        warnAssignmentIds.add(assignmentId);
      }

      // ── 8. Lecture capacity check ─────────────────────────────────────────
      if (ctx.enforceClassroomCapacity && !isLab && !batchId) {
        const semBatchSum = ctx.semesterBatchStudentSum.get(semesterId) ?? 0;
        const studentCount = semBatchSum > 0 ? semBatchSum : 0;
        if (studentCount > 0 && studentCount > ctx.maxLectureRoomCapacity) {
          errors.push({
            assignmentId,
            field: 'roomCapacity',
            problem: `Lecture needs ${studentCount} seats (${semBatchSum > 0 ? 'sum of all batches' : 'semester.studentCount'}) but the largest available lecture room only holds ${ctx.maxLectureRoomCapacity} students`,
            action: `Add a lecture room with capacity >= ${studentCount} to the database`,
          });
          errorAssignmentIds.add(assignmentId);
        }
      }
    }

    const ok = errors.length === 0;

    return {
      ok,
      errors,
      warnings,
      summary: {
        totalAssignments: ctx.assignments.length,
        validAssignments: ctx.assignments.length - errorAssignmentIds.size,
        assignmentsWithErrors: errorAssignmentIds.size,
        assignmentsWithWarnings: warnAssignmentIds.size,
      },
    };
  }

  /** Format a PreFlightResult into a human-readable diagnostic string */
  formatReport(result: PreFlightResult): string {
    const lines: string[] = [];
    lines.push('DATA INTEGRITY PRE-FLIGHT REPORT');
    lines.push('='.repeat(60));
    lines.push(`Total assignments        : ${result.summary.totalAssignments}`);
    lines.push(`Valid assignments         : ${result.summary.validAssignments}`);
    lines.push(`Assignments with errors   : ${result.summary.assignmentsWithErrors}`);
    lines.push(`Assignments with warnings : ${result.summary.assignmentsWithWarnings}`);
    lines.push('');

    if (result.errors.length > 0) {
      lines.push('ERRORS (must be fixed before scheduling):');
      lines.push('-'.repeat(60));
      for (const e of result.errors) {
        lines.push(`  Assignment : ${e.assignmentId}`);
        lines.push(`  Field      : ${e.field}`);
        lines.push(`  Problem    : ${e.problem}`);
        lines.push(`  Action     : ${e.action}`);
        lines.push('');
      }
    }

    if (result.warnings.length > 0) {
      lines.push('WARNINGS:');
      lines.push('-'.repeat(60));
      for (const w of result.warnings) {
        lines.push(`  Assignment : ${w.assignmentId}`);
        lines.push(`  Field      : ${w.field}`);
        lines.push(`  Problem    : ${w.problem}`);
        lines.push(`  Action     : ${w.action}`);
        lines.push('');
      }
    }

    if (result.ok) {
      lines.push('Pre-flight check PASSED — data is consistent for scheduling.');
    } else {
      lines.push('Pre-flight check FAILED — fix the errors above and re-run generation.');
    }

    return lines.join('\n');
  }

  private _str(val: unknown): string {
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'object' && val !== null) {
      // Handle Mongoose ObjectId (has .toString())
      return (val as { toString(): string }).toString();
    }
    return String(val);
  }
}

export const preFlightValidator = new PreFlightValidator();
