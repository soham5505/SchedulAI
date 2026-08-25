/**
 * Seed Dummy Data for Timetable
 * 
 * Creates realistic course assignments for 3 semesters that fit within 40 time slots
 * BEIT 7th, SEIT 3rd, TEIT 5th
 * 
 * Usage: npm --workspace=@schedulai/api run seed:dummy
 */

import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { TeacherModel } from '../models/teacher.model.js';
import { SubjectModel } from '../models/subject.model.js';
import { SemesterModel } from '../models/semester.model.js';
import { ClassroomModel } from '../models/classroom.model.js';
import { DepartmentModel } from '../models/department.model.js';
import { TeachingAssignmentModel } from '../models/assignment.model.js';
import { Logger } from '../utils/logger.js';

dotenv.config();
const logger = new Logger('SeedDummyData');

// Sample data
const DEPARTMENTS = [
  { code: 'IT', name: 'Information Technology' },
  { code: 'CSE', name: 'Computer Science & Engineering' },
  { code: 'ECE', name: 'Electronics & Communication Engineering' },
];

const TEACHERS = [
  { name: 'Prof. A. B. Vartak', email: 'vartak@college.edu', employeeId: 'EMP001', designation: 'Assistant Professor', department: 'IT' },
  { name: 'Prof. S. V. Jadhav', email: 'jadhav@college.edu', employeeId: 'EMP002', designation: 'Assistant Professor', department: 'IT' },
  { name: 'Prof. M. K. Zagade', email: 'zagade@college.edu', employeeId: 'EMP003', designation: 'Assistant Professor', department: 'IT' },
  { name: 'Prof. A. R. Kazi', email: 'kazi@college.edu', employeeId: 'EMP004', designation: 'Assistant Professor', department: 'IT' },
  { name: 'Prof. S. S. Tolye', email: 'tolye@college.edu', employeeId: 'EMP005', designation: 'Assistant Professor', department: 'IT' },
  { name: 'Prof. R. S. More', email: 'more@college.edu', employeeId: 'EMP006', designation: 'Assistant Professor', department: 'IT' },
  { name: 'Prof. P. L. Fernandes', email: 'fernandes@college.edu', employeeId: 'EMP007', designation: 'Assistant Professor', department: 'IT' },
  { name: 'Prof. M. S. Joshi', email: 'joshi@college.edu', employeeId: 'EMP008', designation: 'Assistant Professor', department: 'IT' },
  { name: 'Prof. S. Sankreswari', email: 'sankreswari@college.edu', employeeId: 'EMP009', designation: 'Assistant Professor', department: 'IT' },
  { name: 'Prof. T. P. Soman', email: 'soman@college.edu', employeeId: 'EMP010', designation: 'Assistant Professor', department: 'IT' },
  { name: 'Prof. V. M. Kulkarni', email: 'kulkarni@college.edu', employeeId: 'EMP011', designation: 'Assistant Professor', department: 'IT' },
  { name: 'Prof. A.R. Palwankar', email: 'palwankar@college.edu', employeeId: 'EMP012', designation: 'Assistant Professor', department: 'IT' },
];

const CLASSROOMS = [
  { name: 'Lab-1', building: 'Academic Block A', roomNumber: '301', capacity: 40, type: 'LAB', isLab: true },
  { name: 'Lab-2', building: 'Academic Block A', roomNumber: '302', capacity: 40, type: 'LAB', isLab: true },
  { name: 'Hall-A', building: 'Academic Block B', roomNumber: '101', capacity: 60, type: 'LECTURE', isLab: false },
  { name: 'Hall-B', building: 'Academic Block B', roomNumber: '102', capacity: 60, type: 'LECTURE', isLab: false },
];

