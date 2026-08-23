import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client.js';
import { IAuditLog, PaginationMeta } from '@schedulai/shared-types';
import { DataTable, Column } from '../components/ui/DataTable.js';
import { Badge } from '../components/ui/Badge.js';
import { ShieldCheck, User, Clock, Terminal } from 'lucide-react';

export const AuditLogsPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery<{ logs: IAuditLog[]; meta: PaginationMeta }>({
    queryKey: ['audit-logs', page, search],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '15' });
      if (search) params.append('search', search);

      const res = await apiClient.get<{ success: boolean; data: IAuditLog[]; meta: PaginationMeta }>(
        `/audit-logs?${params.toString()}`
      );
      return { logs: res.data.data, meta: res.data.meta! };
    },
  });

  const columns: Column<IAuditLog>[] = [
    {
      key: 'timestamp',
      header: 'Timestamp',
      render: (item) => (
        <span className="text-xs font-mono text-slate-300">
          {new Date(item.timestamp).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'user',
      header: 'User / Actor',
      render: (item) => (
        <div>
          <div className="font-semibold text-slate-100">{item.userName || 'System'}</div>
          <div className="text-[11px] text-slate-400">{item.userEmail}</div>
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      render: (item) => {
        const variants = {
          CREATE: 'emerald',
          UPDATE: 'teal',
          DELETE: 'rose',
          LOGIN: 'blue',
          LOGOUT: 'slate',
          GENERATE_TIMETABLE: 'purple',
          IMPORT_DATA: 'amber',
          EXPORT_DATA: 'blue',
          RESTORE_VERSION: 'teal',
          AI_QUERY: 'purple',
        };
        return <Badge variant={(variants[item.action as keyof typeof variants] || 'slate') as any}>{item.action}</Badge>;
      },
    },
    {
      key: 'entity',
      header: 'Entity / Target',
      render: (item) => (
        <span className="font-mono text-xs text-slate-300">
          {item.entity} {item.entityId ? `(${item.entityId.slice(-6)})` : ''}
        </span>
      ),
    },
    {
      key: 'ipAddress',
      header: 'IP Address',
      render: (item) => <span className="font-mono text-xs text-slate-400">{item.ipAddress || '127.0.0.1'}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">System Audit & Compliance Logs</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Immutable audit trail recording all administrative mutations, logins, imports, and generations
        </p>
      </div>

      <DataTable
        columns={columns}
        data={data?.logs || []}
        meta={data?.meta}
        isLoading={isLoading}
        searchPlaceholder="Search audit logs by user, action, or entity..."
        onSearch={setSearch}
        onPageChange={setPage}
      />
    </div>
  );
};
