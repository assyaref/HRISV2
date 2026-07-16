import { useState } from 'react';
import { Download, FileText, Users, Clock, CalendarOff, Wallet } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Card, CardHeader, CardTitle, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Select, Input } from '../components/ui/Input';
import { useToast } from '../context/ToastContext';
import { formatCurrency, formatDate, exportToExcel } from '../lib/utils';
import { db } from '../lib/db';

type ReportType = 'employee' | 'attendance' | 'leave' | 'payroll';

const reportTypes = [
  { value: 'employee', label: 'Laporan Karyawan', icon: Users, color: 'text-primary bg-primary/10' },
  { value: 'attendance', label: 'Laporan Absensi', icon: Clock, color: 'text-sky-600 bg-sky-500/10' },
  { value: 'leave', label: 'Laporan Cuti', icon: CalendarOff, color: 'text-amber-600 bg-amber-500/10' },
  { value: 'payroll', label: 'Laporan Payroll', icon: Wallet, color: 'text-emerald-600 bg-emerald-500/10' },
];

export function ReportPage() {
  const toast = useToast();
  const [type, setType] = useState<ReportType>('employee');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [period, setPeriod] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const exportExcel = () => {
    let data: Record<string, unknown>[] = [];
    let filename = '';

    if (type === 'employee') {
      data = db.getEmployees().map((e) => ({
        'Employee ID': e.employeeId,
        Nama: e.fullName,
        NIK: e.nik,
        Email: e.email,
        Telepon: e.phone,
        Departemen: db.getDepartmentById(e.departmentId)?.name,
        Divisi: db.getDivisionById(e.divisionId)?.name,
        Jabatan: db.getPositionById(e.positionId)?.name,
        'Join Date': e.joinDate,
        Status: e.employmentStatus,
        Gaji: e.salary,
      }));
      filename = 'laporan-karyawan';
    } else if (type === 'attendance') {
      let list = db.getAttendances();
      if (dateFrom) list = list.filter((a) => a.date >= dateFrom);
      if (dateTo) list = list.filter((a) => a.date <= dateTo);
      data = list.map((a) => ({
        Tanggal: a.date,
        Karyawan: db.getEmployeeById(a.employeeId)?.fullName,
        'Check In': a.checkIn,
        'Check Out': a.checkOut,
        Status: a.status,
        'Jam Kerja': a.workHours,
        Terlambat: a.lateMinutes,
      }));
      filename = 'laporan-absensi';
    } else if (type === 'leave') {
      data = db.getLeaves().map((l) => ({
        Karyawan: db.getEmployeeById(l.employeeId)?.fullName,
        Tipe: l.leaveType,
        Mulai: l.startDate,
        Selesai: l.endDate,
        Hari: l.days,
        Alasan: l.reason,
        Status: l.status,
      }));
      filename = 'laporan-cuti';
    } else {
      data = db.getPayrolls()
        .filter((p) => !period || p.period === period)
        .map((p) => ({
          Periode: p.period,
          Karyawan: db.getEmployeeById(p.employeeId)?.fullName,
          'Gaji Pokok': p.basicSalary,
          Tunjangan: p.allowance,
          Lembur: p.overtime,
          Potongan: p.deduction,
          BPJS: p.bpjs,
          PPh21: p.pph21,
          'Gaji Bersih': p.netSalary,
          Status: p.status,
        }));
      filename = `laporan-payroll-${period}`;
    }

    exportToExcel(data, filename);
    toast.success(`Laporan ${filename} diexport ke Excel`);
  };

  const exportPDF = () => {
    const settings = db.getSettings();
    const doc = new jsPDF();
    const title = reportTypes.find((r) => r.value === type)?.label || 'Laporan';

    doc.setFontSize(16);
    doc.text(settings.companyName, 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(settings.companyAddress, 14, 27);
    doc.setTextColor(0);
    doc.setFontSize(14);
    doc.text(title, 14, 40);
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Dicetak: ${formatDate(new Date().toISOString())}`, 14, 47);
    doc.setTextColor(0);

    let head: string[][] = [];
    let body: string[][] = [];

    if (type === 'employee') {
      head = [['ID', 'Nama', 'Departemen', 'Jabatan', 'Status']];
      body = db.getEmployees().map((e) => [
        e.employeeId,
        e.fullName,
        db.getDepartmentById(e.departmentId)?.name || '-',
        db.getPositionById(e.positionId)?.name || '-',
        e.employmentStatus,
      ]);
    } else if (type === 'attendance') {
      let list = db.getAttendances();
      if (dateFrom) list = list.filter((a) => a.date >= dateFrom);
      if (dateTo) list = list.filter((a) => a.date <= dateTo);
      head = [['Tanggal', 'Karyawan', 'In', 'Out', 'Status']];
      body = list.slice(0, 50).map((a) => [
        a.date,
        db.getEmployeeById(a.employeeId)?.fullName || '-',
        a.checkIn || '-',
        a.checkOut || '-',
        a.status,
      ]);
    } else if (type === 'leave') {
      head = [['Karyawan', 'Tipe', 'Mulai', 'Selesai', 'Hari', 'Status']];
      body = db.getLeaves().map((l) => [
        db.getEmployeeById(l.employeeId)?.fullName || '-',
        l.leaveType,
        l.startDate,
        l.endDate,
        String(l.days),
        l.status,
      ]);
    } else {
      head = [['Karyawan', 'Periode', 'Gaji Pokok', 'Net', 'Status']];
      body = db
        .getPayrolls()
        .filter((p) => !period || p.period === period)
        .map((p) => [
          db.getEmployeeById(p.employeeId)?.fullName || '-',
          p.period,
          formatCurrency(p.basicSalary),
          formatCurrency(p.netSalary),
          p.status,
        ]);
    }

    autoTable(doc, {
      startY: 54,
      head,
      body,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [13, 71, 161] },
    });

    doc.save(`${title.toLowerCase().replace(/\s+/g, '-')}.pdf`);
    toast.success('Laporan PDF diunduh');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {reportTypes.map((r) => {
          const Icon = r.icon;
          return (
            <button
              key={r.value}
              onClick={() => setType(r.value as ReportType)}
              className={`p-5 rounded-2xl border text-left transition-all ${
                type === r.value
                  ? 'border-primary bg-primary/5 shadow-md shadow-primary/10'
                  : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-200'
              }`}
            >
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${r.color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <p className="mt-3 font-semibold text-slate-800 dark:text-slate-100 text-sm">{r.label}</p>
            </button>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filter & Export</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {(type === 'attendance' || type === 'leave') && (
              <>
                <Input label="Dari Tanggal" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="sm:w-44" />
                <Input label="Sampai Tanggal" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="sm:w-44" />
              </>
            )}
            {type === 'payroll' && (
              <Select
                label="Periode"
                options={Array.from({ length: 12 }, (_, i) => {
                  const d = new Date();
                  d.setMonth(d.getMonth() - i);
                  return {
                    value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
                    label: d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }),
                  };
                })}
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="sm:w-56"
              />
            )}
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button onClick={exportExcel}>
              <Download className="h-4 w-4" /> Export Excel
            </Button>
            <Button variant="secondary" onClick={exportPDF}>
              <FileText className="h-4 w-4" /> Export PDF
            </Button>
          </div>

          <div className="mt-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-sm text-slate-500">
            <p className="font-medium text-slate-700 dark:text-slate-300 mb-1">Preview ringkas:</p>
            {type === 'employee' && <p>{db.getEmployees().length} karyawan terdaftar</p>}
            {type === 'attendance' && <p>{db.getAttendances().length} record absensi</p>}
            {type === 'leave' && <p>{db.getLeaves().length} pengajuan cuti</p>}
            {type === 'payroll' && (
              <p>
                {db.getPayrolls().filter((p) => p.period === period).length} slip gaji periode {period}
              </p>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
