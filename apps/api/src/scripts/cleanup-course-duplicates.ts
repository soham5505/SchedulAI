/**
 * Fixed Cleanup: Remove Duplicate Batch Section Assignments
 * 
 * Problem: Same course assigned to multiple professors for different batch sections.
 * Example: SQL Lab assigned to 3 professors with 8 periods each = 24 periods
 * Correct: SQL Lab should be 8 periods (ONE course offering with multiple sections)
 * 
 * Solution: Keep ONE assignment per course per semester, remove batch duplicates
 * 
 * Usage: npm --workspace=@schedulai/api run cleanup:course-duplicates
 */

import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { TeachingAssignmentModel } from '../models/assignment.model.js';
import { TeacherModel } from '../models/teacher.model.js';
import { SubjectModel } from '../models/subject.model.js';
import { SemesterModel } from '../models/semester.model.js';
import { Logger } from '../utils/logger.js';

dotenv.config();
const logger = new Logger('CourseBatchCleanup');

async function cleanupCourseBatchDuplicates() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/schedulai';
    await mongoose.connect(mongoUri);
    logger.info('Connected to MongoDB');

    const allAssignments = await TeachingAssignmentModel.find({}).lean();
    logger.info(`Total assignments in database: ${allAssignments.length}`);

    if (allAssignments.length === 0) {
      logger.info('No assignments found.');
      await mongoose.connection.close();
      return;
    }

    const teachers = await TeacherModel.find({}).lean();
    const subjects = await SubjectModel.find({}).lean();
    const semesters = await SemesterModel.find({}).lean();

    const teacherMap = new Map(teachers.map((t: any) => [t._id.toString(), t]));
    const subjectMap = new Map(subjects.map((s: any) => [s._id.toString(), s]));
    const semesterMap = new Map(semesters.map((s: any) => [s._id.toString(), s]));

    // Group by (subjectId, semesterId) - NOT including teacherId
    const coursesByOfferingKey: Record<string, any[]> = {};
    for (const assignment of allAssignments) {
      // Key: course offering (subject + semester, regardless of teacher)
      const key = `${assignment.subjectId}|${assignment.semesterId}`;
      if (!coursesByOfferingKey[key]) {
        coursesByOfferingKey[key] = [];
      }
      coursesByOfferingKey[key].push(assignment);
    }

    // Find courses with multiple batch assignments
    let totalCoursesWithDuplicates = 0;
    let totalDuplicateAssignments = 0;
    const deletionLog: any[] = [];

    logger.info(`\nAnalyzing ${Object.keys(coursesByOfferingKey).length} unique course offerings...\n`);

    for (const [key, assignments] of Object.entries(coursesByOfferingKey)) {
      if (assignments.length > 1) {
        totalCoursesWithDuplicates++;

        const [subjectId, semesterId] = key.split('|');
        const subject = subjectMap.get(subjectId);
        const semester = semesterMap.get(semesterId);

        logger.warn(`\nCourse with multiple batch sections: ${assignments.length} assignments`);
        logger.warn(`  Subject: ${subject?.code || 'N/A'} - ${subject?.name || 'UNKNOWN'}`);
        logger.warn(`  Semester: ${semester?.name || 'UNKNOWN'}`);
        logger.warn(`  Assignments by professor:`);

        // Sort by periodsPerWeek descending to keep the highest one
        const sorted = assignments.sort((a: any, b: any) => (b.periodsPerWeek || 0) - (a.periodsPerWeek || 0));

        for (let i = 0; i < sorted.length; i++) {
          const teacher = teacherMap.get(sorted[i].teacherId.toString());
          logger.warn(`    [${i === 0 ? 'KEEP' : 'DELETE'}] Prof. ${teacher?.name || 'UNKNOWN'}: ${sorted[i].periodsPerWeek} periods (ID: ${sorted[i]._id})`);
        }

        // Keep the first (highest periods), delete the rest
        const toDelete = sorted.slice(1);
        totalDuplicateAssignments += toDelete.length;

        for (const assignment of toDelete) {
          const teacher = teacherMap.get(assignment.teacherId.toString());
          deletionLog.push({
            deletedId: assignment._id.toString(),
            keptId: sorted[0]._id.toString(),
            subjectCode: subject?.code,
            subjectName: subject?.name,
            semester: semester?.name,
            deletedTeacher: teacher?.name,
            deletedPeriods: assignment.periodsPerWeek,
            keptTeacher: teacherMap.get(sorted[0].teacherId.toString())?.name,
            keptPeriods: sorted[0].periodsPerWeek,
          });
        }
      }
    }

    logger.info(`\n${'='.repeat(80)}`);
    logger.info(`SUMMARY:`);
    logger.info(`  Courses with multiple batch assignments: ${totalCoursesWithDuplicates}`);
    logger.info(`  Total duplicate assignments to DELETE: ${totalDuplicateAssignments}`);
    logger.info(`${'='.repeat(80)}`);

    if (totalDuplicateAssignments === 0) {
      logger.info('✅ No duplicate batch assignments found. Database is clean!');
      await mongoose.connection.close();
      return;
    }

    // List what would be deleted
    logger.info('\n📋 DRY RUN - Batch assignments that would be DELETED:');
    for (const log of deletionLog) {
      logger.info(`\n  DELETE ID: ${log.deletedId}`);
      logger.info(`  ├─ Subject: ${log.subjectCode} (${log.subjectName})`);
      logger.info(`  ├─ Semester: ${log.semester}`);
      logger.info(`  ├─ Delete from Prof. ${log.deletedTeacher} (${log.deletedPeriods} periods)`);
      logger.info(`  └─ Keep with Prof. ${log.keptTeacher} (${log.keptPeriods} periods)`);
    }

    logger.warn(`\n⚠️  To ACTUALLY DELETE these ${totalDuplicateAssignments} assignments:`);
    logger.warn(`1. Uncomment the deletion code in cleanup-course-duplicates.ts`);
    logger.warn(`2. Ensure MongoDB is backed up!`);
    logger.warn(`3. Run the script again`);

    // STEP: Uncomment below to actually perform deletion

    logger.info('\n🗑️  Executing deletion...');
    for (const log of deletionLog) {
      await TeachingAssignmentModel.findByIdAndDelete(log.deletedId);
      logger.info(`  ✓ Deleted ${log.subjectCode} from Prof. ${log.deletedTeacher}`);
    }

    logger.info(`\n✅ Cleanup complete! Deleted ${totalDuplicateAssignments} batch assignments.`);

    const remaining = await TeachingAssignmentModel.find({});
    const totalPeriods = remaining.reduce((sum, a) => sum + (a.periodsPerWeek || 0), 0);
    logger.info(`📊 Remaining: ${remaining.length} assignments, ${totalPeriods} total periods`);
    

    await mongoose.connection.close();
    logger.info('\n✓ Database connection closed.');
  } catch (error) {
    logger.error('Cleanup failed:', error);
    process.exit(1);
  }
}

cleanupCourseBatchDuplicates();
