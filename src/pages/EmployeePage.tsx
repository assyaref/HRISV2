import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Download, Upload, Eye } from 'lucide-react';
import Swal from 'sweetalert2';
import * as api from '../services/api';
import type { Employee, Department, Division, Position } from '../types';
import { Card, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { Modal } from '../components/ui/Modal';
import { Input, Select, Textarea } from '../components/ui/Input';
import { DataTable, type Column } from '../components/ui/DataTable';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatCurrency, exportToExcel, compressImage } from '../lib/utils';
import { db } from '../lib/db';

const emptyForm: Partial<Employee> = {
  fullName: '',
  nik: '',
  gender: 'Male',
  birthDate: '',
  religion: 'Islam',
  address: '',
  phone: '',
  email: '',
  departmentId: '',
  divisionId: '',
  positionId: '',
  joinDate: '',
  employmentStatus: 'Active',
  salary: 0,
};

export function EmployeePage() {
  const toast = useToast();
  const { isHR } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [form, setForm] = useState<Partial<Employee>>(emptyForm);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [saving, setSaving] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [filterDept, setFilterDept] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [empRes, lookRes] = await Promise.all([
      api.getEmployees({ departmentId: filterDept || undefined, status: filterStatus || undefined }),
      api.getLookups(),
    ]);
    if (empRes.success && empRes.data) setEmployees(empRes.data);
    if (lookRes.success && lookRes.data) {
      setDepartments(lookRes.data.departments);
      setDivisions(lookRes.data.divisions);
      setPositions(lookRes.data.positions);
    }
    setLoading(false);
  }, [filterDept, filterStatus]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setForm(emptyForm);
    setSelected(null);
    setModalOpen(true);
  };

  const openEdit = (emp: Employee) => {
    setForm({ ...emp });
    setSelected(emp);
    setModalOpen(true);
  };

  const openView = (emp: Employee) => {
    setSelected(emp);
    setViewOpen(true);
  };

  const handleSave = async () => {
    if (!form.fullName?.trim()) {
      toast.error('Nama lengkap wajib diisi');
      return;
    }
    setSaving(true);
    const res = await api.saveEmployee(form as Employee & { fullName: string });
    setSaving(false);
    if (res.success) {
      toast.success(res.message);
      setModalOpen(false);
      load();
    } else {
      toast.error(res.message);
    }
  };

  const handleDelete = async (emp: Employee) => {
    const result = await Swal.fire({
      title: 'Hapus Karyawan?',
      text: `Yakin ingin menghapus ${emp.fullName}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#D32F2F',
      confirmButtonText: 'Hapus',
      cancelButtonText: 'Batal',
    });
    if (!result.isConfirmed) return;
    const res = await api.deleteEmployee(emp.id);
    if (res.success) {
      toast.success(res.message);
      load();
    } else toast.error(res.message);
  };

  const handleExport = () => {
    const data = employees.map((e) => ({
      'Employee ID': e.employeeId,
      NIK: e.nik,
      'Nama Lengkap': e.fullName,
      Gender: e.gender,
      'Tanggal Lahir': e.birthDate,
      Agama: e.religion,
      Alamat: e.address,
      Telepon: e.phone,
      Email: e.email,
      Departemen: db.getDepartmentById(e.departmentId)?.name || '',
      Divisi: db.getDivisionById(e.divisionId)?.name || '',
      Jabatan: db.getPositionById(e.positionId)?.name || '',
      'Tanggal Masuk': e.joinDate,
      Status: e.employmentStatus,
      Gaji: e.salary,
    }));
    exportToExcel(data, 'data-karyawan');
    toast.success('Data berhasil diexport');
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const XLSX = await import('xlsx');
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);
    const mapped = rows.map((r) => ({
      fullName: r['Nama Lengkap'] || r['fullName'] || r['name'] || '',
      nik: r['NIK'] || r['nik'] || '',
      email: r['Email'] || r['email'] || '',
      phone: r['Telepon'] || r['phone'] || '',
      gender: (r['Gender'] || 'Male') as Employee['gender'],
      employeeId: r['Employee ID'] || r['employeeId'] || undefined,
      salary: Number(r['Gaji'] || r['salary'] || 0),
    }));
    const res = await api.importEmployees(mapped);
    if (res.success) {
      toast.success(res.message);
      load();
    } else toast.error(res.message);
    e.target.value = '';
  };

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      setForm((f) => ({ ...f, photo: compressed }));
    } catch {
      toast.error('Gagal memproses foto');
    }
  };

  const filteredDivisions = divisions.filter((d) => !form.departmentId || d.departmentId === form.departmentId);
  const filteredPositions = positions.filter((p) => !form.departmentId || p.departmentId === form.departmentId);

  const columns: Column<Employee & Record<string, unknown>>[] = [
    {
      key: 'fullName',
      label: 'Karyawan',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.fullName} src={row.photo} size="sm" />
          <div>
            <p className="font-medium text-slate-800 dark:text-slate-100">{row.fullName}</p>
            <p className="text-xs text-slate-400">{row.employeeId}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'departmentId',
      label: 'Departemen',
      render: (row) => db.getDepartmentById(row.departmentId)?.name || '-',
    },
    {
      key: 'positionId',
      label: 'Jabatan',
      render: (row) => db.getPositionById(row.positionId)?.name || '-',
    },
    {
      key: 'email',
      label: 'Email',
      className: 'hidden md:table-cell',
    },
    {
      key: 'phone',
      label: 'Telepon',
      className: 'hidden lg:table-cell',
    },
    {
      key: 'employmentStatus',
      label: 'Status',
      sortable: true,
      render: (row) => <Badge status={row.employmentStatus}>{row.employmentStatus}</Badge>,
    },
    {
      key: 'joinDate',
      label: 'Join Date',
      sortable: true,
      className: 'hidden xl:table-cell',
      render: (row) => formatDate(row.joinDate),
    },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <Card>
        <CardBody className="pt-5">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <Select
              options={[{ value: '', label: 'Semua Departemen' }, ...departments.map((d) => ({ value: d.id, label: d.name }))]}
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              className="sm:w-48"
            />
            <Select
              options={[
                { value: '', label: 'Semua Status' },
                { value: 'Active', label: 'Active' },
                { value: 'On Leave', label: 'On Leave' },
                { value: 'Probation', label: 'Probation' },
                { value: 'Resigned', label: 'Resigned' },
              ]}
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="sm:w-40"
            />
          </div>

          <DataTable
            columns={columns as Column<Record<string, unknown>>[]}
            data={employees as unknown as Record<string, unknown>[]}
            searchKeys={['fullName', 'employeeId', 'email', 'nik', 'phone']}
            searchPlaceholder="Cari nama, ID, email, NIK..."
            loading={loading}
            toolbar={
              isHR ? (
                <>
                  <Button size="sm" onClick={openCreate}>
                    <Plus className="h-4 w-4" /> Tambah
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleExport}>
                    <Download className="h-4 w-4" /> Export
                  </Button>
                  <label>
                    <Button size="sm" variant="outline" as-child>
                      <span className="inline-flex items-center gap-2 cursor-pointer">
                        <Upload className="h-4 w-4" /> Import
                      </span>
                    </Button>
                    <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
                  </label>
                </>
              ) : (
                <Button size="sm" variant="outline" onClick={handleExport}>
                  <Download className="h-4 w-4" /> Export
                </Button>
              )
            }
            actions={(row) => {
              const emp = row as unknown as Employee;
              return (
                <>
                  <button onClick={() => openView(emp)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500" title="Detail">
                    <Eye className="h-4 w-4" />
                  </button>
                  {isHR && (
                    <>
                      <button onClick={() => openEdit(emp)} className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950 text-primary" title="Edit">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDelete(emp)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 text-danger" title="Hapus">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </>
              );
            }}
          />
        </CardBody>
      </Card>

      {/* Form Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selected ? 'Edit Karyawan' : 'Tambah Karyawan'}
        size="xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Batal</Button>
            <Button onClick={handleSave} loading={saving}>Simpan</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 flex items-center gap-4">
            <Avatar name={form.fullName || 'New'} src={form.photo} size="xl" />
            <div>
              <label className="cursor-pointer">
                <span className="text-sm text-primary font-medium hover:underline">Upload Foto</span>
                <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
              </label>
              <p className="text-xs text-slate-400 mt-1">JPG/PNG, max 2MB (auto compress)</p>
            </div>
          </div>
          <Input label="Nama Lengkap" required value={form.fullName || ''} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          <Input label="NIK" value={form.nik || ''} onChange={(e) => setForm({ ...form, nik: e.target.value })} />
          <Input label="Employee ID" value={form.employeeId || ''} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} hint="Kosongkan untuk auto-generate" />
          <Select
            label="Gender"
            options={[{ value: 'Male', label: 'Laki-laki' }, { value: 'Female', label: 'Perempuan' }]}
            value={form.gender || 'Male'}
            onChange={(e) => setForm({ ...form, gender: e.target.value as Employee['gender'] })}
          />
          <Input label="Tanggal Lahir" type="date" value={form.birthDate || ''} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />
          <Select
            label="Agama"
            options={['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Konghucu'].map((r) => ({ value: r, label: r }))}
            value={form.religion || 'Islam'}
            onChange={(e) => setForm({ ...form, religion: e.target.value })}
          />
          <Input label="Email" type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="Telepon" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <div className="md:col-span-2">
            <Textarea label="Alamat" value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <Select
            label="Departemen"
            options={departments.map((d) => ({ value: d.id, label: d.name }))}
            value={form.departmentId || ''}
            onChange={(e) => setForm({ ...form, departmentId: e.target.value, divisionId: '', positionId: '' })}
            placeholder="Pilih departemen"
          />
          <Select
            label="Divisi"
            options={filteredDivisions.map((d) => ({ value: d.id, label: d.name }))}
            value={form.divisionId || ''}
            onChange={(e) => setForm({ ...form, divisionId: e.target.value })}
            placeholder="Pilih divisi"
          />
          <Select
            label="Jabatan"
            options={filteredPositions.map((p) => ({ value: p.id, label: p.name }))}
            value={form.positionId || ''}
            onChange={(e) => setForm({ ...form, positionId: e.target.value })}
            placeholder="Pilih jabatan"
          />
          <Input label="Tanggal Masuk" type="date" value={form.joinDate || ''} onChange={(e) => setForm({ ...form, joinDate: e.target.value })} />
          <Select
            label="Status"
            options={[
              { value: 'Active', label: 'Active' },
              { value: 'On Leave', label: 'On Leave' },
              { value: 'Probation', label: 'Probation' },
              { value: 'Resigned', label: 'Resigned' },
            ]}
            value={form.employmentStatus || 'Active'}
            onChange={(e) => setForm({ ...form, employmentStatus: e.target.value as Employee['employmentStatus'] })}
          />
          <Input label="Gaji Pokok" type="number" value={form.salary || ''} onChange={(e) => setForm({ ...form, salary: Number(e.target.value) })} />
        </div>
      </Modal>

      {/* View Modal */}
      <Modal open={viewOpen} onClose={() => setViewOpen(false)} title="Detail Karyawan" size="lg">
        {selected && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar name={selected.fullName} src={selected.photo} size="xl" />
              <div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">{selected.fullName}</h3>
                <p className="text-sm text-slate-400">{selected.employeeId} · {db.getPositionById(selected.positionId)?.name}</p>
                <Badge status={selected.employmentStatus} className="mt-1">{selected.employmentStatus}</Badge>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              {[
                ['NIK', selected.nik],
                ['Gender', selected.gender === 'Male' ? 'Laki-laki' : 'Perempuan'],
                ['Tanggal Lahir', formatDate(selected.birthDate)],
                ['Agama', selected.religion],
                ['Email', selected.email],
                ['Telepon', selected.phone],
                ['Departemen', db.getDepartmentById(selected.departmentId)?.name],
                ['Divisi', db.getDivisionById(selected.divisionId)?.name],
                ['Jabatan', db.getPositionById(selected.positionId)?.name],
                ['Tanggal Masuk', formatDate(selected.joinDate)],
                ['Gaji', formatCurrency(selected.salary)],
                ['Alamat', selected.address],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <p className="text-xs text-slate-400 mb-0.5">{label}</p>
                  <p className="font-medium text-slate-700 dark:text-slate-200">{value || '-'}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
