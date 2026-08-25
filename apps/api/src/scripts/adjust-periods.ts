/**
 * Adjust Course Periods to Fit Within Slot Constraints
 * 
 * Reduces lab periods from 8h to 6h for select courses to fit within 40-slot limit
 * 
 * BEIT 7th: 44 → 40 periods (reduce 2 labs from 8 to 6)
 * SEIT 3rd: 57 → 40 periods (reduce 3-4 labs from 8 to 6)
 * TEIT 5th: 65 → 40 periods (reduce 4 labs from 8 to 6)
 * 
 * Usage: npm --workspace=@schedulai/api run adjust:periods
 */

import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { TeachingAssignmentModel } from '../models/assignment.model.js';
import { SubjectModel } from '../models/subject.model.js';
import { SemesterModel } from '../models/semester.model.js';
import { Logger } from '../utils/logger.js';

dotenv.config();
const logger = new Logger('AdjustPeriods');

// Courses to adjust: map of course code to new periods
const ADJUSTMENTS: Record<string, { code: string; newPeriods: number }[]> = {
  BEIT7: [
    { code: 'ITL701', newPeriods: 6 }, // Data Science Lab: 8 → 6
    { code: 'ITL702', newPeriods: 6 }, // IoE Lab: 8 → 6
  ],
  SEIT3: [
    { code: '2343112', newPeriods: 2 }, // Advance Data Structures: 3 → 2
    { code: '2343113', newPeriods: 2 }, // Database Management: 3 → 2
    { code: '2993511', newPeriods: 4 }, // Entrepreneurship: 8 → 4
    { code: '2343115', newPeriods: 4 }, // ADSA Lab: 8 → 4
    { code: '2343116', newPeriods: 4 }, // SQL Lab: 8 → 4
    { code: '2343611', newPeriods: 4 }, // Mini Project: 8 → 4
    { code: '2993512', newPeriods: 4 }, // Environmental Science: 8 → 4
  ],
  TEIT5: [
    { code: '2345111', newPeriods: 2 }, // Software Engineering: 3 → 2
    { code: '2345112', newPeriods: 2 }, // AI and Machine Learning: 3 → 2
    { code: '2345113', newPeriods: 2 }, // Web Technology: 3 → 2
    { code: '2345114', newPeriods: 2 }, // Advanced Database: 3 → 2
    { code: 'MDC501', newPeriods: 2 }, // Multidisciplinary Minor: 3 → 2
    { code: '2345511', newPeriods: 4 }, // India Knowledge Lab: 8 → 4
    { code: '2345115', newPeriods: 4 }, // DevOps Lab: 8 → 4
    { code: '2345116', newPeriods: 4 }, // AI & ML Lab: 8 → 4
    { code: '2345117', newPeriods: 4 }, // Web Lab: 8 → 4
    { code: '2345118', newPeriods: 4 }, // PEL-1 Lab: 8 → 4
    { code: 'MDL501', newPeriods: 4 }, // Multidisciplinary Minor Lab: 8 → 4
  ],
};

const SEMESTER_CODES: Record<string, string> = {
  BEIT7: 'BEIT 7th Semester — Section A',
  SEIT3: 'SEIT 3rd Semester — Section A',
  TEIT5: 'TEIT 5th Semester — Section A',
};

async function adjustPeriods() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/schedulai';
    await mongoose.connect(mongoUri);
    logger.info('Connected to MongoDB');

    // Get all semesters
    const semesters = await SemesterModel.find({}).lean();
    const semesterMap = new Map(semesters.map((s: any) => [s.name, s._id]));

    logger.info('\n🔧 Adjusting course periods...\n');

    let totalAdjustments = 0;
    let totalPeriodsSaved = 0;

    for (const [semCode, adjustList] of Object.entries(ADJUSTMENTS)) {
      const semesterName = SEMESTER_CODES[semCode];
      const semesterId = semesterMap.get(semesterName);

      if (!semesterId) {
        logger.warn(`⚠️  Semester not found: ${semesterName}`);
        continue;
      }

      let semesterPeriodsSaved = 0;

      for (const adjustment of adjustList) {
        const subject = await SubjectModel.findOne({
          code: adjustment.code,
        }).lean();

        if (!subject) {
          logger.warn(
            `⚠️  Subject not found: ${adjustment.code}`
          );
          continue;
        }

        const assignment = await TeachingAssignmentModel.findOne({
          subjectId: subject._id,
          semesterId,
        }).lean();

        if (!assignment) {
          logger.warn(
            `⚠️  Assignment not found for ${adjustment.code} in ${semesterName}`
          );
          continue;
        }

        const oldPeriods = assignment.periodsPerWeek || 0;
        const newPeriods = adjustment.newPeriods;
        const saved = oldPeriods - newPeriods;

        // Update the assignment
        await TeachingAssignmentModel.findByIdAndUpdate(
          assignment._id,
          { periodsPerWeek: newPeriods },
          { new: true }
        );

        logger.info(
          `  ✓ ${adjustment.code}: ${oldPeriods}h → ${newPeriods}h (saved ${saved}h)`
        );

        totalAdjustments++;
        totalPeriodsSaved += saved;
        semesterPeriodsSaved += saved;
      }

      logger.info(
        `\n  📊 ${semesterName}: Saved ${semesterPeriodsSaved} periods\n`
      );
    }

    logger.info(`${'='.repeat(80)}`);
    logger.info(`✅ Adjustments Complete!`);
    logger.info(`  Total courses adjusted: ${totalAdjustments}`);
    logger.info(`  Total periods reduced: ${totalPeriodsSaved}`);
    logger.info(`${'='.repeat(80)}`);

    // Show new totals
    logger.info('\n📈 New Period Totals:');
    const semestreCounts: Record<string, number> = {};

    const allAssignments = await TeachingAssignmentModel.find({}).lean();
    for (const assignment of allAssignments) {
      const semester = await SemesterModel.findById(assignment.semesterId).lean();
      if (semester) {
        semestreCounts[semester.name] = (semestreCounts[semester.name] || 0) + (assignment.periodsPerWeek || 0);
      }
    }

    for (const [semName, totalPeriods] of Object.entries(semestreCounts)) {
      const status = totalPeriods <= 40 ? '✅' : '⚠️';
      logger.info(`  ${status} ${semName}: ${totalPeriods} periods`);
    }

    await mongoose.connection.close();
    logger.info('\n✓ Database connection closed.');
  } catch (error) {
    logger.error('Adjustment failed:', error);
    process.exit(1);
  }
}

adjustPeriods();
