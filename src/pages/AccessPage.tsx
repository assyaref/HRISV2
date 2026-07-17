import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Key, Shield, UserCheck, UserX, Mail, User as UserIcon, Scan, Eye } from 'lucide-react';
import Swal from 'sweetalert2';
import * as api from '../services/api';
import type { User, Role, Employee } from '../types';
import { Card, CardBody, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { Modal } from '../components/ui/Modal';
import { Input, Select } from '../components/ui/Input';
import { DataTable, type Column } from '../components/ui/DataTable';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../lib/utils';

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'Administrator', label: 'Administrator' },
  { value: 'HR', label: 'HR' },
  { value: 'Manager', label: 'Manager' },
  { value: 'Employee', label: 'Employee' },
];

const ROLE_BADGE_COLORS: Record<Role, string> = {
  Administrator: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  HR: 'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300',
  Manager: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
  Employee: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

const ROLE_ICONS: Record<Role, React.ReactNode> = {
  Administrator: <Shield className="h-4 w-4" />,
  HR: <UserCheck className="h-4 w-4" />,
  Manager: <UserCheck className="h-4 w-4" />,
  Employee: <UserIcon className="h-4 w-4" />,
};

const ROLE_DESCRIPTIONS: Record<Role, string> = {
  Administrator: 'Akses penuh ke semua fitur dan pengaturan',
  HR: 'Mengelola data karyawan, cuti, izin, payroll',
  Manager: 'Menyetujui cuti dan izin bawahan',
  Employee: 'Absensi, cuti, izin, dan profil pribadi',
};

export function AccessPage() {
  const toast = useToast();
  const { session } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [resetPassOpen, setResetPassOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    id: '',
    email: '',
    password: '',
    role: 'Employee' as Role,
    name: '',
    employeeId: '',
    isActive: true,
  });
  const [resetPassword, setResetPassword] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [faceModalOpen, setFaceModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [viewingFace, setViewingFace] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [userRes, empRes] = await Promise.all([
      api.getUsers(),
      api.getEmployees(),
    ]);
    if (userRes.success && userRes.data) setUsers(userRes.data);
    if (empRes.success && empRes.data) setEmployees(empRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setSelectedUser(null);
    setForm({
      id: '',
      email: '',
      password: '',
      role: 'Employee',
      name: '',
      employeeId: '',
      isActive: true,
    });
    setModalOpen(true);
  };

  const openEdit = (user: User) => {
    setSelectedUser(user);
    setForm({
      id: user.id,
      email: user.email,
      password: '',
      role: user.role,
      name: user.name,
      employeeId: user.employeeId || '',
      isActive: user.isActive,
    });
    setModalOpen(true);
  };

  const openResetPassword = (user: User) => {
    setSelectedUser(user);
    setResetPassword('');
    setResetPassOpen(true);
  };

  const openFaceModal = (emp: Employee) => {
    setSelectedEmployee(emp);
    setViewingFace(false);
    setFaceModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.email.trim() || !form.name.trim()) {
      toast.error('Email dan Nama wajib diisi');
      return;
    }
    if (!form.id && !form.password) {
      toast.error('Password wajib diisi untuk user baru');
      return;
    }
    if (form.password && form.password.length < 4) {
      toast.error('Password minimal 4 karakter');
      return;
    }

    setSaving(true);
    const res = await api.saveUser({
      id: form.id || undefined,
      email: form.email,
      password: form.password || undefined,
      role: form.role,
      name: form.name,
      employeeId: form.employeeId || undefined,
      isActive: form.isActive,
    });
    setSaving(false);

    if (res.success) {
      toast.success(res.message);
      setModalOpen(false);
      load();
    } else {
      toast.error(res.message);
    }
  };

  const handleDelete = async (user: User) => {
    if (user.id === session?.userId) {
      toast.error('Tidak dapat menghapus akun sendiri');
      return;
    }

    const result = await Swal.fire({
      title: 'Hapus User?',
      text: `Yakin ingin menghapus user "${user.name}" (${user.email})?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#D32F2F',
      confirmButtonText: 'Hapus',
      cancelButtonText: 'Batal',
    });
    if (!result.isConfirmed) return;

    const res = await api.deleteUser(user.id);
    if (res.success) {
      toast.success(res.message);
      load();
    } else {
      toast.error(res.message);
    }
  };

  const handleResetPassword = async () => {
    if (!resetPassword || resetPassword.length < 4) {
      toast.error('Password baru minimal 4 karakter');
      return;
    }
    if (!selectedUser) return;

    setSaving(true);
    const res = await api.resetUserPassword(selectedUser.id, resetPassword);
    setSaving(false);

    if (res.success) {
      toast.success(`Password ${selectedUser.email} berhasil direset`);
      setResetPassOpen(false);
    } else {
      toast.error(res.message);
    }
  };

  const getEmployeeName = (employeeId?: string) => {
    if (!employeeId) return '-';
    const emp = employees.find((e) => e.id === employeeId || e.employeeId === employeeId);
    return emp?.fullName || employeeId;
  };

  const filteredUsers = filterRole
    ? users.filter((u) => u.role === filterRole)
    : users;

  const columns: Column<User & Record<string, unknown>>[] = [
    {
      key: 'name',
      label: 'User',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.name} src={row.avatar} size="sm" />
          <div>
            <p className="font-medium text-slate-800 dark:text-slate-100">{row.name}</p>
            <p className="text-xs text-slate-400">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      sortable: true,
      render: (row) => (
        <Badge color={ROLE_BADGE_COLORS[row.role as Role]}>
          <span className="flex items-center gap-1">
            {ROLE_ICONS[row.role as Role]}
            {row.role}
          </span>
        </Badge>
      ),
    },
    {
      key: 'employeeId',
      label: 'Terkait Karyawan',
      render: (row) => {
        const emp = employees.find(e => e.id === row.employeeId);
        return (
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600 dark:text-slate-400">
              {getEmployeeName(row.employeeId)}
            </span>
            {emp && (
              <button
                onClick={() => openFaceModal(emp)}
                className="p-1 rounded hover:bg-purple-50 dark:hover:bg-purple-950 text-purple-600"
                title="Lihat Face Descriptor"
              >
                <Scan className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        );
      },
    },
    {
      key: 'isActive',
      label: 'Status',
      sortable: true,
      render: (row) => (
        <Badge status={row.isActive ? 'Active' : 'Resigned'}>
          {row.isActive ? 'Aktif' : 'Nonaktif'}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      label: 'Dibuat',
      sortable: true,
      className: 'hidden lg:table-cell',
      render: (row) => formatDate(row.createdAt),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardBody className="flex items-center gap-4 pt-5">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <UserIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{users.length}</p>
              <p className="text-xs text-slate-400">Total User</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4 pt-5">
            <div className="h-12 w-12 rounded-xl bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
              <Shield className="h-6 w-6 text-purple-600 dark:text-purple-300" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">
                {users.filter((u) => u.role === 'Administrator').length}
              </p>
              <p className="text-xs text-slate-400">Administrator</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4 pt-5">
            <div className="h-12 w-12 rounded-xl bg-pink-100 dark:bg-pink-900/40 flex items-center justify-center">
              <UserCheck className="h-6 w-6 text-pink-600 dark:text-pink-300" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">
                {users.filter((u) => u.role === 'HR' || u.role === 'Manager').length}
              </p>
              <p className="text-xs text-slate-400">HR & Manager</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4 pt-5">
            <div className="h-12 w-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
              <UserCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-300" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">
                {users.filter((u) => u.isActive).length}
              </p>
              <p className="text-xs text-slate-400">Aktif</p>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Role Permissions Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" /> Hak Akses Role
          </CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {ROLE_OPTIONS.map((r) => (
              <div
                key={r.value}
                className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Badge color={ROLE_BADGE_COLORS[r.value]}>
                    <span className="flex items-center gap-1">
                      {ROLE_ICONS[r.value]}
                      {r.label}
                    </span>
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {ROLE_DESCRIPTIONS[r.value]}
                </p>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Users Table */}
      <Card>
        <CardBody className="pt-5">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <Select
              options={[
                { value: '', label: 'Semua Role' },
                ...ROLE_OPTIONS,
              ]}
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="sm:w-48"
            />
          </div>

          <DataTable
            columns={columns as Column<Record<string, unknown>>[]}
            data={filteredUsers as unknown as Record<string, unknown>[]}
            searchKeys={['name', 'email', 'role']}
            searchPlaceholder="Cari user berdasarkan nama, email, role..."
            loading={loading}
            toolbar={
              <Button size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4" /> Tambah User
              </Button>
            }
            actions={(row) => {
              const user = row as unknown as User;
              return (
                <>
                  <button
                    onClick={() => openEdit(user)}
                    className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950 text-primary"
                    title="Edit User"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => openResetPassword(user)}
                    className="p-1.5 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950 text-amber-600"
                    title="Reset Password"
                  >
                    <Key className="h-4 w-4" />
                  </button>
                  {user.id !== session?.userId && (
                    <button
                      onClick={() => handleDelete(user)}
                      className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 text-danger"
                      title="Hapus User"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </>
              );
            }}
          />
        </CardBody>
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={form.id ? 'Edit User' : 'Tambah User Baru'}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Batal</Button>
            <Button onClick={handleSave} loading={saving}>
              {form.id ? 'Simpan Perubahan' : 'Tambah User'}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {/* Info */}
          <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
            <p className="text-sm text-primary font-medium flex items-center gap-2">
              <Shield className="h-4 w-4" />
              {form.id ? 'Edit data user yang sudah ada' : 'Buat akun baru untuk akses ke sistem'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Nama Lengkap"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Nama user"
            />
            <Input
              label="Email"
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="user@perusahaan.com"
              icon={<Mail className="h-4 w-4" />}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Role / Hak Akses"
              required
              options={ROLE_OPTIONS}
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
            />
            <Select
              label="Karyawan Terkait (Opsional)"
              options={[
                { value: '', label: 'Tidak ada' },
                ...employees.map((e) => ({
                  value: e.id,
                  label: `${e.fullName} (${e.employeeId})`,
                })),
              ]}
              value={form.employeeId}
              onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
              placeholder="Pilih karyawan"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label={form.id ? 'Password Baru (kosongkan jika tidak diubah)' : 'Password'}
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={form.id ? 'Biarkan kosong jika tidak diubah' : 'Minimal 4 karakter'}
              hint={form.id ? 'Kosongkan jika tidak ingin mengubah password' : 'Password default: 123456'}
            />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Status Akun
              </label>
              <div className="flex items-center gap-4 h-10">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={form.isActive}
                    onChange={() => setForm({ ...form, isActive: true })}
                    className="h-4 w-4 text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-slate-600 dark:text-slate-400">Aktif</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={!form.isActive}
                    onChange={() => setForm({ ...form, isActive: false })}
                    className="h-4 w-4 text-danger focus:ring-danger"
                  />
                  <span className="text-sm text-slate-600 dark:text-slate-400">Nonaktif</span>
                </label>
              </div>
              {!form.isActive && (
                <p className="text-xs text-amber-600">
                  User nonaktif tidak dapat login ke sistem
                </p>
              )}
            </div>
          </div>

          {/* Role Info */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">YANG DAPAT DIAKSES:</p>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              {ROLE_DESCRIPTIONS[form.role]}
            </p>
          </div>
        </div>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        open={resetPassOpen}
        onClose={() => setResetPassOpen(false)}
        title="Reset Password"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setResetPassOpen(false)}>Batal</Button>
            <Button onClick={handleResetPassword} loading={saving}>
              Reset Password
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/50">
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Reset password untuk <strong>{selectedUser?.name}</strong> ({selectedUser?.email})
            </p>
          </div>
          <Input
            label="Password Baru"
            type="password"
            required
            value={resetPassword}
            onChange={(e) => setResetPassword(e.target.value)}
            placeholder="Minimal 4 karakter"
            hint="User akan login dengan password baru ini"
          />
        </div>
      </Modal>

      {/* Face Descriptor Modal */}
      <Modal
        open={faceModalOpen}
        onClose={() => { setFaceModalOpen(false); setSelectedEmployee(null); setViewingFace(false); }}
        title="Face Descriptor - Koleksi Wajah"
        footer={
          <>
            <Button variant="outline" onClick={() => { setFaceModalOpen(false); setSelectedEmployee(null); setViewingFace(false); }}>Tutup</Button>
            {selectedEmployee?.faceDescriptor && !viewingFace && (
              <Button onClick={() => setViewingFace(true)}>
                <Eye className="h-4 w-4" /> Lihat Full Descriptor
              </Button>
            )}
          </>
        }
      >
        {selectedEmployee && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {selectedEmployee.fullName} ({selectedEmployee.employeeId})
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Status: {selectedEmployee.faceRegistered ? (
                  <span className="text-emerald-600 font-medium">✓ Terdaftar</span>
                ) : (
                  <span className="text-red-600 font-medium">✗ Belum Terdaftar</span>
                )}
              </p>
            </div>

            {!viewingFace ? (
              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-start gap-2">
                    <Scan className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-800 dark:text-blue-300">
                      <p className="font-medium mb-1">Koleksi Face Descriptor</p>
                      <p className="text-xs">
                        Face descriptor adalah representasi matematis dari wajah karyawan (128 fitur).
                        Data ini disimpan di spreadsheet <strong>EMPLOYEE</strong> sheet dan digunakan untuk verifikasi absensi.
                      </p>
                    </div>
                  </div>
                </div>

                {selectedEmployee.faceDescriptor ? (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Face Descriptor (Preview)
                    </label>
                    <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 font-mono text-xs break-all max-h-40 overflow-y-auto">
                      {selectedEmployee.faceDescriptor.substring(0, 200)}...
                    </div>
                    <p className="text-xs text-slate-500">
                      Total: {JSON.parse(selectedEmployee.faceDescriptor).length} features
                    </p>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                    <p className="text-sm text-red-800 dark:text-red-300">
                      Karyawan ini belum melakukan pendaftaran wajah (Face Enrollment).
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-2">
                    ⚠️ Face Descriptor Lengkap (128 Fitur)
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Jangan bagikan data ini kepada pihak yang tidak berwenang. Data ini digunakan untuk verifikasi identitas karyawan.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Full Face Descriptor Array
                  </label>
                  <pre className="font-mono text-xs break-all max-h-96 overflow-y-auto p-3 bg-white dark:bg-slate-900 rounded-lg">
                    {selectedEmployee.faceDescriptor}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}