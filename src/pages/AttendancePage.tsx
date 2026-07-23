import { useEffect, useState, useCallback, useRef } from 'react';
import { LogIn, LogOut, MapPin, Camera, Download, Clock, Navigation } from 'lucide-react';
import * as api from '../services/api';
import type { Attendance } from '../types';
import { Card, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { DataTable, type Column } from '../components/ui/DataTable';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatTime, exportToExcel, getCurrentPosition, todayStr } from '../lib/utils';
import { db } from '../lib/db';
import { validateFace, type FaceValidationResult } from '../services/faceRecognition';

export function AttendancePage() {
  const toast = useToast();
  const { session, isHR, isManager } = useAuth();
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [checkType, setCheckType] = useState<'in' | 'out'>('in');
  const [photo, setPhoto] = useState<string | null>(null);
  const [faceDescriptor, setFaceDescriptor] = useState<number[] | null>(null);
  const [faceValidation, setFaceValidation] = useState<FaceValidationResult | null>(null);
  const [faceVerified, setFaceVerified] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const todayAtt = attendances.find(
    (a) => a.employeeId === session?.employeeId && a.date === todayStr()
  );

  const load = useCallback(async () => {
    setLoading(true);
    const filters: { employeeId?: string; dateFrom?: string; dateTo?: string } = {};
    if (!isHR && !isManager && session?.employeeId) {
      filters.employeeId = session.employeeId;
    }
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;
    const res = await api.getAttendances(filters);
    if (res.success && res.data) setAttendances(res.data);
    setLoading(false);
  }, [session, isHR, isManager, dateFrom, dateTo]);

  useEffect(() => {
    load();
  }, [load]);

  const getLocation = async () => {
    setLocLoading(true);
    try {
      const pos = await getCurrentPosition();
      setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      toast.success('Lokasi berhasil didapatkan');
    } catch {
      toast.warning('Tidak dapat mengakses GPS. Check-in tetap bisa dilanjutkan.');
      setLocation(null);
    }
    setLocLoading(false);
  };

  const startCamera = async (type: 'in' | 'out') => {
    setCheckType(type);
    setPhoto(null);
    setFaceDescriptor(null);
    setFaceValidation(null);
    setFaceVerified(false);
    setCameraOpen(true);
    await getLocation();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      toast.warning('Kamera tidak tersedia. Anda dapat check-in tanpa foto.');
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      const photoData = canvas.toDataURL('image/jpeg', 0.7);
      setPhoto(photoData);
      
      // Validate face and extract descriptor
      const validation = validateFace(canvas);
      setFaceValidation(validation);
      
      if (validation.detected && validation.descriptor) {
        setFaceDescriptor(validation.descriptor);
        setFaceVerified(true);
        toast.success('Wajah terdeteksi!');
      } else {
        setFaceDescriptor(null);
        setFaceVerified(false);
        toast.warning(validation.message || 'Wajah tidak terdeteksi dengan baik. Silakan coba lagi.');
      }
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOpen(false);
    setPhoto(null);
    setFaceDescriptor(null);
    setFaceValidation(null);
    setFaceVerified(false);
  };

  const submitCheck = async () => {
    setChecking(true);
    
    // Build payload with face verification data
    const payload = {
      lat: location?.lat,
      lng: location?.lng,
      photo: photo || undefined,
      faceDescriptor: faceDescriptor || undefined,
      faceVerified: faceVerified || undefined,
    };
    
    const res = checkType === 'in' ? await api.checkIn(payload) : await api.checkOut(payload);
    setChecking(false);
    if (res.success) {
      toast.success(res.message);
      stopCamera();
      load();
    } else {
      toast.error(res.message);
    }
  };

  const handleExport = () => {
    const data = attendances.map((a) => ({
      Tanggal: a.date,
      Karyawan: db.getEmployeeById(a.employeeId)?.fullName || a.employeeId,
      'Check In': a.checkIn || '-',
      'Check Out': a.checkOut || '-',
      Status: a.status,
      'Jam Kerja': a.workHours ?? '-',
      'Terlambat (mnt)': a.lateMinutes ?? 0,
      'Lat In': a.checkInLat ?? '',
      'Lng In': a.checkInLng ?? '',
    }));
    exportToExcel(data, 'data-absensi');
    toast.success('Data absensi diexport');
  };

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const columns: Column<Attendance & Record<string, unknown>>[] = [
    {
      key: 'date',
      label: 'Tanggal',
      sortable: true,
      render: (row) => formatDate(row.date),
    },
    {
      key: 'employeeId',
      label: 'Karyawan',
      render: (row) => db.getEmployeeById(row.employeeId)?.fullName || row.employeeId,
    },
    {
      key: 'checkIn',
      label: 'Check In',
      render: (row) => (
        <span className={row.status === 'Late' ? 'text-amber-600 font-medium' : ''}>
          {formatTime(row.checkIn)}
        </span>
      ),
    },
    {
      key: 'checkOut',
      label: 'Check Out',
      render: (row) => formatTime(row.checkOut),
    },
    {
      key: 'workHours',
      label: 'Jam Kerja',
      className: 'hidden md:table-cell',
      render: (row) => (row.workHours != null ? `${row.workHours}h` : '-'),
    },
    {
      key: 'lateMinutes',
      label: 'Terlambat',
      className: 'hidden lg:table-cell',
      render: (row) => (row.lateMinutes ? `${row.lateMinutes} mnt` : '-'),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (row) => <Badge status={row.status}>{row.status}</Badge>,
    },
  ];

  const now = new Date();
  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Check In/Out Card */}
      {session?.employeeId && (
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-primary to-secondary p-6 text-white">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="text-white/70 text-sm">Hari ini · {formatDate(todayStr())}</p>
                <p className="text-3xl font-bold mt-1 tabular-nums" id="live-clock">{timeStr}</p>
                <div className="flex items-center gap-4 mt-3 text-sm">
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-white/70" />
                    In: {formatTime(todayAtt?.checkIn) || '—'}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-white/70" />
                    Out: {formatTime(todayAtt?.checkOut) || '—'}
                  </span>
                  {todayAtt && <Badge status={todayAtt.status}>{todayAtt.status}</Badge>}
                </div>
              </div>
              <div className="flex gap-3">
                <Button
                  size="lg"
                  className="bg-white text-primary hover:bg-white/90 shadow-lg"
                  disabled={!!todayAtt?.checkIn}
                  onClick={() => startCamera('in')}
                >
                  <LogIn className="h-5 w-5" /> Check In
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/40 text-white hover:bg-white/10"
                  disabled={!todayAtt?.checkIn || !!todayAtt?.checkOut}
                  onClick={() => startCamera('out')}
                >
                  <LogOut className="h-5 w-5" /> Check Out
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* History */}
      <Card>
        <CardBody className="pt-5">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <Input type="date" label="Dari" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="sm:w-44" />
            <Input type="date" label="Sampai" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="sm:w-44" />
          </div>
          <DataTable
            columns={columns as Column<Record<string, unknown>>[]}
            data={attendances as unknown as Record<string, unknown>[]}
            searchKeys={['employeeId', 'status', 'date']}
            searchPlaceholder="Cari absensi..."
            loading={loading}
            toolbar={
              <Button size="sm" variant="outline" onClick={handleExport}>
                <Download className="h-4 w-4" /> Export
              </Button>
            }
          />
        </CardBody>
      </Card>

      {/* Camera Modal */}
      <Modal
        open={cameraOpen}
        onClose={stopCamera}
        title={checkType === 'in' ? 'Check In - Verifikasi Wajah' : 'Check Out - Verifikasi Wajah'}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={stopCamera}>Batal</Button>
            <Button 
              onClick={submitCheck} 
              loading={checking}
              disabled={!faceVerified && !photo}
            >
              {checking ? 'Memproses...' : (checkType === 'in' ? 'Konfirmasi Check In' : 'Konfirmasi Check Out')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Camera / Photo */}
          <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-video flex items-center justify-center">
            {photo ? (
              <img src={photo} alt="Selfie" className="w-full h-full object-cover" />
            ) : (
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover mirror" />
            )}
            {!photo && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-40 h-48 border-2 border-white/40 rounded-full" />
              </div>
            )}
          </div>

          {/* Face Validation Status */}
          {faceValidation && (
            <div className={`p-3 rounded-xl text-sm ${
              faceValidation.detected 
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 text-emerald-700 dark:text-emerald-300'
                : 'bg-red-50 dark:bg-red-950/30 border border-red-200 text-red-700 dark:text-red-300'
            }`}>
              <div className="flex items-center gap-2">
                {faceValidation.detected ? (
                  <span>✅ Wajah terverifikasi ({faceValidation.confidence}%)</span>
                ) : (
                  <span>❌ {faceValidation.message}</span>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-center">
            {!photo ? (
              <Button variant="secondary" onClick={capturePhoto} size="lg" className="w-full">
                <Camera className="h-5 w-5" /> Ambil Foto & Verifikasi Wajah
              </Button>
            ) : (
              <div className="flex gap-2 w-full">
                <Button variant="outline" onClick={() => setPhoto(null)} className="flex-1">
                  <Camera className="h-4 w-4" /> Ulangi
                </Button>
                <Button variant="outline" onClick={getLocation} loading={locLoading}>
                  <Navigation className="h-4 w-4" /> GPS
                </Button>
              </div>
            )}
          </div>

          {location && (
            <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-2">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              Lat: {location.lat.toFixed(6)}, Lng: {location.lng.toFixed(6)}
            </div>
          )}

          {/* Face Verification Instructions */}
          {!photo && (
            <div className="text-center text-sm text-slate-500 space-y-1">
              <p className="font-medium text-slate-700 dark:text-slate-300">Verifikasi Wajah Diperlukan</p>
              <p>Ambil foto untuk memverifikasi identitas Anda</p>
              <p className="text-xs text-slate-400">Pastikan wajah terlihat jelas dan pencahayaan cukup</p>
            </div>
          )}
          
          {photo && !faceVerified && (
            <div className="text-center text-sm text-amber-600">
              <p>Wajah tidak terverifikasi. Silakan ambil foto ulang dengan posisi yang lebih baik.</p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}