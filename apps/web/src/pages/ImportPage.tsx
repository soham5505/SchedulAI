import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client.js';
import { useToast } from '../contexts/ToastContext.js';
import { ImportType, IImportJob, IDepartment, PaginationMeta } from '@schedulai/shared-types';
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
  ChevronDown,
  Download,
  Check,
  Layers,
  Sparkles,
  BookOpen,
} from 'lucide-react';

function ImportJobDetails({ job }: { job: IImportJob }) {
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading, isError, error } = useQuery<IImportJob>({
    queryKey: ['import-job', job._id],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: IImportJob }>(`/import/jobs/${job._id}`);
      return response.data.data;
    },
    enabled: expanded,
    retry: false,
  });

  return (
    <div className="max-w-[min(80vw,56rem)] whitespace-normal">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-300 hover:text-teal-200"
      >
        <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        {expanded ? 'Hide details' : 'View details'}
      </button>
      {expanded && (
        <section className="mt-3 w-[min(80vw,56rem)] space-y-3 rounded border border-slate-700 bg-slate-950 p-3 text-xs text-slate-300">
          {isLoading && <p role="status">Loading import details...</p>}
          {isError && <p role="alert" className="text-rose-300">Could not load this import: {(error as Error).message}</p>}
          {data && (
            <>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                <div><dt className="text-slate-500">Job ID</dt><dd className="break-all font-mono">{data._id}</dd></div>
                <div><dt className="text-slate-500">Status</dt><dd>{data.status}</dd></div>
                <div><dt className="text-slate-500">Started</dt><dd>{data.startedAt ? new Date(data.startedAt).toLocaleString() : 'Not recorded'}</dd></div>
                <div><dt className="text-slate-500">Completed</dt><dd>{data.completedAt ? new Date(data.completedAt).toLocaleString() : 'Not completed'}</dd></div>
                <div><dt className="text-slate-500">Worksheets</dt><dd>{data.totalSheets ?? 1}</dd></div>
                <div><dt className="text-slate-500">Rows found</dt><dd>{data.totalRows}</dd></div>
                <div><dt className="text-slate-500">Processed</dt><dd>{data.processedRows}</dd></div>
                <div><dt className="text-slate-500">Imported</dt><dd className="text-emerald-300">{data.successRows}</dd></div>
                <div><dt className="text-slate-500">Failed / skipped</dt><dd className="text-rose-300">{data.errorRows} / {data.skippedRows ?? 0}</dd></div>
              </dl>
              {data.warnings?.length > 0 && (
                <div className="space-y-1" role="status">
                  <h4 className="font-semibold text-amber-300">Warnings</h4>
                  {data.warnings.map((warning, index) => <p key={`${index}-${warning}`}>{warning}</p>)}
                </div>
              )}
              {data.worksheetResults?.length > 0 && (
                <div className="space-y-1">
                  <h4 className="font-semibold text-slate-200">Worksheet results</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[38rem] text-left">
                      <thead className="text-slate-500"><tr><th className="pr-3">Worksheet</th><th className="pr-3">Entity</th><th className="pr-3">Found</th><th className="pr-3">Imported</th><th className="pr-3">Skipped</th><th>Failed</th></tr></thead>
                      <tbody>{data.worksheetResults.map((sheet) => (
                        <tr key={sheet.sheetName} className="border-t border-slate-800">
                          <td className="py-1 pr-3">{sheet.sheetName}</td><td className="pr-3">{sheet.entityType || 'Unrecognized'}</td><td className="pr-3">{sheet.foundRows}</td><td className="pr-3">{sheet.importedRows}</td><td className="pr-3">{sheet.skippedRows}</td><td>{sheet.failedRows}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </div>
              )}
              <div className="space-y-1">
                <h4 className="font-semibold text-slate-200">Row errors</h4>
                {data.rowErrors?.length ? data.rowErrors.map((rowError, index) => (
                  <details key={`${rowError.sheetName}-${rowError.row}-${index}`} className="border-t border-slate-800 py-1">
                    <summary className="cursor-pointer text-rose-300">
                      {rowError.sheetName ? `${rowError.sheetName} / ` : ''}Row {rowError.row} · {rowError.entityType || data.type} · {rowError.field}
                    </summary>
                    <p className="mt-1 pl-4 text-slate-300">{rowError.message}</p>
                  </details>
                )) : <p className="text-emerald-300">No row-level errors recorded.</p>}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}

export const ImportPage: React.FC = () => {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [importType, setImportType] = useState<ImportType>('MASTER');
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
    sheets?: Record<string, {
      headers: string[];
      totalRows: number;
      sampleRows: Record<string, unknown>[];
      allRows: Record<string, unknown>[];
    }>;
    masterSheetsDetected?: {
      teachers?: string;
      subjects?: string;
      classrooms?: string;
      semesters?: string;
      batches?: string;
      assignments?: string;
      timeslots?: string;
    };
    isMasterWorkbook?: boolean;
  } | null>(null);

  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'IMPORT' | 'HISTORY'>('IMPORT');
  const [jobPage, setJobPage] = useState(1);

  const { data: departments = [] } = useQuery<IDepartment[]>({
    queryKey: ['departments-select'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: IDepartment[] }>('/departments?limit=100');
      return res.data.data;
    },
  });

  const { data: importJobPage, isLoading: jobsLoading, isError: jobsError, error: jobsErrorDetails } = useQuery<{
    jobs: IImportJob[];
    meta?: PaginationMeta;
  }>({
    queryKey: ['import-jobs', jobPage],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: IImportJob[]; meta?: PaginationMeta }>(`/import/jobs?page=${jobPage}&limit=20`);
      return { jobs: res.data.data, meta: res.data.meta };
    },
    enabled: activeTab === 'HISTORY',
  });

  const handleDownloadMasterTemplate = async () => {
    try {
      const res = await apiClient.get('/import/template/master', {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'Master_Academic_Data_Template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Master Excel template downloaded successfully');
    } catch {
      toast.error('Failed to download master template');
    }
  };

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
          sheets?: Record<string, {
            headers: string[];
            totalRows: number;
            sampleRows: Record<string, unknown>[];
            allRows: Record<string, unknown>[];
          }>;
          masterSheetsDetected?: {
            teachers?: string;
            subjects?: string;
            classrooms?: string;
            semesters?: string;
            assignments?: string;
            timeslots?: string;
            batches?: string;
          };
          isMasterWorkbook?: boolean;
        };
      }>('/import/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      return res.data.data;
    },
    onSuccess: (data) => {
      setParseResult(data);
      setColumnMapping(data.suggestedMapping || {});
      if (data.isMasterWorkbook || (data.sheetNames && data.sheetNames.length > 1 && data.masterSheetsDetected?.teachers)) {
        setImportType('MASTER');
      }
      toast.success(
        `Parsed ${data.sheetNames && data.sheetNames.length > 1 ? `${data.sheetNames.length} sheets` : `${data.totalRows} rows`} from ${data.fileName}`
      );
    },
    onError: (err) => {
      toast.error((err as Error).message, 'Upload Failed');
    },
  });

  // Execute Import Mutation
  const executeMutation = useMutation({
    mutationFn: async () => {
      if (!parseResult) return;
      if (importType === 'MASTER') {
        const sheetsData: Record<string, Record<string, unknown>[]> = {};
        if (parseResult.sheets) {
          for (const [sName, sData] of Object.entries(parseResult.sheets)) {
            sheetsData[sName] = sData.allRows;
          }
        }
        const res = await apiClient.post<{ success: boolean; data: IImportJob }>('/import/execute', {
          type: 'MASTER',
          sheetsData,
          data: parseResult.allRows,
          fileName: parseResult.fileName,
          departmentId: selectedDeptId || undefined,
        });
        return res.data.data;
      }

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
        if (job.status === 'FAILED') {
          const firstErr = (job as any).rowErrors?.[0];
          const hint = firstErr ? ` First error: ${firstErr.message}` : '';
          toast.warning(
            `All ${job.errorRows} rows failed — check your column mappings and that referenced Teachers, Subjects, and Semesters exist.${hint}`,
            'Import Failed'
          );
        } else if (job.status === 'PARTIAL') {
          toast.error(
            `Import partially completed: ${job.successRows} rows imported, ${job.errorRows} failed, ${job.skippedRows} skipped. Review Import History for details.`,
            'Partial Import'
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
    BATCHES: [
      { key: 'semesterId', label: 'Semester ID (optional)' },
      { key: 'name', label: 'Semester Name' },
      { key: 'departmentCode', label: 'Department Code (optional)' },
      { key: 'academicYear', label: 'Academic Year (optional)' },
      { key: 'number', label: 'Semester Number (optional)' },
      { key: 'section', label: 'Section (optional)' },
      { key: 'batchCode', label: 'Batch Code' },
      { key: 'studentCount', label: 'Student Count' },
    ],
    ASSIGNMENTS: [
      { key: 'employeeId', label: 'Teacher Employee ID' },
      { key: 'email', label: 'Teacher Email (alternative)' },
      { key: 'code', label: 'Subject Code' },
      { key: 'name', label: 'Semester Name (if not using ID)' },
      { key: 'semesterId', label: 'Semester ID (name alternative)' },
      { key: 'departmentCode', label: 'Department Code (for name lookup)' },
      { key: 'academicYear', label: 'Academic Year (for name lookup)' },
      { key: 'number', label: 'Semester Number (for name lookup)' },
      { key: 'section', label: 'Section (for name lookup)' },
      { key: 'batchCode', label: 'Batch Code (blank for theory, B1-B4 for labs)' },
      { key: 'weeklyPeriods', label: 'Weekly Periods' },
      { key: 'location', label: 'Fixed Room (optional)' },
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
    MASTER: [],
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
      header: 'Processed / Imported / Failed / Skipped',
      render: (job) => (
        <div className="text-xs font-mono">
          {job.processedRows} / <span className="text-emerald-400 font-bold">{job.successRows}</span> /{' '}
          <span className="text-rose-400 font-bold">{job.errorRows}</span> / {job.skippedRows ?? 0} ({job.totalRows} total)
        </div>
      ),
    },
    {
      key: 'details',
      header: 'Details',
      render: (job) => <ImportJobDetails job={job} />,
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
        <>
          {jobsError && <div role="alert" className="rounded border border-rose-500/40 bg-rose-950/20 p-3 text-sm text-rose-200">Could not load import history: {(jobsErrorDetails as Error).message}</div>}
          <DataTable
            columns={historyColumns}
            data={importJobPage?.jobs ?? []}
            meta={importJobPage?.meta}
            onPageChange={setJobPage}
            isLoading={jobsLoading}
            emptyMessage="No import jobs are available yet."
          />
        </>
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
                  { value: 'MASTER', label: '⭐ Master Workbook (All-in-One .xlsx)' },
                  { value: 'TEACHERS', label: 'Faculty & Teachers' },
                  { value: 'SUBJECTS', label: 'Courses & Subjects' },
                  { value: 'CLASSROOMS', label: 'Classrooms & Labs' },
                  { value: 'SEMESTERS', label: 'Semesters & Student Batches' },
                  { value: 'BATCHES', label: 'Student Batches' },
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

            {/* Master Template Download Callout Banner */}
            <div className="rounded-xl border border-teal-500/30 bg-teal-950/20 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-teal-300 font-semibold text-sm">
                  <Sparkles className="w-4 h-4 text-teal-400" />
                  <span>One-Click Master Excel Template</span>
                </div>
                <p className="text-xs text-slate-400 max-w-xl">
                  Download our official multi-sheet Excel template (<code className="text-teal-300">Master_Academic_Data_Template.xlsx</code>). Contains all 6 sheets pre-formatted with sample data and exact column headers for 100% automated import without manual column mapping.
                </p>
              </div>
              <Button
                type="button"
                variant="teal"
                size="sm"
                onClick={handleDownloadMasterTemplate}
                leftIcon={<Download className="w-4 h-4" />}
                className="shrink-0"
              >
                Download Master Template (.xlsx)
              </Button>
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
                <p className="text-xs text-slate-500 mt-1">Up to 15MB file size supported with automatic multi-sheet detection</p>
              </div>

              {file && (
                <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-3 py-1.5 rounded-lg">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
                </div>
              )}
            </div>
          </Card>

          {/* Step 2: Confirmation / Column Mapping & Live Preview */}
          {parseResult && (
            <Card className="space-y-6 border-teal-500/30 animate-in fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                    {importType === 'MASTER' ? (
                      <span className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-teal-400" />
                        Step 2: Master Workbook Overview ({parseResult.sheetNames.length} Sheets Detected)
                      </span>
                    ) : (
                      `Step 2: Map Columns & Confirm (${parseResult.totalRows} rows ready)`
                    )}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {importType === 'MASTER'
                      ? 'All sheets will be imported in topological order to satisfy relational dependencies automatically'
                      : 'Match your spreadsheet headers to the system database fields'}
                  </p>
                </div>
                <Badge variant="teal">{parseResult.fileName}</Badge>
              </div>

              {importType === 'MASTER' ? (
                /* Master Workbook Flow */
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[
                      { key: 'teachers', name: 'Teachers', icon: '👨‍🏫', desc: 'Faculty profiles & IDs' },
                      { key: 'subjects', name: 'Subjects', icon: '📚', desc: 'Courses, credits, & lab flags' },
                      { key: 'classrooms', name: 'Classrooms', icon: '🏛️', desc: 'Rooms, labs & capacities' },
                      { key: 'semesters', name: 'Semesters', icon: '🎓', desc: 'Batches, sections & student count' },
                      { key: 'batches', name: 'Batches', icon: '👥', desc: 'Explicit batch rosters and strengths' },
                      { key: 'assignments', name: 'Assignments', icon: '🔗', desc: 'Teacher ↔ Subject ↔ Room' },
                      { key: 'timeslots', name: 'TimeSlots', icon: '⏰', desc: 'Periods, breaks, & hours' },
                    ].map((entity) => {
                      const detectedSheetName = parseResult.masterSheetsDetected?.[entity.key as keyof typeof parseResult.masterSheetsDetected];
                      const sheetInfo = detectedSheetName && parseResult.sheets ? parseResult.sheets[detectedSheetName] : null;

                      return (
                        <div
                          key={entity.key}
                          className={`p-3.5 rounded-xl border transition-all ${
                            detectedSheetName
                              ? 'border-emerald-500/40 bg-emerald-950/20'
                              : 'border-slate-800 bg-slate-900/40 opacity-70'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-base">{entity.icon}</span>
                            {detectedSheetName ? (
                              <Badge variant="emerald" size="sm">
                                {sheetInfo?.totalRows ?? 0} Rows
                              </Badge>
                            ) : (
                              <Badge variant="amber" size="sm">
                                Optional / Missing
                              </Badge>
                            )}
                          </div>
                          <div className="mt-2 font-semibold text-xs text-slate-200">{entity.name}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">{entity.desc}</div>
                          {detectedSheetName && (
                            <div className="mt-2 text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/20 truncate">
                              Sheet: &quot;{detectedSheetName}&quot;
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-300 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-slate-100">Relational Resolution: </span>
                      Teacher IDs, subject codes, and room numbers link across sheets. Assignment rows must include a MongoDB Semester ID or the complete semester identity; semester numbers belong in the Number column, and lab rows must identify B1-B4.
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
                      Execute Master Import (All Sheets)
                    </Button>
                  </div>
                </div>
              ) : (
                /* Single Sheet Column Mapping Flow */
                <>
                  {parseResult.sheetNames.length > 1 && (
                    <div role="alert" className="rounded border border-amber-500/40 bg-amber-950/20 p-3 text-xs text-amber-200">
                      This workbook has {parseResult.sheetNames.length} worksheets. Single-entity imports only process one worksheet. Select Master Workbook to process all named entity sheets, or upload a single-sheet file.
                    </div>
                  )}
                  {importType === 'ASSIGNMENTS' && (
                    <div className="rounded border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-100">
                      Resolve each semester with its MongoDB Semester ID, or provide Semester Name, Department Code, Academic Year, Semester Number, and Section. Put values like 3 in Semester Number, not Semester ID. Lab rows need batch code B1-B4; leave it blank for theory.
                    </div>
                  )}
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
                      disabled={parseResult.sheetNames.length > 1}
                      onClick={() => executeMutation.mutate()}
                      leftIcon={<Check className="w-4 h-4" />}
                    >
                      Execute Import ({parseResult.totalRows} rows)
                    </Button>
                  </div>
                </>
              )}
            </Card>
          )}

          {/* Reference Column Guide */}
          <Card className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <BookOpen className="w-4 h-4 text-teal-400" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                Required Columns Reference (Auto-Matched)
              </h3>
            </div>
            <p className="text-xs text-slate-400">
              When naming columns in your Excel sheets, use these exact header names (case-insensitive) so the system maps them 100% automatically without any manual adjustments:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200">1. Sheet: Teachers</span>
                  <Badge variant="teal" size="sm">5 cols</Badge>
                </div>
                <ul className="text-xs space-y-1 text-slate-400">
                  <li><code className="text-teal-300">name</code>: Full Name</li>
                  <li><code className="text-teal-300">email</code>: Email Address</li>
                  <li><code className="text-teal-300">employeeId</code>: ID / Code (e.g. T-101)</li>
                  <li><code className="text-teal-300">designation</code>: Professor / AP</li>
                  <li><code className="text-slate-500">departmentCode</code> (optional)</li>
                </ul>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200">2. Sheet: Subjects</span>
                  <Badge variant="teal" size="sm">6 cols</Badge>
                </div>
                <ul className="text-xs space-y-1 text-slate-400">
                  <li><code className="text-teal-300">code</code>: Subject Code (e.g. CS501)</li>
                  <li><code className="text-teal-300">name</code>: Subject Name</li>
                  <li><code className="text-teal-300">isLab</code>: true or false</li>
                  <li><code className="text-teal-300">weeklyPeriods</code>: 3 or 4 (lab: 2)</li>
                  <li><code className="text-teal-300">credits</code>: Credits (e.g. 3 or 4)</li>
                  <li><code className="text-slate-500">departmentCode</code> (optional)</li>
                </ul>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200">3. Sheet: Classrooms</span>
                  <Badge variant="teal" size="sm">5 cols</Badge>
                </div>
                <ul className="text-xs space-y-1 text-slate-400">
                  <li><code className="text-teal-300">roomNumber</code>: Room No (e.g. 301, LAB-01)</li>
                  <li><code className="text-teal-300">name</code>: Room Name</li>
                  <li><code className="text-teal-300">type</code>: LECTURE, LAB, or SEMINAR</li>
                  <li><code className="text-teal-300">capacity</code>: Seat capacity (e.g. 60)</li>
                  <li><code className="text-slate-500">building</code> (optional)</li>
                </ul>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200">4. Sheet: Semesters</span>
                  <Badge variant="teal" size="sm">6 cols</Badge>
                </div>
                <ul className="text-xs space-y-1 text-slate-400">
                  <li><code className="text-teal-300">name</code>: Semester Name (e.g. SEM 5)</li>
                  <li><code className="text-teal-300">number</code>: Number (e.g. 5)</li>
                  <li><code className="text-teal-300">section</code>: Section (e.g. A)</li>
                  <li><code className="text-teal-300">studentCount</code>: Count (e.g. 60)</li>
                  <li><code className="text-slate-500">academicYear</code> (optional)</li>
                  <li><code className="text-slate-500">departmentCode</code> (optional)</li>
                </ul>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200">5. Sheet: Assignments</span>
                  <Badge variant="teal" size="sm">12 cols</Badge>
                </div>
                <ul className="text-xs space-y-1 text-slate-400">
                  <li><code className="text-teal-300">employeeId</code>: Teacher ID</li>
                  <li><code className="text-teal-300">code</code>: Subject Code</li>
                  <li><code className="text-teal-300">semesterId</code>: Stable semester ID (alternative)</li>
                  <li><code className="text-teal-300">name</code>, <code className="text-teal-300">departmentCode</code></li>
                  <li><code className="text-teal-300">academicYear</code>, <code className="text-teal-300">number</code>, <code className="text-teal-300">section</code>: Required together for name lookup</li>
                  <li><code className="text-teal-300">batchCode</code>: Blank for theory; B1-B4 for labs</li>
                  <li><code className="text-teal-300">weeklyPeriods</code>: Number of periods</li>
                  <li><code className="text-slate-500">location</code>: Preferred room (optional)</li>
                </ul>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200">6. Sheet: TimeSlots</span>
                  <Badge variant="teal" size="sm">6 cols</Badge>
                </div>
                <ul className="text-xs space-y-1 text-slate-400">
                  <li><code className="text-teal-300">day</code>: MONDAY, TUESDAY, etc.</li>
                  <li><code className="text-teal-300">periodNumber</code>: 1, 2, 3, etc.</li>
                  <li><code className="text-teal-300">startTime</code>: e.g. 09:00</li>
                  <li><code className="text-teal-300">endTime</code>: e.g. 10:00</li>
                  <li><code className="text-slate-500">isBreak</code>: true or false</li>
                  <li><code className="text-slate-500">label</code>: e.g. Lunch (optional)</li>
                </ul>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
