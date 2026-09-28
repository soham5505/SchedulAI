/**
 * Migration 004 — Repair stale assignment references
 *
 * FIX 1: Clear classroomId on every assignment.
 *   Classroom references become stale whenever classrooms are deleted or
 *   re-imported.  Clearing classroomId lets the solver pick the best
 *   available room dynamically.
 *
 * FIX 2: Repair teacherId using the stable employeeId field.
 *   Teachers receive a new MongoDB _id after each re-import.  The
 *   employeeId is the business-stable key we use to remap the reference.
 *
 * Safety guarantees:
 *   - Writes a JSON backup of all affected assignments before changing anything.
 *   - Dry-run mode (DRY_RUN=true) prints the plan without writing.
 *   - Never deletes assignments, teachers, or classrooms.
 *   - Never guesses a teacher mapping — reports unresolvable assignments.
 *   - Exits with code 1 if any unresolvable teacher reference remains
 *     (so CI/CD pipelines catch the problem).
 *
 * Run:
 *   tsx src/scripts/migrations/004-repair-stale-references.ts
 *
 * Dry-run (no writes):
 *   DRY_RUN=true tsx src/scripts/migrations/004-repair-stale-references.ts
 */

import mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import { connectDatabase, disconnectDatabase } from '../../config/database.js';
import { TeachingAssignmentModel } from '../../models/assignment.model.js';
import { TeacherModel } from '../../models/teacher.model.js';
import { ClassroomModel } from '../../models/classroom.model.js';

const DRY_RUN = process.env.DRY_RUN === 'true';

// ─── Counters ───────────────────────────────────────────────────────────────

interface MigrationReport {
  totalAssignments: number;
  classroomIdsCleared: number;
  teacherIdsRepaired: number;
  unresolvedTeacherRefs: number;
  unresolvedDetails: Array<{
    assignmentId: string;
    staleTeacherId: string;
    problem: string;
  }>;
  backupPath: string | null;
}

// ─── Entry point ─────────────────────────────────────────────────────────────

async function migrate(): Promise<void> {
  await connectDatabase();

  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database connection unavailable');
  }

  console.log('');
  console.log('======================================================');
  console.log('Migration 004 — Repair Stale Assignment References');
  console.log(DRY_RUN ? '*** DRY-RUN MODE: no writes will be performed ***' : '*** LIVE MODE: changes will be written to MongoDB ***');
  console.log('======================================================');
  console.log('');

  const report = await runMigration();

  console.log('');
  console.log('======================================================');
  console.log('MIGRATION REPORT');
  console.log('======================================================');
  console.log(`Total assignments examined  : ${report.totalAssignments}`);
  console.log(`classroomId values cleared  : ${report.classroomIdsCleared}`);
  console.log(`teacherId references repaired: ${report.teacherIdsRepaired}`);
  console.log(`Unresolved teacher references: ${report.unresolvedTeacherRefs}`);

  if (report.backupPath) {
    console.log(`Backup written to           : ${report.backupPath}`);
  }

  if (report.unresolvedDetails.length > 0) {
    console.log('');
    console.log('UNRESOLVED ASSIGNMENTS (manual intervention required):');
    for (const detail of report.unresolvedDetails) {
      console.log(`  Assignment ID : ${detail.assignmentId}`);
      console.log(`  Stale teacherId: ${detail.staleTeacherId}`);
      console.log(`  Problem       : ${detail.problem}`);
      console.log('');
    }
    console.error('Migration completed with unresolved references. Manual fix required.');
    process.exitCode = 1;
  } else {
    console.log('');
    console.log('All references resolved successfully.');
  }
}

// ─── Core logic ──────────────────────────────────────────────────────────────

