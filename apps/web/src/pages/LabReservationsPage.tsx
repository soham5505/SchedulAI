import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client.js';
import { useToast } from '../contexts/ToastContext.js';
import { IDepartment, IClassroom, IRoomReservation, DayOfWeek } from '@schedulai/shared-types';
import { DAYS_OF_WEEK, STANDARD_PERIOD_TIMES } from '@schedulai/config';
import { formatTimeRange12Hour, formatTo12Hour } from '../utils/timeFormat.js';
import { Card } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { Select } from '../components/ui/Select.js';
import { Input } from '../components/ui/Input.js';
import { DataTable } from '../components/ui/DataTable.js';
import { Modal } from '../components/ui/Modal.js';
import { Badge } from '../components/ui/Badge.js';
import {
  Lock,
  Plus,
  Trash2,
  Edit,
  Building2,
  DoorOpen,
  Calendar,
  Clock,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';

const teachingPeriods = STANDARD_PERIOD_TIMES.filter((p) => !p.isBreak);

export const LabReservationsPage: React.FC = () => {
  const toast = useToast();
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [formDepartmentId, setFormDepartmentId] = useState('');
  const [formClassroomId, setFormClassroomId] = useState('');
  const [formDayOfWeek, setFormDayOfWeek] = useState<DayOfWeek>('MONDAY');
  const [formStartPeriod, setFormStartPeriod] = useState(1);
  const [formEndPeriod, setFormEndPeriod] = useState(2);
  const [formReason, setFormReason] = useState('');

  // Filters
  const [filterDeptId, setFilterDeptId] = useState('');
  const [filterClassroomId, setFilterClassroomId] = useState('');
  const [filterDay, setFilterDay] = useState('');

  // Fetch departments
  const { data: departments = [] } = useQuery<IDepartment[]>({
    queryKey: ['departments-list'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: IDepartment[] }>('/departments?limit=100');
      return res.data.data;
    },
  });

  // Fetch labs/classrooms (only labs for lab reservations, but show all for flexibility)
  const { data: classrooms = [] } = useQuery<IClassroom[]>({
    queryKey: ['classrooms-list'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: IClassroom[] }>('/classrooms?limit=100');
      return res.data.data;
    },
  });

  // Fetch reservations
  const { data: reservations = [], isLoading } = useQuery<IRoomReservation[]>({
    queryKey: ['lab-reservations', filterDeptId, filterClassroomId, filterDay],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '100' });
      if (filterDeptId) params.set('departmentId', filterDeptId);
      if (filterClassroomId) params.set('classroomId', filterClassroomId);
      if (filterDay) params.set('dayOfWeek', filterDay);
      const res = await apiClient.get<{ success: boolean; data: IRoomReservation[] }>(`/lab-reservations?${params}`);
      return res.data.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiClient.post('/lab-reservations', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-reservations'] });
      toast.success('Lab reservation created successfully');
      closeModal();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create reservation');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await apiClient.put(`/lab-reservations/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-reservations'] });
      toast.success('Lab reservation updated successfully');
      closeModal();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update reservation');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/lab-reservations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-reservations'] });
      toast.success('Lab reservation deleted');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete reservation');
    },
  });

  const openCreateModal = () => {
    setEditingId(null);
    setFormDepartmentId(departments[0]?._id || '');
    setFormClassroomId('');
    setFormDayOfWeek('MONDAY');
    setFormStartPeriod(1);
    setFormEndPeriod(2);
    setFormReason('');
    setModalOpen(true);
  };

  const openEditModal = (reservation: IRoomReservation) => {
    setEditingId(reservation._id);
    const deptId = typeof reservation.departmentId === 'object' ? reservation.departmentId._id : reservation.departmentId;
    const classId = typeof reservation.classroomId === 'object' ? reservation.classroomId._id : reservation.classroomId;
    setFormDepartmentId(deptId);
    setFormClassroomId(classId);
    setFormDayOfWeek(reservation.dayOfWeek);
    setFormStartPeriod(reservation.startPeriod);
    setFormEndPeriod(reservation.endPeriod);
    setFormReason(reservation.reason || '');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
  };

  const handleSubmit = () => {
    const payload = {
      classroomId: formClassroomId,
      departmentId: formDepartmentId,
      dayOfWeek: formDayOfWeek,
      startPeriod: formStartPeriod,
      endPeriod: formEndPeriod,
      reason: formReason,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const getClassroomName = (classroom: string | IClassroom) => {
    if (typeof classroom === 'object' && classroom) {
      return classroom.name || `${classroom.building}-${classroom.roomNumber}`;
    }
    const found = classrooms.find((c) => c._id === classroom);
    return found ? found.name : String(classroom);
  };

  const getDeptName = (dept: string | IDepartment) => {
    if (typeof dept === 'object' && dept) return dept.name;
    const found = departments.find((d) => d._id === dept);
    return found ? found.name : String(dept);
  };

  const getPeriodLabel = (period: number) => {
    const p = teachingPeriods.find((tp) => tp.period === period);
    return p ? `P${p.period} (${formatTimeRange12Hour(p.startTime, p.endTime)})` : `P${period}`;
  };

  const labClassrooms = classrooms.filter((c) => c.isLab || c.type === 'LAB');
  const selectableRooms = labClassrooms.length > 0 ? labClassrooms : classrooms;

  const columns = [
    {
      key: 'classroomId',
      header: 'Laboratory',
      render: (row: IRoomReservation) => (
        <div className="flex items-center gap-2">
          <DoorOpen className="w-4 h-4 text-teal-400" />
          <span className="font-medium text-slate-200">{getClassroomName(row.classroomId)}</span>
        </div>
      ),
    },
    {
      key: 'departmentId',
      header: 'Reserved By',
      render: (row: IRoomReservation) => (
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-purple-400" />
          <span>{getDeptName(row.departmentId)}</span>
        </div>
      ),
    },
    {
      key: 'dayOfWeek',
      header: 'Day',
      render: (row: IRoomReservation) => (
        <Badge variant="slate" size="sm">{row.dayOfWeek}</Badge>
      ),
    },
    {
      key: 'time',
      header: 'Reserved Periods',
      render: (row: IRoomReservation) => (
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs font-mono bg-slate-800 px-2 py-0.5 rounded">
            P{row.startPeriod}–P{row.endPeriod}
          </span>
        </div>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (row: IRoomReservation) => (
        <span className="text-slate-400 text-xs">{row.reason || '—'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: IRoomReservation) => (
        <Badge variant={row.isActive ? 'teal' : 'slate'} size="sm">
          {row.isActive ? 'Reserved' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row: IRoomReservation) => (
        <div className="flex gap-2">
          <button
            onClick={() => openEditModal(row)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-teal-300 hover:bg-teal-500/10 transition"
            title="Edit"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => { if (confirm('Delete this reservation?')) deleteMutation.mutate(row._id); }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 transition"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-400 flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
              <Lock className="w-5 h-5" />
            </div>
            Lab Reservations
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Reserve laboratories for specific departments and time slots. Reserved labs become unavailable to other departments during scheduled periods.
          </p>
        </div>
        <Button variant="teal" onClick={openCreateModal} leftIcon={<Plus className="w-4 h-4" />}>
          Reserve Laboratory
        </Button>
      </div>

      {/* Info Banner */}
      <Card className="border-amber-500/20 bg-amber-500/5">
        <div className="flex items-start gap-3 p-4">
          <ShieldCheck className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="text-amber-300 font-medium">Scheduler Hard Constraint</p>
            <p className="text-slate-400 mt-0.5">
              All active reservations are automatically enforced as hard constraints during timetable generation.
              The solver will never schedule any class in a reserved lab during the specified time periods.
            </p>
          </div>
        </div>
      </Card>

      {/* Filters */}
      <Card>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Select
            label="Filter by Department"
            value={filterDeptId}
            onChange={(e) => setFilterDeptId(e.target.value)}
            options={[
              { value: '', label: 'All Departments' },
              ...departments.map((d) => ({ value: d._id, label: d.name })),
            ]}
          />
          <Select
            label="Filter by Laboratory"
            value={filterClassroomId}
            onChange={(e) => setFilterClassroomId(e.target.value)}
            options={[
              { value: '', label: 'All Labs' },
              ...selectableRooms.map((c) => ({ value: c._id, label: `${c.name} ${c.isLab || c.type === 'LAB' ? '(Lab)' : ''}` })),
            ]}
          />
          <Select
            label="Filter by Day"
            value={filterDay}
            onChange={(e) => setFilterDay(e.target.value)}
            options={[
              { value: '', label: 'All Days' },
              ...DAYS_OF_WEEK.map((d) => ({ value: d, label: d })),
            ]}
          />
        </div>
      </Card>

      {/* Reservations Table */}
      <Card>
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Loading reservations...</div>
        ) : reservations.length === 0 ? (
          <div className="p-12 text-center">
            <Lock className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No lab reservations yet.</p>
            <p className="text-slate-500 text-xs mt-1">Click "Reserve Laboratory" to create one.</p>
          </div>
        ) : (
          <DataTable columns={columns} data={reservations} />
        )}
      </Card>

      {/* Create / Edit Modal */}
      <Modal isOpen={modalOpen} onClose={closeModal} title={editingId ? 'Edit Lab Reservation' : 'Reserve Laboratory'}>
        <div className="space-y-4">
          <Select
            label="Department"
            value={formDepartmentId}
            onChange={(e) => setFormDepartmentId(e.target.value)}
            options={[
              { value: '', label: 'Select department...' },
              ...departments.map((d) => ({ value: d._id, label: d.name })),
            ]}
          />
          <Select
            label="Laboratory"
            value={formClassroomId}
            onChange={(e) => setFormClassroomId(e.target.value)}
            options={[
              { value: '', label: 'Select laboratory...' },
              ...selectableRooms.map((c) => ({
                value: c._id,
                label: `${c.name} (${c.isLab || c.type === 'LAB' ? 'Lab' : c.type} - ${c.building} ${c.roomNumber}, Cap: ${c.capacity})`,
              })),
            ]}
          />
          <Select
            label="Day of Week"
            value={formDayOfWeek}
            onChange={(e) => setFormDayOfWeek(e.target.value as DayOfWeek)}
            options={DAYS_OF_WEEK.map((d) => ({ value: d, label: d }))}
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Start Period"
              value={String(formStartPeriod)}
              onChange={(e) => {
                const val = Number(e.target.value);
                setFormStartPeriod(val);
                if (formEndPeriod < val) setFormEndPeriod(val);
              }}
              options={teachingPeriods.map((p) => ({
                value: String(p.period),
                label: `Period ${p.period} (${formatTo12Hour(p.startTime)})`,
              }))}
            />
            <Select
              label="End Period"
              value={String(formEndPeriod)}
              onChange={(e) => setFormEndPeriod(Number(e.target.value))}
              options={teachingPeriods
                .filter((p) => p.period >= formStartPeriod)
                .map((p) => ({
                  value: String(p.period),
                  label: `Period ${p.period} (${formatTo12Hour(p.endTime)})`,
                }))}
            />
          </div>
          <Input
            label="Reason (optional)"
            value={formReason}
            onChange={(e) => setFormReason(e.target.value)}
            placeholder="e.g. Computer Engineering Practical"
          />

          {/* Validation hint */}
          {formEndPeriod < formStartPeriod && (
            <div className="flex items-center gap-2 text-xs text-rose-400">
              <AlertCircle className="w-4 h-4" />
              End period must be ≥ start period
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <Button variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button
              variant="teal"
              onClick={handleSubmit}
              disabled={
                !formDepartmentId || !formClassroomId || formEndPeriod < formStartPeriod ||
                createMutation.isPending || updateMutation.isPending
              }
              leftIcon={<Lock className="w-4 h-4" />}
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'Saving...'
                : editingId
                  ? 'Update Reservation'
                  : 'Reserve Lab'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
