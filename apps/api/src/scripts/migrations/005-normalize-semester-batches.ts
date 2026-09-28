/**
 * Migration 005 - Normalize SEM 3/5/7 sections into shared lectures and batches.
 *
 * For each SEM N - B1..B4 group:
 * - SEM N - B1 remains the canonical active semester.
 * - B1..B4 become batches on the canonical semester.
 * - Theory assignments are deduplicated and shared by all batches.
 * - Lab assignments remain one per batch and are marked as labs.
 * - The other section semesters are deactivated.
 *
 * Run a preview first:
 *   DRY_RUN=true tsx src/scripts/migrations/005-normalize-semester-batches.ts
 * Apply changes:
 *   DRY_RUN=false tsx src/scripts/migrations/005-normalize-semester-batches.ts
 */

import mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import { connectDatabase, disconnectDatabase } from '../../config/database.js';
import { TeachingAssignmentModel } from '../../models/assignment.model.js';
import { SemesterModel } from '../../models/semester.model.js';
import { BatchModel } from '../../models/batch.model.js';
import { SubjectModel } from '../../models/subject.model.js';

const DRY_RUN = process.env.DRY_RUN !== 'false';
const TARGET_LEVELS = new Set([3, 5, 7]);
const SEMESTER_PATTERN = /^SEM\s+(3|5|7)\s*-\s*B([1-4])$/i;

function isLabAssignment(assignment: any, subject: any): boolean {
  return Boolean(
    assignment.isLab ||
    subject?.isLab ||
    /^ITL/i.test(String(subject?.code || '')) ||
    /\bLAB\b/i.test(String(subject?.name || ''))
  );
}

