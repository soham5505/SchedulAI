import { connectDatabase, disconnectDatabase } from '../../config/database.js';
import { TeachingAssignmentModel } from '../../models/assignment.model.js';
import { TimetableEntryModel } from '../../models/timetable.model.js';

async function migrate() {
  await connectDatabase();
  await TeachingAssignmentModel.syncIndexes();
  await TimetableEntryModel.syncIndexes();
  console.log('Migration 002-add-batch-references completed.');
}

migrate()
  .catch((error) => {
    console.error('Migration 002-add-batch-references failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });