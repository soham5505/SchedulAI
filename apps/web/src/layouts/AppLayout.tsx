import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.js';
import {
  LayoutDashboard,
  Calendar,
  Sparkles,
  History,
  Building2,
  Users,
  BookOpen,
  DoorOpen,
  GraduationCap,
  Clock,
  Link as LinkIcon,
  Lock,
  Upload,
  Download,
  ShieldAlert,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react';
import { Button } from '../components/ui/Button.js';
import { Badge } from '../components/ui/Badge.js';
import { cn } from '../utils/cn.js';

export const AppLayout: React.FC = () => {
  const { user, isAuthenticated, isLoading, logout, hasRole } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-slate-400 font-medium">Loading SchedulAI...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const navGroups = [
    {
      title: 'Core Engine',
      items: [
        { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
        { label: 'Timetable Matrix', path: '/timetable', icon: Calendar },
        { label: 'AI Generator', path: '/generate', icon: Sparkles, badge: 'AI' },
        { label: 'Generation History', path: '/generations', icon: History },
      ],
    },
    {
      title: 'Academic Data',
      items: [
        { label: 'Departments', path: '/departments', icon: Building2 },
        { label: 'Faculty & Teachers', path: '/teachers', icon: Users },
        { label: 'Courses & Subjects', path: '/subjects', icon: BookOpen },
        { label: 'Classrooms & Labs', path: '/classrooms', icon: DoorOpen },
        { label: 'Semesters & Batches', path: '/semesters', icon: GraduationCap },
        { label: 'Time Slots', path: '/timeslots', icon: Clock },
        { label: 'Teaching Assignments', path: '/assignments', icon: LinkIcon },
        { label: 'Lab Reservations', path: '/lab-reservations', icon: Lock },
      ],
    },
    {
      title: 'Operations',
      items: [
        { label: 'Import Excel / CSV', path: '/import', icon: Upload },
        { label: 'Export Timetables', path: '/export', icon: Download },
        ...(hasRole('ADMIN') ? [{ label: 'Audit Logs', path: '/audit-logs', icon: ShieldAlert }] : []),
        { label: 'Settings', path: '/settings', icon: Settings },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex overflow-hidden">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={cn(
          'fixed lg:static inset-y-0 left-0 z-50 w-72 bg-slate-900 border-r border-slate-800 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 no-print',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Brand */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center text-slate-950 shadow-lg shadow-teal-500/20 group-hover:scale-105 transition">
              <Calendar className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="font-bold text-lg leading-none tracking-tight flex items-center gap-1.5">
                Schedul<span className="text-teal-400">AI</span>
              </div>
              <div className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">
                OR-Tools Engine
              </div>
            </div>
          </div>

          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {navGroups.map((grp, idx) => (
            <div key={idx} className="space-y-1.5">
              <div className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {grp.title}
              </div>
              <div className="space-y-0.5">
                {grp.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;

                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        'flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition duration-150 group',
                        isActive
                          ? 'bg-teal-500/10 text-teal-300 border border-teal-500/30 shadow-sm'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Icon
                          className={cn(
                            'w-4 h-4 transition',
                            isActive ? 'text-teal-400' : 'text-slate-400 group-hover:text-slate-200'
                          )}
                        />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* User Card & Logout */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-teal-600/20 text-teal-300 border border-teal-500/30 flex items-center justify-center font-bold text-xs shrink-0">
                {user?.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-200 truncate">{user?.name}</div>
                <div className="text-[11px] text-slate-400 truncate">{user?.email}</div>
              </div>
            </div>
            <Badge variant="teal" size="sm">
              {user?.role}
            </Badge>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="w-full text-slate-400 hover:text-rose-300 hover:bg-rose-950/30"
            leftIcon={<LogOut className="w-3.5 h-3.5" />}
          >
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-16 border-b border-slate-800 bg-slate-900/60 backdrop-blur-xl px-4 lg:px-8 flex items-center justify-between shrink-0 no-print z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 font-medium">
              <span>SchedulAI</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
              <span className="text-slate-200 capitalize">
                {location.pathname.replace('/', '') || 'Dashboard'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="teal"
              size="sm"
              onClick={() => navigate('/generate')}
              leftIcon={<Sparkles className="w-3.5 h-3.5" />}
            >
              Generate Timetable
            </Button>
          </div>
        </header>

        {/* Scrollable Page Body */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
