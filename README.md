# HRISV2

Frontend ini siap dideploy sebagai static site ke GitHub Pages. Routing memakai
hash (`/#/dashboard`), sehingga membuka ulang halaman tidak akan menghasilkan
404 dari GitHub Pages.

## Deploy ke GitHub Pages

1. Push perubahan ini ke branch `main` pada repository GitHub.
2. Buka **Settings → Pages → Build and deployment** dan pilih **GitHub Actions**.
3. Workflow **Deploy GitHub Pages** akan berjalan otomatis. URL situs dapat
   dilihat pada ringkasan workflow atau Settings → Pages.

## Backend Google Apps Script

Deploy folder `GAS - HRIS` sebagai **Web app** dengan akses yang mengizinkan
browser pengguna mengaksesnya. Isi `SPREADSHEET_ID` dan `DRIVE_FOLDER_ID` di
`GAS - HRIS/Config.gs`, kemudian jalankan `initAllSheets()` sekali dari editor
Apps Script.

Salin URL deployment yang berakhiran `/exec` ke `.env` lokal berdasarkan
`.env.example`. Untuk build dari GitHub, simpan nilai yang sama sebagai
repository variable `VITE_GAS_API_URL` (Settings → Secrets and variables →
Actions → Variables). Workflow sudah meneruskannya ke proses build.

Jangan menyimpan kata sandi, spreadsheet ID privat, atau token admin pada
frontend/GitHub Pages karena seluruh aset situs dapat dibaca publik.

## Payroll — slip PDF terenkripsi otomatis

Modul **Payroll** kini mengamankan slip gaji dengan enkripsi PDF sungguhan:

- Password slip: `{NIK}{DD}{MM}{YYYY}` dari tanggal lahir karyawan
  (contoh: NIK `12345`, lahir `15-08-1995` → `1234515081995`).
- Enkripsi dilakukan **di browser** (`@pdfsmaller/pdf-encrypt-lite`,
  RC4 128-bit / Standard Security Handler) sebelum file dikirim —
  jsPDF/pdf-lib tidak bisa membuat PDF terkunci.
- Alur status: `Draft` → `Slip Tersedia` (upload slip terenkripsi ke Google Drive)
  → `Terkirim` (aksi Kirim Slip, simulasi).
- Aksi baru: upload slip (auto-encrypt), kirim slip, unduh slip dari Drive.

### Deploy ulang backend GAS (wajib setelah perubahan ini)

1. Buka `GAS - HRIS` dengan [clasp](https://developers.google.com/apps-script/guides/clasp) atau tempel manual ke editor Apps Script.
2. Push semua file, lalu **Deploy → Manage deployments → Edit → Version baru**.
3. Salin URL `/exec` yang baru ke repository variable `VITE_GAS_API_URL`
   (Settings → Secrets and variables → Actions → Variables) dan ke `.env` lokal.
4. Kolom `slipFileId`, `slipUrl`, `slipSentAt` di sheet **PAYROLL** ditambahkan
   otomatis saat halaman Payroll dibuka / payroll digenerate (tidak perlu
   migrasi manual).

