/**
 * Face Recognition Service - Enrollment & Verification
 * 
 * Sistem Face Recognition lengkap:
 * 1. ENROLLMENT: Daftarkan wajah karyawan (simpan face descriptor)
 * 2. VERIFICATION: Cocokkan selfie dengan wajah terdaftar
 * 3. MATCHING: Hitung similarity score antara dua wajah
 * 
 * Menggunakan Canvas pixel analysis yang ringan untuk PWA.
 */

export interface FaceValidationResult {
  detected: boolean;
  faceCount: number;
  confidence: number;
  descriptor?: number[]; // Face descriptor untuk enrollment
  details: {
    hasFace: boolean;
    brightness: number;
    hasEyes: boolean;
    hasMouth: boolean;
    isBlurry: boolean;
    facePosition: 'center' | 'left' | 'right' | 'top' | 'bottom' | 'unknown';
  };
  message: string;
}

export interface FaceMatchResult {
  matched: boolean;
  similarity: number;
  employeeName?: string;
  message: string;
}

// ========== FACE DESCRIPTOR EXTRACTION ==========

/**
 * Ekstrak face descriptor dari canvas
 * Descriptor adalah array angka yang merepresentasikan ciri-ciri wajah
 */
function extractFaceDescriptor(canvas: HTMLCanvasElement): number[] | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const width = 64; // Resize ke ukuran kecil untuk performa
  const height = 64;
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext('2d');
  if (!tempCtx) return null;

  // Resize gambar ke 64x64
  tempCtx.drawImage(canvas, 0, 0, width, height);
  const imageData = tempCtx.getImageData(0, 0, width, height);
  const pixels = imageData.data;

  const descriptor: number[] = [];

  // 1. Ekstraksi warna kulit (skin tone histogram)
  let skinR = 0, skinG = 0, skinB = 0, skinCount = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    const isSkin = r > 95 && g > 40 && b > 20 && r > g && r > b && Math.abs(r - g) > 15;
    if (isSkin) {
      skinR += r; skinG += g; skinB += b; skinCount++;
    }
  }
  if (skinCount > 0) {
    descriptor.push(skinR / skinCount / 255); // Normalized average skin R
    descriptor.push(skinG / skinCount / 255); // Normalized average skin G
    descriptor.push(skinB / skinCount / 255); // Normalized average skin B
    descriptor.push(skinCount / (width * height)); // Skin ratio
  } else {
    return null; // No face detected
  }

  // 2. Grid-based luminance pattern (8x8 grid)
  const gridSize = 8;
  const cellW = Math.floor(width / gridSize);
  const cellH = Math.floor(height / gridSize);
  
  for (let gy = 0; gy < gridSize; gy++) {
    for (let gx = 0; gx < gridSize; gx++) {
      let sum = 0, count = 0;
      for (let y = gy * cellH; y < (gy + 1) * cellH && y < height; y++) {
        for (let x = gx * cellW; x < (gx + 1) * cellW && x < width; x++) {
          const i = (y * width + x) * 4;
          sum += (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
          count++;
        }
      }
      descriptor.push(sum / count / 255);
    }
  }

  // 3. Edge features (horizontal & vertical gradients)
  let edgeSum = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = (y * width + x) * 4;
      const center = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
      const left = (pixels[(y * width + (x - 1)) * 4] + pixels[(y * width + (x - 1)) * 4 + 1] + pixels[(y * width + (x - 1)) * 4 + 2]) / 3;
      const right = (pixels[(y * width + (x + 1)) * 4] + pixels[(y * width + (x + 1)) * 4 + 1] + pixels[(y * width + (x + 1)) * 4 + 2]) / 3;
      const top = (pixels[((y - 1) * width + x) * 4] + pixels[((y - 1) * width + x) * 4 + 1] + pixels[((y - 1) * width + x) * 4 + 2]) / 3;
      const bottom = (pixels[((y + 1) * width + x) * 4] + pixels[((y + 1) * width + x) * 4 + 1] + pixels[((y + 1) * width + x) * 4 + 2]) / 3;
      edgeSum += Math.abs(center - left) + Math.abs(center - right) + Math.abs(center - top) + Math.abs(center - bottom);
    }
  }
  descriptor.push(edgeSum / (width * height) / 255);

  // 4. Symmetry feature (wajah simetris)
  let symmetryScore = 0;
  const halfW = Math.floor(width / 2);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < halfW; x++) {
      const leftI = (y * width + x) * 4;
      const rightI = (y * width + (width - 1 - x)) * 4;
      const diff = Math.abs(pixels[leftI] - pixels[rightI]) + 
                   Math.abs(pixels[leftI + 1] - pixels[rightI + 1]) + 
                   Math.abs(pixels[leftI + 2] - pixels[rightI + 2]);
      symmetryScore += diff;
    }
  }
  descriptor.push(1 - (symmetryScore / (width * height * 3 * 255))); // Normalized symmetry

  return descriptor;
}

