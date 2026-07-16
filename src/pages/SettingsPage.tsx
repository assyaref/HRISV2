import { useEffect, useState } from 'react';
import { Save, Download, Upload, RotateCcw, Building2, Clock, MapPin, Palette } from 'lucide-react';
import Swal from 'sweetalert2';
import * as api from '../services/api';
import type { CompanySetting } from '../types';
import { Card, CardHeader, CardTitle, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import { compressImage, downloadBlob } from '../lib/utils';
import { db } from '../lib/db';

export function SettingsPage() {
  const toast = useToast();
  const { setTheme } = useTheme();
  const [form, setForm] = useState<CompanySetting | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getSettings().then((res) => {
      if (res.success && res.data) setForm(res.data);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    const res = await api.saveSettings(form);
    setSaving(false);
    if (res.success) {
      toast.success(res.message);
      if (form.theme === 'dark' || form.theme === 'light') setTheme(form.theme);
    } else toast.error(res.message);
  };

  const handleLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !form) return;
    try {
      const compressed = await compressImage(file, 400, 0.8);
      setForm({ ...form, companyLogo: compressed });
    } catch {
      toast.error('Gagal memproses logo');
    }
  };

  const handleBackup = async () => {
    const res = await api.backupDatabase();
    if (res.success && res.data) {
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      downloadBlob(blob, `hris-backup-${new Date().toISOString().slice(0, 10)}.json`);
      toast.success('Backup berhasil diunduh');
    } else toast.error(res.message);
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const result = await Swal.fire({
        title: 'Restore Database?',
        text: 'Data saat ini akan diganti. Pastikan Anda sudah backup.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#D32F2F',
        confirmButtonText: 'Restore',
        cancelButtonText: 'Batal',
      });
      if (!result.isConfirmed) return;
      const res = await api.restoreDatabase(data);
      if (res.success) {
        toast.success(res.message);
        window.location.reload();
      } else toast.error(res.message);
    } catch {
      toast.error('File backup tidak valid');
    }
    e.target.value = '';
  };

  const handleReset = async () => {
    const result = await Swal.fire({
      title: 'Reset Database?',
      text: 'Semua data akan dikembalikan ke kondisi awal (demo data).',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#D32F2F',
      confirmButtonText: 'Reset',
      cancelButtonText: 'Batal',
    });
    if (!result.isConfirmed) return;
    db.reset();
    toast.success('Database direset ke data demo');
    window.location.reload();
  };

  if (loading || !form) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-10 w-10 border-3 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      {/* Company Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" /> Profil Perusahaan
          </CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          {form.companyLogo && (
            <img src={form.companyLogo} alt="Logo" className="h-16 object-contain rounded-xl" />
          )}
          <label className="cursor-pointer text-sm text-primary font-medium hover:underline">
            Upload Logo
            <input type="file" accept="image/*" className="hidden" onChange={handleLogo} />
          </label>
          <Input label="Nama Perusahaan" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
          <Input label="Alamat" value={form.companyAddress} onChange={(e) => setForm({ ...form, companyAddress: e.target.value })} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Telepon" value={form.companyPhone} onChange={(e) => setForm({ ...form, companyPhone: e.target.value })} />
            <Input label="Email" value={form.companyEmail} onChange={(e) => setForm({ ...form, companyEmail: e.target.value })} />
          </div>
        </CardBody>
      </Card>

      {/* Working Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" /> Jam Kerja
          </CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input label="Jam Masuk" type="time" value={form.workStartTime} onChange={(e) => setForm({ ...form, workStartTime: e.target.value })} />
            <Input label="Jam Pulang" type="time" value={form.workEndTime} onChange={(e) => setForm({ ...form, workEndTime: e.target.value })} />
            <Input label="Toleransi Terlambat (mnt)" type="number" value={form.lateToleranceMinutes} onChange={(e) => setForm({ ...form, lateToleranceMinutes: Number(e.target.value) })} />
          </div>
          <Input label="Kuota Cuti Tahunan" type="number" value={form.annualLeaveQuota} onChange={(e) => setForm({ ...form, annualLeaveQuota: Number(e.target.value) })} />
        </CardBody>
      </Card>

      {/* Office Location */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" /> Lokasi Kantor
          </CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input label="Latitude" type="number" step="any" value={form.officeLat} onChange={(e) => setForm({ ...form, officeLat: Number(e.target.value) })} />
            <Input label="Longitude" type="number" step="any" value={form.officeLng} onChange={(e) => setForm({ ...form, officeLng: Number(e.target.value) })} />
            <Input label="Radius (meter)" type="number" value={form.officeRadiusMeters} onChange={(e) => setForm({ ...form, officeRadiusMeters: Number(e.target.value) })} />
          </div>
        </CardBody>
      </Card>

      {/* Theme */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" /> Tema
          </CardTitle>
        </CardHeader>
        <CardBody>
          <div className="flex gap-3">
            {(['light', 'dark'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setForm({ ...form, theme: t })}
                className={`px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                  form.theme === t
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                {t === 'light' ? '☀️ Terang' : '🌙 Gelap'}
              </button>
            ))}
          </div>
        </CardBody>
      </Card>

      <Button onClick={handleSave} loading={saving} size="lg">
        <Save className="h-4 w-4" /> Simpan Pengaturan
      </Button>

      {/* Backup / Restore */}
      <Card>
        <CardHeader>
          <CardTitle>Backup & Restore</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={handleBackup}>
            <Download className="h-4 w-4" /> Backup Database
          </Button>
          <label>
            <Button variant="outline" as-child>
              <span className="inline-flex items-center gap-2 cursor-pointer">
                <Upload className="h-4 w-4" /> Restore Database
              </span>
            </Button>
            <input type="file" accept=".json" className="hidden" onChange={handleRestore} />
          </label>
          <Button variant="danger" onClick={handleReset}>
            <RotateCcw className="h-4 w-4" /> Reset ke Demo
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
