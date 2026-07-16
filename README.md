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
