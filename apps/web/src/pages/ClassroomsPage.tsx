import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client.js';
import { useToast } from '../contexts/ToastContext.js';
import { IClassroom, RoomType, PaginationMeta } from '@schedulai/shared-types';
import { DataTable, Column } from '../components/ui/DataTable.js';
import { Button } from '../components/ui/Button.js';
import { Modal } from '../components/ui/Modal.js';
import { Input } from '../components/ui/Input.js';
import { Select } from '../components/ui/Select.js';
import { Badge } from '../components/ui/Badge.js';
import { Plus, Edit2, Trash2, MapPin, Users } from 'lucide-react';

export const ClassroomsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<IClassroom | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [building, setBuilding] = useState('Main Block');
  const [roomNumber, setRoomNumber] = useState('');
  const [capacity, setCapacity] = useState(60);
  const [type, setType] = useState<RoomType>('LECTURE');
  const [isLab, setIsLab] = useState(false);
  const [equipmentInput, setEquipmentInput] = useState('PROJECTOR, AC');

  const { data, isLoading } = useQuery<{ classrooms: IClassroom[]; meta: PaginationMeta }>({
    queryKey: ['classrooms', page, search],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '10' });
      if (search) params.append('search', search);

      const res = await apiClient.get<{ success: boolean; data: IClassroom[]; meta: PaginationMeta }>(
        `/classrooms?${params.toString()}`
      );
      return { classrooms: res.data.data, meta: res.data.meta! };
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const equipment = equipmentInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const payload = {
        name,
        building,
        roomNumber,
        capacity: Number(capacity),
        type,
        isLab: isLab || type === 'LAB',
        equipment,
      };

      if (editingRoom) {
        await apiClient.put(`/classrooms/${editingRoom._id}`, payload);
      } else {
        await apiClient.post('/classrooms', payload);
      }
    },
    onSuccess: () => {
      toast.success(editingRoom ? 'Classroom updated!' : 'Classroom created!');
      queryClient.invalidateQueries({ queryKey: ['classrooms'] });
      handleCloseModal();
    },
    onError: (err) => {
      toast.error((err as Error).message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/classrooms/${id}`);
    },
    onSuccess: () => {
      toast.success('Classroom deleted');
      queryClient.invalidateQueries({ queryKey: ['classrooms'] });
    },
    onError: (err) => {
      toast.error((err as Error).message);
    },
  });

  const handleOpenCreate = () => {
    setEditingRoom(null);
    setName('');
    setBuilding('Main Block');
    setRoomNumber('');
    setCapacity(60);
    setType('LECTURE');
    setIsLab(false);
    setEquipmentInput('PROJECTOR, AC');
    setModalOpen(true);
  };

  const handleOpenEdit = (c: IClassroom) => {
    setEditingRoom(c);
    setName(c.name);
    setBuilding(c.building);
    setRoomNumber(c.roomNumber);
    setCapacity(c.capacity);
    setType(c.type);
    setIsLab(c.isLab);
    setEquipmentInput((c.equipment || []).join(', '));
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingRoom(null);
  };

  const columns: Column<IClassroom>[] = [
    {
      key: 'name',
      header: 'Room Identifier',
      render: (item) => (
        <div>
          <div className="font-semibold text-slate-100">{item.name}</div>
          <div className="text-xs text-slate-400 font-mono flex items-center gap-1">
            <MapPin className="w-3 h-3 text-slate-500" />
            {item.building} - {item.roomNumber}
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Room Type',
      render: (item) => (
        <Badge variant={item.type === 'LAB' ? 'purple' : item.type === 'SEMINAR' ? 'amber' : 'teal'}>
          {item.type}
        </Badge>
      ),
    },
    {
      key: 'capacity',
      header: 'Capacity',
      render: (item) => (
        <span className="flex items-center gap-1 text-xs text-slate-200 font-bold">
          <Users className="w-3.5 h-3.5 text-teal-400" />
          {item.capacity} seats
        </span>
      ),
    },
    {
      key: 'equipment',
      header: 'Facilities / Equipment',
      render: (item) => (
        <div className="flex flex-wrap gap-1 max-w-xs">
          {item.equipment?.map((eq, i) => (
            <span key={i} className="px-1.5 py-0.5 text-[10px] rounded bg-slate-800 text-slate-300 font-mono">
              {eq}
            </span>
          ))}
        </div>
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
              if (confirm(`Delete classroom '${item.name}'?`)) {
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
          <h1 className="text-2xl font-bold text-white tracking-tight">Classrooms & Laboratories</h1>
          <p className="text-xs text-slate-400 mt-0.5">Manage room capacities, laboratory assignments, and equipment tags</p>
        </div>
        <Button variant="teal" size="sm" onClick={handleOpenCreate} leftIcon={<Plus className="w-4 h-4" />}>
          Add Classroom
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={data?.classrooms || []}
        meta={data?.meta}
        isLoading={isLoading}
        searchPlaceholder="Search rooms by name, building, or room number..."
        onSearch={setSearch}
        onPageChange={setPage}
      />

      <Modal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        title={editingRoom ? 'Edit Classroom' : 'Add Classroom'}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate();
          }}
          className="space-y-4"
        >
          <Input
            label="Room Display Name"
            placeholder="Room 101 — Lecture Hall"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Building / Block"
              placeholder="CS Block"
              value={building}
              onChange={(e) => setBuilding(e.target.value)}
              required
            />

            <Input
              label="Room Number"
              placeholder="101"
              value={roomNumber}
              onChange={(e) => setRoomNumber(e.target.value)}
              required
            />

            <Input
              label="Seating Capacity"
              type="number"
              min={1}
              max={1000}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
              required
            />

            <Select
              label="Room Type"
              value={type}
              onChange={(e) => {
                const t = e.target.value as RoomType;
                setType(t);
                if (t === 'LAB') setIsLab(true);
              }}
              options={[
                { value: 'LECTURE', label: 'Lecture Hall' },
                { value: 'LAB', label: 'Laboratory' },
                { value: 'SEMINAR', label: 'Seminar / Auditorium' },
                { value: 'OTHER', label: 'Other' },
              ]}
            />
          </div>

          <Input
            label="Equipment Tags (Comma Separated)"
            placeholder="PROJECTOR, AC, SMART_BOARD, COMPUTERS"
            value={equipmentInput}
            onChange={(e) => setEquipmentInput(e.target.value)}
          />

          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={isLab}
              onChange={(e) => setIsLab(e.target.checked)}
              className="w-4 h-4 accent-teal-500 rounded cursor-pointer"
            />
            <span>Classroom has laboratory facilities (isLab = true)</span>
          </label>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <Button type="button" variant="secondary" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={saveMutation.isPending}>
              {editingRoom ? 'Update Room' : 'Save Classroom'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
