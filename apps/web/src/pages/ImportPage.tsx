import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client.js';
import { useToast } from '../contexts/ToastContext.js';
import { ImportType, IImportJob, IImportError, IDepartment } from '@schedulai/shared-types';
import { Card } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { Select } from '../components/ui/Select.js';
import { Badge } from '../components/ui/Badge.js';
import { DataTable, Column } from '../components/ui/DataTable.js';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Download,
  Check,
} from 'lucide-react';

export const ImportPage: React.FC = () => {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [importType, setImportType] = useState<ImportType>('TEACHERS');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);

  const [parseResult, setParseResult] = useState<{
    fileName: string;
    sheetNames: string[];
    headers: string[];
    totalRows: number;
    sampleRows: Record<string, unknown>[];
    suggestedMapping: Record<string, string>;
    allRows: Record<string, unknown>[];
  } | null>(null);

  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'IMPORT' | 'HISTORY'>('IMPORT');

  const { data: departments = [] } = useQuery<IDepartment[]>({
    queryKey: ['departments-select'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: IDepartment[] }>('/departments?limit=100');
      return res.data.data;
    },
  });

  const { data: importJobs = [], isLoading: jobsLoading } = useQuery<IImportJob[]>({
    queryKey: ['import-jobs'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: IImportJob[] }>('/import/jobs?limit=20');
      return res.data.data;
    },
    enabled: activeTab === 'HISTORY',
  });

  // Upload Mutation
  const uploadMutation = useMutation({
    mutationFn: async (uploadFile: File) => {
      const formData = new FormData();
      formData.append('file', uploadFile);

      const res = await apiClient.post<{
        success: boolean;
        data: {
          fileName: string;
          sheetNames: string[];
          headers: string[];
          totalRows: number;
          sampleRows: Record<string, unknown>[];
          suggestedMapping: Record<string, string>;
          allRows: Record<string, unknown>[];
        };
      }>('/import/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      return res.data.data;
    },
    onSuccess: (data) => {
      setParseResult(data);
      setColumnMapping(data.suggestedMapping || {});
      toast.success(`Parsed ${data.totalRows} rows from ${data.fileName}`);
    },
    onError: (err) => {
      toast.error((err as Error).message, 'Upload Failed');
    },
  });

  // Execute Import Mutation
  const executeMutation = useMutation({
    mutationFn: async () => {
      if (!parseResult) return;
      const res = await apiClient.post<{ success: boolean; data: IImportJob }>('/import/execute', {
        type: importType,
        columnMapping,
        data: parseResult.allRows,
        fileName: parseResult.fileName,
        departmentId: selectedDeptId || undefined,
      });
      return res.data.data;
    },
    onSuccess: (job) => {
      if (job) {
        if (job.successRows === 0 && job.errorRows > 0) {
          // All rows failed — show actionable error
          const firstErr = (job as any).rowErrors?.[0];
          const hint = firstErr ? ` First error: ${firstErr.message}` : '';
          toast.error(
            `All ${job.errorRows} rows failed — check your column mappings and that referenced Teachers, Subjects, and Semesters exist.${hint}`,
            'Import Failed'
          );
        } else {
          toast.success(
            `Import complete! ${job.successRows} rows inserted${job.errorRows > 0 ? `, ${job.errorRows} rows had errors (see Import History for details)` : ''
            }.`
          );
        }
        setParseResult(null);
        setFile(null);
        setActiveTab('HISTORY');
        queryClient.invalidateQueries({ queryKey: ['import-jobs'] });
      }
    },
    onError: (err) => {
      toast.error((err as Error).message, 'Import Error');
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setFile(f);
      uploadMutation.mutate(f);
    }
  };

  const requiredFieldsByType: Record<ImportType, Array<{ key: string; label: string }>> = {
    TEACHERS: [
      { key: 'name', label: 'Faculty Name' },
      { key: 'email', label: 'Email' },
      { key: 'employeeId', label: 'Employee ID' },
      { key: 'designation', label: 'Designation' },
      { key: 'departmentCode', label: 'Department Code' },
    ],
    SUBJECTS: [
      { key: 'name', label: 'Subject Name' },
      { key: 'code', label: 'Subject Code' },
      { key: 'credits', label: 'Credits' },
      { key: 'weeklyPeriods', label: 'Weekly Periods' },
      { key: 'isLab', label: 'Is Lab (true/false)' },
      { key: 'departmentCode', label: 'Department Code' },
    ],
    CLASSROOMS: [
      { key: 'name', label: 'Room Name' },
      { key: 'building', label: 'Building' },
      { key: 'roomNumber', label: 'Room Number' },
      { key: 'capacity', label: 'Capacity' },
      { key: 'type', label: 'Room Type (LECTURE/LAB/SEMINAR)' },
    ],
    SEMESTERS: [
      { key: 'name', label: 'Semester Name' },
      { key: 'number', label: 'Semester Number' },
      { key: 'section', label: 'Section' },
      { key: 'studentCount', label: 'Student Count' },
      { key: 'academicYear', label: 'Academic Year' },
      { key: 'departmentCode', label: 'Department Code' },
    ],
    ASSIGNMENTS: [
      { key: 'employeeId', label: 'Teacher Employee ID' },
      { key: 'code', label: 'Subject Code' },
      { key: 'name', label: 'Semester Name' },
      { key: 'weeklyPeriods', label: 'Weekly Periods' },
    ],
    TIMESLOTS: [
      { key: 'day', label: 'Day of Week' },
      { key: 'startTime', label: 'Start Time' },
      { key: 'endTime', label: 'End Time' },
      { key: 'periodNumber', label: 'Period Number' },
    ],
    TIMETABLE: [
      { key: 'day', label: 'Day' },
      { key: 'startTime', label: 'Start' },
      { key: 'endTime', label: 'End' },
    ],
  };

  const historyColumns: Column<IImportJob>[] = [
    {
      key: 'fileName',
      header: 'File Name / Type',
      render: (job) => (
        <div>
          <div className="font-semibold text-slate-100">{job.fileName}</div>
          <Badge variant="teal" size="sm">{job.type}</Badge>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (job) => (
        <Badge variant={job.status === 'COMPLETED' ? 'emerald' : job.status === 'FAILED' ? 'rose' : 'amber'}>
          {job.status}
        </Badge>
      ),
    },
    {
      key: 'counts',
      header: 'Processed / Success / Errors',
      render: (job) => (
        <div className="text-xs font-mono">
          <span className="text-emerald-400 font-bold">{job.successRows} success</span> /{' '}
          <span className="text-rose-400 font-bold">{job.errorRows} errors</span> ({job.totalRows} total)
        </div>
      ),
    },
    {
      key: 'createdAt',
      header: 'Date',
      render: (job) => <span className="text-xs text-slate-400">{new Date(job.createdAt).toLocaleString()}</span>,
    },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Data Import System</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Bulk import teachers, courses, classrooms, semesters, and assignments from Excel (.xlsx) or CSV
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={activeTab === 'IMPORT' ? 'teal' : 'secondary'}
            size="sm"
            onClick={() => setActiveTab('IMPORT')}
          >
            Import File
          </Button>
          <Button
            variant={activeTab === 'HISTORY' ? 'teal' : 'secondary'}
            size="sm"
            onClick={() => setActiveTab('HISTORY')}
          >
            Import History
          </Button>
        </div>
      </div>

      {activeTab === 'HISTORY' ? (
        <DataTable columns={historyColumns} data={importJobs} isLoading={jobsLoading} />
      ) : (
        <div className="space-y-6">
          {/* Step 1: Configuration & File Dropzone */}
          <Card className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 pb-2 border-b border-slate-800">
              Step 1: Select Target Entity & Upload Spreadsheet
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Import Entity Type"
                value={importType}
                onChange={(e) => setImportType(e.target.value as ImportType)}
                options={[
                  { value: 'TEACHERS', label: 'Faculty & Teachers' },
                  { value: 'SUBJECTS', label: 'Courses & Subjects' },
                  { value: 'CLASSROOMS', label: 'Classrooms & Labs' },
                  { value: 'SEMESTERS', label: 'Semesters & Student Batches' },
                  { value: 'ASSIGNMENTS', label: 'Teaching Assignments' },
                  { value: 'TIMESLOTS', label: 'Time Slots' },
                ]}
              />

              <Select
                label="Default Department (Optional)"
                value={selectedDeptId}
                onChange={(e) => setSelectedDeptId(e.target.value)}
                options={departments.map((d) => ({ value: d._id, label: `${d.name} (${d.code})` }))}
                placeholder="Auto-match from file column"
              />
            </div>

            {/* Dropzone */}
            <div className="mt-4 border-2 border-dashed border-slate-700 hover:border-teal-500/60 rounded-2xl p-8 text-center bg-slate-950/40 transition flex flex-col items-center justify-center gap-3">
              <FileSpreadsheet className="w-12 h-12 text-teal-400" />
              <div>
                <label className="cursor-pointer text-sm font-semibold text-teal-400 hover:text-teal-300 underline">
                  <span>Choose an Excel (.xlsx / .xls) or CSV file</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
                <p className="text-xs text-slate-500 mt-1">Up to 15MB file size supported with automatic header detection</p>
              </div>

              {file && (
                <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-3 py-1.5 rounded-lg">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
                </div>
              )}
            </div>
          </Card>

          {/* Step 2: Column Mapping & Live Preview */}
          {parseResult && (
            <Card className="space-y-6 border-teal-500/30 animate-in fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                    Step 2: Map Columns & Confirm ({parseResult.totalRows} rows ready)
                  </h3>
                  <p className="text-xs text-slate-400">Match your spreadsheet headers to the system database fields</p>
                </div>
                <Badge variant="teal">{parseResult.fileName}</Badge>
              </div>

              {/* Column Mapping Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {requiredFieldsByType[importType].map((field) => (
                  <div key={field.key} className="space-y-1.5 p-3 rounded-xl border border-slate-800 bg-slate-950/60">
                    <label className="block text-xs font-semibold text-slate-300">
                      {field.label}
                    </label>
                    <select
                      value={columnMapping[field.key] || ''}
                      onChange={(e) => setColumnMapping({ ...columnMapping, [field.key]: e.target.value })}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 focus:border-teal-500 focus:outline-none"
                    >
                      <option value="">-- Select Matching Column --</option>
                      {parseResult.headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {/* Sample Data Preview Table */}
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Sample Data Preview (First 5 Rows)
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/80 overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                      <tr>
                        {parseResult.headers.map((h) => (
                          <th key={h} className="p-2.5 font-semibold">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300">
                      {parseResult.sampleRows.map((row, rIdx) => (
                        <tr key={rIdx}>
                          {parseResult.headers.map((h) => (
                            <td key={h} className="p-2.5 whitespace-nowrap">
                              {String(row[h] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Import Action */}
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <Button variant="secondary" onClick={() => setParseResult(null)}>
                  Cancel
                </Button>
                <Button
                  variant="teal"
                  size="lg"
                  isLoading={executeMutation.isPending}
                  onClick={() => executeMutation.mutate()}
                  leftIcon={<Check className="w-4 h-4" />}
                >
                  Execute Import ({parseResult.totalRows} rows)
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};
