import { useEffect, useState, useCallback } from 'react';
import { Plus, Check, X, Download } from 'lucide-react';
import * as api from '../services/api';
import type { Permission } from '../types';
import { Card, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Input, Select, Textarea } from '../components/ui/Input';
import { DataTable, type Column } from '../components/ui/DataTable';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { formatDate, exportToExcel } from '../lib/utils';
import { db } from '../lib/db';

export function PermissionPage() {
  const toast = useToast();
  const { session, isHR, isManager } = useAuth();
  const [items, setItems] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    type: 'Izin' as Permission['type'],
    date: '',
    startTime: '',
    endTime: '',
    reason: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const filters: { employeeId?: string } = {};
    if (!isHR && !isManager && session?.employeeId) filters.employeeId = session.employeeId;
    const res = await api.getPermissions(filters);
    if (res.success && res.data) setItems(res.data);
    setLoading(false);
  }, [session, isHR, isManager]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async () => {
    if (!form.date || !form.reason.trim()) {
      toast.error('Lengkapi field wajib');
      return;
    }
    setSaving(true);
    const res = await api.savePermission(form);
    setSaving(false);
    if (res.success) {
      toast.success(res.message);
      setModalOpen(false);
      setForm({ type: 'Izin', date: '', startTime: '', endTime: '', reason: '' });
      load();
    } else toast.error(res.message);
  };

  const handleApproval = async (item: Permission, action: 'approve' | 'reject') => {
    const res = await api.approvePermission(item.id, action);
    if (res.success) {
      toast.success(res.message);
      load();
    } else toast.error(res.message);
  };

  const columns: Column<Permission & Record<string, unknown>>[] = [
    {
      key: 'employeeId',
      label: 'Karyawan',
      render: (row) => db.getEmployeeById(row.employeeId)?.fullName || row.employeeId,
    },
    {
      key: 'type',
      label: 'Jenis',
      sortable: true,
      render: (row) => <Badge status={row.type === 'Sakit' ? 'Late' : row.type === 'WFH' ? 'Present' : 'Pending'}>{row.type}</Badge>,
    },
    {
      key: 'date',
      label: 'Tanggal',
      sortable: true,
      render: (row) => formatDate(row.date),
    },
    {
      key: 'startTime',
      label: 'Waktu',
      className: 'hidden md:table-cell',
      render: (row) => (row.startTime ? `${row.startTime} – ${row.endTime || ''}` : '-'),
    },
    {
      key: 'reason',
      label: 'Alasan',
      className: 'hidden lg:table-cell max-w-[200px] truncate',
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (row) => <Badge status={row.status}>{row.status}</Badge>,
    },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <Card>
        <CardBody className="pt-5">
          <DataTable
            columns={columns as Column<Record<string, unknown>>[]}
            data={items as unknown as Record<string, unknown>[]}
            searchKeys={['type', 'reason', 'status', 'employeeId']}
            searchPlaceholder="Cari izin..."
            loading={loading}
            toolbar={
              <>
                <Button size="sm" onClick={() => setModalOpen(true)}>
                  <Plus className="h-4 w-4" /> Ajukan Izin
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    exportToExcel(
                      items.map((p) => ({
                        Karyawan: db.getEmployeeById(p.employeeId)?.fullName,
                        Jenis: p.type,
                        Tanggal: p.date,
                        Alasan: p.reason,
                        Status: p.status,
                      })),
                      'data-izin'
                    );
                    toast.success('Data diexport');
                  }}
                >
                  <Download className="h-4 w-4" /> Export
                </Button>
              </>
            }
            actions={(row) => {
              const item = row as unknown as Permission;
              if (item.status === 'Pending' && (isManager || isHR)) {
                return (
                  <>
                    <button onClick={() => handleApproval(item, 'approve')} className="p-1.5 rounded-lg hover:bg-emerald-50 text-success" title="Setujui">
                      <Check className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleApproval(item, 'reject')} className="p-1.5 rounded-lg hover:bg-red-50 text-danger" title="Tolak">
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
        title="Ajukan Izin"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Batal</Button>
            <Button onClick={handleSubmit} loading={saving}>Kirim</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="Jenis"
            options={[
              { value: 'Izin', label: 'Izin' },
              { value: 'Sakit', label: 'Sakit' },
              { value: 'Dinas', label: 'Dinas Luar' },
              { value: 'WFH', label: 'Work From Home' },
            ]}
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as Permission['type'] })}
          />
          <Input label="Tanggal" type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Jam Mulai" type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
            <Input label="Jam Selesai" type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
          </div>
          <Textarea label="Alasan" required value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
        </div>
      </Modal>
    </div>
  );
}
