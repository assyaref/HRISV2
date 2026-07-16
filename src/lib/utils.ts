import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO, differenceInYears, differenceInCalendarDays, isSameMonth, isSameDay } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date, pattern = 'dd MMM yyyy'): string {
  try {
    const d = typeof date === 'string' ? parseISO(date) : date;
    return format(d, pattern, { locale: localeId });
  } catch {
    return String(date);
  }
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatTime(time?: string): string {
  if (!time) return '-';
  return time.slice(0, 5);
}

export function getAge(birthDate: string): number {
  try {
    return differenceInYears(new Date(), parseISO(birthDate));
  } catch {
    return 0;
  }
}

export function calcLeaveDays(start: string, end: string): number {
  try {
    return differenceInCalendarDays(parseISO(end), parseISO(start)) + 1;
  } catch {
    return 1;
  }
}

export function isBirthdayThisMonth(birthDate: string): boolean {
  try {
    return isSameMonth(parseISO(birthDate), new Date());
  } catch {
    return false;
  }
}

export function isToday(date: string): boolean {
  try {
    return isSameDay(parseISO(date), new Date());
  } catch {
    return false;
  }
}

export function todayStr(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function generateToken(): string {
  return `tok_${Date.now()}_${Math.random().toString(36).slice(2, 16)}`;
}

export function generateEmployeeId(existing: string[]): string {
  const nums = existing
    .map((id) => parseInt(id.replace(/\D/g, ''), 10))
    .filter((n) => !isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `EMP${String(next).padStart(3, '0')}`;
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    Active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    'On Leave': 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    Resigned: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    Probation: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    Present: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    Late: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    Absent: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    Pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    'Approved Manager': 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
    'Approved HR': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    Approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    Rejected: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    Cancelled: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    Draft: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    Generated: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
    Paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    High: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
    Urgent: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    Normal: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    Low: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  };
  return map[status] || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
}

export function roleColor(role: string): string {
  const map: Record<string, string> = {
    Administrator: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
    HR: 'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300',
    Manager: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
    Employee: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  };
  return map[role] || 'bg-slate-100 text-slate-700';
}

export function debounce<T extends (...args: never[]) => void>(fn: T, ms = 300) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function compressImage(file: File, maxWidth = 800, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas not supported'));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation tidak didukung browser'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });
  });
}

export function exportToExcel(data: Record<string, unknown>[], filename: string) {
  import('xlsx').then((XLSX) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, `${filename}.xlsx`);
  });
}

export function paginate<T>(items: T[], page: number, perPage: number) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const current = Math.min(Math.max(1, page), totalPages);
  const start = (current - 1) * perPage;
  return {
    data: items.slice(start, start + perPage),
    page: current,
    perPage,
    total,
    totalPages,
  };
}

export function sortBy<T>(items: T[], key: keyof T, dir: 'asc' | 'desc' = 'asc'): T[] {
  return [...items].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (av == null) return 1;
    if (bv == null) return -1;
    if (av < bv) return dir === 'asc' ? -1 : 1;
    if (av > bv) return dir === 'asc' ? 1 : -1;
    return 0;
  });
}
