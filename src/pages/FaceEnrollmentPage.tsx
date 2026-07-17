import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, CheckCircle2, XCircle, User, Shield, Upload, RefreshCw } from 'lucide-react';
import Swal from 'sweetalert2';
import * as api from '../services/api';
import { validateFace } from '../services/faceRecognition';
import { Card, CardBody, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/db';
import { cn } from '../lib/utils';

export function FaceEnrollmentPage() {
  const toast = useToast();
  const { session } = useAuth();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [validation, setValidation] = useState<ReturnType<typeof validateFace> | null>(null);
  const [enrolled, setEnrolled] = useState(false);
  const [loading, setLoading] = useState(true);

  const employee = session?.employeeId ? db.getEmployeeById(session.employeeId) : null;

  useEffect(() => {
    checkEnrollmentStatus();
    return () => stopCamera();
  }, []);

  const checkEnrollmentStatus = async () => {
    const res = await api.getFaceEnrollmentStatus();
    if (res.success && res.data) {
      setEnrolled(res.data.enrolled);
    }
    setLoading(false);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
      setValidation(null);
    } catch {
      toast.error('Tidak dapat mengakses kamera. Pastikan izin kamera diberikan.');
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraActive(false);
    setValidation(null);
  };

  const captureAndValidate = () => {
    if (!videoRef.current) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      const result = validateFace(canvas);
      setValidation(result);
      
      if (result.detected && result.descriptor) {
        toast.success('Wajah terdeteksi! Klik "Daftarkan Wajah" untuk menyimpan.');
      } else {
        toast.warning(result.message);
      }
    }
  };

  const handleEnroll = async () => {
    if (!validation?.descriptor) {
      toast.error('Ambil foto terlebih dahulu');
      return;
    }

    setEnrolling(true);
    const res = await api.enrollFace(validation.descriptor);
    setEnrolling(false);

    if (res.success) {
      toast.success('Wajah berhasil didaftarkan!');
      setEnrolled(true);
      stopCamera();
    } else {
      toast.error(res.message);
    }
  };

  const handleReset = async () => {
    const result = await Swal.fire({
      title: 'Reset Pendaftaran Wajah?',
      text: 'Anda akan menghapus data wajah yang terdaftar dan harus mendaftar ulang.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#D32F2F',
      confirmButtonText: 'Reset',
      cancelButtonText: 'Batal',
    });

    if (!result.isConfirmed) return;

    // Reset face enrollment
    if (session?.employeeId && employee) {
      const employees = db.getEmployees();
      const idx = employees.findIndex((e) => e.id === session.employeeId);
      if (idx >= 0) {
        employees[idx].faceDescriptor = undefined;
        employees[idx].faceRegistered = false;
        db.setEmployees(employees);
        setEnrolled(false);
        toast.success('Pendaftaran wajah berhasil direset');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Pendaftaran Wajah</h1>
        <p className="text-sm text-slate-500 mt-1">
          Daftarkan wajah Anda untuk verifikasi absensi
        </p>
      </div>

      {/* Info Card */}
      <Card>
        <CardBody className="pt-5">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-white mb-1">
                Mengapa Mendaftarkan Wajah?
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Face recognition memastikan bahwa hanya Anda yang dapat melakukan absensi.
                Wajah Anda akan diverifikasi setiap kali check-in/check-out untuk mencegah fraud.
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Employee Info */}
      {employee && (
        <Card>
          <CardBody className="pt-5">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                {employee.photo ? (
                  <img src={employee.photo} alt={employee.fullName} className="h-16 w-16 rounded-full object-cover" />
                ) : (
                  <User className="h-8 w-8 text-primary" />
                )}
              </div>
              <div>
                <p className="font-semibold text-slate-800 dark:text-white">{employee.fullName}</p>
                <p className="text-sm text-slate-500">{employee.employeeId}</p>
                <Badge status={enrolled ? 'Active' : 'Resigned'} className="mt-1">
                  {enrolled ? '✓ Wajah Terdaftar' : 'Belum Terdaftar'}
                </Badge>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Camera Section */}
      {!enrolled ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-primary" />
              {cameraActive ? 'Ambil Foto Wajah' : 'Kamera'}
            </CardTitle>
          </CardHeader>
          <CardBody>
            {!cameraActive ? (
              <div className="text-center py-8">
                <Camera className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                <p className="text-sm text-slate-500 mb-4">
                  Klik tombol di bawah untuk mengaktifkan kamera
                </p>
                <Button onClick={startCamera} size="lg">
                  <Camera className="h-5 w-5" /> Aktifkan Kamera
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Video Preview */}
                <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-video">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover mirror"
                  />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-48 h-56 border-2 border-white/40 rounded-full" />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 justify-center">
                  <Button
                    variant="secondary"
                    onClick={captureAndValidate}
                    disabled={!cameraActive}
                  >
                    <Camera className="h-4 w-4" /> Ambil Foto
                  </Button>
                  <Button variant="outline" onClick={stopCamera}>
                    <XCircle className="h-4 w-4" /> Tutup Kamera
                  </Button>
                </div>

                {/* Validation Result */}
                {validation && (
                  <div className={cn(
                    "p-4 rounded-xl border",
                    validation.detected
                      ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30"
                      : "bg-red-50 border-red-200 dark:bg-red-950/30"
                  )}>
                    <div className="flex items-start gap-3">
                      {validation.detected ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <p className={cn(
                          "text-sm font-medium",
                          validation.detected ? "text-emerald-800 dark:text-emerald-300" : "text-red-800 dark:text-red-300"
                        )}>
                          {validation.message}
                        </p>
                        {validation.detected && (
                          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-slate-500">Kecerahan:</span>
                              <span className="ml-1 font-medium">{validation.details.brightness}%</span>
                            </div>
                            <div>
                              <span className="text-slate-500">Posisi:</span>
                              <span className="ml-1 font-medium capitalize">{validation.details.facePosition}</span>
                            </div>
                            <div>
                              <span className="text-slate-500">Blur:</span>
                              <span className="ml-1 font-medium">{validation.details.isBlurry ? 'Ya' : 'Tidak'}</span>
                            </div>
                            <div>
                              <span className="text-slate-500">Confidence:</span>
                              <span className="ml-1 font-medium">{validation.confidence}%</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Enroll Button */}
                {validation?.detected && (
                  <Button
                    onClick={handleEnroll}
                    loading={enrolling}
                    disabled={enrolling}
                    size="lg"
                    className="w-full"
                  >
                    <Shield className="h-5 w-5" />
                    {enrolling ? 'Mendaftarkan...' : 'Daftarkan Wajah'}
                  </Button>
                )}
              </div>
            )}
          </CardBody>
        </Card>
      ) : (
        /* Enrolled State */
        <Card>
          <CardBody className="pt-5">
            <div className="text-center py-6">
              <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">
                Wajah Sudah Terdaftar
              </h3>
              <p className="text-sm text-slate-500 mb-4">
                Wajah Anda telah terdaftar dan siap untuk verifikasi absensi
              </p>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={startCamera}>
                  <RefreshCw className="h-4 w-4" /> Update Foto
                </Button>
                <Button variant="outline" onClick={handleReset} className="text-red-600 hover:bg-red-50">
                  <XCircle className="h-4 w-4" /> Reset
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Petunjuk Pendaftaran</CardTitle>
        </CardHeader>
        <CardBody>
          <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">1.</span>
              <span>Pastikan wajah terlihat jelas dan pencahayaan cukup</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">2.</span>
              <span>Posisikan wajah di tengah frame kamera</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">3.</span>
              <span>Hindari penggunaan kacamata, masker, atau aksesoris wajah</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">4.</span>
              <span>Ambil foto dari posisi yang berbeda untuk akurasi lebih tinggi</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">5.</span>
              <span>Setelah foto terverifikasi, klik "Daftarkan Wajah"</span>
            </li>
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}