/**
 * Hitung cosine similarity antara dua face descriptor
 * Range: 0 (berbeda) - 1 (identik)
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  return Math.max(0, Math.min(1, similarity)); // Clamp antara 0-1
}

/**
 * Encode face descriptor ke JSON string untuk disimpan
 */
export function encodeDescriptor(descriptor: number[]): string {
  return JSON.stringify(descriptor);
}

/**
 * Decode face descriptor dari JSON string
 */
export function decodeDescriptor(encoded: string): number[] {
  try {
    return JSON.parse(encoded);
  } catch {
    return [];
  }
}

// ========== VALIDASI FACE ==========

/**
 * Validasi wajah dari canvas selfie
 */
export function validateFace(canvas: HTMLCanvasElement): FaceValidationResult {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return {
      detected: false, faceCount: 0, confidence: 0,
      details: { hasFace: false, brightness: 0, hasEyes: false, hasMouth: false, isBlurry: false, facePosition: 'unknown' },
      message: '❌ Canvas tidak tersedia',
    };
  }

  const width = canvas.width;
  const height = canvas.height;
  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = imageData.data;

  let totalBrightness = 0;
  let skinPixelCount = 0;
  let skinCenterX = 0, skinCenterY = 0;

  for (let y = 0; y < height; y += 4) {
    for (let x = 0; x < width; x += 4) {
      const i = (y * width + x) * 4;
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
      const brightness = (r + g + b) / 3;
      totalBrightness += brightness;

      // Lowered red channel threshold for better low-light detection
      const isSkin = r > 85 && g > 40 && b > 20 && r > g && r > b && Math.abs(r - g) > 15;
      if (isSkin) {
        skinPixelCount++;
        skinCenterX += x;
        skinCenterY += y;
      }
    }
  }

  const avgBrightness = totalBrightness / ((width * height) / 16);
  const totalPixels = (width / 4) * (height / 4);
  const skinRatio = skinPixelCount / totalPixels;

  const faceCX = skinPixelCount > 0 ? skinCenterX / skinPixelCount : width / 2;
  const faceCY = skinPixelCount > 0 ? skinCenterY / skinPixelCount : height / 2;
  const faceCenterX = (faceCX / width) * 100;
  const faceCenterY = (faceCY / height) * 100;

  // Blur detection
  let blurScore = 0, sampleCount = 0;
  for (let y = 2; y < height - 2; y += 8) {
    for (let x = 2; x < width - 2; x += 8) {
      const i = (y * width + x) * 4;
      const center = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
      const left = (pixels[(y * width + (x - 2)) * 4] + pixels[(y * width + (x - 2)) * 4 + 1] + pixels[(y * width + (x - 2)) * 4 + 2]) / 3;
      const right = (pixels[(y * width + (x + 2)) * 4] + pixels[(y * width + (x + 2)) * 4 + 1] + pixels[(y * width + (x + 2)) * 4 + 2]) / 3;
      blurScore += Math.abs(center - left) + Math.abs(center - right);
      sampleCount++;
    }
  }
  const avgBlur = blurScore / sampleCount;
  const isBlurry = avgBlur < 12; // More tolerant to blur

  // Face position
  let facePosition: FaceValidationResult['details']['facePosition'] = 'center';
  if (faceCenterX < 30) facePosition = 'left';
  else if (faceCenterX > 70) facePosition = 'right';
  else if (faceCenterY < 30) facePosition = 'top';
  else if (faceCenterY > 70) facePosition = 'bottom';

  const hasFace = skinRatio > 0.05 && skinRatio < 0.5;
  const hasEyes = hasFace && faceCenterY > 25 && faceCenterY < 65;
  const hasMouth = hasFace && faceCenterY > 50 && faceCenterY < 80;

  let confidence = 0;
  if (hasFace) confidence += 40;
  if (!isBlurry) confidence += 20;
  // More lenient brightness check for confidence
  if (avgBrightness > 25 && avgBrightness < 220) confidence += 15;
  if (skinRatio > 0.08 && skinRatio < 0.35) confidence += 15;
  if (facePosition === 'center') confidence += 10;

  // Ekstrak face descriptor jika wajah terdeteksi
  let descriptor: number[] | undefined;
  if (hasFace) {
    const extracted = extractFaceDescriptor(canvas);
    if (extracted) descriptor = extracted;
  }

  const messages: string[] = [];
  // Main success message condition
  if (hasFace && !isBlurry && avgBrightness > 20 && avgBrightness < 230) {
    messages.push('✅ Wajah terverifikasi');
  } else {
    // Detailed error messages
    if (!hasFace) messages.push('❌ Wajah tidak terdeteksi');
    if (isBlurry) messages.push('📷 Foto blur');
    if (avgBrightness < 20) messages.push('🌑 Terlalu gelap'); // Lowered threshold
    if (avgBrightness > 230) messages.push('☀️ Terlalu terang');
    if (facePosition !== 'center') messages.push('🎯 Posisikan wajah di tengah');
  }

  return {
    detected: hasFace && !isBlurry && confidence > 50,
    faceCount: hasFace ? 1 : 0,
    confidence: Math.min(100, confidence),
    descriptor,
    details: { hasFace, brightness: Math.round(avgBrightness), hasEyes, hasMouth, isBlurry, facePosition },
    message: messages.join('. ') || '❌ Wajah tidak valid',
  };
}

