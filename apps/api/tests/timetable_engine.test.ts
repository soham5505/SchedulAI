import { describe, it, expect } from 'vitest';
import {
  CreateDepartmentSchema,
  CreateTeacherSchema,
  CreateSubjectSchema,
  CreateClassroomSchema,
  CreateSemesterSchema,
  TimetableMoveSchema,
} from '@schedulai/validation';

describe('Validation Schemas & Timetable Move Contracts', () => {
  it('validates a valid department payload', () => {
    const valid = {
      name: 'Computer Science and Engineering',
      code: 'CSE',
      description: 'Department of CSE',
    };
    const parsed = CreateDepartmentSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it('rejects invalid email in teacher schema', () => {
    const invalid = {
      name: 'Dr. John Doe',
      email: 'not-an-email',
      departmentId: '507f1f77bcf86cd799439011',
      designation: 'Professor',
      employeeId: 'FAC100',
    };
    const parsed = CreateTeacherSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });

  it('validates subject credit and period relations', () => {
    const valid = {
      name: 'Operating Systems',
      code: 'CS301',
      credits: 4,
      weeklyPeriods: 4,
      departmentId: '507f1f77bcf86cd799439011',
      isLab: false,
    };
    const parsed = CreateSubjectSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it('validates proposed move request schema', () => {
    const validMove = {
      entryId: '507f1f77bcf86cd799439011',
      targetTimeSlotId: '507f1f77bcf86cd799439012',
      targetClassroomId: '507f1f77bcf86cd799439013',
      generationId: '507f1f77bcf86cd799439014',
    };
    const parsed = TimetableMoveSchema.safeParse(validMove);
    expect(parsed.success).toBe(true);
  });
});
