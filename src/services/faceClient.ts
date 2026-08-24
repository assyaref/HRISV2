/**
 * faceClient.ts - FACE ID v2 client
 * ===================================
 * Satu-satunya jembatan frontend <-> backend untuk semua operasi Face ID.
 *
 * Prinsip:
 * - SATU SUMBER KEBENARAN: server (sheet FACE_TEMPLATES via GAS).
 *   TIDAK ADA lagi penyimpanan/pencarian descriptor di localStorage.
 * - Identitas = session.userId (immutable), dikirim via token session.
 * - Registration hanya "sukses" jika server melaporkan READ-BACK valid.
 * - Semua hasil memakai FaceVerificationResult dengan `code` terstandar.
 *   TIDAK ADA lagi string bebas sebagai sumber logic.
 * - Logging debug tanpa data biometrik.
 */

import { gasRequest } from './gasClient';

// ============================================================
//  TYPES
// ============================================================

export type FaceResultCode =
  | 'VERIFIED'
  | 'FACE_NOT_REGISTERED'
  | 'FACE_NOT_DETECTED'
  | 'FACE_NOT_MATCHED'
  | 'INVALID_TEMPLATE'
  | 'INVALID_DESCRIPTOR'
  | 'USER_NOT_FOUND'
  | 'TEMPLATE_NOT_FOUND'
  | 'TEMPLATE_VERSION_MISMATCH'
  | 'REGISTRATION_FAILED'
  | 'UNKNOWN_ACTION'
  | 'NETWORK_ERROR'
  | 'GPS_REQUIRED'
  | 'OUT_OF_GEOFENCE'
  | 'DUPLICATE_CHECKIN'
  | 'DUPLICATE_CHECKOUT'
  | 'NO_CHECKIN'
  | 'VERIFICATION_ERROR';

export interface FaceVerificationResult {
  success: boolean;
  code: FaceResultCode;
  message: string;
  userId?: string;
  employeeId?: string;
  faceTemplateId?: string;
  descriptorLength?: number;
  similarity?: number;
  similarityPercent?: number;
  threshold?: number;
  source?: string;
  requestId?: string;
}

export interface FaceStatus {
  enrolled: boolean;
  code: FaceResultCode;
  userId?: string;
  faceTemplateId?: string;
  descriptorLength?: number;
  descriptorValid?: boolean;
  modelCompatible?: boolean;
  model?: string;
  modelVersion?: string;
  descriptorVersion?: number;
  createdAt?: string;
}

export interface FaceDiagnosis {
  healthy: boolean;
  summary: string;
  checks: {
    userFound: boolean;
    employeeFound: boolean;
    templateFound: boolean;
    templateActive: boolean;
    descriptorValid: boolean;
    modelCompatible: boolean;
    readBackSuccess: boolean;
  };
  templateCount?: number;
  activeTemplateId?: string;
  descriptorLength?: number;
  expectedModel?: string;
  expectedModelVersion?: string;
  expectedDescriptorVersion?: number;
  threshold?: number;
}

// ============================================================
//  DESCRIPTOR VALIDATION (canonical, Phase 11)
// ============================================================

/**
 * Validasi descriptor hasil ekstraksi kamera SEBELUM dikirim ke server:
 * exists, bertipe array, tidak kosong, seluruh nilai finite (bukan NaN/Infinity).
 */
export function validateDescriptor(
  descriptor: unknown
): descriptor is number[] {
  if (!descriptor) return false;
  if (!Array.isArray(descriptor)) return false;
  if (descriptor.length === 0) return false;
  for (const value of descriptor) {
    const n = Number(value);
    if (!Number.isFinite(n)) return false;
  }
  return true;
}

/** Alias kompatibel dengan nama di spesifikasi. */
export function normalizeDescriptor(descriptor: unknown): number[] | null {
  if (!validateDescriptor(descriptor)) return null;
  return Array.from(descriptor, (v) => Number(v));
}

