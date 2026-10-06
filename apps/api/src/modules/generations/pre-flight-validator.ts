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
  batchSemesterMap: Map<string, string>;
  batchCodeMap: Map<string, string>;
  /** Available classroom IDs (isAvailable=true rooms) */
  availableClassroomIds: Set<string>;
  classroomIsLabMap: Map<string, boolean>;
  classroomTypeMap: Map<string, string>;
  classroomEquipmentMap: Map<string, string[]>;
  /** Map of semesterId -> total batch student count (sum of all batches) */
  semesterBatchStudentSum: Map<string, number>;
  /** Map of semesterId -> declared student count */
  semesterStudentCountMap: Map<string, number>;
  /** Map of batchId -> student count */
  batchStudentCountMap: Map<string, number>;
  /** Max capacity of any available non-lab classroom */
  maxLectureRoomCapacity: number;
  /** Max capacity of any available lab classroom */
  maxLabRoomCapacity: number;
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
    const assignmentsByCourse = new Map<string, Array<{ id: string; isLab: boolean; batchId: string | null }>>();

    for (const raw of ctx.assignments) {
      const assignmentId = this._str(raw._id ?? raw.id);
      const teacherRef = raw.teacherId as Record<string, unknown> | null | undefined;
      const subjectRef = raw.subjectId as Record<string, unknown> | null | undefined;
      const semesterId = this._str(raw.semesterId);
      const batchId    = raw.batchId ? this._str(raw.batchId) : null;
      const classroomRef = raw.classroomId as Record<string, unknown> | null | undefined;
      const classroomId = raw.classroomId
        ? this._str(classroomRef?._id ?? raw.classroomId)
        : null;
      const classroomRequirements = Array.isArray(raw.classroomRequirements)
        ? raw.classroomRequirements.map((requirement) => String(requirement))
        : [];
      const periodsPerWeek = Number(raw.periodsPerWeek ?? 0);
      const isLab = Boolean(raw.isLab || (subjectRef as Record<string, unknown> | null | undefined)?.isLab);

      const courseKey = `${semesterId}|${this._str(subjectRef?._id)}`;
      const courseAssignments = assignmentsByCourse.get(courseKey) || [];
      courseAssignments.push({ id: assignmentId, isLab, batchId });
      assignmentsByCourse.set(courseKey, courseAssignments);

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
        } else {
          const capacity = ctx.classroomCapacityMap.get(classroomId) ?? 0;
          const isLabRoom = ctx.classroomIsLabMap.get(classroomId) ?? false;
          const batchStudentCount = batchId ? this._positiveCount(ctx.batchStudentCountMap.get(batchId)) : 0;
          if (!this._roomMeetsRequirements(ctx, classroomId, classroomRequirements)) {
            errors.push({
              assignmentId,
              field: 'classroomRequirements',
              problem: `Assigned room does not satisfy classroom requirements: ${classroomRequirements.join(', ')}`,
              action: 'Assign a room with the required equipment/type or clear classroomId for dynamic room selection',
            });
            errorAssignmentIds.add(assignmentId);
          } else if (isLab && !isLabRoom) {
            errors.push({
              assignmentId,
              field: 'classroomId',
              problem: 'Lab assignment is fixed to a room that is not an available laboratory',
              action: 'Assign an available lab or clear classroomId for dynamic room selection',
            });
            errorAssignmentIds.add(assignmentId);
          } else if (isLab && batchStudentCount === 0) {
            errors.push({
              assignmentId,
              field: 'batchId',
              problem: `Cannot validate capacity because batch ${batchId ?? 'unknown'} has no valid positive student count`,
              action: 'Set a positive student count for this batch',
            });
            errorAssignmentIds.add(assignmentId);
          } else if (isLab && capacity < batchStudentCount) {
            errors.push({
              assignmentId,
              field: 'classroomId',
              problem: `Lab batch ${batchId} needs ${batchStudentCount} seats, but assigned room capacity is ${capacity}`,
              action: `Assign an available lab with capacity >= ${batchStudentCount} or clear classroomId for dynamic room selection`,
            });
            errorAssignmentIds.add(assignmentId);
          } else if (!isLab && isLabRoom) {
            errors.push({
              assignmentId,
              field: 'classroomId',
              problem: 'Whole-semester lecture cannot use a laboratory room',
              action: 'Clear classroomId for dynamic room selection or assign a lecture room',
            });
            errorAssignmentIds.add(assignmentId);
          } else if (!isLab && !batchId && ctx.enforceClassroomCapacity) {
            const requiredSeats = this._semesterStudentCount(ctx, semesterId);
            if (requiredSeats > 0 && capacity < requiredSeats) {
              errors.push({
                assignmentId,
                field: 'roomCapacity',
                problem: `Lecture for semester ${semesterId} needs ${requiredSeats} seats, but assigned room capacity is ${capacity}`,
                action: `Assign a lecture room with capacity >= ${requiredSeats} or clear classroomId for dynamic room selection`,
              });
              errorAssignmentIds.add(assignmentId);
            }
          }
        }
      }

      // ── 5. Assignment scope ───────────────────────────────────────────────
      if (isLab && !batchId) {
        errors.push({
          assignmentId,
          field: 'batchId',
          problem: 'Lab assignments must target exactly one batch',
          action: 'Create one lab assignment for each of B1, B2, B3, and B4',
        });
        errorAssignmentIds.add(assignmentId);
      } else if (isLab && batchId && !ctx.validBatchIds.has(batchId)) {
        errors.push({
          assignmentId,
          field: 'batchId',
          problem: `Lab assignment references batchId ${batchId} which is not in the active batch list`,
          action: 'Ensure the batch exists and is active for the selected semester',
        });
        errorAssignmentIds.add(assignmentId);
      } else if (isLab && batchId && ctx.batchSemesterMap.get(batchId) !== semesterId) {
        errors.push({
          assignmentId,
          field: 'batchId',
          problem: `Batch ${batchId} does not belong to semester ${semesterId}`,
          action: 'Select a batch belonging to the assignment semester',
        });
        errorAssignmentIds.add(assignmentId);
      } else if (!isLab && batchId) {
        errors.push({
          assignmentId,
          field: 'batchId',
          problem: 'Lectures must be whole-semester assignments with batchId null',
          action: 'Remove the batch from this lecture assignment',
        });
        errorAssignmentIds.add(assignmentId);
      }

      // ── 6. periodsPerWeek ─────────────────────────────────────────────────
      const expectedPeriods = isLab ? 2 : 3;
      if (periodsPerWeek !== expectedPeriods) {
        errors.push({
          assignmentId,
          field: 'periodsPerWeek',
          problem: `${isLab ? 'Lab' : 'Lecture'} assignment has ${periodsPerWeek} period(s); expected exactly ${expectedPeriods} per week`,
          action: `Update the assignment to exactly ${expectedPeriods} period(s) per week`,
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
        const studentCount = this._semesterStudentCount(ctx, semesterId);
        const maxCompatibleCapacity = this._maxCompatibleRoomCapacity(ctx, false, classroomRequirements);
        if (studentCount === 0) {
          errors.push({
            assignmentId,
            field: 'studentCount',
            problem: `Cannot validate lecture capacity because semester ${semesterId} has no valid enrollment or batch total`,
            action: 'Set a positive semester studentCount or valid positive student counts on its active batches',
          });
          errorAssignmentIds.add(assignmentId);
        } else if (!classroomId && studentCount > maxCompatibleCapacity) {
          errors.push({
            assignmentId,
            field: 'roomCapacity',
            problem: `Lecture for semester ${semesterId} needs ${studentCount} seats, but the largest available compatible lecture room holds ${maxCompatibleCapacity}`,
            action: `Add a lecture room with capacity >= ${studentCount} to the database`,
          });
          errorAssignmentIds.add(assignmentId);
        }
      }

      if (ctx.enforceClassroomCapacity && isLab && batchId && !classroomId) {
        const batchStudentCount = this._positiveCount(ctx.batchStudentCountMap.get(batchId));
        const maxCompatibleCapacity = this._maxCompatibleRoomCapacity(ctx, true, classroomRequirements);
        if (batchStudentCount === 0) {
          errors.push({
            assignmentId,
            field: 'batchId',
            problem: `Cannot validate capacity because batch ${batchId} has no valid positive student count`,
            action: 'Set a positive student count for this batch',
          });
          errorAssignmentIds.add(assignmentId);
        } else if (batchStudentCount > maxCompatibleCapacity) {
          errors.push({
            assignmentId,
            field: classroomRequirements.length > 0 && maxCompatibleCapacity === 0 ? 'classroomRequirements' : 'roomCapacity',
            problem: `Lab batch ${batchId} in semester ${semesterId} needs ${batchStudentCount} seats, but the largest available compatible lab holds ${maxCompatibleCapacity}`,
            action: `Add an available lab with capacity >= ${batchStudentCount} or correct the batch student count`,
          });
          errorAssignmentIds.add(assignmentId);
        }
      }
    }

    for (const [courseKey, courseAssignments] of assignmentsByCourse) {
      const first = courseAssignments[0];
      if (first.isLab) {
        const semesterId = courseKey.split('|')[0];
        const expectedBatchIds = [...ctx.batchSemesterMap]
          .filter(([, batchSemesterId]) => batchSemesterId === semesterId)
          .map(([batchId]) => batchId);
        const assignedBatchIds = courseAssignments
          .map((assignment) => assignment.batchId)
          .filter((batchId): batchId is string => Boolean(batchId));
        if (
          courseAssignments.length !== expectedBatchIds.length ||
          new Set(assignedBatchIds).size !== expectedBatchIds.length ||
          !expectedBatchIds.every((batchId) => assignedBatchIds.includes(batchId))
        ) {
          errors.push({
            assignmentId: first.id,
            field: 'batchAssignments',
            problem: `Lab course ${courseKey} must have exactly one assignment for each of the ${expectedBatchIds.length} active batches in its semester`,
            action: 'Create or repair one batch-specific lab assignment for every active batch in the semester',
          });
          courseAssignments.forEach((assignment) => errorAssignmentIds.add(assignment.id));
        }
      } else if (courseAssignments.length !== 1 || first.batchId !== null) {
        errors.push({
          assignmentId: first.id,
          field: 'lectureAssignments',
          problem: `Lecture course ${courseKey} must have exactly one whole-semester assignment`,
          action: 'Remove batch-specific duplicates and retain one assignment with batchId null',
        });
        courseAssignments.forEach((assignment) => errorAssignmentIds.add(assignment.id));
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

  private _positiveCount(value: unknown): number {
    const count = Number(value);
    return Number.isFinite(count) && count > 0 ? count : 0;
  }

  private _semesterStudentCount(ctx: PreFlightContext, semesterId: string): number {
    const batchSum = this._positiveCount(ctx.semesterBatchStudentSum.get(semesterId));
    return batchSum || this._positiveCount(ctx.semesterStudentCountMap.get(semesterId));
  }

  private _roomMeetsRequirements(ctx: PreFlightContext, classroomId: string, requirements: string[]): boolean {
    if (requirements.length === 0) return true;
    const equipment = ctx.classroomEquipmentMap.get(classroomId) ?? [];
    const type = ctx.classroomTypeMap.get(classroomId);
    return requirements.some((requirement) => equipment.includes(requirement) || requirement === type);
  }

  private _maxCompatibleRoomCapacity(ctx: PreFlightContext, isLab: boolean, requirements: string[]): number {
    let maxCapacity = 0;
    for (const [classroomId, rawCapacity] of ctx.classroomCapacityMap) {
      if (!ctx.availableClassroomIds.has(classroomId)) continue;
      if ((ctx.classroomIsLabMap.get(classroomId) ?? false) !== isLab) continue;
      if (!this._roomMeetsRequirements(ctx, classroomId, requirements)) continue;
      maxCapacity = Math.max(maxCapacity, this._positiveCount(rawCapacity));
    }
    return maxCapacity;
  }
}

export const preFlightValidator = new PreFlightValidator();
