# HRIS Lite Enterprise

Enterprise Human Resource Information System (HRIS) berbasis React + TypeScript + Google Apps Script.

---

# AI Development Guide

Dokumen ini wajib diikuti oleh Amazon Q ketika melakukan analisis, debugging, refactoring, maupun implementasi fitur.

---

## Project Stack

Frontend
- React
- TypeScript
- Vite
- TailwindCSS
- Bootstrap 5

Backend
- Google Apps Script (REST API)

Database
- Google Spreadsheet

Storage
- Google Drive

Authentication
- JWT / Session

Face Recognition
- face-api.js

---

# Development Rules

## Jangan pernah

- Jangan menghapus fitur yang sudah ada.
- Jangan mengubah struktur folder tanpa alasan.
- Jangan mengubah API Contract.
- Jangan mengubah Spreadsheet schema.
- Jangan mengubah endpoint GAS.
- Jangan mengubah UI kecuali diminta.

---

## Selalu lakukan

Sebelum menulis kode:

1. Analisis project.
2. Cari dependency.
3. Jelaskan root cause.
4. Buat implementation plan.
5. Baru lakukan perubahan.

---

## Coding Standard

Gunakan:

- TypeScript Strict
- Functional Component
- React Hooks
- Async/Await
- Reusable Component
- Clean Architecture

Hindari:

- any
- duplicated code
- hardcoded value
- nested callback
- magic number

---

# Folder Structure

src/

components/

pages/

hooks/

services/

api/

utils/

types/

contexts/

assets/

backend/

Google Apps Script

---

# Face ID Flow

Registrasi

Camera
↓

Capture Face

↓

Generate Face Descriptor

↓

Save Descriptor

↓

Google Apps Script

↓

Google Spreadsheet

Absensi

Camera

↓

Capture Face

↓

Generate Descriptor

↓

Load Descriptor Employee

↓

Compare Descriptor

↓

Threshold Check

↓

Attendance Success

---

# Debugging Rules

Jika terjadi bug:

Jangan langsung memperbaiki.

Lakukan langkah berikut:

1. Cari seluruh file terkait.
2. Jelaskan flow.
3. Temukan root cause.
4. Jelaskan penyebab.
5. Baru lakukan fix.

---

# Face Attendance Checklist

Saat debugging Face Attendance, selalu periksa:

□ employeeId

□ userId

□ login session

□ descriptor

□ face embedding

□ threshold

□ API request

□ API response

□ Spreadsheet

□ Google Drive

□ Face Registration

□ Face Verification

---

# Error Investigation

Jika muncul:

"Wajah Anda belum terdaftar."

Lakukan pemeriksaan:

1. Apakah descriptor tersimpan?
2. Apakah employeeId sesuai?
3. Apakah API mengembalikan descriptor?
4. Apakah descriptor null?
5. Apakah descriptor kosong?
6. Apakah compareFace berjalan?
7. Apakah threshold terlalu tinggi?

---

# Logging Rules

Saat debugging tambahkan log:

console.log("Employee ID:", employeeId);

console.log("User:", user);

console.log("API Response:", response);

console.log("Descriptor:", descriptor);

console.log("Distance:", distance);

console.log("Threshold:", threshold);

---

# Pull Request Rules

Sebelum selesai:

- Pastikan project dapat di-build.
- Tidak ada TypeScript Error.
- Tidak ada ESLint Error.
- Tidak ada fitur yang rusak.
- Jelaskan seluruh file yang diubah.

---

# AI Instructions

Setiap kali menerima task:

1. Pahami requirement.
2. Analisis project.
3. Cari file terkait.
4. Buat implementation plan.
5. Baru edit kode.
6. Jelaskan perubahan.
7. Lakukan self review.
8. Pastikan tidak ada regression.

Jangan membuat asumsi.

Gunakan source code sebagai dasar analisis.

Jika informasi kurang, lakukan pencarian di seluruh workspace sebelum memberikan jawaban.