function makeRequestId(prefix: string): string {
  const uuid =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${uuid}`;
}

// ============================================================
//  LOW-LEVEL CALL DENGAN PEMETAAN ERROR -> CODE
// ============================================================

interface GasResponse {
  success?: boolean;
  code?: string;
  message?: string;
  [key: string]: unknown;
}

async function faceCall(
  action: string,
  payload: Record<string, unknown>,
  fallbackCode: FaceResultCode
): Promise<GasResponse> {
  try {
    return await gasRequest<GasResponse>(action, payload);
  } catch (err) {
    // Network / HTTP error - JANGAN dilaporkan sebagai "belum terdaftar"
    console.error('[FACE] request failed:', action, err);
    return {
      success: false,
      code: fallbackCode,
      message:
        'Tidak dapat menghubungi server. Periksa koneksi internet Anda lalu coba lagi.',
    };
  }
}

/** Deteksi backend production yang belum diperbarui ke FACE ID v2. */
export function isLegacyBackend(res: { code?: string; message?: string }): boolean {
  if (res.code === 'UNKNOWN_ACTION') return true;
  const m = String(res.message || '');
  return m.includes('Action tidak dikenali');
}

export const LEGACY_BACKEND_MESSAGE =
  'Backend belum diperbarui ke versi baru. Admin perlu deploy ulang Google Apps Script terbaru (folder GAS - HRIS), lalu jalankan action migrateFaceTemplates sekali.';

function logDebug(stage: string, requestId: string, res: Record<string, unknown>) {
  console.log(
    `[FACE DEBUG] ${stage}` +
      ` | requestId=${requestId}` +
      ` | code=${res.code ?? '-'}` +
      ` | success=${res.success ?? '-'}` +
      ` | template=${res.faceTemplateId ?? '-'}` +
      ` | sim=${res.similarityPercent ?? '-'}%` +
      ` | threshold=${res.threshold ?? '-'}`
  );
}

// ============================================================
//  PUBLIC API
// ============================================================

/**
 * REGISTER wajah. Sukses HANYA jika server menulis + read-back + validasi OK.
 */
export async function enrollFace(descriptor: number[]): Promise<
  FaceVerificationResult & { readBackValidated?: boolean }
> {
  const requestId = makeRequestId('FACEREG');

  if (!validateDescriptor(descriptor)) {
    console.warn(`[FACE DEBUG] ${requestId} enroll rejected: INVALID_DESCRIPTOR (client-side)`);
    return {
      success: false,
      code: 'INVALID_DESCRIPTOR',
      message: 'Data wajah tidak valid. Silakan ambil foto ulang.',
      requestId,
    };
  }

  const res = await faceCall('faceEnroll', { faceDescriptor: descriptor }, 'NETWORK_ERROR');
  logDebug('enroll', requestId, res);

  if (!res.success) {
    return {
      success: false,
      code: (res.code as FaceResultCode) || 'REGISTRATION_FAILED',
      message: String(res.message || 'Registrasi wajah gagal.'),
      requestId,
    };
  }

  return {
    success: true,
    code: 'VERIFIED',
    message: String(res.message || 'Wajah berhasil didaftarkan.'),
    faceTemplateId: res.faceTemplateId as string,
    descriptorLength: res.descriptorLength as number,
    readBackValidated: res.readBackValidated === true,
    requestId,
  };
}

/** Cek status pendaftaran wajah user yang sedang login. */
export async function getFaceStatus(): Promise<FaceStatus> {
  const res = await faceCall('faceStatus', {}, 'NETWORK_ERROR');
  if (!res.success) {
    if (isLegacyBackend(res)) {
      return { enrolled: false, code: 'UNKNOWN_ACTION' };
    }
    return { enrolled: false, code: (res.code as FaceResultCode) || 'VERIFICATION_ERROR' };
  }
  return {
    enrolled: res.enrolled === true,
    code: (res.code as FaceResultCode) || 'VERIFIED',
    userId: res.userId as string,
    faceTemplateId: res.faceTemplateId as string,
    descriptorLength: res.descriptorLength as number,
    descriptorValid: res.descriptorValid as boolean,
    modelCompatible: res.modelCompatible as boolean,
    model: res.model as string,
    modelVersion: res.modelVersion as string,
    descriptorVersion: res.descriptorVersion as number,
    createdAt: res.createdAt as string,
  };
}

/**
 * VERIFIKASI live: kirim descriptor kamera ke server, server bandingkan
 * dengan ACTIVE template milik user. Client tidak melakukan keputusan final.
 */
export async function verifyLiveFace(
  descriptor: number[]
): Promise<FaceVerificationResult> {
  const requestId = makeRequestId('FACEVERIFY');

  if (!validateDescriptor(descriptor)) {
    return {
      success: false,
      code: 'INVALID_DESCRIPTOR',
      message: 'Wajah tidak terdeteksi dengan baik. Ambil foto ulang.',
      requestId,
    };
  }

  const res = await faceCall('faceVerifyLive', { faceDescriptor: descriptor }, 'NETWORK_ERROR');
  logDebug('verifyLive', requestId, res);

  if (!res.success) {
    return {
      success: false,
      code: (res.code as FaceResultCode) || 'VERIFICATION_ERROR',
      message: String(res.message || 'Verifikasi wajah gagal.'),
      userId: res.userId as string,
      faceTemplateId: res.faceTemplateId as string,
      similarity: res.similarity as number,
      similarityPercent: res.similarityPercent as number,
      threshold: res.threshold as number,
      requestId,
    };
  }

  return {
    success: true,
    code: 'VERIFIED',
    message: String(res.message || 'Wajah terverifikasi.'),
    userId: res.userId as string,
    faceTemplateId: res.faceTemplateId as string,
    similarity: res.similarity as number,
    similarityPercent: res.similarityPercent as number,
    threshold: res.threshold as number,
    requestId,
  };
}

/** Diagnosa database layer (Phase 25): test database sebelum test camera. */
export async function diagnoseFace(): Promise<{
  ok: boolean;
  data?: FaceDiagnosis;
  message?: string;
}> {
  const res = await faceCall('faceDiagnose', {}, 'NETWORK_ERROR');
  if (!res.success) {
    return { ok: false, message: String(res.message || 'Diagnosa gagal.') };
  }
  return {
    ok: true,
    data: {
      healthy: res.healthy === true,
      summary: String(res.summary || ''),
      checks: res.checks as FaceDiagnosis['checks'],
      templateCount: res.templateCount as number,
      activeTemplateId: res.activeTemplateId as string,
      descriptorLength: res.descriptorLength as number,
      expectedModel: res.expectedModel as string,
      expectedModelVersion: res.expectedModelVersion as string,
      expectedDescriptorVersion: res.expectedDescriptorVersion as number,
      threshold: res.threshold as number,
    },
  };
}

/** Nonaktifkan template wajah user (reset). */
export async function deactivateFace(): Promise<{ success: boolean; message: string }> {
  const res = await faceCall('faceDeactivate', {}, 'NETWORK_ERROR');
  return {
    success: res.success === true,
    message: String(
      res.message || (res.success ? 'Wajah dinonaktifkan.' : 'Gagal menonaktifkan wajah.')
    ),
  };
}