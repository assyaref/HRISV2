import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { AppLayout } from './components/layout/AppLayout';
import { LoadingScreen } from './components/ui/LoadingScreen';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { EmployeePage } from './pages/EmployeePage';
import { AttendancePage } from './pages/AttendancePage';
import { LeavePage } from './pages/LeavePage';
import { PermissionPage } from './pages/PermissionPage';
import { PayrollPage } from './pages/PayrollPage';
import { MasterDataPage } from './pages/MasterDataPage';
import { AnnouncementPage } from './pages/AnnouncementPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { ReportPage } from './pages/ReportPage';
import type { Role } from './types';

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: Role[] }) {
  const { session, loading, hasRole } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!session) return <Navigate to="/login" replace />;
  if (roles && !roles.some((r) => hasRole(r)) && session.role !== 'Administrator') {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  const { session, loading } = useAuth();
  const [boot, setBoot] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setBoot(false), 800);
    return () => clearTimeout(t);
  }, []);

  if (boot || loading) return <LoadingScreen message="Memuat HRIS Lite Enterprise..." />;

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route
          path="employees"
          element={
            <ProtectedRoute roles={['Administrator', 'HR', 'Manager']}>
              <EmployeePage />
            </ProtectedRoute>
          }
        />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="leave" element={<LeavePage />} />
        <Route path="permission" element={<PermissionPage />} />
        <Route path="payroll" element={<PayrollPage />} />
        <Route
          path="departments"
          element={
            <ProtectedRoute roles={['Administrator', 'HR']}>
              <MasterDataPage type="department" />
            </ProtectedRoute>
          }
        />
        <Route
          path="divisions"
          element={
            <ProtectedRoute roles={['Administrator', 'HR']}>
              <MasterDataPage type="division" />
            </ProtectedRoute>
          }
        />
        <Route
          path="positions"
          element={
            <ProtectedRoute roles={['Administrator', 'HR']}>
              <MasterDataPage type="position" />
            </ProtectedRoute>
          }
        />
        <Route path="announcements" element={<AnnouncementPage />} />
        <Route
          path="reports"
          element={
            <ProtectedRoute roles={['Administrator', 'HR', 'Manager']}>
              <ReportPage />
            </ProtectedRoute>
          }
        />
        <Route path="profile" element={<ProfilePage />} />
        <Route
          path="settings"
          element={
            <ProtectedRoute roles={['Administrator']}>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to={session ? '/dashboard' : '/login'} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <HashRouter>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </HashRouter>
  );
}
