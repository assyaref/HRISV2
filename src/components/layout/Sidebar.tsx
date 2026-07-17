import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Clock,
  CalendarOff,
  Building2,
  GitBranch,
  Briefcase,
  Wallet,
  Megaphone,
  BarChart3,
  Settings,
  UserCircle,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  Shield,
  User,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import type { Role } from '../../types';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  roles?: Role[];
}

const navItems: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
  { to: '/employees', label: 'Karyawan', icon: <Users className="h-5 w-5" />, roles: ['Administrator', 'HR', 'Manager'] },
  { to: '/attendance', label: 'Absensi', icon: <Clock className="h-5 w-5" /> },
  { to: '/leave', label: 'Cuti', icon: <CalendarOff className="h-5 w-5" /> },
  { to: '/permission', label: 'Izin', icon: <ClipboardList className="h-5 w-5" /> },
  { to: '/payroll', label: 'Payroll', icon: <Wallet className="h-5 w-5" />, roles: ['Administrator', 'HR'] },
  { to: '/departments', label: 'Departemen', icon: <Building2 className="h-5 w-5" />, roles: ['Administrator', 'HR'] },
  { to: '/divisions', label: 'Divisi', icon: <GitBranch className="h-5 w-5" />, roles: ['Administrator', 'HR'] },
  { to: '/positions', label: 'Jabatan', icon: <Briefcase className="h-5 w-5" />, roles: ['Administrator', 'HR'] },
  { to: '/announcements', label: 'Pengumuman', icon: <Megaphone className="h-5 w-5" /> },
  { to: '/access', label: 'Akses', icon: <Shield className="h-5 w-5" />, roles: ['Administrator'] },
  { to: '/face-enrollment', label: 'Face ID', icon: <User className="h-5 w-5" /> },
  { to: '/reports', label: 'Laporan', icon: <BarChart3 className="h-5 w-5" />, roles: ['Administrator', 'HR', 'Manager'] },
  { to: '/profile', label: 'Profil', icon: <UserCircle className="h-5 w-5" /> },
  { to: '/settings', label: 'Pengaturan', icon: <Settings className="h-5 w-5" />, roles: ['Administrator'] },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const { session, hasRole } = useAuth();

  const filtered = navItems.filter((item) => {
    if (!item.roles) return true;
    return item.roles.some((r) => hasRole(r)) || session?.role === 'Administrator';
  });

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
      isActive
        ? 'bg-primary text-white shadow-md shadow-primary/25'
        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
    );

  const content = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={cn('flex items-center gap-3 px-4 h-16 border-b border-slate-100 dark:border-slate-800', collapsed && 'justify-center px-2')}>
        <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center shadow-md shadow-primary/30 shrink-0">
          <span className="text-white font-bold text-sm">HR</span>
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="font-bold text-slate-800 dark:text-white text-sm leading-tight truncate">HRIS Lite</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Enterprise</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {filtered.map((item) => (
          <NavLink key={item.to} to={item.to} className={linkClass} onClick={onMobileClose} title={collapsed ? item.label : undefined}>
            <span className="shrink-0">{item.icon}</span>
            {!collapsed && <span className="truncate">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Collapse toggle (desktop) */}
      <div className="hidden lg:flex border-t border-slate-100 dark:border-slate-800 p-3">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span>Ciutkan</span>
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden lg:flex flex-col fixed top-0 left-0 h-full z-30 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 transition-all duration-300',
          collapsed ? 'w-[72px]' : 'w-64'
        )}
      >
        {content}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onMobileClose} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-white dark:bg-slate-900 shadow-2xl animate-slide-right">
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
