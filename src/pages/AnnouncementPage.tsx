import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Megaphone } from 'lucide-react';
import Swal from 'sweetalert2';
import * as api from '../services/api';
import type { Announcement } from '../types';
import { Card, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Input, Select, Textarea } from '../components/ui/Input';
import { DataTable, type Column } from '../components/ui/DataTable';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../lib/utils';

export function AnnouncementPage() {
  const toast = useToast();
  const { isHR } = useAuth();
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<Announcement>>({
    title: '',
    content: '',
    priority: 'Normal',
    targetRole: 'All',
    isActive: true,
  });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api.getAnnouncements();
    if (res.success && res.data) setItems(res.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setForm({ title: '', content: '', priority: 'Normal', targetRole: 'All', isActive: true });
    setModalOpen(true);
  };

  const openEdit = (item: Announcement) => {
    setForm({ ...item });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.title?.trim() || !form.content?.trim()) {
      toast.error('Judul dan konten wajib diisi');
      return;
    }
    setSaving(true);
    const res = await api.saveAnnouncement(form as Announcement & { title: string; content: string });
    setSaving(false);
    if (res.success) {
      toast.success(res.message);
      setModalOpen(false);
      load();
    } else toast.error(res.message);
  };

  const handleDelete = async (item: Announcement) => {
    const result = await Swal.fire({
      title: 'Hapus Pengumuman?',
      text: item.title,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#D32F2F',
      confirmButtonText: 'Hapus',
      cancelButtonText: 'Batal',
    });
    if (!result.isConfirmed) return;
    const res = await api.deleteAnnouncement(item.id);
    if (res.success) {
      toast.success(res.message);
      load();
    } else toast.error(res.message);
  };

  const columns: Column<Announcement & Record<string, unknown>>[] = [
    {
      key: 'title',
      label: 'Judul',
      sortable: true,
      render: (row) => (
        <div className="flex items-start gap-2">
          <Megaphone className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">{row.title}</p>
            <p className="text-xs text-slate-400 line-clamp-1">{row.content}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'priority',
      label: 'Prioritas',
      sortable: true,
      render: (row) => <Badge status={row.priority}>{row.priority}</Badge>,
    },
    {
      key: 'targetRole',
      label: 'Target',
      className: 'hidden md:table-cell',
      render: (row) => row.targetRole || 'All',
    },
    {
      key: 'publishDate',
      label: 'Tanggal',
      sortable: true,
      render: (row) => formatDate(row.publishDate),
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (row) => <Badge status={row.isActive ? 'Active' : 'Resigned'}>{row.isActive ? 'Aktif' : 'Nonaktif'}</Badge>,
    },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <Card>
        <CardBody className="pt-5">
          <DataTable
            columns={columns as Column<Record<string, unknown>>[]}
            data={items as unknown as Record<string, unknown>[]}
            searchKeys={['title', 'content', 'priority']}
            searchPlaceholder="Cari pengumuman..."
            loading={loading}
            toolbar={
              isHR ? (
                <Button size="sm" onClick={openCreate}>
                  <Plus className="h-4 w-4" /> Tambah
                </Button>
              ) : undefined
            }
            actions={
              isHR
                ? (row) => {
                    const item = row as unknown as Announcement;
                    return (
                      <>
                        <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg hover:bg-blue-50 text-primary">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDelete(item)} className="p-1.5 rounded-lg hover:bg-red-50 text-danger">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    );
                  }
                : undefined
            }
          />
        </CardBody>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={form.id ? 'Edit Pengumuman' : 'Tambah Pengumuman'}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Batal</Button>
            <Button onClick={handleSave} loading={saving}>Simpan</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Judul" required value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Textarea label="Konten" required value={form.content || ''} onChange={(e) => setForm({ ...form, content: e.target.value })} className="min-h-[120px]" />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Prioritas"
              options={[
                { value: 'Low', label: 'Low' },
                { value: 'Normal', label: 'Normal' },
                { value: 'High', label: 'High' },
                { value: 'Urgent', label: 'Urgent' },
              ]}
              value={form.priority || 'Normal'}
              onChange={(e) => setForm({ ...form, priority: e.target.value as Announcement['priority'] })}
            />
            <Select
              label="Target"
              options={[
                { value: 'All', label: 'Semua' },
                { value: 'Administrator', label: 'Administrator' },
                { value: 'HR', label: 'HR' },
                { value: 'Manager', label: 'Manager' },
                { value: 'Employee', label: 'Employee' },
              ]}
              value={form.targetRole || 'All'}
              onChange={(e) => setForm({ ...form, targetRole: e.target.value as Announcement['targetRole'] })}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