async function migrate(): Promise<void> {
  await connectDatabase();
  if (mongoose.connection.readyState !== 1) throw new Error('Database connection unavailable');

  const [semesters, assignments, subjects, batches] = await Promise.all([
    SemesterModel.find({ isActive: true }).lean(),
    TeachingAssignmentModel.find({}).lean(),
    SubjectModel.find({}).lean(),
    BatchModel.find({}).lean(),
  ]);

  const semesterGroups = new Map<number, any[]>();
  for (const semester of semesters) {
    const match = semester.name.match(SEMESTER_PATTERN);
    if (!match) continue;
    const level = Number(match[1]);
    if (!TARGET_LEVELS.has(level)) continue;
    const group = semesterGroups.get(level) || [];
    group.push({ ...semester, batchNumber: Number(match[2]) });
    semesterGroups.set(level, group);
  }

  const subjectMap = new Map(subjects.map((subject) => [subject._id.toString(), subject]));
  const assignmentBySemester = new Map<string, any[]>();
  for (const assignment of assignments) {
    const key = assignment.semesterId.toString();
    const group = assignmentBySemester.get(key) || [];
    group.push(assignment);
    assignmentBySemester.set(key, group);
  }

  const backupPath = path.resolve(
    process.cwd(),
    'backups',
    `semester-batch-normalization-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  );
  if (!DRY_RUN) {
    fs.mkdirSync(path.dirname(backupPath), { recursive: true });
    fs.writeFileSync(
      backupPath,
      JSON.stringify({ semesters, assignments, subjects, batches }, null, 2),
      'utf8'
    );
  }

  for (const [level, group] of Array.from(semesterGroups.entries()).sort()) {
    if (group.length === 1) {
      const canonical = group[0];
      const existingBatchCount = await BatchModel.countDocuments({
        semesterId: canonical._id,
        code: { $in: ['B1', 'B2', 'B3', 'B4'] },
        isActive: true,
      });
      if (existingBatchCount === 4) {
        console.log(`SEM ${level}: already normalized; skipping`);
        continue;
      }
    }
    if (group.length !== 4) {
      throw new Error(`SEM ${level} must contain B1-B4; found ${group.length} active sections`);
    }

    const canonical = group.find((semester) => semester.batchNumber === 1)!;
    const sourceByBatch = new Map(group.map((semester) => [semester.batchNumber, semester]));
    const allAssignments = group.flatMap((semester) => assignmentBySemester.get(semester._id.toString()) || []);
    const seenTheory = new Set<string>();
    let keptTheory = 0;
    let keptLabs = 0;

    console.log(`SEM ${level}: canonical=${canonical.name}, source assignments=${allAssignments.length}`);

    if (!DRY_RUN) {
      for (const semester of group) {
        await BatchModel.updateOne(
          { semesterId: canonical._id, code: `B${semester.batchNumber}` },
          {
            $set: { studentCount: semester.studentCount, isActive: true },
            $setOnInsert: { semesterId: canonical._id, code: `B${semester.batchNumber}` },
          },
          { upsert: true }
        );
      }
    }

    for (const assignment of allAssignments) {
      const subject = subjectMap.get(assignment.subjectId.toString());
      const lab = isLabAssignment(assignment, subject);
      const sourceSemester = group.find((semester) => semester._id.toString() === assignment.semesterId.toString());

      if (!lab) {
        const theoryKey = `${assignment.subjectId}|${assignment.teacherId}|${assignment.periodsPerWeek}`;
        if (seenTheory.has(theoryKey)) {
          if (!DRY_RUN) await TeachingAssignmentModel.deleteOne({ _id: assignment._id });
          continue;
        }
        seenTheory.add(theoryKey);
        keptTheory += 1;
        if (!DRY_RUN) {
          await TeachingAssignmentModel.updateOne(
            { _id: assignment._id },
            { $set: { semesterId: canonical._id, batchId: null, isLab: false, classroomId: null } }
          );
        }
        continue;
      }

      const batch = sourceByBatch.get(sourceSemester?.batchNumber || 1);
      if (!batch) throw new Error(`Could not map lab assignment ${assignment._id} to a batch`);
      keptLabs += 1;
      if (!DRY_RUN) {
        const batchRecord = await BatchModel.findOne({
          semesterId: canonical._id,
          code: `B${batch.batchNumber}`,
        });
        if (!batchRecord) throw new Error(`Missing batch B${batch.batchNumber} for SEM ${level}`);
        await TeachingAssignmentModel.updateOne(
          { _id: assignment._id },
          { $set: { semesterId: canonical._id, batchId: batchRecord._id, isLab: true, classroomId: null } }
        );
      }
    }

    console.log(`  shared theory kept: ${keptTheory}; batch labs kept: ${keptLabs}`);

    if (!DRY_RUN) {
      const studentCount = group.reduce((sum, semester) => sum + semester.studentCount, 0);
      await SemesterModel.updateOne(
        { _id: canonical._id },
        { $set: { studentCount, isActive: true } }
      );

      for (const semester of group) {
        const code = `B${semester.batchNumber}`;
        await BatchModel.updateOne(
          { semesterId: canonical._id, code },
          {
            $set: { studentCount: semester.studentCount, isActive: true },
            $setOnInsert: { semesterId: canonical._id, code },
          },
          { upsert: true }
        );
        if (semester.batchNumber !== 1) {
          await SemesterModel.updateOne({ _id: semester._id }, { $set: { isActive: false } });
        }
      }

      await SubjectModel.updateMany(
        { _id: { $in: allAssignments.filter((assignment) => isLabAssignment(assignment, subjectMap.get(assignment.subjectId.toString()))).map((assignment) => assignment.subjectId) } },
        { $set: { isLab: true, lecturePeriods: 0 } }
      );
    }
  }

  console.log(DRY_RUN ? 'DRY RUN complete; no database changes made.' : `Migration applied. Backup: ${backupPath}`);
  await disconnectDatabase();
}

migrate().catch(async (error) => {
  console.error('Migration 005 failed:', error);
  await disconnectDatabase();
  process.exitCode = 1;
});
