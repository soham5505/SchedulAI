import { describe, it, expect } from 'vitest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';
import { importService } from '../src/modules/imports/import.service.js';
import { aiService } from '../src/modules/ai/ai.service.js';
import { GenerationService } from '../src/modules/generations/generation.service.js';
import * as XLSX from 'xlsx';

describe('Core Backend Services & AI', () => {
  it('Password hashing and verification with bcrypt works', async () => {
    const password = 'SecretPassword@123';
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    expect(await bcrypt.compare(password, hash)).toBe(true);
    expect(await bcrypt.compare('WrongPassword', hash)).toBe(false);
  });

  it('JWT token signing and verification works', () => {
    const payload = { userId: '123456789012345678901234', role: 'ADMIN', email: 'admin@test.com' };
    const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: '1h' });
    const decoded = jwt.verify(token, env.JWT_SECRET) as typeof payload;
    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.role).toBe(payload.role);
    expect(decoded.email).toBe(payload.email);
  });

  it('Excel buffer parser extracts columns and sample data', () => {
    const data = [
      { 'Teacher Name': 'Dr. Alan Turing', Email: 'alan@test.com', 'Employee ID': 'FAC001', Designation: 'Professor' },
      { 'Teacher Name': 'Dr. Grace Hopper', Email: 'grace@test.com', 'Employee ID': 'FAC002', Designation: 'Professor' },
    ];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Teachers');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const parsed = importService.parseUploadedBuffer(buffer, 'teachers.xlsx');
    expect(parsed.totalRows).toBe(2);
    expect(parsed.headers).toContain('Teacher Name');
    expect(parsed.suggestedMapping).toHaveProperty('name', 'Teacher Name');
    expect(parsed.suggestedMapping).toHaveProperty('email', 'Email');
  });

  it('AI Preference parser converts natural language into structured preferences', async () => {
    const prompt = 'Do not schedule Dr. Sharma in morning hours before 10 AM';
    const result = await aiService.extractPreferences(prompt);
    expect(result.preferences.length).toBeGreaterThan(0);
    expect(result.preferences[0]).toHaveProperty('type');
    expect(result.preferences[0]).toHaveProperty('startTime');
  });

  it('AI Conflict explainer generates root causes and actionable remedies', async () => {
    const conflict = {
      type: 'TEACHER_CONFLICT',
      message: 'Dr. Alan Turing is double booked',
      teacherName: 'Dr. Alan Turing',
      timeSlot: 'Monday 09:00 - 10:00',
    };
    const explanation = await aiService.explainConflict(conflict);
    expect(explanation.summary).toContain('Dr. Alan Turing');
    expect(explanation.recommendedActions.length).toBeGreaterThan(0);
  });

  it('rejects assignments with a missing teacher reference using a clear API error', () => {
    const service = new GenerationService();
    const assignments = [{
      _id: 'a1',
      teacherId: null,
      subjectId: { _id: 'sub-1', name: 'Algorithms' },
      semesterId: 'sem-1',
      batchId: null,
      classroomId: null,
      classroomRequirements: [],
      periodsPerWeek: 2,
      isLab: false,
    }];

    expect(() => (service as any).validateAssignmentReferences(assignments, new Set(['sem-1']))).toThrowError(
      'Generation blocked: Assignment a1 references a missing teacher.'
    );
  });

  it('rejects assignments with a missing subject reference using a clear API error', () => {
    const service = new GenerationService();
    const assignments = [{
      _id: 'a2',
      teacherId: { _id: 'teacher-2', name: 'Dr. Hopper' },
      subjectId: null,
      semesterId: 'sem-1',
      batchId: null,
      classroomId: null,
      classroomRequirements: [],
      periodsPerWeek: 3,
      isLab: false,
    }];

    expect(() => (service as any).validateAssignmentReferences(assignments, new Set(['sem-1']))).toThrowError(
      'Generation blocked: Assignment a2 references a missing subject.'
    );
  });

  it('rejects assignments with a missing semester reference using a clear API error', () => {
    const service = new GenerationService();
    const assignments = [{
      _id: 'a3',
      teacherId: { _id: 'teacher-3', name: 'Dr. Turing' },
      subjectId: { _id: 'sub-3', name: 'Databases' },
      semesterId: 'missing-sem',
      batchId: null,
      classroomId: null,
      classroomRequirements: [],
      periodsPerWeek: 4,
      isLab: false,
    }];

    expect(() => (service as any).validateAssignmentReferences(assignments, new Set(['sem-1']))).toThrowError(
      'Generation blocked: Assignment a3 references a missing semester.'
    );
  });

  it('keeps whole-class batchId null assignments valid and accepts valid batch assignments', () => {
    const service = new GenerationService();
    const assignments = [
      {
        _id: 'a4',
        teacherId: { _id: 'teacher-4', name: 'Dr. Ada' },
        subjectId: { _id: 'sub-4', name: 'OS' },
        semesterId: 'sem-1',
        batchId: null,
        classroomId: null,
        classroomRequirements: [],
        periodsPerWeek: 2,
        isLab: false,
      },
      {
        _id: 'a5',
        teacherId: { _id: 'teacher-5', name: 'Dr. Lin' },
        subjectId: { _id: 'sub-5', name: 'Networks' },
        semesterId: 'sem-1',
        batchId: 'batch-5',
        classroomId: null,
        classroomRequirements: [],
        periodsPerWeek: 3,
        isLab: false,
      },
    ];

    expect(() => (service as any).validateAssignmentReferences(assignments, new Set(['sem-1']), new Set(['batch-5']))).not.toThrow();
    const result = (service as any).sanitizeAssignmentsForScheduler(assignments);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ semesterId: 'sem-1' });
  });
});
