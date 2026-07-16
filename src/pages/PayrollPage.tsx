import { useEffect, useState, useCallback } from 'react';
import { Download, FileText, Play, Pencil } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as api from '../services/api';
import type { Payroll } from '../types';
import { Card, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Input, Select } from '../components/ui/Input';
import { DataTable, type Column } from '../components/ui/DataTable';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, exportToExcel } from '../lib/utils';
import { db } from '../lib/db';

export function PayrollPage() {
  const toast = useToast();
  const { session, isHR } = useAuth();
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [period, setPeriod] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<Payroll | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const filters: { period?: string; employeeId?: string } = { period };
    if (!isHR && session?.employeeId) filters.employeeId = session.employeeId;
    const res = await api.getPayrolls(filters);
    if (res.success && res.data) setPayrolls(res.data);
    setLoading(false);
  }, [period, session, isHR]);

  useEffect(() => { load(); }, [load]);

  const handleGenerate = async () => {
    setGenerating(true);
    const res = await api.generatePayroll(period);
    setGenerating(false);
    if (res.success) {
      toast.success(res.message);
      load();
    } else toast.error(res.message);
  };

  const handleExportExcel = () => {
    exportToExcel(
      payrolls.map((p) => ({
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
      })),
      `payroll-${period}`
    );
    toast.success('Payroll diexport');
  };

  const handleSlipPDF = (p: Payroll) => {
    const emp = db.getEmployeeById(p.employeeId);
    const settings = db.getSettings();
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(settings.companyName, 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(settings.companyAddress, 14, 27);
    doc.setTextColor(0);
    doc.setFontSize(14);
    doc.text('SLIP GAJI', 14, 40);
    doc.setFontSize(10);
    doc.text(`Periode: ${p.period}`, 14, 48);
    doc.text(`Nama: ${emp?.fullName || '-'}`, 14, 55);
    doc.text(`NIP: ${emp?.employeeId || '-'}`, 14, 62);
    doc.text(`Jabatan: ${db.getPositionById(emp?.positionId || '')?.name || '-'}`, 14, 69);

    autoTable(doc, {
      startY: 78,
      head: [['Komponen', 'Jumlah']],
      body: [
        ['Gaji Pokok', formatCurrency(p.basicSalary)],
        ['Tunjangan', formatCurrency(p.allowance)],
        ['Lembur', formatCurrency(p.overtime)],
        ['Potongan', `-${formatCurrency(p.deduction)}`],
        ['BPJS', `-${formatCurrency(p.bpjs)}`],
        ['PPh21', `-${formatCurrency(p.pph21)}`],
        ['Gaji Bersih', formatCurrency(p.netSalary)],
      ],
      styles: { fontSize: 10 },
      headStyles: { fillColor: [13, 71, 161] },
    });

    doc.setFontSize(9);
    doc.setTextColor(120);
    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY || 150;
    doc.text('Dokumen ini digenerate otomatis oleh HRIS Lite Enterprise', 14, finalY + 15);
    doc.save(`slip-gaji-${emp?.employeeId || p.employeeId}-${p.period}.pdf`);
    toast.success('Slip gaji diunduh');
  };

  const openEdit = (p: Payroll) => {
    setEditForm({ ...p });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editForm) return;
    setSaving(true);
    const res = await api.updatePayroll(editForm.id, editForm);
    setSaving(false);
    if (res.success) {
      toast.success(res.message);
      setEditOpen(false);
      load();
    } else toast.error(res.message);
  };

  const columns: Column<Payroll & Record<string, unknown>>[] = [
    {
      key: 'employeeId',
      label: 'Karyawan',
      render: (row) => {
        const emp = db.getEmployeeById(row.employeeId);
        return (
          <div>
            <p className="font-medium">{emp?.fullName || row.employeeId}</p>
            <p className="text-xs text-slate-400">{emp?.employeeId}</p>
          </div>
        );
      },
    },
    { key: 'period', label: 'Periode', sortable: true },
    {
      key: 'basicSalary',
      label: 'Gaji Pokok',
      className: 'hidden md:table-cell',
      render: (row) => formatCurrency(row.basicSalary),
    },
    {
      key: 'allowance',
      label: 'Tunjangan',
      className: 'hidden lg:table-cell',
      render: (row) => formatCurrency(row.allowance),
    },
    {
      key: 'netSalary',
      label: 'Gaji Bersih',
      sortable: true,
      render: (row) => <span className="font-semibold text-primary">{formatCurrency(row.netSalary)}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <Badge status={row.status}>{row.status}</Badge>,
    },
  ];

  // Period options
  const periodOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    return { value: val, label };
  });

  return (
    <div className="space-y-4 animate-fade-in">
      <Card>
        <CardBody className="pt-5">
          <div className="flex flex-col sm:flex-row gap-3 mb-4 items-end">
            <div className="sm:w-56">
              <Select label="Periode" options={periodOptions} value={period} onChange={(e) => setPeriod(e.target.value)} />
            </div>
            {isHR && (
              <Button onClick={handleGenerate} loading={generating}>
                <Play className="h-4 w-4" /> Generate Payroll
              </Button>
            )}
          </div>

          <DataTable
            columns={columns as Column<Record<string, unknown>>[]}
            data={payrolls as unknown as Record<string, unknown>[]}
            searchKeys={['employeeId', 'period', 'status']}
            searchPlaceholder="Cari payroll..."
            loading={loading}
            toolbar={
              <Button size="sm" variant="outline" onClick={handleExportExcel}>
                <Download className="h-4 w-4" /> Export Excel
              </Button>
            }
            actions={(row) => {
              const p = row as unknown as Payroll;
              return (
                <>
                  <button onClick={() => handleSlipPDF(p)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500" title="Slip PDF">
                    <FileText className="h-4 w-4" />
                  </button>
                  {isHR && (
                    <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-blue-50 text-primary" title="Edit">
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                </>
              );
            }}
          />
        </CardBody>
      </Card>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Payroll"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Batal</Button>
            <Button onClick={handleSaveEdit} loading={saving}>Simpan</Button>
          </>
        }
      >
        {editForm && (
          <div className="space-y-4">
            <Input label="Gaji Pokok" type="number" value={editForm.basicSalary} onChange={(e) => setEditForm({ ...editForm, basicSalary: Number(e.target.value) })} />
            <Input label="Tunjangan" type="number" value={editForm.allowance} onChange={(e) => setEditForm({ ...editForm, allowance: Number(e.target.value) })} />
            <Input label="Lembur" type="number" value={editForm.overtime} onChange={(e) => setEditForm({ ...editForm, overtime: Number(e.target.value) })} />
            <Input label="Potongan" type="number" value={editForm.deduction} onChange={(e) => setEditForm({ ...editForm, deduction: Number(e.target.value) })} />
            <Input label="BPJS" type="number" value={editForm.bpjs} onChange={(e) => setEditForm({ ...editForm, bpjs: Number(e.target.value) })} />
            <Input label="PPh21" type="number" value={editForm.pph21} onChange={(e) => setEditForm({ ...editForm, pph21: Number(e.target.value) })} />
            <Select
              label="Status"
              options={[
                { value: 'Draft', label: 'Draft' },
                { value: 'Generated', label: 'Generated' },
                { value: 'Paid', label: 'Paid' },
              ]}
              value={editForm.status}
              onChange={(e) => setEditForm({ ...editForm, status: e.target.value as Payroll['status'] })}
            />
            <div className="p-3 rounded-xl bg-primary/5 text-sm">
              <span className="text-slate-500">Estimasi Gaji Bersih: </span>
              <span className="font-bold text-primary">
                {formatCurrency(
                  editForm.basicSalary + editForm.allowance + editForm.overtime - editForm.deduction - editForm.bpjs - editForm.pph21
                )}
              </span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
