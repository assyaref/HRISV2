import { useState, type FormEvent } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Building2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { DEMO_ACCOUNTS } from '../data/mockData';

export function LoginPage() {
  const { session, login, loading: authLoading } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  if (authLoading) return null;
  if (session) return <Navigate to="/dashboard" replace />;

  const validate = () => {
    const e: typeof errors = {};
    if (!email) e.email = 'Email wajib diisi';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Format email tidak valid';
    if (!password) e.password = 'Password wajib diisi';
    else if (password.length < 4) e.password = 'Password minimal 4 karakter';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await login(email, password, remember);
      if (res.success) {
        toast.success('Login berhasil! Selamat datang.');
        navigate('/dashboard');
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error('Terjadi kesalahan. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (acc: (typeof DEMO_ACCOUNTS)[0]) => {
    setEmail(acc.email);
    setPassword(acc.password);
    setErrors({});
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative bg-gradient-to-br from-primary via-secondary to-primary overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute top-1/2 left-1/3 w-48 h-48 rounded-full bg-white/15 blur-2xl" />
        </div>
        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <p className="font-bold text-lg">HRIS Lite</p>
              <p className="text-xs text-white/70 uppercase tracking-widest">Enterprise</p>
            </div>
          </div>
          <div className="space-y-6 max-w-md">
            <h1 className="text-4xl xl:text-5xl font-bold leading-tight">
              Kelola SDM Perusahaan dengan Mudah
            </h1>
            <p className="text-white/80 text-lg leading-relaxed">
              Platform HRIS modern untuk absensi, cuti, payroll, dan manajemen karyawan — semuanya dalam satu tempat.
            </p>
            <div className="grid grid-cols-3 gap-4 pt-4">
              {[
                { n: '10+', l: 'Modul' },
                { n: '4', l: 'Role Akses' },
                { n: '100%', l: 'Responsive' },
              ].map((s) => (
                <div key={s.l} className="bg-white/10 backdrop-blur rounded-2xl p-4 text-center">
                  <p className="text-2xl font-bold">{s.n}</p>
                  <p className="text-xs text-white/70 mt-1">{s.l}</p>
                </div>
              ))}
            </div>
          </div>
          <p className="text-white/50 text-sm">© 2026 HRIS Lite Enterprise. All rights reserved.</p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-bg dark:bg-slate-950">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
              <span className="text-white font-bold text-sm">HR</span>
            </div>
            <div>
              <p className="font-bold text-slate-800 dark:text-white">HRIS Lite</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest">Enterprise</p>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Selamat Datang</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Masuk ke akun Anda untuk melanjutkan</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Email"
              type="email"
              placeholder="nama@perusahaan.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              icon={<Mail className="h-4 w-4" />}
              autoComplete="email"
            />
            <div className="relative">
              <Input
                label="Password"
                type={showPass ? 'text' : 'password'}
                placeholder="Masukkan password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors.password}
                icon={<Lock className="h-4 w-4" />}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-[38px] text-slate-400 hover:text-slate-600"
              >
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                />
                <span className="text-sm text-slate-600 dark:text-slate-400">Ingat saya</span>
              </label>
              <button type="button" className="text-sm text-primary hover:underline font-medium">
                Lupa password?
              </button>
            </div>

            <Button type="submit" className="w-full" size="lg" loading={loading}>
              Masuk
            </Button>
          </form>

          {/* Demo accounts */}
          <div className="space-y-3">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-slate-800" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-bg dark:bg-slate-950 px-3 text-xs text-slate-400">Akun Demo</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => fillDemo(acc)}
                  className="text-left px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-primary/40 hover:bg-primary/5 transition-all text-xs"
                >
                  <p className="font-semibold text-slate-700 dark:text-slate-200">{acc.role}</p>
                  <p className="text-slate-400 truncate mt-0.5">{acc.email}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
