/**
 * Verify Semester Active Status
 * 
 * Checks if semesters are marked as active in the database
 * without changing their status.
 * 
 * Usage: npm --workspace=@schedulai/api run verify:semesters
 */

import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { SemesterModel } from '../models/semester.model.js';
import { Logger } from '../utils/logger.js';

dotenv.config();
const logger = new Logger('VerifySemesters');

async function verifySemesters() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/schedulai';
    await mongoose.connect(mongoUri);
    logger.info('Connected to MongoDB');

    logger.info('\n📋 Checking semester status...\n');

    // Get all semesters
    const semesters = await SemesterModel.find({}).lean();

    if (semesters.length === 0) {
      logger.warn('⚠️  No semesters found in database!');
      await mongoose.connection.close();
      return;
    }

    logger.info(`Found ${semesters.length} semesters:\n`);

    let inactiveCount = 0;

    for (const semester of semesters) {
      const status = semester.isActive ? '✅' : '❌';
      logger.info(
        `${status} ${semester.name} (ID: ${semester._id})`
      );
      logger.info(`   └─ Active: ${semester.isActive}, Year: ${semester.academicYear}, Number: ${semester.number}`);

      if (!semester.isActive) {
        inactiveCount++;
      }
    }

    logger.info(
      inactiveCount > 0
        ? `\n⚠️  Found ${inactiveCount} inactive semester(s); no records were changed.`
        : '\n✅ All semesters are already active.'
    );

    logger.info('\n✓ Database connection closed.');
    await mongoose.connection.close();
  } catch (error) {
    logger.error('Verification failed:', error);
    process.exit(1);
  }
}

verifySemesters();