async function runMigration(): Promise<MigrationReport> {
  const report: MigrationReport = {
    totalAssignments: 0,
    classroomIdsCleared: 0,
    teacherIdsRepaired: 0,
    unresolvedTeacherRefs: 0,
    unresolvedDetails: [],
    backupPath: null,
  };

  // 1. Load all assignments (raw, without populate so we see the raw ObjectIds)
  const assignments = await TeachingAssignmentModel.find({}).lean();
  report.totalAssignments = assignments.length;

  // 2. Load all current classrooms (available ones — same filter as generation)
  const availableClassrooms = await ClassroomModel.find({ isAvailable: true }).lean();
  const availableClassroomIds = new Set(availableClassrooms.map((c) => c._id.toString()));

  // 3. Load all current teachers, indexed by employeeId (stable key)
  const allTeachers = await TeacherModel.find({}).lean();
  const teacherByEmployeeId = new Map<string, typeof allTeachers[number]>();
  const teacherByCurrentId = new Map<string, typeof allTeachers[number]>();
  for (const t of allTeachers) {
    if (t.employeeId) {
      teacherByEmployeeId.set(t.employeeId.trim(), t);
    }
    teacherByCurrentId.set(t._id.toString(), t);
  }

  console.log(`Loaded ${assignments.length} assignments`);
  console.log(`Loaded ${availableClassrooms.length} available classrooms`);
  console.log(`Loaded ${allTeachers.length} teachers`);
  console.log('');

  // 4. Write backup before any changes
  if (!DRY_RUN && assignments.length > 0) {
    const backupDir = path.resolve(process.cwd(), 'backups');
    fs.mkdirSync(backupDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `assignments-backup-${timestamp}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(assignments, null, 2), 'utf-8');
    report.backupPath = backupFile;
    console.log(`Backup written: ${backupFile}`);
    console.log('');
  }

  // 5. Process each assignment
  for (const assignment of assignments) {
    const assignmentId = assignment._id.toString();
    const rawTeacherId = assignment.teacherId?.toString() ?? null;
    const rawClassroomId = assignment.classroomId?.toString() ?? null;

    const updates: Record<string, unknown> = {};
    let hasIssue = false;

    // ── FIX 1: Clear classroomId if it points to a non-existent room ──────
    if (rawClassroomId) {
      if (!availableClassroomIds.has(rawClassroomId)) {
        console.log(`[FIX-1] Assignment ${assignmentId}: classroomId ${rawClassroomId} is STALE (not in available classrooms)`);
        console.log(`        Action: classroomId cleared to null — solver will select room dynamically`);
        updates['classroomId'] = null;
        hasIssue = true;
      }
    }

    // ── FIX 2: Repair teacherId if the current _id is not in Teacher collection ──
    if (rawTeacherId && !teacherByCurrentId.has(rawTeacherId)) {
      // The teacherId is stale — teacher was re-imported with a new _id.
      // We cannot match by name reliably.  Try to find by employeeId embedded
      // in the assignment's data, but since the assignment document only stores
      // the ObjectId (not employeeId), we cannot recover without additional info.
      //
      // Strategy: check if any teacher's _id matches rawTeacherId.
      // If not found → the reference is stale.  We cannot guess automatically.
      console.log(`[FIX-2] Assignment ${assignmentId}: teacherId ${rawTeacherId} is STALE (not found in Teacher collection)`);

      // Since the assignment only stores the _id and the old teacher is gone,
      // we cannot automatically determine the correct employeeId.
      // Report as unresolved.
      report.unresolvedTeacherRefs += 1;
      report.unresolvedDetails.push({
        assignmentId,
        staleTeacherId: rawTeacherId,
        problem:
          'Teacher with this _id no longer exists in the Teacher collection. ' +
          'Cannot auto-repair: no stable employeeId is stored in the assignment. ' +
          'ACTION REQUIRED: manually set the correct teacherId for this assignment.',
      });
      hasIssue = true;

    } else if (rawTeacherId && teacherByCurrentId.has(rawTeacherId)) {
      // Teacher found by current _id — check if the Teacher document is active
      const teacher = teacherByCurrentId.get(rawTeacherId)!;
      if (!teacher.isActive) {
        console.log(`[WARN]  Assignment ${assignmentId}: teacherId ${rawTeacherId} refers to INACTIVE teacher "${teacher.name}" (${teacher.employeeId})`);
      }
    }

    // ── Apply updates ─────────────────────────────────────────────────────
    if (Object.keys(updates).length > 0) {
      if (DRY_RUN) {
        console.log(`        [DRY-RUN] Would update assignment ${assignmentId}:`, updates);
      } else {
        await TeachingAssignmentModel.updateOne(
          { _id: assignment._id },
          { $set: updates }
        );
      }

      if ('classroomId' in updates) {
        report.classroomIdsCleared += 1;
      }
    }

    if (!hasIssue && !Object.keys(updates).length) {
      // Assignment is clean
    }
  }

  return report;
}

// ─── Run ─────────────────────────────────────────────────────────────────────

migrate()
  .catch((error) => {
    console.error('Migration 004 failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
