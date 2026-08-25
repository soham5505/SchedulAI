/**
 * Diagnostic Script: Analyze Teaching Assignments by Semester
 * 
 * Shows detailed breakdown of course assignments, including those with batch identifiers
 * 
 * Usage: npm --workspace=@schedulai/api run diagnostic:assignments
 */

import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { TeachingAssignmentModel } from '../models/assignment.model.js';
import { TeacherModel } from '../models/teacher.model.js';
import { SubjectModel } from '../models/subject.model.js';
import { SemesterModel } from '../models/semester.model.js';
import { Logger } from '../utils/logger.js';

dotenv.config();
const logger = new Logger('AssignmentDiagnostic');

async function analyzeAssignments() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/schedulai';
    await mongoose.connect(mongoUri);
    logger.info('Connected to MongoDB');

    const allAssignments = await TeachingAssignmentModel.find({}).lean();
    logger.info(`\nTotal assignments in database: ${allAssignments.length}\n`);

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

    // Group by semester
    const assignmentsBySemester: Record<string, any[]> = {};
    for (const assignment of allAssignments) {
      const semesterId = assignment.semesterId.toString();
      if (!assignmentsBySemester[semesterId]) {
        assignmentsBySemester[semesterId] = [];
      }
      assignmentsBySemester[semesterId].push(assignment);
    }

    // Analyze each semester
    for (const [semesterId, assignments] of Object.entries(assignmentsBySemester)) {
      const semester = semesterMap.get(semesterId);
      const semesterName = semester?.name || semesterId;

      let totalPeriods = 0;
      let theoryPeriods = 0;
      let labPeriods = 0;

      logger.info(`\n${'='.repeat(80)}`);
      logger.info(`SEMESTER: ${semesterName}`);
      logger.info(`${'='.repeat(80)}`);
      logger.info(`Total Assignments: ${assignments.length}\n`);

      for (const assignment of assignments) {
        const subject = subjectMap.get(assignment.subjectId.toString());
        const teacher = teacherMap.get(assignment.teacherId.toString());

        const subjectName = subject?.name || 'UNKNOWN';
        const subjectCode = subject?.code || 'N/A';
        const isLab = assignment.isLab || subject?.isLab;
        const teacherName = teacher?.name || 'UNKNOWN';
        const periods = assignment.periodsPerWeek || 0;

        totalPeriods += periods;
        if (isLab) {
          labPeriods += periods;
        } else {
          theoryPeriods += periods;
        }

        const typeLabel = isLab ? '[LAB]' : '[THY]';
        logger.info(`${typeLabel} ${subjectCode.padEnd(20)} | ${subjectName.padEnd(35)} | ${teacherName.padEnd(25)} | ${periods} periods`);
      }

      logger.info(`\n${'-'.repeat(80)}`);
      logger.info(`SUMMARY for ${semesterName}:`);
      logger.info(`  Theory periods: ${theoryPeriods}`);
      logger.info(`  Lab periods: ${labPeriods}`);
      logger.info(`  TOTAL PERIODS: ${totalPeriods}`);
      logger.info(`  Available time slots: 40`);

      if (totalPeriods > 40) {
        logger.warn(`  ⚠️  WARNING: ${totalPeriods} periods > 40 slots`);
        logger.warn(`     This will cause scheduling to fail!`);
      }
    }

    logger.info(`\n${'='.repeat(80)}`);
    logger.info('OVERALL ANALYSIS:');
    const totalAssignments = allAssignments.reduce((sum, a) => sum + (a.periodsPerWeek || 0), 0);
    logger.info(`  Total periods across all semesters: ${totalAssignments}`);
    logger.info(`${'='.repeat(80)}\n`);

    await mongoose.connection.close();
  } catch (error) {
    logger.error('Analysis failed:', error);
    process.exit(1);
  }
}

analyzeAssignments();
