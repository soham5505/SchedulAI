/**
 * Cleanup Script: Remove Duplicate Teaching Assignments (Batch Variants)
 * 
 * This script identifies and removes teaching assignments that appear to be 
 * batch duplicates of the same (teacher, subject, semester) combination.
 * 
 * IMPORTANT: Back up your database before running this!
 * 
 * Usage:
 * 1. npm --workspace=@schedulai/api run cleanup:batch-duplicates
 */

import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { TeachingAssignmentModel } from '../models/assignment.model.js';
import { TeacherModel } from '../models/teacher.model.js';
import { SubjectModel } from '../models/subject.model.js';
import { SemesterModel } from '../models/semester.model.js';
import { Logger } from '../utils/logger.js';

dotenv.config();
const logger = new Logger('BatchDuplicateCleanup');

async function cleanupBatchDuplicates() {
  try {
    // Connect to database
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/schedulai';
    await mongoose.connect(mongoUri);
    logger.info('Connected to MongoDB');

    // Find all assignments without populate first, to avoid schema issues
    const allAssignments = await TeachingAssignmentModel.find({}).lean();

    logger.info(`Total assignments in database: ${allAssignments.length}`);

    if (allAssignments.length === 0) {
      logger.info('No assignments found in database.');
      await mongoose.connection.close();
      return;
    }

    // Fetch references separately
    const teachers = await TeacherModel.find({}).lean();
    const subjects = await SubjectModel.find({}).lean();
    const semesters = await SemesterModel.find({}).lean();

    const teacherMap = new Map(teachers.map((t: any) => [t._id.toString(), t]));
    const subjectMap = new Map(subjects.map((s: any) => [s._id.toString(), s]));
    const semesterMap = new Map(semesters.map((s: any) => [s._id.toString(), s]));

    // Group by (teacherId, subjectId, semesterId)
    const groupedAssignments: Record<string, any[]> = {};
    for (const assignment of allAssignments) {
      const key = `${assignment.teacherId}|${assignment.subjectId}|${assignment.semesterId}`;
      if (!groupedAssignments[key]) {
        groupedAssignments[key] = [];
      }
      groupedAssignments[key].push(assignment);
    }

    // Find duplicates (groups with more than 1 assignment)
    let totalDuplicatesFound = 0;
    let totalToDelete = 0;
    const deletionLog: any[] = [];

    for (const [key, assignments] of Object.entries(groupedAssignments)) {
      if (assignments.length > 1) {
        totalDuplicatesFound++;
        const [teacherId, subjectId, semesterId] = key.split('|');
        
        const teacher = teacherMap.get(teacherId);
        const subject = subjectMap.get(subjectId);
        const semester = semesterMap.get(semesterId);
        
        logger.warn(`\nDuplicate found: ${assignments.length} assignments`);
        logger.warn(`  Teacher: ${teacher?.name || teacherId}`);
        logger.warn(`  Subject: ${subject?.name || subjectId}`);
        logger.warn(`  Semester: ${semester?.name || semesterId}`);
        logger.warn(`  Code: ${subject?.code || 'N/A'}`);
        logger.warn(`  Periods per week: ${assignments.map((a: any) => a.periodsPerWeek).join(', ')}`);

        // Keep the first (earliest created), delete the rest
        const toDelete = assignments.slice(1);
        totalToDelete += toDelete.length;

        logger.info(`  Action: Keep 1st (${assignments[0]._id}), DELETE ${toDelete.length} others`);

        for (const assignment of toDelete) {
          deletionLog.push({
            deletedId: assignment._id.toString(),
            keptId: assignments[0]._id.toString(),
            teacher: teacher?.name,
            subject: subject?.name,
            code: subject?.code,
            semester: semester?.name,
            periodsPerWeek: assignment.periodsPerWeek,
          });
        }
      }
    }

    logger.info(`\n${'='.repeat(80)}`);
    logger.info(`Summary:`);
    logger.info(`  Total duplicate groups: ${totalDuplicatesFound}`);
    logger.info(`  Total assignments to DELETE: ${totalToDelete}`);
    logger.info(`${'='.repeat(80)}`);

    if (totalToDelete === 0) {
      logger.info('✅ No duplicates found. Database is clean!');
      await mongoose.connection.close();
      return;
    }

    // STEP 1: List what would be deleted (dry run)
    logger.info('\n📋 DRY RUN - Assignments that would be DELETED:');
    for (const log of deletionLog) {
      logger.info(`  ${log.deletedId}`);
      logger.info(`    Teacher: ${log.teacher}`);
      logger.info(`    Subject: ${log.code || log.subject}`);
      logger.info(`    Semester: ${log.semester}`);
      logger.info(`    Periods: ${log.periodsPerWeek}`);
    }

    logger.warn(`\n⚠️  To actually DELETE these ${totalToDelete} assignments, you must:`);
    logger.warn(`1. Uncomment the deletion code in cleanup-batch-duplicates.ts (around line 110-120)`);
    logger.warn(`2. Run the script again`);
    logger.warn(`3. Ensure you have a MongoDB backup before proceeding!`);

    // STEP 2: Uncomment below to actually perform deletion
    /*
    logger.info('\n🗑️  Executing deletion...');
    for (const log of deletionLog) {
      await TeachingAssignmentModel.findByIdAndDelete(log.deletedId);
      logger.info(`  ✓ Deleted: ${log.deletedId} (${log.code})`);
    }

    logger.info(`\n✅ Cleanup complete! Deleted ${totalToDelete} duplicate assignments.`);

    // STEP 3: Verify results
    const remainingAssignments = await TeachingAssignmentModel.find({});
    logger.info(`📊 Remaining assignments in database: ${remainingAssignments.length}`);
    */

    await mongoose.connection.close();
    logger.info('\n✓ Database connection closed.');
  } catch (error) {
    logger.error('Cleanup failed:', error);
    process.exit(1);
  }
}

cleanupBatchDuplicates();

