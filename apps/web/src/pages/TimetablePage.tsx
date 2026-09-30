import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  DragEndEvent,
  DragStartEvent,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core';
import { apiClient } from '../api/client.js';
import { useToast } from '../contexts/ToastContext.js';
import {
  ITimetableEntry,
  ITimeSlot,
  ISemester,
  ITeacher,
  IClassroom,
  IGeneration,
  IBatch,
  DayOfWeek,
  ISchedulerViolation,
  ISlotSuggestion,
  IAITimetableSummaryResponse,
  IDepartment,
  IRoomReservation,
} from '@schedulai/shared-types';
import { DAYS_OF_WEEK, STANDARD_PERIOD_TIMES } from '@schedulai/config';
import {
  Download,
  Printer,
  Sparkles,
  RefreshCw,
  Clock,
  MapPin,
  User,
  GraduationCap,
  Layers,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { Card } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { Select } from '../components/ui/Select.js';
import { Badge } from '../components/ui/Badge.js';
import { ConflictModal } from '../components/ui/ConflictModal.js';
import { shouldMergeLabSlots } from '../utils/timetableLayout.js';
import { formatTimeRange12Hour } from '../utils/timeFormat.js';

const displaySemesterName = (name: string) => name.replace(/\s*-\s*B1$/i, '');

// Draggable Timetable Card Component
interface TimetableCardProps {
  entry: ITimetableEntry;
  isDragging?: boolean;
  isTwoPeriodBlock?: boolean;
}

const TimetableCard: React.FC<TimetableCardProps> = ({ entry, isDragging = false, isTwoPeriodBlock = false }) => {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: entry._id,
    data: { entry },
    disabled: isTwoPeriodBlock,
  });

  const style = transform
    ? {
      transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      zIndex: 50,
    }
    : undefined;

  const subject = entry.subjectId as unknown as { name?: string; code?: string; isLab?: boolean };
  const teacher = entry.teacherId as unknown as { name?: string; employeeId?: string };
  const classroom = entry.classroomId as unknown as { name?: string; building?: string; roomNumber?: string };
  const semester = entry.semesterId as unknown as { name?: string; section?: string };
  const batch = entry.batchId as unknown as { code?: string } | null | undefined;

  // Determine entry type from periodType field (canonical) with subject.isLab as fallback.
  // This is fully data-driven — no hard-coded subject/teacher names.
  const isLab = entry.periodType === 'LAB' || Boolean(subject?.isLab);
  const isTheory = !isLab;
  const hasSharedLabSession = Boolean(entry.assignmentId) && isLab;

  // Batch label: labs show batch code (B1/B2/...); theory always shows 'ALL STUDENTS'.
  const batchLabel = isTheory
    ? 'ALL STUDENTS'
    : (batch?.code ?? 'ALL');

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`p-3 rounded-xl border text-xs select-none cursor-grab active:cursor-grabbing transition-all duration-150 shadow-md ${
        isDragging
          ? 'opacity-50 ring-2 ring-teal-400 bg-teal-950/80 border-teal-500 scale-105'
          : isLab
            ? 'bg-purple-950/40 hover:bg-purple-900/50 border-purple-500/30 text-purple-100 hover:border-purple-400'
            : 'bg-slate-950/80 hover:bg-slate-800/80 border-slate-700/80 text-slate-100 hover:border-teal-500/50'
      }`}
    >
      {/* Subject name + type badge row */}
      <div className="flex items-start justify-between gap-1 mb-1.5">
        <span className="font-bold text-slate-100 truncate">{subject?.name || 'Subject'}</span>
        {isLab ? (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0">
            {isTwoPeriodBlock ? '2-PERIOD LAB' : hasSharedLabSession ? 'LAB SESSION' : 'LAB'}
          </span>
        ) : (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30 shrink-0">
            THEORY
          </span>
        )}
      </div>

      <div className="space-y-1 text-[11px] text-slate-300">
        {/* Batch / scope row */}
        <div className="flex items-center gap-1.5 truncate">
          <Layers className="w-3 h-3 text-indigo-400 shrink-0" />
          <span
            className={`truncate font-mono text-[10px] ${
              isTheory ? 'text-amber-300 font-semibold' : 'text-indigo-300'
            }`}
          >
            {batchLabel}
          </span>
        </div>

        <div className="flex items-center gap-1.5 truncate">
          <User className="w-3 h-3 text-teal-400 shrink-0" />
          <span className="truncate">{teacher?.name || 'Teacher'}</span>
        </div>

        <div className="flex items-center gap-1.5 truncate">
          <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
          <span className="truncate">
            {classroom?.building ? `${classroom.building} - ${classroom.roomNumber}` : 'Room'}
          </span>
        </div>

        {semester?.name && (
          <div className="flex items-center gap-1.5 truncate text-[10px] text-slate-400 pt-0.5 border-t border-slate-800/60">
            <GraduationCap className="w-3 h-3 text-sky-400 shrink-0" />
            <span className="truncate">{displaySemesterName(semester.name || '')}</span>
          </div>
        )}
      </div>
    </div>
  );
};

