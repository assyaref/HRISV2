import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { cn } from '../../lib/utils';

const titles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/employees': 'Data Karyawan',
  '/attendance': 'Absensi',
  '/leave': 'Manajemen Cuti',
  '/permission': 'Izin & Kehadiran',
  '/payroll': 'Payroll',
  '/departments': 'Departemen',
  '/divisions': 'Divisi',
  '/positions': 'Jabatan',
  '/announcements': 'Pengumuman',
  '/reports': 'Laporan',
  '/profile': 'Profil Saya',
  '/settings': 'Pengaturan',
};

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const title = titles[location.pathname] || 'HRIS Lite';

  return (
    <div className="min-h-screen bg-bg dark:bg-slate-950">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className={cn('transition-all duration-300', collapsed ? 'lg:ml-[72px]' : 'lg:ml-64')}>
        <Header onMenuClick={() => setMobileOpen(true)} title={title} />
        <main className="p-4 lg:p-6 max-w-[1600px]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
