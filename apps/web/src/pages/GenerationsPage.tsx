import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client.js';
import { useToast } from '../contexts/ToastContext.js';
import { IGeneration, PaginationMeta } from '@schedulai/shared-types';
import { DataTable, Column } from '../components/ui/DataTable.js';
import { Button } from '../components/ui/Button.js';
import { Badge } from '../components/ui/Badge.js';
import { Eye, RotateCcw, Trash2, Calendar, Sparkles } from 'lucide-react';

export const GenerationsPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery<{
    generations: IGeneration[];
    meta: PaginationMeta;
  }>({
    queryKey: ['generations-history', page, search],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '15' });
      if (search) params.append('search', search);

      const res = await apiClient.get<{ success: boolean; data: IGeneration[]; meta: PaginationMeta }>(
        `/generations?${params.toString()}`
      );
      return { generations: res.data.data, meta: res.data.meta! };
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post<{ success: boolean; data: { restoredGeneration: IGeneration } }>(
        `/generations/${id}/restore`
      );
      return res.data;
    },
    onSuccess: (res) => {
      toast.success('Version restored into a new active schedule!');
      queryClient.invalidateQueries({ queryKey: ['generations-history'] });
      navigate(`/timetable?generationId=${res.data.restoredGeneration._id}`);
    },
    onError: (err) => {
      toast.error((err as Error).message, 'Restore Failed');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/generations/${id}`);
    },
    onSuccess: () => {
      toast.success('Generation record removed');
      queryClient.invalidateQueries({ queryKey: ['generations-history'] });
    },
    onError: (err) => {
      toast.error((err as Error).message, 'Delete Failed');
    },
  });

  const columns: Column<IGeneration>[] = [
    {
      key: 'name',
      header: 'Run Name / Version',
      render: (item) => (
        <div className="space-y-0.5">
          <div className="font-semibold text-slate-100">{item.name}</div>
          <div className="text-xs text-slate-400 font-mono">Version v{item.version || 1}</div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) => (
        <Badge
          variant={
            item.status === 'COMPLETED'
              ? 'emerald'
              : item.status === 'RUNNING'
              ? 'amber'
              : item.status === 'FAILED'
              ? 'rose'
              : 'slate'
          }
        >
          {item.status}
        </Badge>
      ),
    },
    {
      key: 'score',
      header: 'Optimization Score',
      render: (item) => (
        <span className="font-mono text-xs font-bold text-teal-400">
          {item.score > 0 ? `${item.score.toFixed(1)}/100` : 'N/A'}
        </span>
      ),
    },
    {
      key: 'resultCount',
      header: 'Scheduled Periods',
      render: (item) => (
        <span className="text-xs text-slate-300 font-medium">{item.resultCount} sessions</span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Date Created',
      render: (item) => (
        <span className="text-xs text-slate-400">
          {new Date(item.createdAt).toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item) => (
        <div className="flex items-center gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate(`/timetable?generationId=${item._id}`)}
            leftIcon={<Eye className="w-3.5 h-3.5" />}
          >
            View
          </Button>

          <Button
            variant="outline"
            size="sm"
            isLoading={restoreMutation.isPending}
            onClick={() => {
              if (confirm(`Restore schedule version v${item.version || 1} as active?`)) {
                restoreMutation.mutate(item._id);
              }
            }}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            Restore
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/40"
            onClick={() => {
              if (confirm('Are you sure you want to delete this generation history?')) {
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
          <h1 className="text-2xl font-bold text-white tracking-tight">Generation History & Versioning</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit, compare, and restore previously optimized timetable snapshots
          </p>
        </div>

        <Button
          variant="teal"
          size="sm"
          onClick={() => navigate('/generate')}
          leftIcon={<Sparkles className="w-3.5 h-3.5" />}
        >
          New Schedule Run
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={data?.generations || []}
        meta={data?.meta}
        isLoading={isLoading}
        searchPlaceholder="Search runs by name..."
        onSearch={setSearch}
        onPageChange={setPage}
      />
    </div>
  );
};
