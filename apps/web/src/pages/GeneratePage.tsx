import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '../api/client.js';
import { useToast } from '../contexts/ToastContext.js';
import { IDepartment, ISemester, IHardConstraints, ISoftConstraints, IAIParsedPreference } from '@schedulai/shared-types';
import { DEFAULT_HARD_CONSTRAINTS, DEFAULT_SOFT_CONSTRAINTS } from '@schedulai/config';
import { Card } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { Input } from '../components/ui/Input.js';
import { Select } from '../components/ui/Select.js';
import { Badge } from '../components/ui/Badge.js';
import { AIPreferenceModal } from '../components/ui/AIPreferenceModal.js';
import {
  Sparkles,
  Sliders,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  Zap,
} from 'lucide-react';

export const GeneratePage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();

  const [name, setName] = useState(`Fall 2026 Master Timetable (Run ${Math.floor(Math.random() * 900 + 100)})`);
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [selectedSemesterIds, setSelectedSemesterIds] = useState<string[]>([]);
  const [academicYear, setAcademicYear] = useState('2026-2027');
  const [timeLimitSeconds, setTimeLimitSeconds] = useState(60);

  const [hardConstraints, setHardConstraints] = useState<IHardConstraints>(DEFAULT_HARD_CONSTRAINTS);
  const [softConstraints, setSoftConstraints] = useState<ISoftConstraints>(DEFAULT_SOFT_CONSTRAINTS);

  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [activeStep, setActiveStep] = useState<'IDLE' | 'PREPARING' | 'SOLVING' | 'COMPLETED' | 'FAILED'>('IDLE');
  const [generationResult, setGenerationResult] = useState<{
    generationId: string;
    score: number;
    resultCount: number;
    violations: Array<{ message: string }>;
  } | null>(null);

  // Fetch Departments
  const { data: departments = [] } = useQuery<IDepartment[]>({
    queryKey: ['departments-select'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: IDepartment[] }>('/departments?limit=100');
      return res.data.data;
    },
  });

  // Fetch Semesters
  const { data: semesters = [] } = useQuery<ISemester[]>({
    queryKey: ['semesters-select', selectedDeptId],
    queryFn: async () => {
      const url = selectedDeptId ? `/semesters?departmentId=${selectedDeptId}&limit=100` : '/semesters?limit=100';
      const res = await apiClient.get<{ success: boolean; data: ISemester[] }>(url);
      return res.data.data;
    },
  });

  // Select all semesters when loaded
  React.useEffect(() => {
    if (semesters.length > 0 && selectedSemesterIds.length === 0) {
      setSelectedSemesterIds(semesters.map((s) => s._id));
    }
  }, [semesters]);

  const generateMutation = useMutation({
    mutationFn: async () => {
      setActiveStep('PREPARING');
      await new Promise((r) => setTimeout(r, 400));
      setActiveStep('SOLVING');

      const res = await apiClient.post<{
        success: boolean;
        data: {
          generation: { _id: string; status: string };
          timetable: Array<unknown>;
          score: number;
          violations?: Array<{ message: string }>;
          errorMessage?: string;
        };
      }>('/generations/generate', {
        name,
        departmentId: selectedDeptId || undefined,
        academicYear,
        semesterIds: selectedSemesterIds,
        hardConstraints,
        softConstraints,
        timeLimitSeconds,
      });

      return res.data.data;
    },
    onSuccess: (data) => {
      if (data.generation.status === 'COMPLETED') {
        setActiveStep('COMPLETED');
        setGenerationResult({
          generationId: data.generation._id,
          score: data.score,
          resultCount: data.timetable.length,
          violations: data.violations || [],
        });
        toast.success(`Successfully generated schedule with ${data.timetable.length} periods!`);
      } else {
        setActiveStep('FAILED');
        setGenerationResult({
          generationId: data.generation._id,
          score: 0,
          resultCount: 0,
          violations: data.violations || [],
        });
        toast.error(data.errorMessage || 'Generation failed to satisfy constraints.');
      }
    },
    onError: (err) => {
      setActiveStep('FAILED');
      toast.error((err as Error).message, 'Solver Failure');
    },
  });

  const toggleSemester = (id: string) => {
    setSelectedSemesterIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleApplyAIPrefs = (prefs: IAIParsedPreference[]) => {
    // Modify soft constraint weights dynamically from AI preferences
    const updated = { ...softConstraints };
    for (const p of prefs) {
      if (p.type === 'AVOID_TIME_RANGE' && p.startTime === '09:00') {
        updated.avoidEarlyMorning = Math.min(10, (updated.avoidEarlyMorning || 5) + 3);
      }
      if (p.type === 'AVOID_TIME_RANGE' && p.day === 'FRIDAY') {
        updated.avoidFridayAfternoon = Math.min(10, (updated.avoidFridayAfternoon || 4) + 4);
      }
      if (p.type === 'SUBJECT_SPREAD') {
        updated.spreadSubjects = Math.min(10, (updated.spreadSubjects || 7) + 2);
      }
      if (p.type === 'CONSECUTIVE_CLASSES') {
        updated.preferConsecutiveClasses = Math.min(10, (updated.preferConsecutiveClasses || 4) + 3);
      }
    }
    setSoftConstraints(updated);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
            <Sparkles className="w-7 h-7 text-teal-400" />
            AI Timetable Generator
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Configure constraint parameters and generate mathematically optimized schedules using Google OR-Tools.
          </p>
        </div>

        <Button
          variant="outline"
          onClick={() => setAiModalOpen(true)}
          leftIcon={<Sparkles className="w-4 h-4 text-teal-400" />}
        >
          AI Natural Language Assistant
        </Button>
      </div>

      {/* Main Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Primary Setup & Semester Picker */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card 1: Basic Generation Parameters */}
          <Card className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 pb-2 border-b border-slate-800">
              1. Basic Parameters
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Input
                  label="Schedule Run Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <Select
                label="Department Scope"
                value={selectedDeptId}
                onChange={(e) => setSelectedDeptId(e.target.value)}
                options={departments.map((d) => ({ value: d._id, label: `${d.name} (${d.code})` }))}
                placeholder="All Departments"
              />

              <Input
                label="Academic Year"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                required
              />
            </div>
          </Card>

          {/* Card 2: Semesters to Schedule */}
          <Card className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                2. Select Semesters & Batches ({selectedSemesterIds.length} selected)
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedSemesterIds(semesters.map((s) => s._id))}
                  className="text-xs text-teal-400 hover:underline"
                >
                  Select All
                </button>
                <span className="text-slate-600">•</span>
                <button
                  type="button"
                  onClick={() => setSelectedSemesterIds([])}
                  className="text-xs text-slate-400 hover:underline"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-56 overflow-y-auto pr-1">
              {semesters.map((sem) => {
                const isSelected = selectedSemesterIds.includes(sem._id);
                return (
                  <div
                    key={sem._id}
                    onClick={() => toggleSemester(sem._id)}
                    className={`p-3 rounded-xl border cursor-pointer select-none transition flex items-center justify-between ${
                      isSelected
                        ? 'bg-teal-500/10 border-teal-500/40 text-teal-200'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:bg-slate-800/40'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-xs text-slate-200">{sem.name}</div>
                      <div className="text-[11px] text-slate-400">
                        Section {sem.section} • {sem.studentCount} Students
                      </div>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center border transition ${
                        isSelected
                          ? 'bg-teal-500 border-teal-500 text-slate-950 font-bold'
                          : 'border-slate-700'
                      }`}
                    >
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-slate-950" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Card 3: Soft Optimization Weights */}
          <Card className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <Sliders className="w-4 h-4 text-teal-400" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                3. Soft Constraint Weights (0 = Ignore, 10 = High Priority)
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
              <div className="space-y-1.5">
                <div className="flex justify-between text-slate-300 font-medium">
                  <span>Avoid Early Morning (Period 1)</span>
                  <span className="text-teal-400 font-mono">{softConstraints.avoidEarlyMorning}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={10}
                  value={softConstraints.avoidEarlyMorning}
                  onChange={(e) =>
                    setSoftConstraints({ ...softConstraints, avoidEarlyMorning: Number(e.target.value) })
                  }
                  className="w-full accent-teal-500 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-slate-300 font-medium">
                  <span>Avoid Friday Afternoon</span>
                  <span className="text-teal-400 font-mono">{softConstraints.avoidFridayAfternoon}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={10}
                  value={softConstraints.avoidFridayAfternoon}
                  onChange={(e) =>
                    setSoftConstraints({ ...softConstraints, avoidFridayAfternoon: Number(e.target.value) })
                  }
                  className="w-full accent-teal-500 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-slate-300 font-medium">
                  <span>Spread Subjects Across Days</span>
                  <span className="text-teal-400 font-mono">{softConstraints.spreadSubjects}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={10}
                  value={softConstraints.spreadSubjects}
                  onChange={(e) =>
                    setSoftConstraints({ ...softConstraints, spreadSubjects: Number(e.target.value) })
                  }
                  className="w-full accent-teal-500 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-slate-300 font-medium">
                  <span>Balance Teacher Workload</span>
                  <span className="text-teal-400 font-mono">{softConstraints.balanceTeacherWorkload}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={10}
                  value={softConstraints.balanceTeacherWorkload}
                  onChange={(e) =>
                    setSoftConstraints({ ...softConstraints, balanceTeacherWorkload: Number(e.target.value) })
                  }
                  className="w-full accent-teal-500 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Right 1 Column: Hard Constraints & Generator Trigger */}
        <div className="space-y-6">
          <Card className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                Hard Constraints
              </h3>
            </div>

            <div className="space-y-2.5 text-xs text-slate-300">
              {[
                { key: 'enforceTeacherConflicts', label: 'Zero Teacher Double-Bookings' },
                { key: 'enforceClassroomConflicts', label: 'Zero Classroom Collisions' },
                { key: 'enforceSemesterConflicts', label: 'Zero Semester Class Clashes' },
                { key: 'enforceTeacherAvailability', label: 'Teacher Day/Slot Availability' },
                { key: 'enforceClassroomCapacity', label: 'Room Capacity >= Student Strength' },
                { key: 'enforceLabCompatibility', label: 'Lab Subjects in Laboratory Rooms' },
                { key: 'enforceWeeklyPeriodRequirements', label: 'Exact Weekly Period Quota' },
                { key: 'enforceTeacherWorkloadLimits', label: 'Daily & Weekly Workload Limits' },
              ].map((c) => (
                <label
                  key={c.key}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-800/40 cursor-pointer"
                >
                  <span>{c.label}</span>
                  <input
                    type="checkbox"
                    checked={hardConstraints[c.key as keyof IHardConstraints]}
                    onChange={(e) =>
                      setHardConstraints({
                        ...hardConstraints,
                        [c.key]: e.target.checked,
                      })
                    }
                    className="w-4 h-4 accent-teal-500 rounded cursor-pointer"
                  />
                </label>
              ))}
            </div>
          </Card>

          {/* Launcher Card */}
          <Card className="space-y-4 bg-gradient-to-b from-slate-900 to-teal-950/30 border-teal-500/30">
            <div className="space-y-1">
              <h3 className="font-bold text-slate-100">Ready to Solve</h3>
              <p className="text-xs text-slate-400">
                OR-Tools CP-SAT will execute parallel branch-and-bound search.
              </p>
            </div>

            {activeStep !== 'IDLE' && (
              <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/70 space-y-2 text-xs">
                <div className="flex items-center justify-between font-medium">
                  <span className="text-slate-300">
                    {activeStep === 'PREPARING'
                      ? 'Aggregating constraints...'
                      : activeStep === 'SOLVING'
                      ? 'Solving with OR-Tools...'
                      : activeStep === 'COMPLETED'
                      ? 'Optimal Schedule Found!'
                      : 'Solver Infeasible'}
                  </span>
                  {activeStep === 'COMPLETED' && (
                    <Badge variant="emerald">Score: {generationResult?.score.toFixed(0)}</Badge>
                  )}
                </div>

                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      activeStep === 'PREPARING'
                        ? 'w-1/3 bg-amber-400'
                        : activeStep === 'SOLVING'
                        ? 'w-3/4 bg-teal-400 animate-pulse'
                        : activeStep === 'COMPLETED'
                        ? 'w-full bg-emerald-400'
                        : 'w-full bg-rose-500'
                    }`}
                  />
                </div>
              </div>
            )}

            {activeStep === 'COMPLETED' && generationResult && (
              <Button
                variant="teal"
                size="lg"
                className="w-full"
                onClick={() => navigate(`/timetable?generationId=${generationResult.generationId}`)}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                View Generated Timetable
              </Button>
            )}

            {activeStep === 'FAILED' && (
              <div className="space-y-2 text-xs text-rose-300">
                <div className="font-semibold">Violations Detected:</div>
                <ul className="list-disc list-inside space-y-1">
                  {generationResult?.violations.map((v, idx) => (
                    <li key={idx}>{v.message}</li>
                  ))}
                </ul>
              </div>
            )}

            {activeStep !== 'COMPLETED' && (
              <Button
                variant="teal"
                size="lg"
                className="w-full"
                isLoading={generateMutation.isPending}
                disabled={selectedSemesterIds.length === 0}
                onClick={() => generateMutation.mutate()}
                leftIcon={<Zap className="w-4 h-4" />}
              >
                Run AI Optimization
              </Button>
            )}
          </Card>
        </div>
      </div>

      {/* AI Preference Modal */}
      <AIPreferenceModal
        isOpen={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        onApplyPreferences={handleApplyAIPrefs}
      />
    </div>
  );
};
