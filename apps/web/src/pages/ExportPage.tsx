import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client.js';
import { IGeneration, ISemester, ITeacher, IClassroom } from '@schedulai/shared-types';
import { Card } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { Select } from '../components/ui/Select.js';
import { Download, Printer, FileSpreadsheet, FileText, CheckCircle2 } from 'lucide-react';

export const ExportPage: React.FC = () => {
  const [selectedGenId, setSelectedGenId] = useState<string>('');
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>('');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [selectedClassroomId, setSelectedClassroomId] = useState<string>('');

  const { data: generations = [] } = useQuery<IGeneration[]>({
    queryKey: ['generations-list'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: IGeneration[] }>('/generations?limit=50');
      return res.data.data;
    },
  });

  React.useEffect(() => {
    if (!selectedGenId && generations.length > 0) {
      setSelectedGenId(generations[0]._id);
    }
  }, [generations, selectedGenId]);

  const { data: semesters = [] } = useQuery<ISemester[]>({
    queryKey: ['semesters-filter'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: ISemester[] }>('/semesters?limit=100');
      return res.data.data;
    },
  });

  const { data: teachers = [] } = useQuery<ITeacher[]>({
    queryKey: ['teachers-filter'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: ITeacher[] }>('/teachers?limit=100');
      return res.data.data;
    },
  });

  const { data: classrooms = [] } = useQuery<IClassroom[]>({
    queryKey: ['classrooms-filter'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: IClassroom[] }>('/classrooms?limit=100');
      return res.data.data;
    },
  });

  const buildExportUrl = (format: 'excel' | 'csv' | 'printable') => {
    const params = new URLSearchParams();
    if (selectedGenId) params.append('generationId', selectedGenId);
    if (selectedSemesterId) params.append('semesterId', selectedSemesterId);
    if (selectedTeacherId) params.append('teacherId', selectedTeacherId);
    if (selectedClassroomId) params.append('classroomId', selectedClassroomId);

    return `/api/v1/export/${format}?${params.toString()}`;
  };

  const handleExport = (format: 'excel' | 'csv') => {
    window.open(buildExportUrl(format), '_blank');
  };

  const handlePrint = () => {
    window.open(`/timetable?generationId=${selectedGenId}&semesterId=${selectedSemesterId}&teacherId=${selectedTeacherId}&classroomId=${selectedClassroomId}`, '_blank');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Export & Print Timetables</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Generate official Excel (.xlsx), CSV, and PDF-ready printable timetables for students and faculty
        </p>
      </div>

      <Card className="space-y-6">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 pb-2 border-b border-slate-800">
          1. Scope & Filter Selection
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Target Schedule Run"
            value={selectedGenId}
            onChange={(e) => setSelectedGenId(e.target.value)}
            options={generations.map((g) => ({
              value: g._id,
              label: `${g.name} (v${g.version || 1}) - Score: ${g.score?.toFixed(0) || 0}`,
            }))}
            placeholder="Select a generation run"
          />

          <Select
            label="Filter by Semester Cohort"
            value={selectedSemesterId}
            onChange={(e) => setSelectedSemesterId(e.target.value)}
            options={semesters.map((s) => ({ value: s._id, label: `${s.name} (${s.section})` }))}
            placeholder="Entire Institution / All Semesters"
          />

          <Select
            label="Filter by Faculty Member"
            value={selectedTeacherId}
            onChange={(e) => setSelectedTeacherId(e.target.value)}
            options={teachers.map((t) => ({ value: t._id, label: `${t.name} (${t.designation})` }))}
            placeholder="All Faculty"
          />

          <Select
            label="Filter by Classroom"
            value={selectedClassroomId}
            onChange={(e) => setSelectedClassroomId(e.target.value)}
            options={classrooms.map((c) => ({ value: c._id, label: `${c.building} - ${c.roomNumber}` }))}
            placeholder="All Classrooms"
          />
        </div>
      </Card>

      {/* Export Format Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Card className="p-6 space-y-4 hover:border-emerald-500/50 transition flex flex-col justify-between">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base">Excel Spreadsheet</h3>
            <p className="text-xs text-slate-400">
              Multi-tab workbook containing schedule list + visual 2D matrix grid (Time slots vs Days).
            </p>
          </div>

          <Button
            variant="teal"
            size="md"
            className="w-full bg-emerald-600 hover:bg-emerald-500 border-emerald-500/40"
            disabled={!selectedGenId}
            onClick={() => handleExport('excel')}
            leftIcon={<Download className="w-4 h-4" />}
          >
            Download .XLSX
          </Button>
        </Card>

        <Card className="p-6 space-y-4 hover:border-sky-500/50 transition flex flex-col justify-between">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base">Standard CSV</h3>
            <p className="text-xs text-slate-400">
              Raw comma-separated table for integration with external student portals and ERPs.
            </p>
          </div>

          <Button
            variant="secondary"
            size="md"
            className="w-full"
            disabled={!selectedGenId}
            onClick={() => handleExport('csv')}
            leftIcon={<Download className="w-4 h-4" />}
          >
            Download .CSV
          </Button>
        </Card>

        <Card className="p-6 space-y-4 hover:border-purple-500/50 transition flex flex-col justify-between">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center">
              <Printer className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base">Print / PDF Layout</h3>
            <p className="text-xs text-slate-400">
              Formatted clean academic timetable document suitable for notice boards and printouts.
            </p>
          </div>

          <Button
            variant="outline"
            size="md"
            className="w-full"
            disabled={!selectedGenId}
            onClick={handlePrint}
            leftIcon={<Printer className="w-4 h-4" />}
          >
            Open Print View
          </Button>
        </Card>
      </div>
    </div>
  );
};
