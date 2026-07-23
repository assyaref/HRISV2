/**
 * Script untuk memperbaiki inkonsistensi database HRIS.
 * Jalankan: node scripts/fix-database.mjs
 * 
 * MASALAH YANG DIPERBAIKI:
 * 1. Ferdi: faceRegistered=true tapi faceDescriptor KOSONG -> diset false
 * 2. Department/Division/Position hilang untuk karyawan baru (dept-5, div-6, pos-8)
 * 3. USERS dengan employeeId tidak valid (emp-02235-3, emp-03233-2, emp-02235-4)
 * 4. Kolom faceDescriptor/faceRegistered kosong di baris lama
 * 5. EMPLOYEE dengan joinDate / employmentStatus kosong
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = 'C:/Users/ASUS TUF/Downloads/Database_HRIS_Lengkap (3).xlsx';
const outputPath = path.resolve(__dirname, '..', 'output', 'Database_HRIS_FIXED.xlsx');

console.log(`📂 Membuka: ${sourcePath}`);
const wb = XLSX.readFile(sourcePath, { cellDates: true });
const fixes = [];

// ========== HELPER FUNCTIONS ==========
function readSheet(name) {
  if (!wb.Sheets[name]) return { headers: [], data: [] };
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '', raw: false, header: 1 });
  if (rows.length === 0) return { headers: [], data: [] };
  const headers = rows[0].map(h => String(h ?? ''));
  const data = rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i] ?? ''; });
    return obj;
  });
  return { headers, data };
}

function writeSheet(name, headers, data) {
  const rows = [headers, ...data.map(row => headers.map(h => row[h] ?? ''))];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  wb.Sheets[name] = ws;
}

// ========== PERBAIKAN 1: Ferdi faceDescriptor KOSONG ==========
console.log('\n🔍 [1/5] Memeriksa faceDescriptor vs faceRegistered...');
let { headers: empHeaders, data: empData } = readSheet('EMPLOYEE');

for (let i = 0; i < empData.length; i++) {
  const emp = empData[i];
  const faceDesc = String(emp.faceDescriptor ?? '').trim();
  const faceReg = String(emp.faceRegistered ?? '').trim().toLowerCase();

  // Cek inconsistent: faceRegistered=true tapi descriptor kosong
  if (faceReg === 'true' && (faceDesc.length < 3 || faceDesc === '[]')) {
    empData[i].faceRegistered = 'false';
    console.log(`   ❌ PERBAIKAN: ${emp.fullName} (${emp.employeeId}) - faceDescriptor KOSONG, set faceRegistered=false`);
    fixes.push(`Set faceRegistered=false untuk ${emp.fullName} (descriptor kosong)`);
  }

  // Cek inconsistent: ada descriptor tapi faceRegistered=false/tidak ada
  if (faceDesc.length > 3 && faceDesc !== '[]' && faceReg !== 'true') {
    empData[i].faceRegistered = 'true';
    console.log(`   ✅ PERBAIKAN: ${emp.fullName} (${emp.employeeId}) - ada descriptor, set faceRegistered=true`);
    fixes.push(`Set faceRegistered=true untuk ${emp.fullName} (descriptor ada)`);
  }
}

// ========== PERBAIKAN 2: Tambah Department/Division/Position yang hilang ==========
console.log('\n🔍 [2/5] Memperbaiki Department/Division/Position yang hilang...');

let { data: deptData } = readSheet('DEPARTMENT');
let { data: divData } = readSheet('DIVISION');
let { data: posData } = readSheet('POSITION');

const existingDepts = new Set(deptData.map(d => String(d.id).trim()));
const existingDivs = new Set(divData.map(d => String(d.id).trim()));
const existingPositions = new Set(posData.map(p => String(p.id).trim()));

const missingDepts = new Set();
const missingDivs = new Set();
const missingPositions = new Set();

for (const emp of empData) {
  const deptId = String(emp.departmentId ?? '').trim();
  const divId = String(emp.divisionId ?? '').trim();
  const posId = String(emp.positionId ?? '').trim();
  if (deptId && !existingDepts.has(deptId)) missingDepts.add(deptId);
  if (divId && !existingDivs.has(divId)) missingDivs.add(divId);
  if (posId && !existingPositions.has(posId)) missingPositions.add(posId);
}

const now = '2026-07-23T10:00:00.000Z';

// Tambah department
if (missingDepts.size > 0) {
  for (const deptId of [...missingDepts].sort()) {
    const code = deptId.replace('dept-', '').toUpperCase();
    deptData.push({
      id: deptId, code, name: `Departemen ${code}`,
      description: 'Ditambahkan saat perbaikan database',
      headId: '', isActive: 'true', createdAt: now
    });
    console.log(`   ➕ Tambah Department: ${deptId}`);
    fixes.push(`Tambah Department ${deptId}`);
  }
}
if (missingDepts.size > 0 && deptData.length > 0) {
  const deptHeaders = Object.keys(deptData[0]);
  writeSheet('DEPARTMENT', deptHeaders, deptData);
}

// Tambah division
if (missingDivs.size > 0) {
  for (const divId of [...missingDivs].sort()) {
    const code = divId.replace('div-', '').toUpperCase();
    let parentDept = 'dept-operasional';
    for (const emp of empData) {
      if (String(emp.divisionId ?? '').trim() === divId) {
        parentDept = String(emp.departmentId ?? 'dept-operasional').trim();
        break;
      }
    }
    divData.push({
      id: divId, code, name: `Divisi ${code}`,
      departmentId: parentDept,
      description: 'Ditambahkan saat perbaikan database',
      isActive: 'true', createdAt: now
    });
    console.log(`   ➕ Tambah Division: ${divId}`);
    fixes.push(`Tambah Division ${divId}`);
  }
}
if (missingDivs.size > 0 && divData.length > 0) {
  const divHeaders = Object.keys(divData[0]);
  writeSheet('DIVISION', divHeaders, divData);
}

// Tambah position
if (missingPositions.size > 0) {
  for (const posId of [...missingPositions].sort()) {
    const code = posId.replace('pos-', '').toUpperCase();
    let parentDept = 'dept-operasional';
    for (const emp of empData) {
      if (String(emp.positionId ?? '').trim() === posId) {
        parentDept = String(emp.departmentId ?? 'dept-operasional').trim();
        break;
      }
    }
    posData.push({
      id: posId, code, name: `Jabatan ${code}`,
      departmentId: parentDept,
      level: '1', description: 'Ditambahkan saat perbaikan database',
      isActive: 'true', createdAt: now
    });
    console.log(`   ➕ Tambah Position: ${posId}`);
    fixes.push(`Tambah Position ${posId}`);
  }
}
if (missingPositions.size > 0 && posData.length > 0) {
  const posHeaders = Object.keys(posData[0]);
  writeSheet('POSITION', posHeaders, posData);
}

// ========== PERBAIKAN 3: Fix USERS dengan employeeId tidak valid ==========
console.log('\n🔍 [3/5] Memperbaiki USERS dengan employeeId tidak valid...');
let { headers: usrHeaders, data: usrData } = readSheet('USERS');
const validEmpIds = new Set(empData.map(e => String(e.id).trim()));

for (let i = 0; i < usrData.length; i++) {
  const user = usrData[i];
  const empId = String(user.employeeId ?? '').trim();
  if (!empId) continue;

  if (!validEmpIds.has(empId)) {
    console.log(`   ⚠️  User ${user.email} references non-existent employeeId: ${empId}`);

    const userName = String(user.name ?? '').trim().toLowerCase();
    const matched = empData.find(e => String(e.fullName ?? '').trim().toLowerCase() === userName);

    if (matched) {
      usrData[i].employeeId = matched.id;
      console.log(`   ✅ FIX: User ${user.email} employeeId diubah ke ${matched.id} (matched by name: ${matched.fullName})`);
      fixes.push(`Fix USERS ${user.email}: employeeId ${empId} -> ${matched.id}`);
    } else {
      const role = String(user.role ?? '').trim();
      if (['Administrator', 'HR', 'Manager'].includes(role)) {
        console.log(`   ℹ️  Dibiarkan (role=${role}, tidak wajib punya employeeId)`);
      } else {
        usrData[i].employeeId = '';
        console.log(`   ⚠️  EmployeeId dikosongkan (tidak ditemukan match)`);
        fixes.push(`Kosongkan employeeId ${empId} untuk user ${user.email}`);
      }
    }
  }
}

// ========== PERBAIKAN 4: Tambahkan kolom faceDescriptor/faceRegistered ==========
console.log('\n🔍 [4/5] Memastikan kolom faceDescriptor & faceRegistered ada...');
let faceColAdded = false;
if (!empHeaders.includes('faceDescriptor')) {
  empHeaders.push('faceDescriptor');
  for (const row of empData) row.faceDescriptor = '';
  faceColAdded = true;
  console.log('   ➕ Kolom faceDescriptor ditambahkan');
}
if (!empHeaders.includes('faceRegistered')) {
  empHeaders.push('faceRegistered');
  for (const row of empData) {
    if (!row.faceRegistered) row.faceRegistered = 'false';
  }
  faceColAdded = true;
  console.log('   ➕ Kolom faceRegistered ditambahkan');
}
if (!faceColAdded) {
  console.log('   ✅ Kolom sudah lengkap');
} else {
  fixes.push('Tambah kolom faceDescriptor/faceRegistered');
}

// ========== PERBAIKAN 5: Fix EMPLOYEE yang joinDate / employmentStatus kosong ==========
console.log('\n🔍 [5/5] Memperbaiki data EMPLOYEE yang tidak lengkap...');
for (let i = 0; i < empData.length; i++) {
  const emp = empData[i];
  let changed = false;

  if (!String(emp.joinDate ?? '').trim()) {
    const created = String(emp.createdAt ?? '').trim();
    empData[i].joinDate = created ? created.slice(0, 10) : '2026-07-17';
    changed = true;
  }

  if (!String(emp.employmentStatus ?? '').trim()) {
    empData[i].employmentStatus = 'Active';
    changed = true;
  }

  if (changed) {
    console.log(`   ✅ Fix data: ${emp.fullName} (${emp.employeeId})`);
    fixes.push(`Fix data employee ${emp.fullName}`);
  }
}

// Tulis EMPLOYEE sheet
writeSheet('EMPLOYEE', empHeaders, empData);

// Tulis USERS sheet
writeSheet('USERS', usrHeaders, usrData);

// ========== SIMPAN ==========
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
XLSX.writeFile(wb, outputPath, { compression: true });

console.log('\n' + '='.repeat(60));
console.log('✅ DATABASE BERHASIL DIPERBAIKI!');
console.log(`📁 Output: ${outputPath}`);
console.log(`\n📋 Ringkasan Perbaikan (${fixes.length} items):`);
for (const f of fixes) {
  console.log(`   • ${f}`);
}
console.log('\n⚠️  Upload file ini ke Google Spreadsheet Anda!');
console.log('   Spreadsheet ID: 13gXyJRNeSxyx6pg5fsQISZLljEg8fSJ6nPjKDR2mOYI');
console.log('='.repeat(60));