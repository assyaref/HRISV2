import { encryptPDF } from '@pdfsmaller/pdf-encrypt-lite';

/**
 * Enkripsi PDF (sisi browser) memakai pdf-encrypt-lite (RC4 128-bit,
 * Standard Security Handler PDF) — hasilnya PDF terkunci sungguhan:
 * saat dibuka di Adobe Acrobat / PDF reader, akan diminta password.
 *
 * Catatan: jsPDF/pdf-lib TIDAK mendukung enkripsi. Enkripsi dilakukan di
 * browser sebelum file dikirim ke GAS/Drive, jadi file yang tersimpan pun
 * sudah terproteksi.
 */
export async function encryptPdfBytes(input: ArrayBuffer | Uint8Array, password: string): Promise<Uint8Array> {
  const source = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (!password) throw new Error('Password tidak boleh kosong.');
  return encryptPDF(source, password, password);
}

export function isPdfFile(file: File): boolean {
  return /\.pdf$/i.test(file.name) || file.type === 'application/pdf';
}

/**
 * Salin Uint8Array ke ArrayBuffer polos. Diperlukan karena TS 5.9 memisahkan
 * tipe Uint8Array<ArrayBufferLike> dari BlobPart.
 */
export function toArrayBufferCopy(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer as ArrayBuffer;
}

/** Simpan Uint8Array sebagai unduhan file (browser). */
export function downloadPdfBytes(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([toArrayBufferCopy(bytes)], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Beri microtask agar download tidak digagalkan revoke yang terlalu cepat.
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/** Konversi File ke data URL base64 (dipakai upload ke GAS). */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error || new Error('Gagal membaca file'));
    reader.readAsDataURL(file);
  });
}
