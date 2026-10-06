import { describe, it, expect } from 'vitest';
import { exportService } from '../src/modules/exports/export.service.js';
import { importService } from '../src/modules/imports/import.service.js';
import * as XLSX from 'xlsx';

describe('Import & Export Service Integration', () => {
  it('parses Excel buffer and extracts columns and sample data', () => {
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

  it('parses CSV buffer with headers and suggested column mapping', () => {
    const csvContent = 'Building,Room Number,Capacity,Type\nEngineering Block,101,60,LECTURE\nScience Block,202,30,LAB';
    const buffer = Buffer.from(csvContent, 'utf-8');
    const parsed = importService.parseUploadedBuffer(buffer, 'classrooms.csv');

    expect(parsed.totalRows).toBe(2);
    expect(parsed.headers).toEqual(['Building', 'Room Number', 'Capacity', 'Type']);
    expect(parsed.suggestedMapping).toHaveProperty('building', 'Building');
    expect(parsed.suggestedMapping).toHaveProperty('capacity', 'Capacity');
  });

  it('does not map Department Code as the subject Code column', () => {
    const mapping = importService.suggestMappingForHeaders(['Department Code', 'Subject Code', 'Semester']);

    expect(mapping.departmentCode).toBe('Department Code');
    expect(mapping.code).toBe('Subject Code');
    expect(mapping.name).toBe('Semester');
  });

  it('generates a master template with disambiguating assignment semester identity', () => {
    const parsed = importService.parseUploadedBuffer(importService.generateMasterTemplate(), 'master.xlsx');
    const assignments = parsed.sheets?.Assignments;

    expect(parsed.isMasterWorkbook).toBe(true);
    expect(assignments?.headers).toContain('departmentCode');
    expect(assignments?.headers).toContain('academicYear');
    expect(assignments?.headers).toContain('number');
    expect(assignments?.headers).toContain('section');
    expect(assignments?.allRows[0]).toMatchObject({
      departmentCode: 'IT',
      academicYear: '2025-2026',
      number: 5,
      section: 'A',
    });
  });
});
