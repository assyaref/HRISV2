import { NavLink } from 'react-router-dom';
import { CalendarOff, ClipboardList, Clock, House, UserCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

const items = [
  { to: '/dashboard', label: 'Beranda', icon: House },
  { to: '/attendance', label: 'Absensi', icon: Clock },
  { to: '/leave', label: 'Cuti', icon: CalendarOff },
  { to: '/permission', label: 'Izin', icon: ClipboardList },
  { to: '/profile', label: 'Profil', icon: UserCircle },
];

/** Mobile-first navigation dedicated to the Employee PWA. */
export function EmployeeBottomNav() {
  return (
    <nav aria-label="Navigasi karyawan" className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5 h-16">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => cn('flex flex-col items-center justify-center gap-1 text-[10px] font-medium', isActive ? 'text-primary' : 'text-slate-500 dark:text-slate-400')}>
            {({ isActive }) => <><Icon className={cn('h-5 w-5', isActive && 'stroke-[2.5]')} /><span>{label}</span></>}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
