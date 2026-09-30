import { DayOfWeek, IHardConstraints, ISoftConstraints, RoomType, UserRole } from '@schedulai/shared-types';

export const USER_ROLES: Record<UserRole, UserRole> = {
  ADMIN: 'ADMIN',
  TEACHER: 'TEACHER',
  STAFF: 'STAFF',
  VIEWER: 'VIEWER',
};

export const ROOM_TYPES: Record<RoomType, RoomType> = {
  LECTURE: 'LECTURE',
  LAB: 'LAB',
  SEMINAR: 'SEMINAR',
  OTHER: 'OTHER',
};

export const DAYS_OF_WEEK: DayOfWeek[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
];

export const DEFAULT_HARD_CONSTRAINTS: IHardConstraints = {
  enforceTeacherConflicts: true,
  enforceClassroomConflicts: true,
  enforceSemesterConflicts: true,
  enforceTeacherAvailability: true,
  enforceClassroomCapacity: true,
  enforceLabCompatibility: true,
  enforceWeeklyPeriodRequirements: true,
  enforceTeacherWorkloadLimits: true,
};

export const DEFAULT_SOFT_CONSTRAINTS: ISoftConstraints = {
  avoidEarlyMorning: 5,
  avoidFridayAfternoon: 4,
  avoidTeacherGaps: 6,
  preferConsecutiveClasses: 4,
  balanceTeacherWorkload: 7,
  balanceStudentWorkload: 6,
  avoidUnnecessaryClassroomChanges: 5,
  preferTeacherPreferredPeriods: 7,
  preferPreferredClassrooms: 4,
  avoidExcessiveConsecutiveClasses: 6,
  spreadSubjects: 7,
};

export const STANDARD_PERIOD_TIMES: Array<{ period: number; startTime: string; endTime: string; isBreak?: boolean; label?: string }> = [
  { period: 1, startTime: '09:15', endTime: '10:15', label: 'Period 1' },
  { period: 2, startTime: '10:15', endTime: '11:15', label: 'Period 2' },
  { period: 3, startTime: '11:15', endTime: '11:30', isBreak: true, label: 'SHORT BREAK' },
  { period: 4, startTime: '11:30', endTime: '12:30', label: 'Period 3' },
  { period: 5, startTime: '12:30', endTime: '13:30', label: 'Period 4' },
  { period: 6, startTime: '13:30', endTime: '14:15', isBreak: true, label: 'LUNCH BREAK' },
  { period: 7, startTime: '14:15', endTime: '15:15', label: 'Period 5' },
  { period: 8, startTime: '15:15', endTime: '16:15', label: 'Period 6' },
  { period: 9, startTime: '16:15', endTime: '17:15', label: 'Period 7' },
];

export const ERROR_CODES = {
  // Authentication & Authorization
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  INACTIVE_USER: 'INACTIVE_USER',

  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  CONFLICT: 'CONFLICT',

  // Modules
  DEPARTMENT_NOT_FOUND: 'DEPARTMENT_NOT_FOUND',
  DEPARTMENT_ALREADY_EXISTS: 'DEPARTMENT_ALREADY_EXISTS',
  TEACHER_NOT_FOUND: 'TEACHER_NOT_FOUND',
  TEACHER_ALREADY_EXISTS: 'TEACHER_ALREADY_EXISTS',
  SUBJECT_NOT_FOUND: 'SUBJECT_NOT_FOUND',
  CLASSROOM_NOT_FOUND: 'CLASSROOM_NOT_FOUND',
  SEMESTER_NOT_FOUND: 'SEMESTER_NOT_FOUND',
  TIMESLOT_NOT_FOUND: 'TIMESLOT_NOT_FOUND',
  ASSIGNMENT_NOT_FOUND: 'ASSIGNMENT_NOT_FOUND',
  GENERATION_NOT_FOUND: 'GENERATION_NOT_FOUND',
  TIMETABLE_NOT_FOUND: 'TIMETABLE_NOT_FOUND',
  RESERVATION_NOT_FOUND: 'RESERVATION_NOT_FOUND',
  RESERVATION_OVERLAP: 'RESERVATION_OVERLAP',

  // Conflicts & Scheduling
  TEACHER_CONFLICT: 'TEACHER_CONFLICT',
  CLASSROOM_CONFLICT: 'CLASSROOM_CONFLICT',
  SEMESTER_CONFLICT: 'SEMESTER_CONFLICT',
  SCHEDULER_INFEASIBLE: 'SCHEDULER_INFEASIBLE',
  SCHEDULER_UNAVAILABLE: 'SCHEDULER_UNAVAILABLE',
  SCHEDULER_TIMEOUT: 'SCHEDULER_TIMEOUT',

  // Import / Export
  INVALID_IMPORT: 'INVALID_IMPORT',
  IMPORT_VALIDATION_FAILED: 'IMPORT_VALIDATION_FAILED',
  IMPORT_JOB_NOT_FOUND: 'IMPORT_JOB_NOT_FOUND',
  EXPORT_FAILED: 'EXPORT_FAILED',

  // General
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