// Droppable Cell for Grid
interface DroppableCellProps {
  day: DayOfWeek;
  timeSlot: ITimeSlot;
  entries: ITimetableEntry[];
  reservations?: IRoomReservation[];
  isOver?: boolean;
  isTwoPeriodBlock?: boolean;
  selectedClassroomId?: string;
  getDeptName?: (deptId: string | IDepartment) => string;
  getRoomName?: (roomId: string | IClassroom) => string;
}

const DroppableCell: React.FC<DroppableCellProps> = ({
  day,
  timeSlot,
  entries,
  reservations = [],
  isTwoPeriodBlock = false,
  selectedClassroomId = '',
  getDeptName = (d) => String(d),
  getRoomName = (r) => String(r),
}) => {
  const isReserved = reservations.length > 0;
  const { setNodeRef, isOver } = useDroppable({
    id: `slot_${timeSlot._id}`,
    data: { timeSlot, day },
    disabled: isTwoPeriodBlock || Boolean(selectedClassroomId && isReserved),
  });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[100px] p-2 rounded-xl border transition-all duration-150 flex flex-col gap-2 ${
        isOver
          ? 'bg-teal-950/40 border-teal-400 ring-2 ring-teal-500/30'
          : selectedClassroomId && isReserved
            ? 'bg-purple-950/30 border-purple-700/60 ring-1 ring-purple-600/30'
            : entries.length > 0
              ? 'bg-slate-900/40 border-slate-800'
              : 'bg-slate-950/20 border-slate-800/50 hover:bg-slate-900/30'
      }`}
    >
      {/* If looking at a specific classroom and it's reserved */}
      {selectedClassroomId && reservations.map((res) => (
        <div
          key={res._id}
          className="rounded-lg border border-purple-500/50 bg-purple-950/80 p-2.5 shadow-md text-left relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-purple-500"></div>
          <div className="flex items-center gap-1.5 font-bold text-purple-300 text-xs uppercase tracking-wider">
            <Lock className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span>CROSS-DEPT LAB RESERVED</span>
          </div>
          <div className="text-xs font-semibold text-slate-100 mt-1.5 flex items-center gap-1">
            <span className="text-purple-200">Reserved By:</span> {getDeptName(res.departmentId)}
          </div>
          <div className="text-[11px] text-purple-300 font-mono mt-0.5">
            Periods {res.startPeriod}–{res.endPeriod} ({formatTimeRange12Hour(timeSlot.startTime, timeSlot.endTime)})
          </div>
          {res.reason && (
            <div className="text-[10px] text-slate-400 mt-1 italic line-clamp-2">
              Note: {res.reason}
            </div>
          )}
        </div>
      ))}

      {/* Render actual entries */}
      {entries.map((entry) => (
        <TimetableCard key={entry._id} entry={entry} isTwoPeriodBlock={isTwoPeriodBlock} />
      ))}

      {/* If viewing whole semester/schedule and a shared lab is blocked in this period */}
      {!selectedClassroomId && reservations.length > 0 && (
        <div className="rounded-md border border-purple-800/50 bg-purple-950/40 px-2 py-1 text-[10px] text-purple-300 flex items-center gap-1.5 mt-auto">
          <Lock className="w-3 h-3 text-purple-400 shrink-0" />
          <span className="truncate">
            Blocked: {reservations.map((r) => `${getRoomName(r.classroomId)} (${getDeptName(r.departmentId)})`).join(', ')}
          </span>
        </div>
      )}

      {entries.length === 0 && (!selectedClassroomId || reservations.length === 0) && (
        <div className="flex-1 flex items-center justify-center text-[11px] text-slate-600 italic">
          Empty Slot
        </div>
      )}
    </div>
  );
};

export const TimetablePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [activeDragEntry, setActiveDragEntry] = useState<ITimetableEntry | null>(null);

  // Filter States
  const [selectedGenId, setSelectedGenId] = useState<string>(searchParams.get('generationId') || '');
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>('');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [selectedClassroomId, setSelectedClassroomId] = useState<string>('');
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const semesterGroupPrefix = '__semester_group__:';

  // Conflict & Suggestions Modal State
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [pendingMoveEntryId, setPendingMoveEntryId] = useState<string | null>(null);
  const [conflictsList, setConflictsList] = useState<ISchedulerViolation[]>([]);
  const [suggestionsList, setSuggestionsList] = useState<ISlotSuggestion[]>([]);

  // AI Summary Drawer
  const [aiSummaryOpen, setAiSummaryOpen] = useState(false);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [aiSummaryData, setAiSummaryData] = useState<IAITimetableSummaryResponse | null>(null);

  // Configure Pointer Sensor with distance threshold to allow clicking
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  // 1. Fetch Generations
  const { data: generations = [] } = useQuery<IGeneration[]>({
    queryKey: ['generations-list'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: IGeneration[] }>('/generations?limit=50');
      return res.data.data;
    },
  });

  // Auto select first generation if none selected
  React.useEffect(() => {
    if (!selectedGenId && generations.length > 0) {
      setSelectedGenId(generations[0]._id);
    }
  }, [generations, selectedGenId]);

  // 2. Fetch Semesters, Teachers, Classrooms, TimeSlots
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

  const { data: timeslots = [] } = useQuery<ITimeSlot[]>({
    queryKey: ['timeslots-grid'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: ITimeSlot[] }>('/timeslots?limit=100');
      return res.data.data;
    },
  });

  const { data: departments = [] } = useQuery<IDepartment[]>({
    queryKey: ['departments-filter'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: IDepartment[] }>('/departments?limit=100');
      return res.data.data;
    },
  });

  const { data: reservations = [] } = useQuery<IRoomReservation[]>({
    queryKey: ['room-reservations-active'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: IRoomReservation[] }>('/lab-reservations?limit=100');
      return (res.data.data || []).filter((r) => r.isActive);
    },
  });

  const getDeptName = (dept: string | IDepartment | unknown) => {
    if (typeof dept === 'object' && dept && 'name' in (dept as Record<string, unknown>)) {
      return String((dept as Record<string, unknown>).name);
    }
    const found = departments.find((d) => d._id === String(dept));
    return found ? found.name : String(dept || 'Other Department');
  };

  const getRoomName = (roomId: string | IClassroom | unknown) => {
    if (typeof roomId === 'object' && roomId && 'name' in (roomId as Record<string, unknown>)) {
      return String((roomId as Record<string, unknown>).name);
    }
    const found = classrooms.find((c) => c._id === String(roomId));
    return found ? found.name : String(roomId || 'Lab');
  };

  const semesterGroupOptions = useMemo(() => {
    const groups = new Map<string, string>();
    for (const semester of semesters) {
      const match = semester.name.match(/^(SEM\s+(?:3|5|7))\b/i);
      if (match) groups.set(match[1].toUpperCase(), match[1].toUpperCase());
    }
    return Array.from(groups.values()).sort().map((group) => ({
      value: `${semesterGroupPrefix}${group}`,
      label: `${group} - All Batches`,
    }));
  }, [semesters]);

  const selectedSemesterGroup = selectedSemesterId.startsWith(semesterGroupPrefix)
    ? selectedSemesterId.slice(semesterGroupPrefix.length)
    : '';

  // Fetch batches dynamically based on selected semester
  const { data: batchesForSemester = [] } = useQuery<IBatch[]>({
    queryKey: ['batches-filter', selectedSemesterId],
    queryFn: async () => {
      if (!selectedSemesterId || selectedSemesterGroup) return [];
      const res = await apiClient.get<{ success: boolean; data: IBatch[] }>(
        `/batches?semesterId=${selectedSemesterId}&limit=100`
      );
      return res.data.data;
    },
    enabled: !!selectedSemesterId && !selectedSemesterGroup,
  });

  // 3. Fetch Timetable Entries for current generation & filters
  const {
    data: entries = [],
    isLoading: entriesLoading,
    refetch: refetchEntries,
  } = useQuery<ITimetableEntry[]>({
    queryKey: ['timetable-entries', selectedGenId, selectedSemesterId, selectedTeacherId, selectedClassroomId],
    queryFn: async () => {
      if (!selectedGenId) return [];
      const params = new URLSearchParams({ generationId: selectedGenId });
      if (selectedSemesterId && !selectedSemesterGroup) params.append('semesterId', selectedSemesterId);
      if (selectedTeacherId) params.append('teacherId', selectedTeacherId);
      if (selectedClassroomId) params.append('classroomId', selectedClassroomId);

      const res = await apiClient.get<{ success: boolean; data: ITimetableEntry[] }>(`/timetables?${params.toString()}`);
      return res.data.data;
    },
    enabled: !!selectedGenId,
  });

  // Client-side batch filter: specific batch → show that batch + ALL (null batchId) entries;
  // no batch selected → show everything
  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      const semesterRef = e.semesterId as unknown as { _id?: string; name?: string };
      const semesterId = typeof e.semesterId === 'string' ? e.semesterId : semesterRef?._id;
      const semesterName = semesterRef?.name || semesters.find((semester) => semester._id === semesterId)?.name || '';
      if (selectedSemesterGroup && !semesterName.toUpperCase().startsWith(selectedSemesterGroup)) return false;

      if (!selectedBatchId) return true;
      const bid =
        typeof e.batchId === 'string'
          ? e.batchId
          : (e.batchId as unknown as { _id?: string })?._id ?? null;
      return bid === selectedBatchId || bid == null;
    });
  }, [entries, semesters, selectedBatchId, selectedSemesterGroup]);

  const selectedSemester = semesters.find((semester) => semester._id === selectedSemesterId);
  const selectedGeneration = generations.find((generation) => generation._id === selectedGenId);
  const printSemesterTitle = selectedSemester
    ? `${displaySemesterName(selectedSemester.name)}${selectedSemester.section ? ` (${selectedSemester.section})` : ''}`
    : selectedSemesterGroup || selectedGeneration?.name || 'All Semesters';
  const printAcademicYear = selectedSemester?.academicYear || selectedGeneration?.academicYear;

  // Mutation for moving an entry
  const moveMutation = useMutation({
    mutationFn: async (payload: {
      entryId: string;
      targetTimeSlotId: string;
      targetClassroomId?: string;
      generationId: string;
    }) => {
      const res = await apiClient.post<{
        success: boolean;
        valid: boolean;
        message: string;
        conflicts?: ISchedulerViolation[];
        suggestions?: ISlotSuggestion[];
        entry?: ITimetableEntry;
      }>('/timetables/move', payload);
      return res.data;
    },
    onSuccess: (data, variables) => {
      if (data.valid) {
        toast.success('Timetable entry relocated successfully!');
        queryClient.invalidateQueries({ queryKey: ['timetable-entries'] });
      } else {
        // Show Conflict Modal with diagnostics and suggestions
        setPendingMoveEntryId(variables.entryId);
        setConflictsList(data.conflicts || []);
        setSuggestionsList(data.suggestions || []);
        setConflictModalOpen(true);
      }
    },
    onError: (err) => {
      toast.error((err as Error).message, 'Move Error');
    },
  });

  // Handle Drag Start
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const entry = entries.find((e) => e._id === active.id);
    if (entry) {
      setActiveDragEntry(entry);
    }
  };

  // Handle Drag End
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragEntry(null);

    if (!over || !selectedGenId) return;

    const overIdStr = String(over.id);
    if (!overIdStr.startsWith('slot_')) return;

    const targetSlotId = overIdStr.replace('slot_', '');
    const entryId = String(active.id);

    const sourceEntry = entries.find((e) => e._id === entryId);
    if (!sourceEntry) return;

    // Check if target is the same timeslot
    const srcSlotId = typeof sourceEntry.timeSlotId === 'string' ? sourceEntry.timeSlotId : (sourceEntry.timeSlotId as unknown as { _id: string })._id;
    if (srcSlotId === targetSlotId) return;

    moveMutation.mutate({
      entryId,
      targetTimeSlotId: targetSlotId,
      generationId: selectedGenId,
    });
  };

  // Handle applying a suggested alternative slot from Conflict Modal
  const handleSelectAlternativeSuggestion = (suggestion: ISlotSuggestion) => {
    if (!pendingMoveEntryId || !selectedGenId) return;

    moveMutation.mutate({
      entryId: pendingMoveEntryId,
      targetTimeSlotId: suggestion.timeSlotId,
      targetClassroomId: suggestion.classroomId,
      generationId: selectedGenId,
    });
  };

  // Export handlers
  const handleExportExcel = () => {
    if (!selectedGenId) return;
    const params = new URLSearchParams({ generationId: selectedGenId });
    if (selectedSemesterId && !selectedSemesterGroup) params.append('semesterId', selectedSemesterId);
    if (selectedTeacherId) params.append('teacherId', selectedTeacherId);
    if (selectedClassroomId) params.append('classroomId', selectedClassroomId);

    window.open(`/api/v1/export/excel?${params.toString()}`, '_blank');
  };

  const handleExportCSV = () => {
    if (!selectedGenId) return;
    const params = new URLSearchParams({ generationId: selectedGenId });
    if (selectedSemesterId && !selectedSemesterGroup) params.append('semesterId', selectedSemesterId);
    if (selectedTeacherId) params.append('teacherId', selectedTeacherId);
    if (selectedClassroomId) params.append('classroomId', selectedClassroomId);

    window.open(`/api/v1/export/csv?${params.toString()}`, '_blank');
  };

  const handleFetchAiSummary = async () => {
    if (!selectedGenId) return;
    setAiSummaryLoading(true);
    setAiSummaryOpen(true);
    try {
      const res = await apiClient.post<{ success: boolean; data: IAITimetableSummaryResponse }>(
        '/ai/summarize-timetable',
        { generationId: selectedGenId }
      );
      if (res.data.data) {
        setAiSummaryData(res.data.data);
      }
    } catch (err) {
      toast.error((err as Error).message, 'AI Summary Error');
    } finally {
      setAiSummaryLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Filter & Action Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900/90 p-5 rounded-2xl border border-slate-800 shadow-xl no-print">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 flex-1">
          {/* Generation Version Selector */}
          <Select
            label="Schedule Version"
            value={selectedGenId}
            onChange={(e) => {
              setSelectedGenId(e.target.value);
              setSearchParams({ generationId: e.target.value });
            }}
            options={generations.map((g) => ({
              value: g._id,
              label: `${g.name} (v${g.version || 1}) - Score: ${g.score?.toFixed(0) || 0}`,
            }))}
            placeholder={generations.length === 0 ? 'No generations found' : undefined}
          />

          {/* Semester Filter */}
          <Select
            label="Filter Semester"
            value={selectedSemesterId}
            onChange={(e) => {
              setSelectedSemesterId(e.target.value);
              setSelectedBatchId(''); // clear batch when semester changes
            }}
            options={[
              ...semesterGroupOptions,
              ...semesters.map((s) => ({
                value: s._id,
                label: `${displaySemesterName(s.name)} (${s.section})`,
              })),
            ]}
            placeholder="All Semesters"
          />

          {/* Teacher Filter */}
          <Select
            label="Filter Faculty"
            value={selectedTeacherId}
            onChange={(e) => setSelectedTeacherId(e.target.value)}
            options={teachers.map((t) => ({
              value: t._id,
              label: `${t.name} (${t.designation})`,
            }))}
            placeholder="All Teachers"
          />

          {/* Classroom Filter */}
          <Select
            label="Filter Classroom"
            value={selectedClassroomId}
            onChange={(e) => setSelectedClassroomId(e.target.value)}
            options={classrooms.map((c) => ({
              value: c._id,
              label: `${c.building} - ${c.roomNumber} (${c.name})`,
            }))}
            placeholder="All Classrooms"
          />

          {/* Batch Filter — populated dynamically from selected semester */}
          <Select
            label="Filter Batch"
            value={selectedBatchId}
            onChange={(e) => setSelectedBatchId(e.target.value)}
            options={batchesForSemester.map((b) => ({
              value: b._id,
              label: b.code,
            }))}
            placeholder={selectedSemesterId ? 'All Batches' : 'Select Semester First'}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap justify-end pt-2 lg:pt-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleFetchAiSummary}
            leftIcon={<Sparkles className="w-3.5 h-3.5 text-teal-400" />}
          >
            AI Analysis
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportExcel}
            leftIcon={<Download className="w-3.5 h-3.5 text-emerald-400" />}
          >
            Excel
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportCSV}
            leftIcon={<Download className="w-3.5 h-3.5" />}
          >
            CSV
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            leftIcon={<Printer className="w-3.5 h-3.5" />}
          >
            Print
          </Button>
        </div>
      </div>

      {/* Printable Heading (Only visible when printing) */}
      <section className="hidden print-only official-timetable">
        <header className="official-timetable__header">
          <h1>Hope Foundation&apos;s Finolex Academy of Management and Technology, Ratnagiri</h1>
          <p>Department of Information Technology</p>
          <h2>
            Timetable ({printSemesterTitle}){printAcademicYear ? ` for AY ${printAcademicYear}` : ''}
          </h2>
        </header>

        <table className="official-timetable__grid">
          <thead>
            <tr>
              <th className="official-timetable__day">Day</th>
              {STANDARD_PERIOD_TIMES.map((periodSlot) => (
                <th
                  key={periodSlot.period}
                  className={periodSlot.isBreak ? 'official-timetable__break-column' : ''}
                >
                  <span>{formatTimeRange12Hour(periodSlot.startTime, periodSlot.endTime)}</span>
                  {periodSlot.isBreak && <span className="official-timetable__break-name">{periodSlot.label}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS_OF_WEEK.map((day, dayIndex) => {
              const mergedPeriods = new Set<number>();
              return (
              <tr key={day}>
                <th className="official-timetable__day">{day.slice(0, 3)}</th>
                {STANDARD_PERIOD_TIMES.map((periodSlot, periodIndex) => {
                  if (mergedPeriods.has(periodSlot.period)) return null;
                  if (periodSlot.isBreak) {
                    if (dayIndex > 0 && dayIndex < DAYS_OF_WEEK.length - 1) return null;
                    return (
                      <td
                        key={periodSlot.period}
                        rowSpan={dayIndex === 0 ? DAYS_OF_WEEK.length - 1 : undefined}
                        className="official-timetable__break-column"
                      >
                        {dayIndex === 0 && <span className="official-timetable__break-label">{periodSlot.label}</span>}
                      </td>
                    );
                  }

                  const exactSlot = timeslots.find(
                    (slot) => slot.day === day && slot.periodNumber === periodSlot.period && slot.isActive && !slot.isBreak
                  );
                  const cellEntries = filteredEntries.filter((entry) => {
                    const slotId = typeof entry.timeSlotId === 'string'
                      ? entry.timeSlotId
                      : (entry.timeSlotId as unknown as { _id: string })?._id;
                    return entry.day === day && (
                      slotId === exactSlot?._id ||
                      (entry.startTime === periodSlot.startTime && entry.endTime === periodSlot.endTime)
                    );
                  });
                  const nextPeriod = STANDARD_PERIOD_TIMES[periodIndex + 1];
                  const nextSlot = nextPeriod && !nextPeriod.isBreak
                    ? timeslots.find(
                      (slot) => slot.day === day && slot.periodNumber === nextPeriod.period && slot.isActive && !slot.isBreak
                    )
                    : undefined;
                  const nextEntries = nextPeriod && nextSlot
                    ? filteredEntries.filter((entry) => {
                      const slotId = typeof entry.timeSlotId === 'string'
                        ? entry.timeSlotId
                        : (entry.timeSlotId as unknown as { _id: string })?._id;
                      return entry.day === day && (
                        slotId === nextSlot._id ||
                        (entry.startTime === nextSlot.startTime && entry.endTime === nextSlot.endTime)
                      );
                    })
                    : [];
                  const mergeNextPeriod = Boolean(
                    exactSlot && nextPeriod && nextSlot &&
                    shouldMergeLabSlots(exactSlot, nextSlot, cellEntries, nextEntries)
                  );
                  if (mergeNextPeriod && nextPeriod) mergedPeriods.add(nextPeriod.period);

                  const slotReservations = reservations.filter((r) => {
                    if (r.dayOfWeek !== day) return false;
                    if (periodSlot.period < r.startPeriod || periodSlot.period > r.endPeriod) return false;
                    if (!selectedClassroomId) return true;
                    const rRoomId = typeof r.classroomId === 'string' ? r.classroomId : (r.classroomId as unknown as { _id?: string })?._id;
                    return rRoomId === selectedClassroomId;
                  });

                  return (
                    <td
                      key={periodSlot.period}
                      colSpan={mergeNextPeriod ? 2 : 1}
                      className="official-timetable__slot"
                    >
                      {selectedClassroomId && slotReservations.map((res) => (
                        <div key={res._id} className="official-timetable__entry" style={{ fontStyle: 'italic', color: '#6b21a8', fontWeight: 600 }}>
                          [RESERVED: {getDeptName(res.departmentId)}]
                        </div>
                      ))}
                      {cellEntries.map((entry) => {
                        const subject = entry.subjectId as unknown as { name?: string; isLab?: boolean };
                        const teacher = entry.teacherId as unknown as { name?: string };
                        const batch = entry.batchId as unknown as { code?: string } | null | undefined;
                        const isLab = entry.periodType === 'LAB' || Boolean(subject?.isLab);
                        const teacherInitials = teacher?.name
                          ?.split(/\s+/)
                          .map((part) => part[0])
                          .join('')
                          .slice(0, 3)
                          .toUpperCase();
                        return (
                          <div key={entry._id} className="official-timetable__entry">
                            {isLab && batch?.code ? `${batch.code} - ` : ''}
                            {subject?.name || 'Class'}{teacherInitials ? ` (${teacherInitials})` : ''}
                          </div>
                        );
                      })}
                    </td>
                  );
                })}
              </tr>
              );
            })}
          </tbody>
        </table>

        <footer className="official-timetable__signatures">
          <span>Prepared By: Timetable Committee</span>
          <span>Head of Department</span>
        </footer>
      </section>

      {/* Interactive DnD Matrix Grid */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="no-print rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1500px] border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/80">
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-400 w-36 border-r border-slate-800 text-center">
                    Day
                  </th>
                  {STANDARD_PERIOD_TIMES.map((periodSlot) => (
                    <th
                      key={periodSlot.period}
                      className={`p-3 text-center min-w-[145px] border-r border-slate-800 last:border-r-0 ${periodSlot.isBreak ? 'bg-amber-950/50 text-amber-200' : 'text-teal-300'}`}
                    >
                      <div className="text-xs font-bold uppercase">{periodSlot.label}</div>
                      <div className="mt-1 font-mono text-[11px] text-slate-300">
                        {formatTimeRange12Hour(periodSlot.startTime, periodSlot.endTime)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800">
                {DAYS_OF_WEEK.map((day) => {
                  const mergedPeriods = new Set<number>();
                  return (
                  <tr key={day}>
                    <th className="p-3 border-r border-slate-800 bg-slate-950/60 text-xs font-bold uppercase text-teal-200 text-center">
                      {day}
                    </th>
                    {STANDARD_PERIOD_TIMES.map((periodSlot, periodIndex) => {
                      if (mergedPeriods.has(periodSlot.period)) return null;
                      if (periodSlot.isBreak) {
                        return (
                          <td
                            key={periodSlot.period}
                            className="px-2 py-3 border-r border-slate-800 bg-amber-950/40 text-center text-[10px] font-bold uppercase text-amber-200"
                          >
                            {periodSlot.label}
                          </td>
                        );
                      }

                      const exactSlot = timeslots.find(
                        (ts) => ts.day === day && ts.periodNumber === periodSlot.period && ts.isActive && !ts.isBreak
                      );
                      const slotEntries = filteredEntries.filter((entry) => {
                        const timeSlotId = typeof entry.timeSlotId === 'string'
                          ? entry.timeSlotId
                          : (entry.timeSlotId as unknown as { _id: string })?._id;
                        return entry.day === day && (
                          timeSlotId === exactSlot?._id ||
                          (entry.startTime === periodSlot.startTime && entry.endTime === periodSlot.endTime)
                        );
                      });

                      const nextPeriod = STANDARD_PERIOD_TIMES[periodIndex + 1];
                      const nextSlot = nextPeriod && !nextPeriod.isBreak
                        ? timeslots.find(
                          (ts) => ts.day === day && ts.periodNumber === nextPeriod.period && ts.isActive && !ts.isBreak
                        )
                        : undefined;
                      const nextEntries = nextPeriod && nextSlot
                        ? filteredEntries.filter((entry) => {
                          const timeSlotId = typeof entry.timeSlotId === 'string'
                            ? entry.timeSlotId
                            : (entry.timeSlotId as unknown as { _id: string })?._id;
                          return entry.day === day && (
                            timeSlotId === nextSlot._id ||
                            (entry.startTime === nextSlot.startTime && entry.endTime === nextSlot.endTime)
                          );
                        })
                        : [];
                      const mergeNextPeriod = Boolean(
                        exactSlot && nextPeriod && nextSlot &&
                        shouldMergeLabSlots(exactSlot, nextSlot, slotEntries, nextEntries)
                      );
                      if (mergeNextPeriod && nextPeriod) mergedPeriods.add(nextPeriod.period);

                      const slotReservations = reservations.filter((r) => {
                        if (r.dayOfWeek !== day) return false;
                        if (periodSlot.period < r.startPeriod || periodSlot.period > r.endPeriod) return false;
                        if (!selectedClassroomId) return true;
                        const rRoomId = typeof r.classroomId === 'string' ? r.classroomId : (r.classroomId as unknown as { _id?: string })?._id;
                        return rRoomId === selectedClassroomId;
                      });

                      return (
                        <td
                          key={periodSlot.period}
                          colSpan={mergeNextPeriod ? 2 : 1}
                          className="p-2 border-r border-slate-800/60 align-top"
                        >
                          {exactSlot ? (
                            <DroppableCell
                              day={day}
                              timeSlot={exactSlot}
                              entries={slotEntries}
                              reservations={slotReservations}
                              isTwoPeriodBlock={mergeNextPeriod}
                              selectedClassroomId={selectedClassroomId}
                              getDeptName={getDeptName}
                              getRoomName={getRoomName}
                            />
                          ) : (
                            <div className="min-h-[100px] flex items-center justify-center bg-slate-950/20 text-xs text-slate-600 italic">
                              Inactive
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Drag Overlay Preview */}
        <DragOverlay>
          {activeDragEntry ? (
            <div className="w-48 p-3 rounded-xl border border-teal-400 bg-slate-900 shadow-2xl text-xs">
              <div className="font-bold text-white mb-1">
                {(activeDragEntry.subjectId as unknown as { name?: string })?.name || 'Class'}
              </div>
              <div className="text-slate-300 text-[11px]">
                {(activeDragEntry.teacherId as unknown as { name?: string })?.name || 'Teacher'}
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* AI Timetable Analysis Drawer / Modal */}
      {aiSummaryOpen && (
        <Card className="no-print space-y-4 border-teal-500/30 bg-slate-900/95">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-teal-400" />
              <h3 className="font-bold text-slate-100">AI Schedule Optimization Analysis</h3>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setAiSummaryOpen(false)}>
              Close
            </Button>
          </div>

          {aiSummaryLoading ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              Analyzing timetable workload, balance, and constraint health...
            </div>
          ) : aiSummaryData ? (
            <div className="space-y-4 text-xs">
              <p className="text-slate-200 leading-relaxed">{aiSummaryData.overview}</p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-slate-400 text-[11px]">Total Scheduled Sessions</div>
                  <div className="text-lg font-bold text-teal-400">{aiSummaryData.keyMetrics.totalClasses}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-slate-400 text-[11px]">Room Utilization</div>
                  <div className="text-lg font-bold text-emerald-400">{aiSummaryData.keyMetrics.roomUtilizationRate}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-slate-400 text-[11px]">Peak Days</div>
                  <div className="text-sm font-semibold text-amber-300">
                    {aiSummaryData.keyMetrics.peakDays.join(', ')}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 pt-2">
                <div className="font-semibold text-slate-300 uppercase tracking-wider text-[11px]">
                  Key Observations & Recommendations
                </div>
                <ul className="space-y-1 text-slate-400 list-disc list-inside">
                  {aiSummaryData.recommendations.map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </Card>
      )}

      {/* Conflict Modal with Alternative Slot Picker */}
      <ConflictModal
        isOpen={conflictModalOpen}
        onClose={() => setConflictModalOpen(false)}
        conflicts={conflictsList}
        suggestions={suggestionsList}
        onSelectSuggestion={handleSelectAlternativeSuggestion}
      />
    </div>
  );
};
