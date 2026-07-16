import { cn } from '../../lib/utils';
import type { ReactNode } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: number;
  subtitle?: string;
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  loading?: boolean;
}

const colorMap = {
  primary: 'from-primary/10 to-primary/5 text-primary',
  success: 'from-emerald-500/10 to-emerald-500/5 text-emerald-600',
  warning: 'from-amber-500/10 to-amber-500/5 text-amber-600',
  danger: 'from-red-500/10 to-red-500/5 text-red-600',
  info: 'from-sky-500/10 to-sky-500/5 text-sky-600',
};

const iconBg = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-emerald-500/10 text-emerald-600',
  warning: 'bg-amber-500/10 text-amber-600',
  danger: 'bg-red-500/10 text-red-600',
  info: 'bg-sky-500/10 text-sky-600',
};

export function StatCard({ title, value, icon, trend, subtitle, color = 'primary', loading }: StatCardProps) {
  if (loading) {
    return (
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 shadow-soft animate-pulse">
        <div className="flex justify-between">
          <div className="space-y-3 flex-1">
            <div className="h-3 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-7 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
          </div>
          <div className="h-12 w-12 bg-slate-200 dark:bg-slate-700 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('rounded-2xl bg-gradient-to-br border border-slate-100 dark:border-slate-800 p-5 shadow-soft bg-white dark:bg-slate-900', colorMap[color])}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{title}</p>
          <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{value}</p>
          {(trend !== undefined || subtitle) && (
            <div className="flex items-center gap-1.5 mt-1">
              {trend !== undefined && (
                <span className={cn('inline-flex items-center gap-0.5 text-xs font-medium', trend >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                  {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {Math.abs(trend)}%
                </span>
              )}
              {subtitle && <span className="text-xs text-slate-400">{subtitle}</span>}
            </div>
          )}
        </div>
        <div className={cn('h-12 w-12 rounded-xl flex items-center justify-center', iconBg[color])}>{icon}</div>
      </div>
    </div>
  );
}
