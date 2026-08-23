import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client.js';
import { useToast } from '../contexts/ToastContext.js';
import { ITeacher, IDepartment, DayOfWeek, PaginationMeta } from '@schedulai/shared-types';
import { DAYS_OF_WEEK } from '@schedulai/config';
import { DataTable, Column } from '../components/ui/DataTable.js';
import { Button } from '../components/ui/Button.js';
import { Modal } from '../components/ui/Modal.js';
import { Input } from '../components/ui/Input.js';
import { Select } from '../components/ui/Select.js';
import { Badge } from '../components/ui/Badge.js';
import { Plus, Edit2, Trash2, Mail, Phone, Clock } from 'lucide-react';

export const TeachersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<ITeacher | null>(null);

  // Form States
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [designation, setDesignation] = useState('Assistant Professor');
  const [departmentId, setDepartmentId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [availability, setAvailability] = useState<DayOfWeek[]>([
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
  ]);
  const [maxClassesPerDay, setMaxClassesPerDay] = useState(4);
  const [maxClassesPerWeek, setMaxClassesPerWeek] = useState(20);

  const { data: departments = [] } = useQuery<IDepartment[]>({
    queryKey: ['departments-list'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: IDepartment[] }>('/departments?limit=100');
      return res.data.data;
    },
  });

  const { data, isLoading } = useQuery<{ teachers: ITeacher[]; meta: PaginationMeta }>({
    queryKey: ['teachers', page, search],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '10' });
      if (search) params.append('search', search);

      const res = await apiClient.get<{ success: boolean; data: ITeacher[]; meta: PaginationMeta }>(
        `/teachers?${params.toString()}`
      );
      return { teachers: res.data.data, meta: res.data.meta! };
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        email,
        phone,
        designation,
        departmentId,
        employeeId,
        availability,
        maxClassesPerDay: Number(maxClassesPerDay),
        maxClassesPerWeek: Number(maxClassesPerWeek),
      };

      if (editingTeacher) {
        await apiClient.put(`/teachers/${editingTeacher._id}`, payload);
      } else {
        await apiClient.post('/teachers', payload);
      }
    },
    onSuccess: () => {
      toast.success(editingTeacher ? 'Faculty updated!' : 'Faculty added!');
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      handleCloseModal();
    },
    onError: (err) => {
      toast.error((err as Error).message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/teachers/${id}`);
    },
    onSuccess: () => {
      toast.success('Teacher record removed');
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
    },
    onError: (err) => {
      toast.error((err as Error).message);
    },
  });

  const handleOpenCreate = () => {
    setEditingTeacher(null);
    setName('');
    setEmail('');
    setPhone('');
    setDesignation('Assistant Professor');
    setDepartmentId(departments[0]?._id || '');
    setEmployeeId(`FAC${Math.floor(Math.random() * 900 + 100)}`);
    setAvailability(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']);
    setMaxClassesPerDay(4);
    setMaxClassesPerWeek(20);
    setModalOpen(true);
  };

  const handleOpenEdit = (t: ITeacher) => {
    setEditingTeacher(t);
    setName(t.name);
    setEmail(t.email);
    setPhone(t.phone || '');
    setDesignation(t.designation);
    const deptId = typeof t.departmentId === 'string' ? t.departmentId : (t.departmentId as IDepartment)?._id;
    setDepartmentId(deptId || '');
    setEmployeeId(t.employeeId);
    setAvailability(t.availability || []);
    setMaxClassesPerDay(t.maxClassesPerDay || 4);
    setMaxClassesPerWeek(t.maxClassesPerWeek || 20);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingTeacher(null);
  };

  const toggleDay = (day: DayOfWeek) => {
    setAvailability((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const columns: Column<ITeacher>[] = [
    {
      key: 'name',
      header: 'Faculty Member',
      render: (item) => (
        <div>
          <div className="font-semibold text-slate-100">{item.name}</div>
          <div className="text-xs text-slate-400 font-mono">ID: {item.employeeId} • {item.designation}</div>
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
      key: 'email',
      header: 'Contact',
      render: (item) => (
        <div className="text-xs text-slate-300 space-y-0.5">
          <div className="flex items-center gap-1.5"><Mail className="w-3 h-3 text-slate-400" /> {item.email}</div>
          {item.phone && <div className="flex items-center gap-1.5 text-slate-400"><Phone className="w-3 h-3" /> {item.phone}</div>}
        </div>
      ),
    },
    {
      key: 'availability',
      header: 'Availability',
      render: (item) => (
        <div className="flex flex-wrap gap-1 max-w-xs">
          {item.availability?.map((d) => (
            <span key={d} className="px-1.5 py-0.5 text-[10px] rounded bg-slate-800 text-slate-300 font-mono">
              {d.slice(0, 3)}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: 'workload',
      header: 'Max Load',
      render: (item) => (
        <span className="text-xs text-slate-300 font-medium">
          {item.maxClassesPerDay}/day • {item.maxClassesPerWeek}/wk
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
              if (confirm(`Delete teacher '${item.name}'?`)) {
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
          <h1 className="text-2xl font-bold text-white tracking-tight">Faculty & Teachers</h1>
          <p className="text-xs text-slate-400 mt-0.5">Manage teaching staff, workload bounds, and day availability</p>
        </div>
        <Button variant="teal" size="sm" onClick={handleOpenCreate} leftIcon={<Plus className="w-4 h-4" />}>
          Add Faculty
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={data?.teachers || []}
        meta={data?.meta}
        isLoading={isLoading}
        searchPlaceholder="Search faculty by name, email, or ID..."
        onSearch={setSearch}
        onPageChange={setPage}
      />

      <Modal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        title={editingTeacher ? 'Edit Faculty' : 'Add Faculty Member'}
        maxWidth="xl"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Full Name"
              placeholder="Dr. Alan Turing"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <Input
              label="Email Address"
              placeholder="alan.turing@schedulai.edu"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Input
              label="Employee / Faculty ID"
              placeholder="FAC001"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
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
              label="Designation"
              placeholder="Associate Professor"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              required
            />

            <Input
              label="Phone Number"
              placeholder="+1 555-0100"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />

            <Input
              label="Max Classes / Day"
              type="number"
              min={1}
              max={8}
              value={maxClassesPerDay}
              onChange={(e) => setMaxClassesPerDay(Number(e.target.value))}
              required
            />

            <Input
              label="Max Classes / Week"
              type="number"
              min={1}
              max={40}
              value={maxClassesPerWeek}
              onChange={(e) => setMaxClassesPerWeek(Number(e.target.value))}
              required
            />
          </div>

          {/* Availability Days Checkbox Matrix */}
          <div className="space-y-1.5 pt-2 border-t border-slate-800">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
              Teaching Availability Days
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {DAYS_OF_WEEK.map((d) => {
                const isSelected = availability.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(d)}
                    className={`py-2 px-1 rounded-xl border text-xs font-semibold transition ${
                      isSelected
                        ? 'bg-teal-500/20 border-teal-500 text-teal-300'
                        : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {d.slice(0, 3)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <Button type="button" variant="secondary" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={saveMutation.isPending}>
              {editingTeacher ? 'Update Faculty' : 'Save Faculty'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
