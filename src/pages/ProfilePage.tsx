import { useState } from 'react';
import { Camera, Save, Lock, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Card, CardHeader, CardTitle, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { compressImage } from '../lib/utils';
import * as api from '../services/api';
import { db } from '../lib/db';
import { formatDate, formatCurrency } from '../lib/utils';

export function ProfilePage() {
  const { session, refresh } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(session?.name || '');
  const [avatar, setAvatar] = useState(session?.avatar || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [changingPass, setChangingPass] = useState(false);

  const employee = (session?.employeeId ? db.getEmployeeById(session.employeeId) : null)
    || (session?.email ? db.getEmployees().find(e => e.email.toLowerCase() === session.email.toLowerCase()) : null);

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      setAvatar(compressed);
    } catch {
      toast.error('Gagal memproses foto');
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    const res = await api.updateProfile({ name, avatar });
    setSaving(false);
    if (res.success) {
      toast.success(res.message);
      refresh();
    } else toast.error(res.message);
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      toast.error('Lengkapi semua field password');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password baru minimal 6 karakter');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Konfirmasi password tidak cocok');
      return;
    }
    setChangingPass(true);
    const res = await api.updateProfile({ currentPassword, password: newPassword });
    setChangingPass(false);
    if (res.success) {
      toast.success('Password berhasil diubah');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else toast.error(res.message);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      {/* Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" /> Informasi Profil
          </CardTitle>
        </CardHeader>
        <CardBody className="space-y-6">
          <div className="flex items-center gap-5">
            <div className="relative">
              <Avatar name={name || 'User'} src={avatar} size="xl" />
              <label className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center cursor-pointer shadow-md hover:bg-primary-dark transition-colors">
                <Camera className="h-4 w-4" />
                <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
              </label>
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">{session?.name}</h3>
              <p className="text-sm text-slate-400">{session?.email}</p>
              <Badge role={session?.role} className="mt-1">{session?.role}</Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Nama" value={name} onChange={(e) => setName(e.target.value)} />
            <Input label="Email" value={session?.email || ''} disabled />
          </div>

          <Button onClick={handleSaveProfile} loading={saving}>
            <Save className="h-4 w-4" /> Simpan Profil
          </Button>
        </CardBody>
      </Card>

      {/* Employee Info */}
      {employee && (
        <Card>
          <CardHeader>
            <CardTitle>Data Karyawan</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              {[
                ['Employee ID', employee.employeeId],
                ['NIK', employee.nik],
                ['Departemen', db.getDepartmentById(employee.departmentId)?.name],
                ['Divisi', db.getDivisionById(employee.divisionId)?.name],
                ['Jabatan', db.getPositionById(employee.positionId)?.name],
                ['Tanggal Masuk', formatDate(employee.joinDate)],
                ['Status', employee.employmentStatus],
                ['Gaji', formatCurrency(employee.salary)],
                ['Telepon', employee.phone],
                ['Alamat', employee.address],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <p className="text-xs text-slate-400 mb-0.5">{label}</p>
                  <p className="font-medium text-slate-700 dark:text-slate-200">{value || '-'}</p>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" /> Ubah Password
          </CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <Input label="Password Saat Ini" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          <Input label="Password Baru" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <Input label="Konfirmasi Password Baru" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          <Button onClick={handleChangePassword} loading={changingPass} variant="secondary">
            <Lock className="h-4 w-4" /> Ubah Password
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