const SEMESTERS = [
  { code: 'BEIT7', name: 'BEIT 7th Semester — Section A', number: 7, academicYear: '2025-26', section: 'A', studentCount: 40, departmentCode: 'IT' },
  { code: 'SEIT3', name: 'SEIT 3rd Semester — Section A', number: 3, academicYear: '2025-26', section: 'A', studentCount: 40, departmentCode: 'IT' },
  { code: 'TEIT5', name: 'TEIT 5th Semester — Section A', number: 5, academicYear: '2025-26', section: 'A', studentCount: 40, departmentCode: 'IT' },
];

// BEIT 7th Semester - 8 assignments = 44 periods (realistic for 40 slots)
const BEIT_7TH_COURSES = [
  { code: 'ITC701', name: 'AI and DS - II', periods: 3, isLab: false },
  { code: 'ITC702', name: 'Internet of Everything', periods: 3, isLab: false },
  { code: 'ITD070-1', name: 'Infrastructure Security', periods: 3, isLab: false },
  { code: 'ITD070-2', name: 'Information Retrieval System', periods: 3, isLab: false },
  { code: 'ITL701', name: 'Data Science Lab', periods: 8, isLab: true },
  { code: 'ITL702', name: 'IoE Lab', periods: 8, isLab: true },
  { code: 'ITL703', name: 'Secure Application Lab', periods: 8, isLab: true },
  { code: 'ITL704', name: 'Recent OSS Lab', periods: 8, isLab: true },
];

// SEIT 3rd Semester - 10 assignments = 57 periods
const SEIT_3RD_COURSES = [
  { code: '2343111', name: 'Applied Mathematics Thinking', periods: 6, isLab: false },
  { code: '2343112', name: 'Advance Data Structures', periods: 3, isLab: false },
  { code: '2343113', name: 'Database Management System', periods: 3, isLab: false },
  { code: '2343114', name: 'Automata Theory', periods: 3, isLab: false },
  { code: 'OEC301', name: 'Open Elective - Web Design', periods: 2, isLab: false },
  { code: '2993511', name: 'Entrepreneurship Development', periods: 8, isLab: true },
  { code: '2343115', name: 'ADSA Lab', periods: 8, isLab: true },
  { code: '2343116', name: 'SQL Lab', periods: 8, isLab: true },
  { code: '2343611', name: 'Mini Project - Full Stack Java', periods: 8, isLab: true },
  { code: '2993512', name: 'Environmental Science', periods: 8, isLab: true },
];

// TEIT 5th Semester - 12 assignments = 65 periods
const TEIT_5TH_COURSES = [
  { code: '2345111', name: 'Software Engineering & Agile', periods: 3, isLab: false },
  { code: '2345112', name: 'AI and Machine Learning', periods: 3, isLab: false },
  { code: '2345113', name: 'Web Technology', periods: 3, isLab: false },
  { code: '2345114', name: 'Advanced Database Technologies', periods: 3, isLab: false },
  { code: 'MDC501', name: 'Multidisciplinary Minor', periods: 3, isLab: false },
  { code: 'OECL501', name: 'Open Elective - Generative AI', periods: 2, isLab: false },
  { code: '2345511', name: 'India Knowledge System Lab', periods: 8, isLab: true },
  { code: '2345115', name: 'DevOps Lab', periods: 8, isLab: true },
  { code: '2345116', name: 'AI & ML Lab', periods: 8, isLab: true },
  { code: '2345117', name: 'Web Lab', periods: 8, isLab: true },
  { code: '2345118', name: 'PEL-1 Lab', periods: 8, isLab: true },
  { code: 'MDL501', name: 'Multidisciplinary Minor Lab', periods: 8, isLab: true },
];

