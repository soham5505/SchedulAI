import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client.js';
import { useToast } from '../contexts/ToastContext.js';
import { IDepartment, PaginationMeta } from '@schedulai/shared-types';
import { DataTable, Column } from '../components/ui/DataTable.js';
import { Button } from '../components/ui/Button.js';
import { Modal } from '../components/ui/Modal.js';
import { Input } from '../components/ui/Input.js';
import { Badge } from '../components/ui/Badge.js';
import { Plus, Edit2, Trash2 } from 'lucide-react';

export const DepartmentsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<IDepartment | null>(null);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');

  const { data, isLoading } = useQuery<{ departments: IDepartment[]; meta: PaginationMeta }>({
    queryKey: ['departments', page, search],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '10' });
      if (search) params.append('search', search);

      const res = await apiClient.get<{ success: boolean; data: IDepartment[]; meta: PaginationMeta }>(
        `/departments?${params.toString()}`
      );
      return { departments: res.data.data, meta: res.data.meta! };
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingDept) {
        await apiClient.put(`/departments/${editingDept._id}`, { name, code, description });
      } else {
        await apiClient.post('/departments', { name, code, description });
      }
    },
    onSuccess: () => {
      toast.success(editingDept ? 'Department updated!' : 'Department created!');
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      handleCloseModal();
    },
    onError: (err) => {
      toast.error((err as Error).message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/departments/${id}`);
    },
    onSuccess: () => {
      toast.success('Department deleted');
      queryClient.invalidateQueries({ queryKey: ['departments'] });
    },
    onError: (err) => {
      toast.error((err as Error).message);
    },
  });

  const handleOpenCreate = () => {
    setEditingDept(null);
    setName('');
    setCode('');
    setDescription('');
    setModalOpen(true);
  };

  const handleOpenEdit = (dept: IDepartment) => {
    setEditingDept(dept);
    setName(dept.name);
    setCode(dept.code);
    setDescription(dept.description || '');
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingDept(null);
  };

  const columns: Column<IDepartment>[] = [
    {
      key: 'name',
      header: 'Department Name',
      render: (item) => (
        <div>
          <div className="font-semibold text-slate-100">{item.name}</div>
          {item.description && <div className="text-xs text-slate-400 truncate max-w-xs">{item.description}</div>}
        </div>
      ),
    },
    {
      key: 'code',
      header: 'Code',
      render: (item) => <Badge variant="teal">{item.code}</Badge>,
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (item) => <Badge variant={item.isActive ? 'emerald' : 'slate'}>{item.isActive ? 'Active' : 'Inactive'}</Badge>,
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
              if (confirm(`Delete department '${item.name}'?`)) {
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
          <h1 className="text-2xl font-bold text-white tracking-tight">Academic Departments</h1>
          <p className="text-xs text-slate-400 mt-0.5">Manage faculty divisions and departmental units</p>
        </div>
        <Button variant="teal" size="sm" onClick={handleOpenCreate} leftIcon={<Plus className="w-4 h-4" />}>
          Add Department
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={data?.departments || []}
        meta={data?.meta}
        isLoading={isLoading}
        searchPlaceholder="Search departments by name or code..."
        onSearch={setSearch}
        onPageChange={setPage}
      />

      <Modal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        title={editingDept ? 'Edit Department' : 'Create Department'}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate();
          }}
          className="space-y-4"
        >
          <Input
            label="Department Name"
            placeholder="e.g. Computer Science & Engineering"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <Input
            label="Department Code"
            placeholder="e.g. CSE"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            required
          />

          <Input
            label="Description (Optional)"
            placeholder="Department overview..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <Button type="button" variant="secondary" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={saveMutation.isPending}>
              {editingDept ? 'Update Department' : 'Create Department'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
