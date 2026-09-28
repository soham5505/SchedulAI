import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client.js';
import { useToast } from '../contexts/ToastContext.js';
import {
  ITeachingAssignment,
  ITeacher,
  ISubject,
  ISemester,
  IBatch,
  PaginationMeta,
} from '@schedulai/shared-types';
import { DataTable, Column } from '../components/ui/DataTable.js';
import { Button } from '../components/ui/Button.js';
import { Modal } from '../components/ui/Modal.js';
import { Input } from '../components/ui/Input.js';
import { Select } from '../components/ui/Select.js';
import { Badge } from '../components/ui/Badge.js';
import { Plus, Edit2, Trash2, User, BookOpen, GraduationCap, Layers } from 'lucide-react';

export const AssignmentsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<ITeachingAssignment | null>(null);

  // Form states
  const [teacherId, setTeacherId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [semesterId, setSemesterId] = useState('');
  const [batchId, setBatchId] = useState(''); // '' = whole class (null)
  const [periodsPerWeek, setPeriodsPerWeek] = useState(4);
  const [isLab, setIsLab] = useState(false);

  const { data: teachers = [] } = useQuery<ITeacher[]>({
    queryKey: ['teachers-select'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: ITeacher[] }>('/teachers?limit=100');
      return res.data.data;
    },
  });

  const { data: subjects = [] } = useQuery<ISubject[]>({
    queryKey: ['subjects-select'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: ISubject[] }>('/subjects?limit=100');
      return res.data.data;
    },
  });

  const { data: semesters = [] } = useQuery<ISemester[]>({
    queryKey: ['semesters-select'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: ISemester[] }>('/semesters?limit=100');
      return res.data.data;
    },
  });

  // Load all batches and filter by the selected semester on the client.
  // This keeps the picker working even when an older API instance has a broken
  // semesterId query filter.
  const { data: allBatches = [] } = useQuery<IBatch[]>({
    queryKey: ['batches-form'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: IBatch[] }>(
        '/batches?limit=100'
      );
      return res.data.data;
    },
  });

  const batchesForSemester = allBatches.filter((batch) => {
    const batchSemesterId =
      typeof batch.semesterId === 'string'
        ? batch.semesterId
        : batch.semesterId?._id;
    return batchSemesterId === semesterId;
  });

  const { data, isLoading } = useQuery<{ assignments: ITeachingAssignment[]; meta: PaginationMeta }>({
    queryKey: ['assignments', page],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: ITeachingAssignment[]; meta: PaginationMeta }>(
        `/assignments?page=${page}&limit=20`
      );
      return { assignments: res.data.data, meta: res.data.meta! };
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        teacherId,
        subjectId,
        semesterId,
        // Theory assignments MUST have batchId=null (whole class).
        // This is enforced here AND validated server-side.
        batchId: isLab ? (batchId || null) : null,
        periodsPerWeek: Number(periodsPerWeek),
        isLab,
      };

      if (editingAssignment) {
        await apiClient.put(`/assignments/${editingAssignment._id}`, payload);
      } else {
        await apiClient.post('/assignments', payload);
      }
    },
    onSuccess: () => {
      toast.success(editingAssignment ? 'Assignment updated!' : 'Assignment created!');
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      handleCloseModal();
    },
    onError: (err) => {
      toast.error((err as Error).message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/assignments/${id}`);
    },
    onSuccess: () => {
      toast.success('Assignment deleted');
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
    },
    onError: (err) => {
      toast.error((err as Error).message);
    },
  });

  const handleOpenCreate = () => {
    setEditingAssignment(null);
    setTeacherId(teachers[0]?._id || '');
    setSubjectId(subjects[0]?._id || '');
    setSemesterId(semesters[0]?._id || '');
    setBatchId('');
    setPeriodsPerWeek(4);
    setIsLab(false);
    setModalOpen(true);
  };

  const handleOpenEdit = (a: ITeachingAssignment) => {
    setEditingAssignment(a);
    const tId = typeof a.teacherId === 'string' ? a.teacherId : (a.teacherId as ITeacher)?._id;
    const sId = typeof a.subjectId === 'string' ? a.subjectId : (a.subjectId as ISubject)?._id;
    const semId = typeof a.semesterId === 'string' ? a.semesterId : (a.semesterId as ISemester)?._id;
    const bId = a.batchId == null ? ''
      : typeof a.batchId === 'string' ? a.batchId
        : (a.batchId as IBatch)?._id || '';

    setTeacherId(tId || '');
    setSubjectId(sId || '');
    setSemesterId(semId || '');
    setBatchId(bId);
    setPeriodsPerWeek(a.periodsPerWeek);
    setIsLab(a.isLab);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingAssignment(null);
    setBatchId('');
  };

  const columns: Column<ITeachingAssignment>[] = [
    {
      key: 'teacherId',
      header: 'Faculty Member',
      render: (item) => {
        const teacher = item.teacherId as ITeacher;
        return (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center font-bold text-xs">
              <User className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="font-semibold text-slate-100">{teacher?.name || 'Teacher'}</div>
              <div className="text-[11px] text-slate-400 font-mono">{teacher?.employeeId}</div>
            </div>
          </div>
        );
      },
    },
    {
      key: 'subjectId',
      header: 'Course / Subject',
      render: (item) => {
        const subject = item.subjectId as ISubject;
        return (
          <div>
            <div className="font-semibold text-slate-200">{subject?.name || 'Subject'}</div>
            <div className="text-[11px] text-teal-400 font-mono">{subject?.code}</div>
          </div>
        );
      },
    },
    {
      key: 'semesterId',
      header: 'Assigned Semester',
      render: (item) => {
        const semester = item.semesterId as ISemester;
        return <Badge variant="teal">{semester ? `${semester.name} (${semester.section})` : 'Semester'}</Badge>;
      },
    },
    {
      key: 'batchId',
      header: 'Batch',
      render: (item) => {
        const b = item.batchId as IBatch | null | undefined;
        return (
          <div className="flex items-center gap-1.5">
            <Layers className="w-3 h-3 text-indigo-400 shrink-0" />
            <Badge variant={b?.code ? 'blue' : 'slate'}>{b?.code ?? 'ALL'}</Badge>
          </div>
        );
      },
    },
    {
      key: 'periodsPerWeek',
      header: 'Weekly Load',
      render: (item) => (
        <span className="font-mono text-xs font-bold text-slate-200">
          {item.periodsPerWeek} periods/wk
        </span>
      ),
    },
    {
      key: 'isLab',
      header: 'Format',
      render: (item) => <Badge variant={item.isLab ? 'purple' : 'blue'}>{item.isLab ? 'Lab Practical' : 'Theory'}</Badge>,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item) => (
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(item)}>
            <Edit2 className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-rose-400 hover:text-rose-300"
            onClick={() => {
              if (confirm('Delete this teaching assignment?')) {
                deleteMutation.mutate(item._id);
              }
            }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Teaching Assignments</h1>
          <p className="text-xs text-slate-400 mt-0.5">Map faculty members to courses and semester cohorts (Core Scheduler Input)</p>
        </div>
        <Button variant="teal" size="sm" onClick={handleOpenCreate} leftIcon={<Plus className="w-4 h-4" />}>
          New Teaching Assignment
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={data?.assignments || []}
        meta={data?.meta}
        isLoading={isLoading}
        onPageChange={setPage}
      />

      <Modal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        title={editingAssignment ? 'Edit Teaching Assignment' : 'Create Teaching Assignment'}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate();
          }}
          className="space-y-4"
        >
          <Select
            label="Faculty Member"
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
            options={teachers.map((t) => ({ value: t._id, label: `${t.name} (${t.employeeId} - ${t.designation})` }))}
            required
          />

          <Select
            label="Course / Subject"
            value={subjectId}
            onChange={(e) => {
              setSubjectId(e.target.value);
              const found = subjects.find((s) => s._id === e.target.value);
              if (found) {
                setPeriodsPerWeek(found.weeklyPeriods);
                setIsLab(found.isLab);
              }
            }}
            options={subjects.map((s) => ({ value: s._id, label: `${s.name} (${s.code} - ${s.credits} cr)` }))}
            required
          />

          <Select
            label="Target Semester"
            value={semesterId}
            onChange={(e) => {
              setSemesterId(e.target.value);
              setBatchId(''); // clear batch when semester changes
            }}
            options={semesters.map((s) => ({ value: s._id, label: `${s.name} (Sec ${s.section} - ${s.studentCount} students)` }))}
            required
          />

          {/* Dynamic batch picker — options come from the selected semester.
              THEORY: disabled, forced to null (whole class).
              LAB:    enabled, user may select a specific batch. */}
          <Select
            label="Batch / Division"
            value={isLab ? batchId : ''}
            onChange={(e) => setBatchId(e.target.value)}
            disabled={!isLab}
            options={[
              {
                value: '',
                label: isLab ? 'Whole Class (ALL)' : 'N/A (Theory — whole class only)',
              },
              ...(isLab ? batchesForSemester.map((b) => ({ value: b._id, label: b.code })) : []),
            ]}
          />

          <Input
            label="Weekly Periods Required"
            type="number"
            min={1}
            max={20}
            value={periodsPerWeek}
            onChange={(e) => setPeriodsPerWeek(Number(e.target.value))}
            required
          />

          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={isLab}
              onChange={(e) => {
                setIsLab(e.target.checked);
                // When switching from Lab → Theory, clear the batch selection
                // because theory is always for the whole class (ALL students).
                if (!e.target.checked) setBatchId('');
              }}
              className="w-4 h-4 accent-teal-500 rounded cursor-pointer"
            />
            <span>This assignment requires laboratory facilities (Lab Practical)</span>
          </label>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <Button type="button" variant="secondary" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={saveMutation.isPending}>
              {editingAssignment ? 'Update Assignment' : 'Save Assignment'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
