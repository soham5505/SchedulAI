import { z } from 'zod';

// ==========================================
// COMMON / ENUM SCHEMAS
// ==========================================

export const UserRoleSchema = z.enum(['ADMIN', 'TEACHER', 'STAFF', 'VIEWER']);

export const RoomTypeSchema = z.enum(['LECTURE', 'LAB', 'SEMINAR', 'OTHER']);

export const DayOfWeekSchema = z.enum([
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
]);

export const PeriodTypeSchema = z.enum(['LECTURE', 'LAB', 'TUTORIAL', 'SEMINAR']);

export const GenerationStatusSchema = z.enum([
  'PENDING',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
]);

export const ImportTypeSchema = z.enum([
  'TEACHERS',
  'SUBJECTS',
  'CLASSROOMS',
  'SEMESTERS',
  'TIMESLOTS',
  'ASSIGNMENTS',
  'TIMETABLE',
  'MASTER',
]);

export const TimeStringSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'Invalid time format. Use HH:mm (24-hour)' });

export const MongoIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, { message: 'Invalid MongoDB ObjectId' });

// ==========================================
// AUTH SCHEMAS
// ==========================================

export const RegisterUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
      message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
    }),
  role: UserRoleSchema.default('VIEWER'),
  departmentId: MongoIdSchema.optional(),
});

export const LoginUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// ==========================================
// USER SCHEMAS
// ==========================================

export const UpdateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  role: UserRoleSchema.optional(),
  isActive: z.boolean().optional(),
  departmentId: MongoIdSchema.nullable().optional(),
  password: z
    .string()
    .min(8)
    .max(100)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .optional(),
});

// ==========================================
// DEPARTMENT SCHEMAS
// ==========================================

export const CreateDepartmentSchema = z.object({
  name: z.string().min(2, 'Name is required').max(100),
  code: z.string().min(2, 'Code is required').max(20).toUpperCase(),
  description: z.string().max(500).optional(),
  isActive: z.boolean().default(true),
});

export const UpdateDepartmentSchema = CreateDepartmentSchema.partial();

// ==========================================
// TEACHER SCHEMAS
// ==========================================

