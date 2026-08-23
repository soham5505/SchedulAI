import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client.js';
import {
  Users,
  Building2,
  BookOpen,
  DoorOpen,
  GraduationCap,
  Calendar,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Clock,
  Upload,
  Cpu,
} from 'lucide-react';
import { Card } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { Badge } from '../components/ui/Badge.js';

interface DashboardStats {
  summary: {
    totalDepartments: number;
    totalTeachers: number;
    totalSubjects: number;
    totalClassrooms: number;
    totalSemesters: number;
    totalGenerations: number;
    totalTimetableEntries: number;
    totalAssignments: number;
    activeGenerations: number;
  };
  recentGenerations: Array<{
    _id: string;
    name: string;
    status: string;
    score: number;
    resultCount: number;
    createdAt: string;
    createdBy?: { name: string };
  }>;
  recentImports: Array<{
    _id: string;
    type: string;
    fileName: string;
    status: string;
    successRows: number;
    createdAt: string;
  }>;
  analytics: {
    classroomTypes: Record<string, number>;
    teachersByDepartment: Record<string, number>;
  };
}

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: DashboardStats }>('/dashboard/stats');
      return res.data.data;
    },
    refetchInterval: 10000,
  });

  const statCards = [
    {
      label: 'Departments',
      value: stats?.summary.totalDepartments ?? 0,
      icon: Building2,
      color: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
      path: '/departments',
    },
    {
      label: 'Faculty Members',
      value: stats?.summary.totalTeachers ?? 0,
      icon: Users,
      color: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
      path: '/teachers',
    },
    {
      label: 'Courses / Subjects',
      value: stats?.summary.totalSubjects ?? 0,
      icon: BookOpen,
      color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
      path: '/subjects',
    },
    {
      label: 'Classrooms & Labs',
      value: stats?.summary.totalClassrooms ?? 0,
      icon: DoorOpen,
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      path: '/classrooms',
    },
    {
      label: 'Semester Batches',
      value: stats?.summary.totalSemesters ?? 0,
      icon: GraduationCap,
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      path: '/semesters',
    },
    {
      label: 'Scheduled Classes',
      value: stats?.summary.totalTimetableEntries ?? 0,
      icon: Calendar,
      color: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
      path: '/timetable',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-teal-500/20 bg-gradient-to-r from-slate-900 via-teal-950/40 to-slate-900 p-6 sm:p-8 shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <Badge variant="teal" size="sm" className="mb-1">
              <Sparkles className="w-3.5 h-3.5" /> AI Timetable Optimization
            </Badge>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Optimize Institutional Schedules with Mathematical Precision
            </h1>
            <p className="text-xs sm:text-sm text-slate-300">
              Eliminate teacher clashes, classroom double-bookings, and student workload imbalances automatically using Google OR-Tools CP-SAT.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="teal"
              size="lg"
              onClick={() => navigate('/generate')}
              leftIcon={<Sparkles className="w-4 h-4" />}
            >
              Generate Schedule
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => navigate('/timetable')}
              leftIcon={<Calendar className="w-4 h-4" />}
            >
              View Timetable
            </Button>
          </div>
        </div>
      </div>

      {/* Metric Counters Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <Card
              key={idx}
              onClick={() => navigate(card.path)}
              className="p-4 cursor-pointer hover:border-slate-700 transition hover:scale-[1.02] flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <div className={`p-2 rounded-xl border ${card.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold text-white tracking-tight">
                  {isLoading ? '...' : card.value}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">{card.label}</div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Analytics & System Health Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Schedule Generations */}
        <Card className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="font-bold text-slate-100">Recent Generation Runs</h3>
              <p className="text-xs text-slate-400">Latest optimized timetable solver runs</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/generations')}
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              View All History
            </Button>
          </div>

          <div className="space-y-2.5">
            {!stats?.recentGenerations || stats.recentGenerations.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                No schedule generation history yet. Run your first generation!
              </div>
            ) : (
              stats.recentGenerations.map((gen) => (
                <div
                  key={gen._id}
                  onClick={() => navigate(`/timetable?generationId=${gen._id}`)}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-slate-800 bg-slate-950/40 hover:bg-slate-800/40 cursor-pointer transition"
                >
                  <div className="space-y-1">
                    <div className="font-semibold text-sm text-slate-200">{gen.name}</div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span>{gen.resultCount} classes assigned</span>
                      <span>•</span>
                      <span>{new Date(gen.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Badge variant={gen.status === 'COMPLETED' ? 'emerald' : gen.status === 'RUNNING' ? 'amber' : 'rose'}>
                      {gen.status}
                    </Badge>
                    {gen.score > 0 && (
                      <span className="text-xs font-mono font-bold text-teal-400">
                        Score: {gen.score.toFixed(0)}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Engine Monitor & Quick Tools */}
        <div className="space-y-6">
          <Card className="space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
              <Cpu className="w-5 h-5 text-teal-400" />
              <div>
                <h3 className="font-bold text-sm text-slate-100">Solver Engine Status</h3>
                <p className="text-[11px] text-slate-400">Google OR-Tools CP-SAT Worker</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/50 border border-slate-800">
                <span className="text-slate-400">Algorithm</span>
                <span className="font-mono text-slate-200">Constraint Programming</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/50 border border-slate-800">
                <span className="text-slate-400">Hard Constraints</span>
                <Badge variant="emerald">8 Active (100% Enforced)</Badge>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/50 border border-slate-800">
                <span className="text-slate-400">Soft Constraint Scoring</span>
                <Badge variant="teal">Multi-Objective</Badge>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={() => navigate('/import')}
              leftIcon={<Upload className="w-3.5 h-3.5" />}
            >
              Import Academic Data (Excel/CSV)
            </Button>
          </Card>

          {/* Classroom Type Breakdown */}
          {stats?.analytics.classroomTypes && (
            <Card className="space-y-3">
              <h4 className="font-semibold text-xs text-slate-300 uppercase tracking-wider">
                Classroom Infrastructure
              </h4>
              <div className="space-y-2 text-xs">
                {Object.entries(stats.analytics.classroomTypes).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className="text-slate-400">{type}</span>
                    <span className="font-semibold text-slate-200">{count} rooms</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
