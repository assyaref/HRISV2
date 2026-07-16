import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import Swal from 'sweetalert2';
import * as api from '../services/api';
import type { Department, Division, Position } from '../types';
import { Card, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Input, Select, Textarea } from '../components/ui/Input';
import { DataTable, type Column } from '../components/ui/DataTable';
import { useToast } from '../context/ToastContext';
import { db } from '../lib/db';

type MasterType = 'department' | 'division' | 'position';

interface MasterDataPageProps {
  type: MasterType;
}

export function MasterDataPage({ type }: MasterDataPageProps) {
  const toast = useToast();
  const [items, setItems] = useState<(Department | Division | Position)[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string | number | boolean>>({});

  const titles = { department: 'Departemen', division: 'Divisi', position: 'Jabatan' };

  const load = useCallback(async () => {
    setLoading(true);
    if (type === 'department') {
      const res = await api.getDepartments();
      if (res.success && res.data) setItems(res.data);
    } else if (type === 'division') {
      const [divRes, deptRes] = await Promise.all([api.getDivisions(), api.getDepartments()]);
      if (divRes.success && divRes.data) setItems(divRes.data);
      if (deptRes.success && deptRes.data) setDepartments(deptRes.data);
    } else {
      const [posRes, deptRes] = await Promise.all([api.getPositions(), api.getDepartments()]);
      if (posRes.success && posRes.data) setItems(posRes.data);
      if (deptRes.success && deptRes.data) setDepartments(deptRes.data);
    }
    setLoading(false);
  }, [type]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setForm({ code: '', name: '', description: '', departmentId: '', level: 1, isActive: true });
    setModalOpen(true);
  };

  const openEdit = (item: Department | Division | Position) => {
    setForm({ ...item });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.code) {
      toast.error('Kode dan Nama wajib diisi');
      return;
    }
    setSaving(true);
    let res;
    if (type === 'department') {
      res = await api.saveDepartment(form as unknown as Department & { name: string; code: string });
    } else if (type === 'division') {
      if (!form.departmentId) {
        toast.error('Departemen wajib dipilih');
        setSaving(false);
        return;
      }
      res = await api.saveDivision(form as unknown as Division & { name: string; code: string; departmentId: string });
    } else {
      if (!form.departmentId) {
        toast.error('Departemen wajib dipilih');
        setSaving(false);
        return;
      }
      res = await api.savePosition(form as unknown as Position & { name: string; code: string; departmentId: string });
    }
    setSaving(false);
    if (res.success) {
      toast.success(res.message);
      setModalOpen(false);
      load();
    } else toast.error(res.message);
  };

  const handleDelete = async (item: Department | Division | Position) => {
    const result = await Swal.fire({
      title: `Hapus ${titles[type]}?`,
      text: `Yakin ingin menghapus "${item.name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#D32F2F',
      confirmButtonText: 'Hapus',
      cancelButtonText: 'Batal',
    });
    if (!result.isConfirmed) return;
    let res;
    if (type === 'department') res = await api.deleteDepartment(item.id);
    else if (type === 'division') res = await api.deleteDivision(item.id);
    else res = await api.deletePosition(item.id);
    if (res.success) {
      toast.success(res.message);
      load();
    } else toast.error(res.message);
  };

  const columns: Column<Record<string, unknown>>[] = [
    { key: 'code', label: 'Kode', sortable: true },
    { key: 'name', label: 'Nama', sortable: true },
    ...(type !== 'department'
      ? [
          {
            key: 'departmentId',
            label: 'Departemen',
            render: (row: Record<string, unknown>) =>
              db.getDepartmentById(String(row.departmentId))?.name || '-',
          },
        ]
      : []),
    ...(type === 'position'
      ? [
          {
            key: 'level',
            label: 'Level',
            sortable: true as const,
          },
        ]
      : []),
    {
      key: 'description',
      label: 'Deskripsi',
      className: 'hidden md:table-cell',
      render: (row: Record<string, unknown>) => String(row.description || '-'),
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (row: Record<string, unknown>) => (
        <Badge status={row.isActive ? 'Active' : 'Resigned'}>{row.isActive ? 'Aktif' : 'Nonaktif'}</Badge>
      ),
    },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <Card>
        <CardBody className="pt-5">
          <DataTable
            columns={columns}
            data={items as unknown as Record<string, unknown>[]}
            searchKeys={['code', 'name', 'description']}
            searchPlaceholder={`Cari ${titles[type].toLowerCase()}...`}
            loading={loading}
            toolbar={
              <Button size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4" /> Tambah {titles[type]}
              </Button>
            }
            actions={(row) => {
              const item = row as unknown as Department | Division | Position;
              return (
                <>
                  <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg hover:bg-blue-50 text-primary" title="Edit">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(item)} className="p-1.5 rounded-lg hover:bg-red-50 text-danger" title="Hapus">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              );
            }}
          />
        </CardBody>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={`${form.id ? 'Edit' : 'Tambah'} ${titles[type]}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Batal</Button>
            <Button onClick={handleSave} loading={saving}>Simpan</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Kode" required value={String(form.code || '')} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <Input label="Nama" required value={String(form.name || '')} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          {type !== 'department' && (
            <Select
              label="Departemen"
              required
              options={departments.map((d) => ({ value: d.id, label: d.name }))}
              value={String(form.departmentId || '')}
              onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
              placeholder="Pilih departemen"
            />
          )}
          {type === 'position' && (
            <Input label="Level" type="number" value={Number(form.level || 1)} onChange={(e) => setForm({ ...form, level: Number(e.target.value) })} />
          )}
          <Textarea label="Deskripsi" value={String(form.description || '')} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
      </Modal>
    </div>
  );
}