export const CreateTeacherSchema = z.object({
  name: z.string().min(2, 'Name is required').max(100),
  email: z.string().email('Invalid email address'),
  phone: z.string().max(20).optional(),
  designation: z.string().min(2, 'Designation is required').max(100),
  departmentId: MongoIdSchema,
  employeeId: z.string().min(1, 'Employee ID is required').max(50),
  subjects: z.array(MongoIdSchema).default([]),
  availability: z.array(DayOfWeekSchema).default(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']),
  preferredTimeSlots: z.array(MongoIdSchema).default([]),
  unavailableTimeSlots: z.array(MongoIdSchema).default([]),
  maxClassesPerDay: z.number().int().min(1).max(10).default(4),
  maxClassesPerWeek: z.number().int().min(1).max(40).default(20),
  isActive: z.boolean().default(true),
});

export const UpdateTeacherSchema = CreateTeacherSchema.partial();

// ==========================================
// SUBJECT SCHEMAS
// ==========================================

export const CreateSubjectSchema = z.object({
  name: z.string().min(2, 'Subject name is required').max(100),
  code: z.string().min(2, 'Subject code is required').max(20).toUpperCase(),
  credits: z.number().int().min(1).max(10).default(3),
  departmentId: MongoIdSchema,
  semesterIds: z.array(MongoIdSchema).default([]),
  weeklyPeriods: z.number().int().min(1).max(20).default(4),
  lecturePeriods: z.number().int().min(0).max(20).default(3),
  labPeriods: z.number().int().min(0).max(20).default(1),
  isLab: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const UpdateSubjectSchema = CreateSubjectSchema.partial();

// ==========================================
// CLASSROOM SCHEMAS
// ==========================================

export const CreateClassroomSchema = z.object({
  name: z.string().min(2, 'Room name is required').max(100),
  building: z.string().min(1, 'Building is required').max(100),
  roomNumber: z.string().min(1, 'Room number is required').max(50),
  capacity: z.number().int().min(1, 'Capacity must be at least 1').max(1000),
  type: RoomTypeSchema.default('LECTURE'),
  equipment: z.array(z.string()).default([]),
  isLab: z.boolean().default(false),
  isAvailable: z.boolean().default(true),
});

export const UpdateClassroomSchema = CreateClassroomSchema.partial();

// ==========================================
// SEMESTER SCHEMAS
// ==========================================

export const CreateSemesterSchema = z.object({
  name: z.string().min(2, 'Semester name is required').max(100),
  number: z.number().int().min(1).max(12),
  departmentId: MongoIdSchema,
  academicYear: z.string().min(4, 'Academic year is required (e.g. 2025-2026)'),
  section: z.string().min(1).max(10).default('A'),
  studentCount: z.number().int().min(1, 'Student count must be at least 1').max(500),
  isActive: z.boolean().default(true),
});

export const UpdateSemesterSchema = CreateSemesterSchema.partial();

// ==========================================
// BATCH SCHEMAS
// ==========================================

export const CreateBatchSchema = z.object({
  semesterId: MongoIdSchema,
  code: z
    .string()
    .trim()
    .min(1, 'Batch code is required')
    .max(20)
    .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, 'Batch code may contain only letters, numbers, hyphens, and underscores')
    .transform((value) => value.toUpperCase()),
  studentCount: z.number().int().min(1).max(500).default(30),
  isActive: z.boolean().default(true),
});

export const UpdateBatchSchema = CreateBatchSchema.omit({ semesterId: true }).partial();

// ==========================================
// ROOM RESERVATION SCHEMAS
// ==========================================

export const CreateRoomReservationSchema = z.object({
  classroomId: MongoIdSchema,
  departmentId: MongoIdSchema,
  dayOfWeek: DayOfWeekSchema,
  startPeriod: z.number().int().min(1, 'Start period must be at least 1').max(20),
  endPeriod: z.number().int().min(1, 'End period must be at least 1').max(20),
  reason: z.string().max(500).default(''),
  isActive: z.boolean().default(true),
}).refine((data) => data.endPeriod >= data.startPeriod, {
  message: 'End period must be greater than or equal to start period',
  path: ['endPeriod'],
});

export const UpdateRoomReservationSchema = z.object({
  classroomId: MongoIdSchema.optional(),
  departmentId: MongoIdSchema.optional(),
  dayOfWeek: DayOfWeekSchema.optional(),
  startPeriod: z.number().int().min(1).max(20).optional(),
  endPeriod: z.number().int().min(1).max(20).optional(),
  reason: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
});



// ==========================================
// TIME SLOT SCHEMAS
// ==========================================

export const CreateTimeSlotSchema = z.object({
  day: DayOfWeekSchema,
  startTime: TimeStringSchema,
  endTime: TimeStringSchema,
  periodNumber: z.number().int().min(1).max(20),
  isBreak: z.boolean().default(false),
  isActive: z.boolean().default(true),
  label: z.string().max(50).optional(),
});

export const UpdateTimeSlotSchema = CreateTimeSlotSchema.partial();

// ==========================================
// TEACHING ASSIGNMENT SCHEMAS
// ==========================================

const TeachingAssignmentBaseSchema = z.object({
  teacherId: MongoIdSchema,
  subjectId: MongoIdSchema,
  semesterId: MongoIdSchema,
  batchId: MongoIdSchema.nullable().optional(),
  classroomId: MongoIdSchema.optional(),
  classroomRequirements: z.array(z.string()).default([]),
  periodsPerWeek: z.number().int().min(2).max(3).default(3),
  isLab: z.boolean().default(false),
});

export const CreateTeachingAssignmentSchema = TeachingAssignmentBaseSchema.superRefine((assignment, context) => {
  const expectedPeriods = assignment.isLab ? 2 : 3;
  if (assignment.periodsPerWeek !== expectedPeriods) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['periodsPerWeek'],
      message: `This assignment must have exactly ${expectedPeriods} period(s) per week.`,
    });
  }
});

export const UpdateTeachingAssignmentSchema = TeachingAssignmentBaseSchema.partial();

// ==========================================
// HARD & SOFT CONSTRAINTS SCHEMAS
// ==========================================