async function seedDummyData() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/schedulai';
    await mongoose.connect(mongoUri);
    logger.info('Connected to MongoDB');

    // Step 1: Clear existing data
    logger.info('🗑️  Clearing existing data...');
    await TeachingAssignmentModel.deleteMany({});
    await SubjectModel.deleteMany({});
    await TeacherModel.deleteMany({});
    await SemesterModel.deleteMany({});
    await ClassroomModel.deleteMany({});
    await DepartmentModel.deleteMany({});
    logger.info('✓ Cleared all collections');

    // Step 2: Create departments
    logger.info('\n📚 Creating departments...');
    const departments = await DepartmentModel.insertMany(DEPARTMENTS);
    const deptMap = new Map(departments.map((d: any) => [d.code, d._id]));
    logger.info(`✓ Created ${departments.length} departments`);

    // Step 3: Create teachers
    logger.info('\n👨‍🏫 Creating teachers...');
    const teachersWithDept = TEACHERS.map((t: any) => ({
      ...t,
      departmentId: deptMap.get(t.department),
    }));
    const teachers = await TeacherModel.insertMany(teachersWithDept);
    const teacherMap = new Map(teachers.map((t: any, idx) => [idx, t._id]));
    logger.info(`✓ Created ${teachers.length} teachers`);

    // Step 4: Create classrooms
    logger.info('\n🏫 Creating classrooms...');
    const classrooms = await ClassroomModel.insertMany(CLASSROOMS);
    logger.info(`✓ Created ${classrooms.length} classrooms`);

    // Step 5: Create semesters
    logger.info('\n📅 Creating semesters...');
    const semestersWithDept = SEMESTERS.map((s: any) => ({
      name: s.name,
      number: s.number,
      academicYear: s.academicYear,
      section: s.section,
      studentCount: s.studentCount,
      departmentId: deptMap.get(s.departmentCode),
    }));
    const semesters = await SemesterModel.insertMany(semestersWithDept);
    const semesterMap = new Map(
      semesters.map((s: any, idx) => [SEMESTERS[idx].code, s._id])
    );
    logger.info(`✓ Created ${semesters.length} semesters`);

    // Step 6: Create subjects and assignments
    logger.info('\n📖 Creating subjects and assignments...');

    const allCourses = [
      { semester: 'BEIT7', courses: BEIT_7TH_COURSES },
      { semester: 'SEIT3', courses: SEIT_3RD_COURSES },
      { semester: 'TEIT5', courses: TEIT_5TH_COURSES },
    ];

    let totalAssignments = 0;
    let totalPeriods = 0;

    for (const { semester, courses } of allCourses) {
      const semesterId = semesterMap.get(semester);
      let semesterPeriods = 0;

      for (let i = 0; i < courses.length; i++) {
        const course = courses[i];
        const teacherId = teacherMap.get(i % teachers.length);

        // Create subject
        const subject = await SubjectModel.create({
          code: course.code,
          name: course.name,
          departmentId: deptMap.get('IT'),
          credits: Math.ceil(course.periods / 4), // Rough conversion
        });

        // Create assignment
        await TeachingAssignmentModel.create({
          teacherId,
          subjectId: subject._id,
          semesterId,
          periodsPerWeek: course.periods,
          isLab: course.isLab,
        });

        semesterPeriods += course.periods;
        totalAssignments++;
        totalPeriods += course.periods;

        logger.info(
          `  ✓ ${course.code} (${course.name}) - ${course.periods}h/week → Prof. ${teachers[i % teachers.length].name}`
        );
      }

      logger.info(
        `\n  📊 ${SEMESTERS.find((s) => s.code === semester)?.name}: ${courses.length} courses = ${semesterPeriods} periods`
      );
    }

    logger.info(`\n${'='.repeat(80)}`);
    logger.info(`✅ SEED COMPLETE!`);
    logger.info(`  Total assignments: ${totalAssignments}`);
    logger.info(`  Total periods: ${totalPeriods}`);
    logger.info(`  Per semester: ~${Math.round(totalPeriods / 3)} periods`);
    logger.info(`${'='.repeat(80)}`);

    await mongoose.connection.close();
  } catch (error) {
    logger.error('Seed failed:', error);
    process.exit(1);
  }
}

seedDummyData();
