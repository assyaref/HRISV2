import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  CalendarCheck,
  CalendarOff,
  ClipboardList,
  ChevronRight,
  Megaphone,
  User,
  LogOut,
  Bell,
  MapPin,
  Camera,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { getDashboard, checkIn, checkOut, getCurrentSession } from '../services/api';
import type { DashboardStats, Attendance } from '../types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatDate, formatTime, todayStr, getCurrentPosition } from '../lib/utils';
import { db } from '../lib/db';
import { cn } from '../lib/utils';
import { validateFace } from '../services/faceRecognition';

export function EmployeeDashboard() {
  const { session, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [checkType, setCheckType] = useState<'in' | 'out'>('in');
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [faceDescriptor, setFaceDescriptor] = useState<number[] | null>(null);
  const [faceVerified, setFaceVerified] = useState(false);

  const today = todayStr();
  const todayAtt = stats?.recentAttendance?.find(
    (a) => a.employeeId === session?.employeeId && a.date === today
  );

  const load = async () => {
    setLoading(true);
    const res = await getDashboard();
    if (res.success && res.data) setStats(res.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  const getLocation = async () => {
    try {
      const pos = await getCurrentPosition();
      setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch {
      // GPS not available
    }
  };

  const startCheck = async (type: 'in' | 'out') => {
    setCheckType(type);
    setPhoto(null);
    setShowCamera(true);
    await getLocation();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 320, height: 240 },
        audio: false,
      });
      setVideoStream(stream);
    } catch {
      // Camera not available
    }
  };

  const capturePhoto = () => {
    const video = document.querySelector('video');
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 320;
    canvas.height = video.videoHeight || 240;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const photoData = canvas.toDataURL('image/jpeg', 0.6);
      setPhoto(photoData);

      // Validasi wajah dan ekstrak descriptor
      const validation = validateFace(canvas);
      if (validation.detected && validation.descriptor) {
        setFaceDescriptor(validation.descriptor);
        setFaceVerified(true);
      } else {
        setFaceDescriptor(null);
        setFaceVerified(false);
      }
    }
  };

  const stopCamera = () => {
    videoStream?.getTracks().forEach((t) => t.stop());
    setVideoStream(null);
    setShowCamera(false);
    setPhoto(null);
    setFaceDescriptor(null);
    setFaceVerified(false);
  };

  const submitCheck = async () => {
    setChecking(true);
    const payload = {
      lat: location?.lat,
      lng: location?.lng,
      photo: photo || undefined,
      faceDescriptor: faceDescriptor || undefined,
      faceVerified: faceVerified || undefined,
    };
    const res = checkType === 'in' ? await checkIn(payload) : await checkOut(payload);
    setChecking(false);

    if (res.success) {
      toast.success(res.message);
      stopCamera();
      load();
    } else {
      toast.error(res.message);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const now = new Date();
  const timeStr = now.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const employee = session?.employeeId ? db.getEmployeeById(session.employeeId) : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary to-primary/90 text-white">
      {/* Header */}
      <div className="px-4 pt-4 pb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
              <User className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-white/70">Selamat datang,</p>
              <p className="font-semibold">{session?.name || 'Karyawan'}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        {/* Clock */}
        <div className="text-center py-4">
          <p className="text-5xl font-bold tabular-nums tracking-wider">{timeStr}</p>
          <p className="text-sm text-white/60 mt-1">{formatDate(today, 'EEEE, dd MMMM yyyy')}</p>
        </div>

        {/* Check In/Out Status */}
        <div className="flex items-center justify-center gap-4 mt-2">
          <div className="text-center">
            <p className="text-xs text-white/60">Check In</p>
            <p className="font-semibold">{formatTime(todayAtt?.checkIn) || '—'}</p>
          </div>
          <div className="h-8 w-px bg-white/20" />
          <div className="text-center">
            <p className="text-xs text-white/60">Check Out</p>
            <p className="font-semibold">{formatTime(todayAtt?.checkOut) || '—'}</p>
          </div>
          <div className="h-8 w-px bg-white/20" />
          <div className="text-center">
            <p className="text-xs text-white/60">Status</p>
            <p className="font-semibold">
              {todayAtt ? (
                todayAtt.status === 'Present' ? 'Hadir' : 'Terlambat'
              ) : 'Belum'}
            </p>
          </div>
        </div>
      </div>

      {/* Check In/Out Buttons */}
      <div className="px-4 -mt-2">
        <div className="bg-white rounded-2xl p-4 shadow-lg">
          <div className="flex gap-3">
            <button
              onClick={() => startCheck('in')}
              disabled={!!todayAtt?.checkIn}
              className={cn(
                'flex-1 py-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2',
                todayAtt?.checkIn
                  ? 'bg-slate-100 text-slate-400'
                  : 'bg-primary text-white shadow-lg shadow-primary/30 active:scale-[0.98]'
              )}
            >
              <Clock className="h-5 w-5" />
              Check In
            </button>
            <button
              onClick={() => startCheck('out')}
              disabled={!todayAtt?.checkIn || !!todayAtt?.checkOut}
              className={cn(
                'flex-1 py-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2',
                !todayAtt?.checkIn || todayAtt?.checkOut
                  ? 'bg-slate-100 text-slate-400'
                  : 'bg-secondary text-white shadow-lg shadow-secondary/30 active:scale-[0.98]'
              )}
            >
              <Clock className="h-5 w-5" />
              Check Out
            </button>
          </div>
        </div>
      </div>

      {/* Quick Menu */}
      <div className="px-4 mt-4">
        <div className="bg-white rounded-2xl p-4 shadow-lg">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Menu Cepat</p>
          <div className="grid grid-cols-4 gap-2">
            {[
              { icon: CalendarCheck, label: 'Cuti', path: '/leave', color: 'text-emerald-600 bg-emerald-50' },
              { icon: ClipboardList, label: 'Izin', path: '/permission', color: 'text-amber-600 bg-amber-50' },
              { icon: Clock, label: 'Riwayat', path: '/attendance', color: 'text-blue-600 bg-blue-50' },
              { icon: User, label: 'Profil', path: '/profile', color: 'text-purple-600 bg-purple-50' },
            ].map((item) => (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-slate-50 active:scale-95 transition-all"
              >
                <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center', item.color)}>
                  <item.icon className="h-5 w-5" />
                </div>
                <span className="text-[11px] font-medium text-slate-600">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Today's Info */}
      <div className="px-4 mt-4 pb-24">
        <div className="bg-white rounded-2xl p-4 shadow-lg">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Info Hari Ini</p>
          
          {employee && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 mb-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800">{employee.fullName}</p>
                <p className="text-xs text-slate-400">{employee.employeeId}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300" />
            </div>
          )}

          {/* Announcements */}
          {stats?.announcements && stats.announcements.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                <Megaphone className="h-3.5 w-3.5" /> Pengumuman
              </p>
              {stats.announcements.slice(0, 2).map((a) => (
                <div
                  key={a.id}
                  className="p-3 rounded-xl bg-amber-50 border border-amber-100"
                >
                  <div className="flex items-start gap-2">
                    <Megaphone className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-amber-800">{a.title}</p>
                      <p className="text-xs text-amber-600 mt-0.5 line-clamp-2">{a.content}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {(!stats?.announcements || stats.announcements.length === 0) && (
            <div className="text-center py-6">
              <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Tidak ada pengumuman baru</p>
            </div>
          )}
        </div>
      </div>

      {/* Camera Modal */}
      {showCamera && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-black/50">
            <button onClick={stopCamera} className="text-white text-sm font-medium">
              Batal
            </button>
            <p className="text-white font-semibold">
              {checkType === 'in' ? 'Check In' : 'Check Out'}
            </p>
            <div className="w-10" />
          </div>

          {/* Camera Preview */}
          <div className="flex-1 flex items-center justify-center relative">
            {photo ? (
              <img src={photo} alt="Selfie" className="w-full h-full object-cover" />
            ) : (
              <>
                {videoStream ? (
                  <video
                    autoPlay
                    playsInline
                    muted
                    ref={(ref) => {
                      if (ref) ref.srcObject = videoStream;
                    }}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-white text-center">
                    <Camera className="h-16 w-16 mx-auto mb-3 opacity-50" />
                    <p className="text-sm opacity-70">Kamera tidak tersedia</p>
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-40 h-48 border-2 border-white/30 rounded-full" />
                </div>
              </>
            )}
          </div>

          {/* Location */}
          {location && (
            <div className="px-4 py-2 bg-black/30">
              <div className="flex items-center gap-1.5 text-xs text-white/60">
                <MapPin className="h-3 w-3" />
                {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="px-4 py-6 bg-black/30">
            <div className="flex gap-3 justify-center">
              {!photo ? (
                <button
                  onClick={capturePhoto}
                  className="h-14 w-14 rounded-full border-4 border-white flex items-center justify-center active:scale-90 transition-transform"
                >
                  <div className="h-10 w-10 rounded-full bg-white" />
                </button>
              ) : (
                <div className="flex gap-3">
                  <button
                    onClick={() => setPhoto(null)}
                    className="px-6 py-3 rounded-xl bg-white/10 text-white font-medium text-sm"
                  >
                    Ulangi
                  </button>
                  <button
                    onClick={submitCheck}
                    disabled={checking}
                    className="px-8 py-3 rounded-xl bg-primary text-white font-semibold text-sm shadow-lg disabled:opacity-50"
                  >
                    {checking ? 'Memproses...' : 'Konfirmasi'}
                  </button>
                </div>
              )}
            </div>
            <p className="text-center text-xs text-white/50 mt-3">
              Ambil foto untuk verifikasi kehadiran
            </p>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5 h-16">
          {[
            { icon: Clock, label: 'Absensi', path: '/attendance', active: false },
            { icon: CalendarCheck, label: 'Cuti', path: '/leave', active: false },
            { icon: null, label: '', path: '/dashboard', active: true, isCenter: true },
            { icon: ClipboardList, label: 'Izin', path: '/permission', active: false },
            { icon: User, label: 'Profil', path: '/profile', active: false },
          ].map((item, i) => {
            if (item.isCenter) {
              return (
                <div key={i} className="flex items-center justify-center">
                  <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/30 -mt-4">
                    <Clock className="h-6 w-6 text-white" />
                  </div>
                </div>
              );
            }
            const Icon = item.icon!;
            return (
              <button
                key={i}
                onClick={() => navigate(item.path)}
                className="flex flex-col items-center justify-center gap-0.5"
              >
                <Icon className={cn('h-5 w-5', item.active ? 'text-primary' : 'text-slate-400')} />
                <span className={cn('text-[10px] font-medium', item.active ? 'text-primary' : 'text-slate-400')}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}