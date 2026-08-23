import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { UserModel } from '../models/user.model.js';
import { DepartmentModel } from '../models/department.model.js';
import { TeacherModel } from '../models/teacher.model.js';
import { SubjectModel } from '../models/subject.model.js';
import { ClassroomModel } from '../models/classroom.model.js';
import { SemesterModel } from '../models/semester.model.js';
import { TimeSlotModel } from '../models/timeslot.model.js';
import { TeachingAssignmentModel } from '../models/assignment.model.js';
import { STANDARD_PERIOD_TIMES } from '@schedulai/config';
import { DayOfWeek } from '@schedulai/shared-types';

export async function seedDatabase() {
  console.log('🌱 Starting comprehensive database seeding...');
  await connectDatabase();

  // 1. Clear existing collections
  await Promise.all([
    UserModel.deleteMany({}),
    DepartmentModel.deleteMany({}),
    TeacherModel.deleteMany({}),
    SubjectModel.deleteMany({}),
    ClassroomModel.deleteMany({}),
    SemesterModel.deleteMany({}),
    TimeSlotModel.deleteMany({}),
    TeachingAssignmentModel.deleteMany({}),
  ]);

  console.log('🧹 Cleaned existing database tables.');

  // 2. Create Departments
  const csDept = await DepartmentModel.create({
    name: 'Computer Science & Engineering',
    code: 'CSE',
    description: 'Department of Computer Science and Engineering',
    isActive: true,
  });

  const meDept = await DepartmentModel.create({
    name: 'Mechanical Engineering',
    code: 'ME',
    description: 'Department of Mechanical Engineering',
    isActive: true,
  });

  const eeDept = await DepartmentModel.create({
    name: 'Electrical Engineering',
    code: 'EE',
    description: 'Department of Electrical & Electronics',
    isActive: true,
  });

  const mathDept = await DepartmentModel.create({
    name: 'Mathematics & Computing',
    code: 'MATH',
    description: 'Department of Mathematics',
    isActive: true,
  });

  console.log('✅ Created 4 Departments.');

  // 3. Create Users
  const salt = await bcrypt.genSalt(10);
  const adminPassword = await bcrypt.hash('Admin@12345', salt);
  const teacherPassword = await bcrypt.hash('Teacher@12345', salt);
  const staffPassword = await bcrypt.hash('Staff@12345', salt);
  const viewerPassword = await bcrypt.hash('Viewer@12345', salt);

  const adminUser = await UserModel.create({
    name: 'Chief Administrator',
    email: 'admin@schedulai.edu',
    passwordHash: adminPassword,
    role: 'ADMIN',
    departmentId: csDept._id,
    isActive: true,
  });

  const teacherUser = await UserModel.create({
    name: 'Dr. Alan Turing',
    email: 'teacher@schedulai.edu',
    passwordHash: teacherPassword,
    role: 'TEACHER',
    departmentId: csDept._id,
    isActive: true,
  });

  const staffUser = await UserModel.create({
    name: 'Academic Coordinator',
    email: 'staff@schedulai.edu',
    passwordHash: staffPassword,
    role: 'STAFF',
    departmentId: csDept._id,
    isActive: true,
  });

  const viewerUser = await UserModel.create({
    name: 'Student Viewer',
    email: 'viewer@schedulai.edu',
    passwordHash: viewerPassword,
    role: 'VIEWER',
    departmentId: csDept._id,
    isActive: true,
  });

  console.log('✅ Created 4 System Users (Admin, Teacher, Staff, Viewer).');

  // 4. Create Standard Time Slots (Monday - Friday)
  const days: DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
  const createdSlots = [];

  for (const day of days) {
    for (const p of STANDARD_PERIOD_TIMES) {
      const slot = await TimeSlotModel.create({
        day,
        startTime: p.startTime,
        endTime: p.endTime,
        periodNumber: p.period,
        isBreak: p.isBreak || false,
        label: p.label || `Period ${p.period}`,
        isActive: true,
      });
      createdSlots.push(slot);
    }
  }

  console.log(`✅ Created ${createdSlots.length} Time Slots.`);

  // 5. Create Classrooms
  const room101 = await ClassroomModel.create({
    name: 'Room 101 — Lecture Hall',
    building: 'CS Block',
    roomNumber: '101',
    capacity: 60,
    type: 'LECTURE',
    equipment: ['PROJECTOR', 'AC', 'SMART_BOARD'],
    isLab: false,
    isAvailable: true,
  });

  const room102 = await ClassroomModel.create({
    name: 'Room 102 — Lecture Hall',
    building: 'CS Block',
    roomNumber: '102',
    capacity: 60,
    type: 'LECTURE',
    equipment: ['PROJECTOR', 'AC'],
    isLab: false,
    isAvailable: true,
  });

  const lab201 = await ClassroomModel.create({
    name: 'Lab 201 — Systems Programming Lab',
    building: 'CS Block',
    roomNumber: '201',
    capacity: 45,
    type: 'LAB',
    equipment: ['PROJECTOR', 'COMPUTERS', 'LINUX_WORKSTATIONS'],
    isLab: true,
    isAvailable: true,
  });

  const lab202 = await ClassroomModel.create({
    name: 'Lab 202 — AI & Robotics Lab',
    building: 'CS Block',
    roomNumber: '202',
    capacity: 45,
    type: 'LAB',
    equipment: ['COMPUTERS', 'GPU_SERVERS', 'ROBOTIC_KITS'],
    isLab: true,
    isAvailable: true,
  });

  const seminarA = await ClassroomModel.create({
    name: 'Seminar Hall A',
    building: 'Main Block',
    roomNumber: 'SHA',
    capacity: 120,
    type: 'SEMINAR',
    equipment: ['PROJECTOR', 'SURROUND_AUDIO', 'PODIUM'],
    isLab: false,
    isAvailable: true,
  });

  console.log('✅ Created 5 Classrooms & Labs.');

  // 6. Create Semesters
  const sem3A = await SemesterModel.create({
    name: 'CSE 3rd Semester — Section A',
    number: 3,
    departmentId: csDept._id,
    academicYear: '2026-2027',
    section: 'A',
    studentCount: 40,
    isActive: true,
  });

  const sem3B = await SemesterModel.create({
    name: 'CSE 3rd Semester — Section B',
    number: 3,
    departmentId: csDept._id,
    academicYear: '2026-2027',
    section: 'B',
    studentCount: 38,
    isActive: true,
  });

  const sem5A = await SemesterModel.create({
    name: 'CSE 5th Semester — Section A',
    number: 5,
    departmentId: csDept._id,
    academicYear: '2026-2027',
    section: 'A',
    studentCount: 35,
    isActive: true,
  });

  console.log('✅ Created 3 Semesters.');

  // 7. Create Subjects
  const dsa = await SubjectModel.create({
    name: 'Data Structures & Algorithms',
    code: 'CS301',
    credits: 4,
    departmentId: csDept._id,
    semesterIds: [sem3A._id, sem3B._id],
    weeklyPeriods: 4,
    lecturePeriods: 3,
    labPeriods: 1,
    isLab: false,
    isActive: true,
  });

  const os = await SubjectModel.create({
    name: 'Operating Systems',
    code: 'CS302',
    credits: 4,
    departmentId: csDept._id,
    semesterIds: [sem3A._id, sem3B._id],
    weeklyPeriods: 4,
    lecturePeriods: 3,
    labPeriods: 1,
    isLab: false,
    isActive: true,
  });

  const dbms = await SubjectModel.create({
    name: 'Database Management Systems',
    code: 'CS303',
    credits: 4,
    departmentId: csDept._id,
    semesterIds: [sem3A._id, sem3B._id],
    weeklyPeriods: 4,
    lecturePeriods: 3,
    labPeriods: 1,
    isLab: false,
    isActive: true,
  });

  const discreteMath = await SubjectModel.create({
    name: 'Discrete Mathematics',
    code: 'MA301',
    credits: 3,
    departmentId: mathDept._id,
    semesterIds: [sem3A._id, sem3B._id],
    weeklyPeriods: 3,
    lecturePeriods: 3,
    labPeriods: 0,
    isLab: false,
    isActive: true,
  });

  const dsaLab = await SubjectModel.create({
    name: 'Data Structures Laboratory',
    code: 'CS311',
    credits: 2,
    departmentId: csDept._id,
    semesterIds: [sem3A._id],
    weeklyPeriods: 2,
    lecturePeriods: 0,
    labPeriods: 2,
    isLab: true,
    isActive: true,
  });

  const aiSub = await SubjectModel.create({
    name: 'Artificial Intelligence & Deep Learning',
    code: 'CS501',
    credits: 4,
    departmentId: csDept._id,
    semesterIds: [sem5A._id],
    weeklyPeriods: 4,
    lecturePeriods: 3,
    labPeriods: 1,
    isLab: false,
    isActive: true,
  });

  console.log('✅ Created 6 Subjects.');

  // 8. Create Teachers
  const teacher1 = await TeacherModel.create({
    name: 'Dr. Alan Turing',
    email: 'alan.turing@schedulai.edu',
    phone: '+1 555-0101',
    designation: 'Professor & Head',
    departmentId: csDept._id,
    employeeId: 'FAC001',
    subjects: [dsa._id, dsaLab._id],
    availability: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
    maxClassesPerDay: 4,
    maxClassesPerWeek: 18,
    isActive: true,
  });

  const teacher2 = await TeacherModel.create({
    name: 'Dr. Grace Hopper',
    email: 'grace.hopper@schedulai.edu',
    phone: '+1 555-0102',
    designation: 'Professor',
    departmentId: csDept._id,
    employeeId: 'FAC002',
    subjects: [os._id],
    availability: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
    maxClassesPerDay: 4,
    maxClassesPerWeek: 18,
    isActive: true,
  });

  const teacher3 = await TeacherModel.create({
    name: 'Dr. Ada Lovelace',
    email: 'ada.lovelace@schedulai.edu',
    phone: '+1 555-0103',
    designation: 'Associate Professor',
    departmentId: csDept._id,
    employeeId: 'FAC003',
    subjects: [dbms._id, aiSub._id],
    availability: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
    maxClassesPerDay: 4,
    maxClassesPerWeek: 18,
    isActive: true,
  });

  const teacher4 = await TeacherModel.create({
    name: 'Prof. Katherine Johnson',
    email: 'katherine.johnson@schedulai.edu',
    phone: '+1 555-0104',
    designation: 'Assistant Professor',
    departmentId: mathDept._id,
    employeeId: 'FAC004',
    subjects: [discreteMath._id],
    availability: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
    maxClassesPerDay: 4,
    maxClassesPerWeek: 18,
    isActive: true,
  });

  console.log('✅ Created 4 Faculty Profiles.');

  // 9. Create Teaching Assignments for CSE 3rd Sem Sec A
  await TeachingAssignmentModel.create([
    {
      teacherId: teacher1._id,
      subjectId: dsa._id,
      semesterId: sem3A._id,
      classroomRequirements: [],
      periodsPerWeek: 4,
      isLab: false,
    },
    {
      teacherId: teacher2._id,
      subjectId: os._id,
      semesterId: sem3A._id,
      classroomRequirements: [],
      periodsPerWeek: 4,
      isLab: false,
    },
    {
      teacherId: teacher3._id,
      subjectId: dbms._id,
      semesterId: sem3A._id,
      classroomRequirements: [],
      periodsPerWeek: 4,
      isLab: false,
    },
    {
      teacherId: teacher4._id,
      subjectId: discreteMath._id,
      semesterId: sem3A._id,
      classroomRequirements: [],
      periodsPerWeek: 3,
      isLab: false,
    },
    {
      teacherId: teacher1._id,
      subjectId: dsaLab._id,
      semesterId: sem3A._id,
      classroomRequirements: [],
      periodsPerWeek: 2,
      isLab: true,
    },
  ]);

  console.log('✅ Created 5 Teaching Assignments for CSE 3rd Sem Sec A.');
  console.log('🎉 Seeding successfully completed!');
}

if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  seedDatabase()
    .then(async () => {
      await disconnectDatabase();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('❌ Seeding failed:', err);
      await disconnectDatabase();
      process.exit(1);
    });
}
