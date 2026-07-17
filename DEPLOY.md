# Deployment Guide - HRIS Lite Enterprise

## 1. Push ke GitHub & GitHub Pages

### A. Persiapan Git
```bash
# Inisialisasi git (jika belum)
git init
git remote add origin https://github.com/username/repo-name.git

# Commit semua perubahan
git add .
git commit -m "Initial commit: HRIS Lite with face recognition"
git branch -M main
git push -u origin main
```

### B. Deploy ke GitHub Pages
```bash
# Build dan deploy
npm run deploy
```

Atau manual:
```bash
# Build
npm run build

# Push folder dist ke branch gh-pages
git subtree push --prefix dist origin gh-pages
```

### C. Aktifkan GitHub Pages
1. Buka repository GitHub
2. Settings → Pages
3. Source: pilih branch `gh-pages`
4. Save
5. Tunggu 1-2 menit, aplikasi akan live di `https://username.github.io/repo-name/`

---

## 2. Deploy Google Apps Script (GAS) Backend

### A. Install Clasp (jika belum)
```bash
npm install -g @google/clasp
clasp login
```

### B. Push ke Google Apps Script
```bash
cd "GAS - HRIS"
clasp push
```

### C. Deploy Versi Baru
```bash
# Buat deployment baru
clasp deploy --versionNumber 2 --description "Add face recognition & geofencing"

# Atau update deployment yang ada
clasp deploy --description "Update face validation"
```

### D. Update URL di Frontend
Setelah deploy, update `GAS_API_URL` di file `.env`:
```
VITE_GAS_API_URL=https://script.google.com/macros/s/AKfycbx.../exec
```

---

## 3. Data Face Recognition - Di Mana?

### Lokasi Penyimpanan Face Data:

**A. Mode Local (tanpa GAS backend)**
- **File**: `src/lib/db.ts` → IndexedDB/localStorage
- **Field**: `Employee.faceDescriptor` (JSON string)
- **Field**: `Employee.faceRegistered` (boolean)
- **Akses**: `db.getEmployees()` → cek `faceDescriptor` dan `faceRegistered`

**B. Mode GAS Backend**
- **Storage**: Google Apps Script Properties Service
- **Key**: `face_descriptors`
- **Format**: JSON object dengan `employeeId` sebagai key

### Struktur Data Face:
```typescript
interface Employee {
  id: string;
  employeeId: string;
  fullName: string;
  faceDescriptor?: string;  // JSON: [0.123, 0.456, ...] (128 features)
  faceRegistered?: boolean; // true/false
}
```

### Contoh faceDescriptor:
```json
"[0.123,0.456,0.789,...]"  // 128 angka yang merepresentasikan wajah
```

---

## 4. Face Recognition Flow

### Enrollment (Pendaftaran):
1. Karyawan buka `/#/face-enrollment`
2. Kamera aktif → ambil foto
3. Sistem ekstrak 128 fitur wajah (descriptor)
4. Simpan ke `Employee.faceDescriptor`
5. Set `Employee.faceRegistered = true`

### Verification (Absensi):
1. Karyawan check-in/check-out
2. GPS validasi geofencing (harus dalam 200m kantor)
3. Kamera ambil selfie
4. Ekstrak descriptor dari selfie
5. **Compare** dengan enrolled descriptor
6. Hitung cosine similarity
7. **Threshold**: 65% untuk match
8. Jika match → absensi berhasil
9. Jika tidak match → ditolak

---

## 5. Testing

### Test Face Enrollment:
```bash
# Login sebagai karyawan
Email: employee@hrislite.com
Password: employee123

# Buka Face Enrollment
http://localhost:5173/#/face-enrollment
```

### Test Geofencing:
```bash
# Koordinat kantor (Pekanbaru)
Latitude: -1.282646
Longitude: 101.181111
Radius: 200 meter

# Test dari lokasi berbeda
- Dalam radius → absensi berhasil
- Di luar radius → ditolak dengan pesan jarak
```

---

## 6. Troubleshooting

### Face Recognition tidak bekerja:
1. Cek kamera permission
2. Cek pencahayaan (tidak terlalu gelap/terang)
3. Cek wajah tidak blur
4. Pastikan wajah sudah terdaftar (`faceRegistered = true`)

### Geofencing tidak akurat:
1. Aktifkan GPS high accuracy
2. Coba di outdoor (bukan di dalam gedung)
3. Tunggu 5-10 detik untuk GPS lock

### GitHub Pages tidak update:
1. Cek branch `gh-pages` ada
2. Cek Settings → Pages → Source benar
3. Clear cache browser (Ctrl+Shift+R)

---

## 7. Environment Variables

### File `.env`:
```env
# GAS Backend URL (opsional)
VITE_GAS_API_URL=

# App Config
VITE_APP_NAME=HRIS Lite Enterprise
VITE_APP_VERSION=1.0.0
```

### File `.env.example`:
```env
VITE_GAS_API_URL=
VITE_APP_NAME=HRIS Lite Enterprise
VITE_APP_VERSION=1.0.0
```

---

## 8. Build & Deploy Commands

```bash
# Install dependencies
npm install

# Run development
npm run dev

# Build for production
npm run build

# Preview build
npm run preview

# Deploy to GitHub Pages
npm run deploy

# Push GAS backend
cd "GAS - HRIS" && clasp push && clasp deploy
```

---

## 9. Important Notes

1. **Face Data Privacy**: Face descriptor disimpan locally di browser (localStorage/IndexedDB)
2. **Geofencing**: Koordinat bisa diubah di Settings (`officeLat`, `officeLng`, `officeRadiusMeters`)
3. **GAS Backend**: Opsional, app bisa jalan tanpa GAS (mode local)
4. **PWA**: Installable di HP Android/iOS
5. **Offline**: Service Worker cache untuk offline access

---

## 10. Support

- GitHub: https://github.com/username/repo-name
- Issues: https://github.com/username/repo-name/issues