// ========== FACE ENROLLMENT ==========

/**
 * Daftarkan wajah karyawan dari video/camera
 * Menyimpan face descriptor ke employee data
 */
export function captureAndEnroll(video: HTMLVideoElement): FaceValidationResult {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth || 320;
  canvas.height = video.videoHeight || 240;
  const ctx = canvas.getContext('2d');
  
  if (ctx) {
    ctx.drawImage(video, 0, 0);
    return validateFace(canvas);
  }

  return {
    detected: false, faceCount: 0, confidence: 0,
    details: { hasFace: false, brightness: 0, hasEyes: false, hasMouth: false, isBlurry: false, facePosition: 'unknown' },
    message: '❌ Gagal memproses kamera',
  };
}

// ========== FACE VERIFICATION ==========

/**
 * Verifikasi selfie dengan face descriptor yang sudah terdaftar
 * @param selfieCanvas - Canvas hasil selfie
 * @param enrolledDescriptor - Face descriptor yang sudah didaftarkan
 * @param threshold - Minimal similarity score (default: 0.65)
 */
export function verifyFace(
  selfieCanvas: HTMLCanvasElement,
  enrolledDescriptor: number[],
  threshold = 0.65
): FaceMatchResult {
  // 1. Validasi selfie
  const validation = validateFace(selfieCanvas);
  if (!validation.detected || !validation.descriptor) {
    return {
      matched: false,
      similarity: 0,
      message: validation.message || '❌ Wajah tidak valid untuk verifikasi',
    };
  }

  // 2. Hitung similarity dengan face descriptor terdaftar
  const similarity = cosineSimilarity(validation.descriptor, enrolledDescriptor);
  const matched = similarity >= threshold;

  if (matched) {
    return {
      matched: true,
      similarity: Math.round(similarity * 100),
      message: `✅ Wajah cocok (${Math.round(similarity * 100)}% match)`,
    };
  }

  return {
    matched: false,
    similarity: Math.round(similarity * 100),
    message: `❌ Wajah tidak cocok (${Math.round(similarity * 100)}%). Gunakan wajah yang sudah terdaftar.`,
  };
}

/**
 * Verifikasi dari base64 image
 */
export async function verifyFaceFromBase64(
  base64Data: string,
  enrolledDescriptor: number[]
): Promise<FaceMatchResult> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(verifyFace(canvas, enrolledDescriptor));
      } else {
        resolve({ matched: false, similarity: 0, message: '❌ Gagal memproses gambar' });
      }
    };
    img.onerror = () => {
      resolve({ matched: false, similarity: 0, message: '❌ Gagal memuat gambar' });
    };
    img.src = base64Data;
  });
}

/**
 * Cek apakah similarity cukup untuk verifikasi
 */
export function isFaceMatch(similarity: number, threshold = 0.65): boolean {
  return similarity >= threshold;
}

/**
 * Dapatkan level kepercayaan berdasarkan similarity
 */
export function getMatchLevel(similarity: number): 'high' | 'medium' | 'low' | 'none' {
  if (similarity >= 0.8) return 'high';
  if (similarity >= 0.65) return 'medium';
  if (similarity >= 0.4) return 'low';
  return 'none';
}