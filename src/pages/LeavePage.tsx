import { useEffect, useState, useCallback } from 'react';
import { Plus, Check, X, Download } from 'lucide-react';
import * as api from '../services/api';
import type { Leave, LeaveBalance } from '../types';
import { Card, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Input, Select, Textarea } from '../components/ui/Input';
import { DataTable, type Column } from '../components/ui/DataTable';
import { StatCard } from '../components/ui/StatCard';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { formatDate, exportToExcel, calcLeaveDays } from '../lib/utils';
import { db } from '../lib/db';
import { CalendarOff, CalendarCheck, CalendarClock } from 'lucide-react';

export function LeavePage() {
  const toast = useToast();
  const { session, isHR, isManager } = useAuth();
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ leaveType: 'Annual' as Leave['leaveType'], startDate: '', endDate: '', reason: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const filters: { employeeId?: string } = {};
    if (!isHR && !isManager && session?.employeeId) filters.employeeId = session.employeeId;
    const [leaveRes, balRes] = await Promise.all([api.getLeaves(filters), api.getLeaveBalance()]);
    if (leaveRes.success && leaveRes.data) setLeaves(leaveRes.data);
    if (balRes.success && balRes.data) setBalance(balRes.data);
    setLoading(false);
  }, [session, isHR, isManager]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async () => {
    if (!form.startDate || !form.endDate || !form.reason.trim()) {
      toast.error('Lengkapi semua field');
      return;
    }
    if (form.endDate < form.startDate) {
      toast.error('Tanggal akhir harus setelah tanggal mulai');
      return;
    }
    setSaving(true);
    const res = await api.saveLeave(form);
    setSaving(false);
    if (res.success) {
      toast.success(res.message);
      setModalOpen(false);
      setForm({ leaveType: 'Annual', startDate: '', endDate: '', reason: '' });
      load();
    } else toast.error(res.message);
  };

  const handleApproval = async (leave: Leave, action: 'approve_manager' | 'approve_hr' | 'reject') => {
    const res = await api.approveLeave(leave.id, action);
    if (res.success) {
      toast.success(res.message);
      load();
    } else toast.error(res.message);
  };

  const handleExport = () => {
    exportToExcel(
      leaves.map((l) => ({
        Karyawan: db.getEmployeeById(l.employeeId)?.fullName || l.employeeId,
        Tipe: l.leaveType,
        Mulai: l.startDate,
        Selesai: l.endDate,
        Hari: l.days,
        Alasan: l.reason,
        Status: l.status,
      })),
      'data-cuti'
    );
    toast.success('Data cuti diexport');
  };

  const columns: Column<Leave & Record<string, unknown>>[] = [
    {
      key: 'employeeId',
      label: 'Karyawan',
      render: (row) => db.getEmployeeById(row.employeeId)?.fullName || row.employeeId,
    },
    { key: 'leaveType', label: 'Tipe', sortable: true },
    {
      key: 'startDate',
      label: 'Periode',
      render: (row) => `${formatDate(row.startDate)} – ${formatDate(row.endDate)}`,
    },
    { key: 'days', label: 'Hari', sortable: true },
    {
      key: 'reason',
      label: 'Alasan',
      className: 'hidden md:table-cell max-w-[200px] truncate',
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (row) => <Badge status={row.status}>{row.status}</Badge>,
    },
  ];

  const daysPreview = form.startDate && form.endDate ? calcLeaveDays(form.startDate, form.endDate) : 0;

  return (
    <div className="space-y-4 animate-fade-in">
      {balance && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Kuota Tahunan" value={balance.annual} icon={<CalendarOff className="h-5 w-5" />} color="primary" />
          <StatCard title="Terpakai" value={balance.used} icon={<CalendarClock className="h-5 w-5" />} color="warning" />
          <StatCard title="Sisa" value={balance.remaining} icon={<CalendarCheck className="h-5 w-5" />} color="success" />
          <StatCard title="Sakit" value={balance.sick} icon={<CalendarOff className="h-5 w-5" />} color="danger" />
        </div>
      )}

      <Card>
        <CardBody className="pt-5">
          <DataTable
            columns={columns as Column<Record<string, unknown>>[]}
            data={leaves as unknown as Record<string, unknown>[]}
            searchKeys={['leaveType', 'reason', 'status', 'employeeId']}
            searchPlaceholder="Cari cuti..."
            loading={loading}
            toolbar={
              <>
                <Button size="sm" onClick={() => setModalOpen(true)}>
                  <Plus className="h-4 w-4" /> Ajukan Cuti
                </Button>
                <Button size="sm" variant="outline" onClick={handleExport}>
                  <Download className="h-4 w-4" /> Export
                </Button>
              </>
            }
            actions={(row) => {
              const leave = row as unknown as Leave;
              if (leave.status === 'Pending' && isManager) {
                return (
                  <>
                    <button onClick={() => handleApproval(leave, 'approve_manager')} className="p-1.5 rounded-lg hover:bg-emerald-50 text-success" title="Approve Manager">
                      <Check className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleApproval(leave, 'reject')} className="p-1.5 rounded-lg hover:bg-red-50 text-danger" title="Tolak">
                      <X className="h-4 w-4" />
                    </button>
                  </>
                );
              }
              if (leave.status === 'Approved Manager' && isHR) {
                return (
                  <>
                    <button onClick={() => handleApproval(leave, 'approve_hr')} className="p-1.5 rounded-lg hover:bg-emerald-50 text-success" title="Approve HR">
                      <Check className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleApproval(leave, 'reject')} className="p-1.5 rounded-lg hover:bg-red-50 text-danger" title="Tolak">
                      <X className="h-4 w-4" />
                    </button>
                  </>
                );
              }
              return null;
            }}
          />
        </CardBody>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Ajukan Cuti"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Batal</Button>
            <Button onClick={handleSubmit} loading={saving}>Kirim Pengajuan</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="Jenis Cuti"
            options={[
              { value: 'Annual', label: 'Cuti Tahunan' },
              { value: 'Sick', label: 'Cuti Sakit' },
              { value: 'Maternity', label: 'Cuti Melahirkan' },
              { value: 'Unpaid', label: 'Cuti Tanpa Gaji' },
              { value: 'Other', label: 'Lainnya' },
            ]}
            value={form.leaveType}
            onChange={(e) => setForm({ ...form, leaveType: e.target.value as Leave['leaveType'] })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Tanggal Mulai" type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            <Input label="Tanggal Selesai" type="date" required value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          </div>
          {daysPreview > 0 && (
            <p className="text-sm text-primary font-medium">Durasi: {daysPreview} hari kerja</p>
          )}
          <Textarea label="Alasan" required value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Jelaskan alasan cuti..." />
        </div>
      </Modal>
    </div>
  );
}
