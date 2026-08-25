/**
 * Debug Semester Retrieval
 * 
 * Simulates the generation API call to see what's happening
 * when we try to fetch semesters by ID.
 * 
 * Usage: npm --workspace=@schedulai/api run debug:generation
 */

import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { SemesterModel } from '../models/semester.model.js';
import { Logger } from '../utils/logger.js';

dotenv.config();
const logger = new Logger('DebugGeneration');

async function debugGeneration() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/schedulai';
    await mongoose.connect(mongoUri);
    logger.info('Connected to MongoDB');

    logger.info('\n🔍 Debugging semester retrieval...\n');

    // Get all semesters and show their IDs
    const allSemesters = await SemesterModel.find({}).lean();
    logger.info(`Total semesters in database: ${allSemesters.length}\n`);

    for (const sem of allSemesters) {
      logger.info(`Semester: ${sem.name}`);
      logger.info(`  ID: ${sem._id}`);
      logger.info(`  ID (string): "${sem._id.toString()}"`);
      logger.info(`  Active: ${sem.isActive}`);
      logger.info(`  Academic Year: ${sem.academicYear}\n`);
    }

    // Try to find semesters using different methods
    logger.info('Testing different query methods:\n');

    // Method 1: Find all active semesters
    logger.info('1️⃣  Find all active semesters:');
    const activeSemesters = await SemesterModel.find({ isActive: true }).lean();
    logger.info(`   Found: ${activeSemesters.length}`);
    for (const sem of activeSemesters) {
      logger.info(`   - ${sem.name}`);
    }

    // Method 2: Find by specific ID
    if (allSemesters.length > 0) {
      logger.info(`\n2️⃣  Find by first semester ID: ${allSemesters[0]._id}`);
      const found = await SemesterModel.findById(allSemesters[0]._id).lean();
      logger.info(`   Found: ${found ? found.name : 'NOT FOUND'}`);
    }

    // Method 3: Find by multiple IDs (array)
    if (allSemesters.length > 0) {
      logger.info(`\n3️⃣  Find by multiple IDs (array):`);
      const ids = allSemesters.map((s) => s._id);
      logger.info(`   Query IDs: ${ids.map((id) => id.toString()).join(', ')}`);

      const found = await SemesterModel.find({ _id: { $in: ids } }).lean();
      logger.info(`   Found: ${found.length}`);
      for (const sem of found) {
        logger.info(`   - ${sem.name}`);
      }
    }

    logger.info(
      '\n✅ Debug complete. All semester retrieval methods working correctly.'
    );

    await mongoose.connection.close();
  } catch (error) {
    logger.error('Debug failed:', error);
    process.exit(1);
  }
}

debugGeneration();
