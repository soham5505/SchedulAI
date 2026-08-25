import { connectDatabase, disconnectDatabase } from '../../config/database.js';
import { TeachingAssignmentModel } from '../../models/assignment.model.js';

async function migrate() {
  await connectDatabase();
  await TeachingAssignmentModel.syncIndexes();
  console.log('Migration 003-batch-aware-assignment-index completed.');
}

migrate()
  .catch((error) => {
    console.error('Migration 003-batch-aware-assignment-index failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });