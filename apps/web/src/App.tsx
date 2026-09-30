import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext.js';
import { ToastProvider } from './contexts/ToastContext.js';

import { AuthLayout } from './layouts/AuthLayout.js';
import { AppLayout } from './layouts/AppLayout.js';

import { LoginPage } from './pages/LoginPage.js';
import { RegisterPage } from './pages/RegisterPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { TimetablePage } from './pages/TimetablePage.js';
import { GeneratePage } from './pages/GeneratePage.js';
import { GenerationsPage } from './pages/GenerationsPage.js';
import { DepartmentsPage } from './pages/DepartmentsPage.js';
import { TeachersPage } from './pages/TeachersPage.js';
import { SubjectsPage } from './pages/SubjectsPage.js';
import { ClassroomsPage } from './pages/ClassroomsPage.js';
import { SemestersPage } from './pages/SemestersPage.js';
import { TimeSlotsPage } from './pages/TimeSlotsPage.js';
import { AssignmentsPage } from './pages/AssignmentsPage.js';
import { ImportPage } from './pages/ImportPage.js';
import { ExportPage } from './pages/ExportPage.js';
import { AuditLogsPage } from './pages/AuditLogsPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { LabReservationsPage } from './pages/LabReservationsPage.js';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30000,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Auth Routes */}
              <Route element={<AuthLayout />}>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
              </Route>

              {/* Main Application Protected Routes */}
              <Route element={<AppLayout />}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/timetable" element={<TimetablePage />} />
                <Route path="/generate" element={<GeneratePage />} />
                <Route path="/generations" element={<GenerationsPage />} />
                <Route path="/departments" element={<DepartmentsPage />} />
                <Route path="/teachers" element={<TeachersPage />} />
                <Route path="/subjects" element={<SubjectsPage />} />
                <Route path="/classrooms" element={<ClassroomsPage />} />
                <Route path="/semesters" element={<SemestersPage />} />
                <Route path="/timeslots" element={<TimeSlotsPage />} />
                <Route path="/assignments" element={<AssignmentsPage />} />
                <Route path="/lab-reservations" element={<LabReservationsPage />} />
                <Route path="/import" element={<ImportPage />} />
                <Route path="/export" element={<ExportPage />} />
                <Route path="/audit-logs" element={<AuditLogsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
};
