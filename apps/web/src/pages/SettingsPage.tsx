import React from 'react';
import { useAuth } from '../contexts/AuthContext.js';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client.js';
import { Card } from '../components/ui/Card.js';
import { Badge } from '../components/ui/Badge.js';
import { Button } from '../components/ui/Button.js';
import { User, Shield, Cpu, Database, CheckCircle2, Server } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();

  const { data: health, isLoading } = useQuery<{
    status: string;
    service: string;
    database: string;
    scheduler: string;
  }>({
    queryKey: ['system-health'],
    queryFn: async () => {
      const res = await apiClient.get('/health', { baseURL: '' });
      return res.data;
    },
    refetchInterval: 15000,
  });

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Account & System Settings</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          View current profile credentials, security role, and backend engine status
        </p>
      </div>

      {/* User Profile Card */}
      <Card className="space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20 flex items-center justify-center font-bold">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-100">User Profile</h3>
            <p className="text-xs text-slate-400">Authenticated user details</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-slate-400">Full Name</span>
            <div className="font-semibold text-slate-100 mt-0.5 text-sm">{user?.name}</div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-slate-400">Email Address</span>
            <div className="font-semibold text-slate-100 mt-0.5 text-sm">{user?.email}</div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-slate-400">Role & Permissions</span>
            <div className="mt-1">
              <Badge variant="teal">{user?.role}</Badge>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-slate-400">Account Status</span>
            <div className="mt-1">
              <Badge variant={user?.isActive ? 'emerald' : 'rose'}>
                {user?.isActive ? 'Active / Verified' : 'Inactive'}
              </Badge>
            </div>
          </div>
        </div>
      </Card>

      {/* Infrastructure Health Status */}
      <Card className="space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-100">Microservice Health</h3>
            <p className="text-xs text-slate-400">Live service heartbeat & connectivity checks</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">API Gateway</span>
              <Badge variant="emerald">Live</Badge>
            </div>
            <div className="font-mono text-[11px] text-slate-300">Node.js Express TypeScript</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">OR-Tools Solver</span>
              <Badge variant={health?.scheduler === 'available' ? 'emerald' : 'rose'}>
                {health?.scheduler === 'available' ? 'Connected' : 'Unavailable'}
              </Badge>
            </div>
            <div className="font-mono text-[11px] text-slate-300">Python FastAPI CP-SAT</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Database</span>
              <Badge variant={health?.database === 'connected' ? 'emerald' : 'amber'}>
                {health?.database || 'Connected'}
              </Badge>
            </div>
            <div className="font-mono text-[11px] text-slate-300">MongoDB Mongoose</div>
          </div>
        </div>
      </Card>
    </div>
  );
};