export const HardConstraintsSchema = z.object({
  enforceTeacherConflicts: z.boolean().default(true),
  enforceClassroomConflicts: z.boolean().default(true),
  enforceSemesterConflicts: z.boolean().default(true),
  enforceTeacherAvailability: z.boolean().default(true),
  enforceClassroomCapacity: z.boolean().default(true),
  enforceLabCompatibility: z.boolean().default(true),
  enforceWeeklyPeriodRequirements: z.boolean().default(true),
  enforceTeacherWorkloadLimits: z.boolean().default(true),
});

export const SoftConstraintsSchema = z.object({
  avoidEarlyMorning: z.number().min(0).max(10).default(5),
  avoidFridayAfternoon: z.number().min(0).max(10).default(4),
  avoidTeacherGaps: z.number().min(0).max(10).default(6),
  preferConsecutiveClasses: z.number().min(0).max(10).default(4),
  balanceTeacherWorkload: z.number().min(0).max(10).default(7),
  balanceStudentWorkload: z.number().min(0).max(10).default(6),
  avoidUnnecessaryClassroomChanges: z.number().min(0).max(10).default(5),
  preferTeacherPreferredPeriods: z.number().min(0).max(10).default(7),
  preferPreferredClassrooms: z.number().min(0).max(10).default(4),
  avoidExcessiveConsecutiveClasses: z.number().min(0).max(10).default(6),
  spreadSubjects: z.number().min(0).max(10).default(7),
});

// ==========================================
// GENERATION SCHEMAS
// ==========================================

export const GenerateTimetableSchema = z.object({
  name: z.string().min(2, 'Name is required').max(100),
  departmentId: MongoIdSchema.optional(),
  academicYear: z.string().optional(),
  semesterIds: z.array(MongoIdSchema).min(1, 'At least one semester must be selected'),
  hardConstraints: HardConstraintsSchema.partial().optional(),
  softConstraints: SoftConstraintsSchema.partial().optional(),
  timeLimitSeconds: z.number().min(5).max(300).default(60),
});

// ==========================================
// TIMETABLE MOVE & EDIT SCHEMAS
// ==========================================

export const TimetableMoveSchema = z.object({
  entryId: MongoIdSchema,
  targetTimeSlotId: MongoIdSchema,
  targetClassroomId: MongoIdSchema.optional(),
  generationId: MongoIdSchema,
});

export const TimetableEntryUpdateSchema = z.object({
  teacherId: MongoIdSchema.optional(),
  subjectId: MongoIdSchema.optional(),
  classroomId: MongoIdSchema.optional(),
  timeSlotId: MongoIdSchema.optional(),
  periodType: PeriodTypeSchema.optional(),
  batchId: MongoIdSchema.nullable().optional(),
});

// ==========================================
// IMPORT SCHEMAS
// ==========================================

export const ColumnMappingSchema = z.record(z.string());

export const ExecuteImportSchema = z.object({
  type: ImportTypeSchema,
  columnMapping: ColumnMappingSchema,
  data: z.array(z.record(z.unknown())),
  departmentId: MongoIdSchema.optional(),
});

// ==========================================
// AI REQUEST SCHEMAS
// ==========================================

export const AIPreferenceParseSchema = z.object({
  prompt: z.string().min(3, 'Prompt is required').max(2000),
  departmentId: MongoIdSchema.optional(),
});

export const AIConflictExplainSchema = z.object({
  conflict: z.object({
    type: z.string(),
    message: z.string(),
    teacherId: z.string().optional(),
    teacherName: z.string().optional(),
    semesterId: z.string().optional(),
    semesterName: z.string().optional(),
    classroomId: z.string().optional(),
    classroomName: z.string().optional(),
    timeSlot: z.string().optional(),
    day: z.string().optional(),
  }),
});

export const AITimetableSummarySchema = z.object({
  generationId: MongoIdSchema,
});

// ==========================================
// QUERY PARAMETERS SCHEMA
// ==========================================

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('asc'),
  departmentId: MongoIdSchema.optional(),
  isActive: z.coerce.boolean().optional(),
});

export const BatchQuerySchema = PaginationQuerySchema.extend({
  semesterId: MongoIdSchema.optional(),
});

export const RoomReservationQuerySchema = PaginationQuerySchema.extend({
  classroomId: MongoIdSchema.optional(),
  dayOfWeek: DayOfWeekSchema.optional(),
});
