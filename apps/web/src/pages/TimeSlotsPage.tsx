import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client.js';
import { useToast } from '../contexts/ToastContext.js';
import { ITimeSlot, DayOfWeek, PaginationMeta } from '@schedulai/shared-types';
import { DAYS_OF_WEEK } from '@schedulai/config';
import { DataTable, Column } from '../components/ui/DataTable.js';
import { Button } from '../components/ui/Button.js';
import { Modal } from '../components/ui/Modal.js';
import { Input } from '../components/ui/Input.js';
import { Select } from '../components/ui/Select.js';
import { Badge } from '../components/ui/Badge.js';
import { Plus, Edit2, Trash2, Clock, Wand2 } from 'lucide-react';

export const TimeSlotsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<ITimeSlot | null>(null);

  // Form states
  const [day, setDay] = useState<DayOfWeek>('MONDAY');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [periodNumber, setPeriodNumber] = useState(1);
  const [isBreak, setIsBreak] = useState(false);
  const [label, setLabel] = useState('Period 1');

  const { data, isLoading } = useQuery<{ timeslots: ITimeSlot[]; meta: PaginationMeta }>({
    queryKey: ['timeslots', page],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: ITimeSlot[]; meta: PaginationMeta }>(
        `/timeslots?page=${page}&limit=50`
      );
      return { timeslots: res.data.data, meta: res.data.meta! };
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        day,
        startTime,
        endTime,
        periodNumber: Number(periodNumber),
        isBreak,
        label,
      };

      if (editingSlot) {
        await apiClient.put(`/timeslots/${editingSlot._id}`, payload);
      } else {
        await apiClient.post('/timeslots', payload);
      }
    },
    onSuccess: () => {
      toast.success(editingSlot ? 'Time slot updated!' : 'Time slot added!');
      queryClient.invalidateQueries({ queryKey: ['timeslots'] });
      handleCloseModal();
    },
    onError: (err) => {
      toast.error((err as Error).message);
    },
  });

  const bulkGenerateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<{ success: boolean; message: string }>('/timeslots/bulk-standard', {
        days: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Standard template generated!');
      queryClient.invalidateQueries({ queryKey: ['timeslots'] });
    },
    onError: (err) => {
      toast.error((err as Error).message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/timeslots/${id}`);
    },
    onSuccess: () => {
      toast.success('Time slot deleted');
      queryClient.invalidateQueries({ queryKey: ['timeslots'] });
    },
    onError: (err) => {
      toast.error((err as Error).message);
    },
  });

  const handleOpenCreate = () => {
    setEditingSlot(null);
    setDay('MONDAY');
    setStartTime('09:00');
    setEndTime('10:00');
    setPeriodNumber(1);
    setIsBreak(false);
    setLabel('Period 1');
    setModalOpen(true);
  };

  const handleOpenEdit = (ts: ITimeSlot) => {
    setEditingSlot(ts);
    setDay(ts.day);
    setStartTime(ts.startTime);
    setEndTime(ts.endTime);
    setPeriodNumber(ts.periodNumber);
    setIsBreak(ts.isBreak);
    setLabel(ts.label || `Period ${ts.periodNumber}`);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingSlot(null);
  };

  const columns: Column<ITimeSlot>[] = [
    {
      key: 'day',
      header: 'Day of Week',
      render: (item) => <Badge variant="teal">{item.day}</Badge>,
    },
    {
      key: 'label',
      header: 'Period Identifier',
      render: (item) => (
        <span className="font-semibold text-slate-100 text-xs">
          {item.label || `Period ${item.periodNumber}`}
        </span>
      ),
    },
    {
      key: 'time',
      header: 'Time Range',
      render: (item) => (
        <span className="flex items-center gap-1.5 font-mono text-xs text-slate-300">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          {item.startTime} – {item.endTime}
        </span>
      ),
    },
    {
      key: 'periodNumber',
      header: 'Order #',
      render: (item) => <span className="font-mono text-xs text-slate-400">{item.periodNumber}</span>,
    },
    {
      key: 'isBreak',
      header: 'Slot Type',
      render: (item) => (
        <Badge variant={item.isBreak ? 'amber' : 'emerald'}>
          {item.isBreak ? 'Break / Inactive' : 'Teaching Slot'}
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
              if (confirm(`Delete time slot ${item.day} ${item.startTime}-${item.endTime}?`)) {
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Time Slots & Academic Bell Schedule</h1>
          <p className="text-xs text-slate-400 mt-0.5">Configure institutional periods, lunch breaks, and daily time slot bounds</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            isLoading={bulkGenerateMutation.isPending}
            onClick={() => bulkGenerateMutation.mutate()}
            leftIcon={<Wand2 className="w-4 h-4 text-teal-400" />}
          >
            Generate Standard 5-Day Schedule
          </Button>
          <Button variant="teal" size="sm" onClick={handleOpenCreate} leftIcon={<Plus className="w-4 h-4" />}>
            Add Time Slot
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.timeslots || []}
        meta={data?.meta}
        isLoading={isLoading}
        onPageChange={setPage}
      />

      <Modal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        title={editingSlot ? 'Edit Time Slot' : 'Add Time Slot'}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Day of Week"
              value={day}
              onChange={(e) => setDay(e.target.value as DayOfWeek)}
              options={DAYS_OF_WEEK.map((d) => ({ value: d, label: d }))}
              required
            />

            <Input
              label="Period Label"
              placeholder="Period 1"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />

            <Input
              label="Start Time (HH:mm 24-hr)"
              placeholder="09:00"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />

            <Input
              label="End Time (HH:mm 24-hr)"
              placeholder="10:00"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
            />

            <Input
              label="Period Number (Order)"
              type="number"
              min={1}
              max={20}
              value={periodNumber}
              onChange={(e) => setPeriodNumber(Number(e.target.value))}
              required
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={isBreak}
              onChange={(e) => setIsBreak(e.target.checked)}
              className="w-4 h-4 accent-teal-500 rounded cursor-pointer"
            />
            <span>This is a break period (Lunch / Short Break — not scheduled for classes)</span>
          </label>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <Button type="button" variant="secondary" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={saveMutation.isPending}>
              {editingSlot ? 'Update Time Slot' : 'Save Time Slot'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
