import type { Employee, Payroll, PayrollStatus } from '../types';

/**
 * Helper khusus modul Payroll — password slip & label status slip.
 *
 * Konvensi password (sesuai spesifikasi):
 *   password = {NIK}{DD}{MM}{YYYY} dari tanggal lahir karyawan.
 *   Contoh: NIK 12345, lahir 15-08-1995  ->  "1234515081995"
 * Jika NIK kosong, fallback ke employeeId (kode NIP) agar tetap deterministik.
 */
export function buildSlipPassword(emp: Pick<Employee, 'nik' | 'employeeId' | 'birthDate'> | null | undefined): string {
  const base = String(emp?.nik || emp?.employeeId || '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(emp?.birthDate || '');
  if (!base || !m) return '';
  // m[1]=YYYY, m[2]=MM, m[3]=DD -> susun DD MM YYYY
  return `${base}${m[3]}${m[2]}${m[1]}`;
}

/** Label status slip untuk ditampilkan di tabel (kompatibel dgn status lama). */
export function slipStatusLabel(p: Pick<Payroll, 'status' | 'slipUrl' | 'slipSentAt'>): PayrollStatus {
  const raw = String(p.status || '');
  if (raw === 'Terkirim' || p.slipSentAt) return 'Terkirim';
  if (raw === 'Slip Tersedia' || p.slipUrl) return 'Slip Tersedia';
  if (raw === 'Paid') return 'Terkirim';
  return 'Draft'; // 'Draft' / 'Generated' / kosong -> slip belum ada
}

/** Nama file slip yang stabil, mis. slip-EMP001-2026-08.pdf */
export function slipFileName(empKey: string | undefined, period: string): string {
  return `slip-${String(empKey || 'unknown').replace(/[^\w-]+/g, '')}-${period}.pdf`;
}

/** Format periode "2026-08" -> "2026-08" (untuk folder Drive sudah pakai YYYY-MM). */
export function periodFromIso(period: string): { year: string; month: string } {
  const [year = '', month = ''] = String(period).split('-');
  return { year, month };
}
