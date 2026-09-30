import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { TeachingAssignmentModel } from '../../models/assignment.model.js';
import { SubjectModel } from '../../models/subject.model.js';
import { BatchModel } from '../../models/batch.model.js';
import { connectDatabase, disconnectDatabase } from '../../config/database.js';

dotenv.config();

const DRY_RUN = process.env.DRY_RUN !== 'false';

async function migrateLabPeriods() {
  await connectDatabase();
  if (mongoose.connection.readyState !== 1) throw new Error('Database connection unavailable');

  const [assignments, subjects, batches] = await Promise.all([
    TeachingAssignmentModel.find({}).lean(),
    SubjectModel.find({}).lean(),
    BatchModel.find({ isActive: true }).lean(),
  ]);
  const subjectById = new Map(subjects.map((subject) => [String(subject._id), subject]));
  const labAssignments = assignments.filter((assignment) =>
    Boolean(assignment.isLab || subjectById.get(String(assignment.subjectId))?.isLab)
  );
  const labSubjects = subjects.filter((subject) => subject.isLab);
  const labBatchAssignments = labAssignments.filter((assignment) => assignment.batchId);
  const assignmentCounts = new Map<string, number>();
  for (const assignment of labBatchAssignments) {
    const key = `${assignment.semesterId}|${assignment.subjectId}|${assignment.batchId}`;
    assignmentCounts.set(key, (assignmentCounts.get(key) || 0) + 1);
  }
  const duplicates = [...assignmentCounts].filter(([, count]) => count !== 1);
  const activeBatchIds = new Set(batches.map((batch) => String(batch._id)));
  const missingBatchAssignments = labAssignments.filter(
    (assignment) => !assignment.batchId || !activeBatchIds.has(String(assignment.batchId))
  );
  const assignmentsToUpdate = labAssignments.filter((assignment) => assignment.periodsPerWeek !== 2);
  const subjectsToUpdate = labSubjects.filter((subject) =>
    subject.weeklyPeriods !== 2 || subject.lecturePeriods !== 0 || subject.labPeriods !== 2
  );

  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);
  console.log(`Lab assignments: ${labAssignments.length}; to normalize: ${assignmentsToUpdate.length}`);
  console.log(`Lab subjects: ${labSubjects.length}; to normalize: ${subjectsToUpdate.length}`);
  if (missingBatchAssignments.length || duplicates.length) {
    throw new Error(
      `Lab data must have one active batch assignment per course and batch; found ${missingBatchAssignments.length} missing/inactive batches and ${duplicates.length} duplicate groups.`
    );
  }
  if (DRY_RUN) return;

  const backupDir = path.resolve(process.cwd(), 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `lab-two-periods-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(
    backupPath,
    JSON.stringify({ assignments: labAssignments, subjects: labSubjects }, null, 2),
    'utf8'
  );
  console.log(`Backup: ${backupPath}`);

  await Promise.all([
    ...assignmentsToUpdate.map((assignment) =>
      TeachingAssignmentModel.updateOne({ _id: assignment._id }, { $set: { periodsPerWeek: 2, isLab: true } })
    ),
    ...subjectsToUpdate.map((subject) =>
      SubjectModel.updateOne(
        { _id: subject._id },
        { $set: { weeklyPeriods: 2, lecturePeriods: 0, labPeriods: 2, isLab: true } }
      )
    ),
  ]);
  console.log('Lab period migration completed.');
}

migrateLabPeriods()
  .catch((error) => {
    console.error('Lab period migration failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });