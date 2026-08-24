import { useEffect, useState, useRef, useCallback } from 'react';
import { Camera, CheckCircle2, XCircle, User, Shield, RefreshCw, Stethoscope } from 'lucide-react';
import Swal from 'sweetalert2';
import {
  enrollFace,
  getFaceStatus,
  deactivateFace,
  diagnoseFace,
  LEGACY_BACKEND_MESSAGE,
  type FaceDiagnosis,
} from '../services/faceClient';
import { validateFace } from '../services/faceRecognition';
import { Card, CardBody, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';

export function FaceEnrollmentPage() {
  const toast = useToast();
  const { session } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [validation, setValidation] = useState<ReturnType<typeof validateFace> | null>(null);
  const [enrolled, setEnrolled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  // FACE ID v2: metadata template aktif dari server
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [diagnosis, setDiagnosis] = useState<FaceDiagnosis | null>(null);
  const [diagnosing, setDiagnosing] = useState(false);

  const runDiagnosis = useCallback(async () => {
    setDiagnosing(true);
    try {
      const res = await diagnoseFace();
      if (!res.ok || !res.data) {
        toast.error(res.message || 'Diagnosa gagal.');
        setDiagnosis(null);
      } else {
        setDiagnosis(res.data);
        console.log(
          `[FACE DEBUG] diagnose | healthy=${res.data.healthy}` +
          ` | template=${res.data.activeTemplateId || '-'}` +
          ` | length=${res.data.descriptorLength ?? '-'}` +
          ` | model=${res.data.expectedModel ?? '-'}`
        );
      }
    } finally {
      setDiagnosing(false);
    }
  }, [toast]);

  // FACE ID v2: identitas hanya dari session (immutable userId) - bukan localStorage
  const displayName = session?.name || 'Pengguna';

  // Properly release camera resources
  const releaseCamera = useCallback(() => {
    try {
      if (streamRef.current) {
        const tracks = streamRef.current.getTracks();
        tracks.forEach((t) => {
          t.stop();
          t.enabled = false;
        });
        streamRef.current = null;
      }
      
      // Also clean up video element's srcObject
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      }
    } catch (e) {
      console.warn('Error releasing camera:', e);
    }
  }, []);

  // Stop camera and clean up all resources
  const stopCamera = useCallback(() => {
    releaseCamera();
    setCameraActive(false);
    setValidation(null);
  }, [releaseCamera]);

  // The video element is conditionally rendered. A callback ref makes sure a
  // stream is attached even when React renders the element after getUserMedia
  // has already resolved.
  const attachStreamToVideo = useCallback((element: HTMLVideoElement | null) => {
    videoRef.current = element;
    const stream = streamRef.current;
    if (!element || !stream) return;

    element.srcObject = stream;
    const playVideo = () => {
      element.play().catch((error: unknown) => {
        // The browser can reject a stale play request while replacing a stream.
        // It is harmless as long as the current stream remains attached.
        if ((error as DOMException)?.name !== 'AbortError') {
          console.warn('Video play error:', error);
        }
      });
    };
    if (element.readyState >= HTMLMediaElement.HAVE_METADATA) playVideo();
    else element.onloadedmetadata = playVideo;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    checkEnrollmentStatus();
    return () => {
      releaseCamera();
    };
  }, []);

  const checkEnrollmentStatus = async () => {
    // FACE ID v2: status diambil dari SERVER (FACE_TEMPLATES), bukan localStorage
    const res = await getFaceStatus();
    if (res.code === 'UNKNOWN_ACTION') {
      toast.error(LEGACY_BACKEND_MESSAGE);
      setEnrolled(false);
      setActiveTemplateId(null);
    } else if (res.enrolled) {
      setEnrolled(true);
      setActiveTemplateId(res.faceTemplateId || null);
    } else if (res.code === 'INVALID_TEMPLATE' || res.modelCompatible === false) {
      toast.error('Data wajah terdaftar tidak kompatibel. Silakan daftarkan ulang wajah Anda.');
      setEnrolled(false);
      setActiveTemplateId(null);
    } else {
      setEnrolled(false);
      setActiveTemplateId(null);
    }
    setLoading(false);
  };

  const startCamera = useCallback(async () => {
    if (cameraStarting) return;

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      toast.error('Kamera hanya dapat digunakan melalui HTTPS atau localhost.');
      return;
    }

    setCameraStarting(true);
    try {
      // Release any existing camera resources before requesting a new stream.
      releaseCamera();

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });
      } catch {
        // Fallback: try without specific resolution
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        });
      }

      streamRef.current = stream;
      setCameraActive(true);
      setValidation(null);
    } catch (err: any) {
      console.error('Camera error:', err);
      
      let errorMessage = 'Tidak dapat mengakses kamera.';
      if (err.name === 'NotReadableError') {
        errorMessage = 'Kamera sedang digunakan oleh aplikasi lain. Tutup aplikasi kamera lain dan coba lagi.';
      } else if (err.name === 'NotAllowedError') {
        errorMessage = 'Izin kamera ditolak. Izinkan akses kamera di pengaturan browser.';
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'Kamera tidak ditemukan. Pastikan perangkat kamera terpasang dengan benar.';
      }
      
      toast.error(errorMessage);
      releaseCamera();
      setCameraActive(false);
    } finally {
      setCameraStarting(false);
    }
  }, [cameraStarting, releaseCamera, toast]);

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
    if (enrolling) return;

    setEnrolling(true);
    try {
      // FACE ID v2: registrasi transaksional.
      // Server melakukan WRITE -> READ BACK -> VALIDATE.
      // Sukses hanya jika data benar-benar bisa dibaca kembali dari database.
      const result = await enrollFace(validation.descriptor);

      if (result.success) {
        setEnrolled(true);
        setActiveTemplateId(result.faceTemplateId || null);
        setUpdating(false);
        stopCamera();

        console.log(
          `[FACE DEBUG] enroll OK` +
          ` | template=${result.faceTemplateId ?? '-'}` +
          ` | length=${result.descriptorLength ?? '-'}` +
          ` | readBack=${result.readBackValidated}` +
          ` | requestId=${result.requestId ?? '-'}`
        );

        await Swal.fire({
          icon: 'success',
          title: 'Wajah Berhasil Didaftarkan',
          html:
            '<p>Template Face ID Anda tersimpan dan <b>sudah diverifikasi dapat dibaca kembali</b> dari database.</p>' +
            `<p style="font-size:0.85em;color:#64748b">Template ID: <code>${result.faceTemplateId ?? '-'}</code></p>`,
          confirmButtonColor: '#0D47A1',
        });
        runDiagnosis();
      } else {
        await Swal.fire({
          icon: 'error',
          title: 'Registrasi Gagal',
          text: result.message,
          confirmButtonColor: '#0D47A1',
        });
      }
    } finally {
      setEnrolling(false);
    }
  };

  const handleUpdateCancel = () => {
    setUpdating(false);
    stopCamera();
  };

  const handleReset = async () => {
    const result = await Swal.fire({
      title: 'Reset Pendaftaran Wajah?',
      text: 'Template wajah Anda akan dinonaktifkan di server dan harus mendaftar ulang.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#D32F2F',
      confirmButtonText: 'Reset',
      cancelButtonText: 'Batal',
    });

    if (!result.isConfirmed) return;

    setUpdating(true);
    try {
      // FACE ID v2: nonaktifkan template di SERVER (bukan localStorage)
      const res = await deactivateFace();
      if (res.success) {
        setEnrolled(false);
        setActiveTemplateId(null);
        setUpdating(false);
        toast.success('Pendaftaran wajah berhasil direset di server');
        runDiagnosis();
      } else {
        toast.error(res.message);
      }
    } finally {
      setUpdating(false);
    }
  };

  const handleStartEnrollment = () => {
    if (enrolled) {
      setUpdating(true);
      // Wait for React to render the update UI, then start camera
      setTimeout(() => startCamera(), 150);
    } else {
      startCamera();
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

      {/* User Info (identitas dari session, bukan localStorage) */}
      {session && (
        <Card>
          <CardBody className="pt-5">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-8 w-8 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 dark:text-white">{displayName}</p>
                <p className="text-sm text-slate-500">{session.email}</p>
                <Badge status={enrolled ? 'Active' : 'Resigned'} className="mt-1">
                  {enrolled ? '✓ Wajah Terdaftar' : 'Belum Terdaftar'}
                </Badge>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* New Enrollment - Camera Section */}
      {!enrolled && !updating && (
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
                <Button onClick={handleStartEnrollment} size="lg" loading={cameraStarting} disabled={cameraStarting}>
                  <Camera className="h-5 w-5" /> Aktifkan Kamera
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-video">
                  <video
                    ref={attachStreamToVideo}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover mirror"
                  />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-48 h-56 border-2 border-white/40 rounded-full" />
                  </div>
                </div>

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
      )}

      {/* Update Mode */}
      {updating && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-primary" />
              Update Foto Wajah
            </CardTitle>
          </CardHeader>
          <CardBody>
            {!cameraActive ? (
              <div className="text-center py-8">
                <RefreshCw className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                <p className="text-sm text-slate-500 mb-4">
                  Mengaktifkan kamera untuk memperbarui foto wajah...
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-video">
                  <video
                    ref={attachStreamToVideo}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover mirror"
                  />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-48 h-56 border-2 border-white/40 rounded-full" />
                  </div>
                </div>

                <div className="flex gap-2 justify-center">
                  <Button
                    variant="secondary"
                    onClick={captureAndValidate}
                    disabled={!cameraActive}
                  >
                    <Camera className="h-4 w-4" /> Ambil Foto
                  </Button>
                  <Button variant="outline" onClick={handleUpdateCancel}>
                    <XCircle className="h-4 w-4" /> Batal
                  </Button>
                </div>

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
                      </div>
                    </div>
                  </div>
                )}

                {validation?.detected && (
                  <Button
                    onClick={handleEnroll}
                    loading={enrolling}
                    disabled={enrolling}
                    size="lg"
                    className="w-full"
                  >
                    <Shield className="h-5 w-5" />
                    {enrolling ? 'Memperbarui...' : 'Perbarui Wajah'}
                  </Button>
                )}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Enrolled State */}
      {enrolled && !updating && (
        <Card>
          <CardBody className="pt-5">
            <div className="text-center py-6">
              <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">
                Wajah Sudah Terdaftar
              </h3>
              <p className="text-sm text-slate-500 mb-1">
                Wajah Anda telah terdaftar di server dan siap untuk verifikasi absensi
              </p>
              {activeTemplateId && (
                <p className="text-xs text-slate-400 mb-4 font-mono">
                  Template ID: {activeTemplateId}
                </p>
              )}
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={handleStartEnrollment}>
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

      {/* Diagnostics Panel - test database layer sebelum camera */}
      {!cameraActive && !updating && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Stethoscope className="h-4 w-4" /> Diagnosa Database Face ID
            </CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-slate-500 mb-3">
              Periksa apakah layer database Face ID sehat untuk akun Anda (template ada, aktif,
              descriptor valid, model kompatibel) — sebelum menguji kamera.
            </p>
            <Button variant="secondary" onClick={runDiagnosis} loading={diagnosing}>
              Jalankan Diagnosa
            </Button>

            {diagnosis && (
              <div className={cn(
                'mt-4 p-4 rounded-xl border text-sm',
                diagnosis.healthy
                  ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30'
                  : 'bg-red-50 border-red-200 dark:bg-red-950/30'
              )}>
                <p className={cn(
                  'font-semibold mb-2',
                  diagnosis.healthy ? 'text-emerald-800 dark:text-emerald-300' : 'text-red-800 dark:text-red-300'
                )}>
                  {diagnosis.summary}
                </p>
                <ul className="space-y-1 text-xs">
                  <li>{diagnosis.checks.userFound ? '✅' : '❌'} User ditemukan</li>
                  <li>{diagnosis.checks.employeeFound ? '✅' : '⚠️'} Data karyawan terhubung</li>
                  <li>{diagnosis.checks.templateFound ? '✅' : '❌'} Template wajah ditemukan ({diagnosis.templateCount ?? 0})</li>
                  <li>{diagnosis.checks.templateActive ? '✅' : '❌'} Template berstatus ACTIVE</li>
                  <li>{diagnosis.checks.descriptorValid ? '✅' : '❌'} Descriptor valid</li>
                  <li>{diagnosis.checks.modelCompatible ? '✅' : '❌'} Model kompatibel ({diagnosis.expectedModel} v{diagnosis.expectedModelVersion})</li>
                  <li>{diagnosis.checks.readBackSuccess ? '✅' : '❌'} Read-back berhasil</li>
                </ul>
                {diagnosis.activeTemplateId && (
                  <p className="text-xs text-slate-400 mt-2 font-mono">ID: {diagnosis.activeTemplateId}</p>
                )}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Instructions */}
      {!cameraActive && !updating && (
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
      )}
    </div>
  );
}
