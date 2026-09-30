import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client.js';
import { useToast } from '../contexts/ToastContext.js';
import { ISubject, IDepartment, PaginationMeta } from '@schedulai/shared-types';
import { DataTable, Column } from '../components/ui/DataTable.js';
import { Button } from '../components/ui/Button.js';
import { Modal } from '../components/ui/Modal.js';
import { Input } from '../components/ui/Input.js';
import { Select } from '../components/ui/Select.js';
import { Badge } from '../components/ui/Badge.js';
import { Plus, Edit2, Trash2, BookOpen } from 'lucide-react';

export const SubjectsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<ISubject | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [credits, setCredits] = useState(3);
  const [departmentId, setDepartmentId] = useState('');
  const [weeklyPeriods, setWeeklyPeriods] = useState(3);
  const [lecturePeriods, setLecturePeriods] = useState(3);
  const [labPeriods, setLabPeriods] = useState(0);
  const [isLab, setIsLab] = useState(false);

  const { data: departments = [] } = useQuery<IDepartment[]>({
    queryKey: ['departments-list'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: IDepartment[] }>('/departments?limit=100');
      return res.data.data;
    },
  });

  const { data, isLoading } = useQuery<{ subjects: ISubject[]; meta: PaginationMeta }>({
    queryKey: ['subjects', page, search],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '10' });
      if (search) params.append('search', search);

      const res = await apiClient.get<{ success: boolean; data: ISubject[]; meta: PaginationMeta }>(
        `/subjects?${params.toString()}`
      );
      return { subjects: res.data.data, meta: res.data.meta! };
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        code: code.toUpperCase(),
        credits: Number(credits),
        departmentId,
        weeklyPeriods: Number(weeklyPeriods),
        lecturePeriods: Number(lecturePeriods),
        labPeriods: Number(labPeriods),
        isLab,
      };

      if (editingSubject) {
        await apiClient.put(`/subjects/${editingSubject._id}`, payload);
      } else {
        await apiClient.post('/subjects', payload);
      }
    },
    onSuccess: () => {
      toast.success(editingSubject ? 'Course updated!' : 'Course created!');
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      handleCloseModal();
    },
    onError: (err) => {
      toast.error((err as Error).message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/subjects/${id}`);
    },
    onSuccess: () => {
      toast.success('Course deleted');
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
    },
    onError: (err) => {
      toast.error((err as Error).message);
    },
  });

  const handleOpenCreate = () => {
    setEditingSubject(null);
    setName('');
    setCode('');
    setCredits(3);
    setDepartmentId(departments[0]?._id || '');
    setWeeklyPeriods(3);
    setLecturePeriods(3);
    setLabPeriods(0);
    setIsLab(false);
    setModalOpen(true);
  };

  const handleOpenEdit = (s: ISubject) => {
    setEditingSubject(s);
    setName(s.name);
    setCode(s.code);
    setCredits(s.credits);
    const deptId = typeof s.departmentId === 'string' ? s.departmentId : (s.departmentId as IDepartment)?._id;
    setDepartmentId(deptId || '');
    setIsLab(s.isLab);
    setWeeklyPeriods(s.isLab ? 2 : 3);
    setLecturePeriods(s.isLab ? 0 : 3);
    setLabPeriods(s.isLab ? 2 : 0);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingSubject(null);
  };

  const columns: Column<ISubject>[] = [
    {
      key: 'name',
      header: 'Course / Subject Name',
      render: (item) => (
        <div>
          <div className="font-semibold text-slate-100">{item.name}</div>
          <div className="text-xs text-slate-400 font-mono">Code: {item.code}</div>
        </div>
      ),
    },
    {
      key: 'departmentId',
      header: 'Department',
      render: (item) => {
        const dept = item.departmentId as IDepartment;
        return <Badge variant="teal">{dept?.code || 'General'}</Badge>;
      },
    },
    {
      key: 'credits',
      header: 'Credits',
      render: (item) => <span className="font-mono font-bold text-xs text-slate-200">{item.credits}</span>,
    },
    {
      key: 'periods',
      header: 'Weekly Periods',
      render: (item) => (
        <span className="text-xs text-slate-300 font-medium">
          {item.weeklyPeriods} total ({item.lecturePeriods}L + {item.labPeriods}P)
        </span>
      ),
    },
    {
      key: 'isLab',
      header: 'Type',
      render: (item) => (
        <Badge variant={item.isLab ? 'purple' : 'blue'}>
          {item.isLab ? 'Laboratory' : 'Theory / Lecture'}
        </Badge>
      ),
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
              if (confirm(`Delete course '${item.name}'?`)) {
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
          <h1 className="text-2xl font-bold text-white tracking-tight">Courses & Subjects</h1>
          <p className="text-xs text-slate-400 mt-0.5">Manage subject requirements, weekly period targets, and lab classifications</p>
        </div>
        <Button variant="teal" size="sm" onClick={handleOpenCreate} leftIcon={<Plus className="w-4 h-4" />}>
          Add Course
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={data?.subjects || []}
        meta={data?.meta}
        isLoading={isLoading}
        searchPlaceholder="Search courses by name or code..."
        onSearch={setSearch}
        onPageChange={setPage}
      />

      <Modal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        title={editingSubject ? 'Edit Course' : 'Create Course'}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate();
          }}
          className="space-y-4"
        >
          <Input
            label="Subject Name"
            placeholder="Data Structures & Algorithms"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Subject Code"
              placeholder="CS301"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              required
            />

            <Select
              label="Department"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              options={departments.map((d) => ({ value: d._id, label: `${d.name} (${d.code})` }))}
              required
            />

            <Input
              label="Credits"
              type="number"
              min={1}
              max={10}
              value={credits}
              onChange={(e) => setCredits(Number(e.target.value))}
              required
            />

            <Input
              label="Total Weekly Periods"
              type="number"
              min={isLab ? 2 : 3}
              max={isLab ? 2 : 3}
              step={1}
              value={weeklyPeriods}
              onChange={(e) => setWeeklyPeriods(Number(e.target.value))}
              required
            />

            <Input
              label="Lecture Periods / Wk"
              type="number"
              min={isLab ? 0 : 3}
              max={isLab ? 0 : 3}
              step={1}
              value={lecturePeriods}
              onChange={(e) => setLecturePeriods(Number(e.target.value))}
              required
            />

            <Input
              label="Lab Periods / Wk"
              type="number"
              min={isLab ? 2 : 0}
              max={isLab ? 2 : 0}
              step={1}
              value={labPeriods}
              onChange={(e) => setLabPeriods(Number(e.target.value))}
              required
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={isLab}
              onChange={(e) => {
                const nextIsLab = e.target.checked;
                setIsLab(nextIsLab);
                setWeeklyPeriods(nextIsLab ? 2 : 3);
                setLecturePeriods(nextIsLab ? 0 : 3);
                setLabPeriods(nextIsLab ? 2 : 0);
              }}
              className="w-4 h-4 accent-teal-500 rounded cursor-pointer"
            />
            <span>This is a laboratory practical subject (requires lab room)</span>
          </label>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <Button type="button" variant="secondary" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={saveMutation.isPending}>
              {editingSubject ? 'Update Course' : 'Create Course'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
