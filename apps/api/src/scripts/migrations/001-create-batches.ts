import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../../config/database.js';
import { BatchModel } from '../../models/batch.model.js';

/** Creates the batch collection and its uniqueness index without changing existing data. */
async function migrate() {
  await connectDatabase();
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database connection is unavailable');
  }

  await BatchModel.createCollection().catch((error: unknown) => {
    if ((error as { code?: number }).code !== 48) throw error;
  });
  await BatchModel.syncIndexes();
  console.log('Migration 001-create-batches completed.');
}

migrate()
  .catch((error) => {
    console.error('Migration 001-create-batches failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });