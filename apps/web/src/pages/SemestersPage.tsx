import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client.js';
import { useToast } from '../contexts/ToastContext.js';
import { ISemester, IDepartment, PaginationMeta } from '@schedulai/shared-types';
import { DataTable, Column } from '../components/ui/DataTable.js';
import { Button } from '../components/ui/Button.js';
import { Modal } from '../components/ui/Modal.js';
import { Input } from '../components/ui/Input.js';
import { Select } from '../components/ui/Select.js';
import { Badge } from '../components/ui/Badge.js';
import { Plus, Edit2, Trash2, Users } from 'lucide-react';

export const SemestersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSemester, setEditingSemester] = useState<ISemester | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [number, setNumber] = useState(1);
  const [departmentId, setDepartmentId] = useState('');
  const [academicYear, setAcademicYear] = useState('2026-2027');
  const [section, setSection] = useState('A');
  const [studentCount, setStudentCount] = useState(40);

  const { data: departments = [] } = useQuery<IDepartment[]>({
    queryKey: ['departments-list'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: IDepartment[] }>('/departments?limit=100');
      return res.data.data;
    },
  });

  const { data, isLoading } = useQuery<{ semesters: ISemester[]; meta: PaginationMeta }>({
    queryKey: ['semesters', page, search],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '10' });
      if (search) params.append('search', search);

      const res = await apiClient.get<{ success: boolean; data: ISemester[]; meta: PaginationMeta }>(
        `/semesters?${params.toString()}`
      );
      return { semesters: res.data.data, meta: res.data.meta! };
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        number: Number(number),
        departmentId,
        academicYear,
        section,
        studentCount: Number(studentCount),
      };

      if (editingSemester) {
        await apiClient.put(`/semesters/${editingSemester._id}`, payload);
      } else {
        await apiClient.post('/semesters', payload);
      }
    },
    onSuccess: () => {
      toast.success(editingSemester ? 'Semester updated!' : 'Semester added!');
      queryClient.invalidateQueries({ queryKey: ['semesters'] });
      handleCloseModal();
    },
    onError: (err) => {
      toast.error((err as Error).message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/semesters/${id}`);
    },
    onSuccess: () => {
      toast.success('Semester deleted');
      queryClient.invalidateQueries({ queryKey: ['semesters'] });
    },
    onError: (err) => {
      toast.error((err as Error).message);
    },
  });

  const handleOpenCreate = () => {
    setEditingSemester(null);
    setName('CSE 3rd Semester — Section A');
    setNumber(3);
    setDepartmentId(departments[0]?._id || '');
    setAcademicYear('2026-2027');
    setSection('A');
    setStudentCount(40);
    setModalOpen(true);
  };

  const handleOpenEdit = (sem: ISemester) => {
    setEditingSemester(sem);
    setName(sem.name);
    setNumber(sem.number);
    const deptId = typeof sem.departmentId === 'string' ? sem.departmentId : (sem.departmentId as IDepartment)?._id;
    setDepartmentId(deptId || '');
    setAcademicYear(sem.academicYear);
    setSection(sem.section);
    setStudentCount(sem.studentCount);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingSemester(null);
  };

  const columns: Column<ISemester>[] = [
    {
      key: 'name',
      header: 'Semester Batch',
      render: (item) => (
        <div>
          <div className="font-semibold text-slate-100">{item.name}</div>
          <div className="text-xs text-slate-400 font-mono">
            Semester {item.number} • Sec {item.section} • Year {item.academicYear}
          </div>
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
      key: 'studentCount',
      header: 'Student Count',
      render: (item) => (
        <span className="flex items-center gap-1.5 text-xs text-slate-200 font-bold">
          <Users className="w-3.5 h-3.5 text-teal-400" />
          {item.studentCount} students
        </span>
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
              if (confirm(`Delete semester '${item.name}'?`)) {
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
          <h1 className="text-2xl font-bold text-white tracking-tight">Semesters & Student Batches</h1>
          <p className="text-xs text-slate-400 mt-0.5">Manage cohort student counts, sections, and department associations</p>
        </div>
        <Button variant="teal" size="sm" onClick={handleOpenCreate} leftIcon={<Plus className="w-4 h-4" />}>
          Add Semester
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={data?.semesters || []}
        meta={data?.meta}
        isLoading={isLoading}
        searchPlaceholder="Search semesters by name, year, or section..."
        onSearch={setSearch}
        onPageChange={setPage}
      />

      <Modal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        title={editingSemester ? 'Edit Semester' : 'Add Semester'}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate();
          }}
          className="space-y-4"
        >
          <Input
            label="Semester Name"
            placeholder="CSE 3rd Semester — Section A"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Semester Number (1-12)"
              type="number"
              min={1}
              max={12}
              value={number}
              onChange={(e) => setNumber(Number(e.target.value))}
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
              label="Academic Year"
              placeholder="2026-2027"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              required
            />

            <Input
              label="Section"
              placeholder="A"
              value={section}
              onChange={(e) => setSection(e.target.value)}
              required
            />

            <Input
              label="Student Count / Strength"
              type="number"
              min={1}
              max={500}
              value={studentCount}
              onChange={(e) => setStudentCount(Number(e.target.value))}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <Button type="button" variant="secondary" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={saveMutation.isPending}>
              {editingSemester ? 'Update Semester' : 'Save Semester'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
