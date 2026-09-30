// ==========================================
// ENUMS & CONSTANTS
// ==========================================

export type UserRole = 'ADMIN' | 'TEACHER' | 'STAFF' | 'VIEWER';

export type RoomType = 'LECTURE' | 'LAB' | 'SEMINAR' | 'OTHER';

export type DayOfWeek = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY';

export type PeriodType = 'LECTURE' | 'LAB' | 'TUTORIAL' | 'SEMINAR';

export type GenerationStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export type ImportJobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export type ImportType = 'TEACHERS' | 'SUBJECTS' | 'CLASSROOMS' | 'SEMESTERS' | 'TIMESLOTS' | 'ASSIGNMENTS' | 'TIMETABLE' | 'MASTER';

export type AuditAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'GENERATE_TIMETABLE'
  | 'IMPORT_DATA'
  | 'EXPORT_DATA'
  | 'RESTORE_VERSION'
  | 'AI_QUERY';

// ==========================================
// ENTITY INTERFACES
// ==========================================

export interface IUser {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  departmentId?: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  lastLoginAt?: string | Date;
}

export interface IUserWithPassword extends IUser {
  passwordHash: string;
}

export interface IDepartment {
  _id: string;
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface ITeacher {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  designation: string;
  departmentId: string | IDepartment;
  employeeId: string;
  subjects: string[] | ISubject[];
  availability: DayOfWeek[];
  preferredTimeSlots: string[];
  unavailableTimeSlots: string[];
  maxClassesPerDay: number;
  maxClassesPerWeek: number;
  isActive: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface ISubject {
  _id: string;
  name: string;
  code: string;
  credits: number;
  departmentId: string | IDepartment;
  semesterIds: string[] | ISemester[];
  weeklyPeriods: number;
  lecturePeriods: number;
  labPeriods: number;
  isLab: boolean;
  isActive: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface IClassroom {
  _id: string;
  name: string;
  building: string;
  roomNumber: string;
  capacity: number;
  type: RoomType;
  equipment: string[];
  isLab: boolean;
  isAvailable: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface ISemester {
  _id: string;
  name: string;
  number: number;
  departmentId: string | IDepartment;
  academicYear: string;
  section: string;
  studentCount: number;
  isActive: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface IBatch {
  _id: string;
  semesterId: string | ISemester;
  code: string;
  studentCount: number;
  isActive: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface IRoomReservation {
  _id: string;
  classroomId: string | IClassroom;
  departmentId: string | IDepartment;
  dayOfWeek: DayOfWeek;
  startPeriod: number;
  endPeriod: number;
  reason: string;
  isActive: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface ITimeSlot {
  _id: string;
  day: DayOfWeek;
  startTime: string;
  endTime: string;
  periodNumber: number;
  isBreak: boolean;
  isActive: boolean;
  label?: string;
}

export interface ITeachingAssignment {
  _id: string;
  teacherId: string | ITeacher;
  subjectId: string | ISubject;
  semesterId: string | ISemester;
  batchId?: string | IBatch | null;
  classroomId?: string | IClassroom | null;
  classroomRequirements: string[];
  periodsPerWeek: number;
  isLab: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface ITimetableEntry {
  _id: string;
  assignmentId?: string;
  semesterId: string | ISemester;
  batchId?: string | IBatch | null;
  subjectId: string | ISubject;
  teacherId: string | ITeacher;
  classroomId: string | IClassroom;
  timeSlotId: string | ITimeSlot;
  day: DayOfWeek;
  startTime: string;
  endTime: string;
  periodType: PeriodType;
  generationId: string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface ISoftConstraints {
  avoidEarlyMorning?: number;
  avoidFridayAfternoon?: number;
  avoidTeacherGaps?: number;
  preferConsecutiveClasses?: number;
  balanceTeacherWorkload?: number;
  balanceStudentWorkload?: number;
  avoidUnnecessaryClassroomChanges?: number;
  preferTeacherPreferredPeriods?: number;
  preferPreferredClassrooms?: number;
  avoidExcessiveConsecutiveClasses?: number;
  spreadSubjects?: number;
}

export interface IHardConstraints {
  enforceTeacherConflicts: boolean;
  enforceClassroomConflicts: boolean;
  enforceSemesterConflicts: boolean;
  enforceTeacherAvailability: boolean;
  enforceClassroomCapacity: boolean;
  enforceLabCompatibility: boolean;
  enforceWeeklyPeriodRequirements: boolean;
  enforceTeacherWorkloadLimits: boolean;
}

export interface IGeneration {
  _id: string;
  name: string;
  status: GenerationStatus;
  semesterIds: string[] | ISemester[];
  departmentId?: string | IDepartment;
  academicYear?: string;
  startedAt: string | Date;
  completedAt?: string | Date;
  constraints?: IHardConstraints;
  preferences?: ISoftConstraints;
  resultCount: number;
  score: number;
  errorMessage?: string;
  violations?: ISchedulerViolation[];
  assignmentId?: string;
  createdBy: string | IUser;
  version?: number;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface IAuditLog {
  _id: string;
  userId?: string | IUser;
  userEmail?: string;
  userName?: string;
  action: AuditAction;
  entity: string;
  entityId?: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string | Date;
}

export interface IImportError {
  row: number;
  field: string;
  message: string;
  value?: unknown;
}

export interface IImportJob {
  _id: string;
  type: ImportType;
  fileName: string;
  status: ImportJobStatus;
  progress: number;
  totalRows: number;
  processedRows: number;
  successRows: number;
  errorRows: number;
  rowErrors: IImportError[];
  createdBy: string | IUser;
  startedAt?: string | Date;
  completedAt?: string | Date;
  createdAt: string | Date;
  updatedAt: string | Date;
}

// ==========================================
// SCHEDULER CONTRACTS
// ==========================================

export interface ISchedulerTeacherInput {
  id: string;
  name: string;
  availability: DayOfWeek[];
  preferredTimeSlots: string[];
  unavailableTimeSlots: string[];
  maxClassesPerDay: number;
  maxClassesPerWeek: number;
}

export interface ISchedulerSubjectInput {
  id: string;
  name: string;
  code: string;
  weeklyPeriods: number;
  lecturePeriods: number;
  labPeriods: number;
  isLab: boolean;
}

export interface ISchedulerClassroomInput {
  id: string;
  name: string;
  capacity: number;
  type: RoomType;
  equipment: string[];
  isLab: boolean;
  isAvailable: boolean;
}

export interface ISchedulerSemesterInput {
  id: string;
  name: string;
  studentCount: number;
}

export interface ISchedulerTimeSlotInput {
  id: string;
  day: DayOfWeek;
  startTime: string;
  endTime: string;
  periodNumber: number;
  isBreak: boolean;
  isActive: boolean;
}

export interface ISchedulerAssignmentInput {
  id: string;
  teacherId: string;
  subjectId: string;
  semesterId: string;
  batchId?: string;
  classroomId?: string;
  classroomRequirements: string[];
  periodsPerWeek: number;
  isLab: boolean;
}

export interface ISchedulerBatchInput {
  id: string;
  semesterId: string;
  code: string;
  studentCount: number;
}

export interface ISchedulerRoomBlockInput {
  id?: string;
  classroomId: string;
  departmentId?: string;
  dayOfWeek: DayOfWeek;
  startPeriod: number;
  duration: number;
  reason?: string;
}

export interface ISchedulerInput {
  teachers: ISchedulerTeacherInput[];
  subjects: ISchedulerSubjectInput[];
  classrooms: ISchedulerClassroomInput[];
  semesters: ISchedulerSemesterInput[];
  batches?: ISchedulerBatchInput[];
  roomBlocks?: ISchedulerRoomBlockInput[];
  timeslots: ISchedulerTimeSlotInput[];
  teachingAssignments: ISchedulerAssignmentInput[];
  hardConstraints?: Partial<IHardConstraints>;
  softConstraints?: ISoftConstraints;
  preferences?: Record<string, unknown>;
  timeLimitSeconds?: number;
}

export interface ISchedulerEntryOutput {
  assignmentId?: string;
  semesterId: string;
  batchId?: string;
  subjectId: string;
  teacherId: string;
  classroomId: string;
  timeSlotId: string;
  day: DayOfWeek;
  startTime: string;
  endTime: string;
  periodType: PeriodType;
}

export interface ISchedulerViolation {
  type: string;
  severity: 'ERROR' | 'WARNING';
  message: string;
  entityType?: string;
  entityId?: string;
  details?: Record<string, unknown>;
}

export interface ISchedulerOutput {
  success: boolean;
  status: GenerationStatus;
  timetable: ISchedulerEntryOutput[];
  score: number;
  violations: ISchedulerViolation[];
  errorMessage?: string;
  statistics: {
    totalAssignments?: number;
    scheduledCount?: number;
    unassignedCount?: number;
    solveTimeSeconds?: number;
    branches?: number;
    wallTime?: number;
  };
}

export interface IValidateTimetableRequest {
  timetable: ISchedulerEntryOutput[];
  teachers: ISchedulerTeacherInput[];
  subjects: ISchedulerSubjectInput[];
  classrooms: ISchedulerClassroomInput[];
  semesters: ISchedulerSemesterInput[];
  batches?: ISchedulerBatchInput[];
  timeslots: ISchedulerTimeSlotInput[];
  teachingAssignments: ISchedulerAssignmentInput[];
}

export interface IValidateTimetableResponse {
  isValid: boolean;
  violations: ISchedulerViolation[];
  stats: {
    totalEntries: number;
    conflictsCount: number;
  };
}

export interface IProposedMoveRequest {
  entryId: string;
  targetTimeSlotId: string;
  targetClassroomId?: string;
  currentTimetable: ITimetableEntry[];
  teachers: ISchedulerTeacherInput[];
  subjects: ISchedulerSubjectInput[];
  classrooms: ISchedulerClassroomInput[];
  semesters: ISchedulerSemesterInput[];
  batches?: ISchedulerBatchInput[];
  timeslots: ISchedulerTimeSlotInput[];
}

export interface ISlotSuggestion {
  timeSlotId: string;
  timeSlot: ITimeSlot;
  classroomId: string;
  classroom: IClassroom;
  score: number;
  reason: string;
}

export interface ISuggestionResponse {
  valid: boolean;
  conflicts: ISchedulerViolation[];
  suggestions: ISlotSuggestion[];
}

// ==========================================
// AI & NLP TYPES
// ==========================================

export type AIParsedRuleType =
  | 'TEACHER_UNAVAILABLE'
  | 'TEACHER_PREFERRED_SLOT'
  | 'TEACHER_MAX_CLASSES'
  | 'SUBJECT_SPREAD'
  | 'ROOM_PREFERENCE'
  | 'CONSECUTIVE_CLASSES'
  | 'AVOID_TIME_RANGE';

export interface IAIParsedPreference {
  type: AIParsedRuleType;
  targetId?: string;
  targetName?: string;
  targetType?: 'TEACHER' | 'SUBJECT' | 'CLASSROOM' | 'SEMESTER';
  day?: DayOfWeek;
  startTime?: string;
  endTime?: string;
  weight?: number;
  description: string;
  rawText: string;
}

export interface IAIPreferenceExtractResponse {
  preferences: IAIParsedPreference[];
  summary: string;
  warnings?: string[];
}

export interface IAIConflictExplanationResponse {
  summary: string;
  rootCause: string;
  recommendedActions: string[];
  alternativeOptions?: string[];
}

export interface IAITimetableSummaryResponse {
  overview: string;
  keyMetrics: {
    totalClasses: number;
    teacherWorkloadBalance: string;
    roomUtilizationRate: string;
    peakDays: string[];
  };
  recommendations: string[];
}

// ==========================================
// API & COMMON UTILITIES
// ==========================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  meta?: PaginationMeta;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  errorCode: string;
  details?: Record<string, unknown> | Array<unknown>;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface QueryParams {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  departmentId?: string;
  teacherId?: string;
  subjectId?: string;
  semesterId?: string;
  classroomId?: string;
  day?: string;
  action?: string;
  entity?: string;
  userId?: string;
  role?: string;
  status?: string;
  type?: string;
  academicYear?: string;
  isLab?: boolean;
  isBreak?: boolean;
  isActive?: boolean;
  isAvailable?: boolean;
  [key: string]: unknown;
}
