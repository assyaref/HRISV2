import { cn, statusColor, roleColor } from '../../lib/utils';
import type { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  status?: string;
  role?: string;
  className?: string;
  color?: string;
}

export function Badge({ children, status, role, className, color }: BadgeProps) {
  const colorClass = color || (status ? statusColor(status) : role ? roleColor(role) : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300');
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap', colorClass, className)}>
      {children}
    </span>
  );
}
