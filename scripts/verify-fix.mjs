import XLSX from 'xlsx';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.resolve(__dirname, '..', 'output', 'Database_HRIS_FIXED.xlsx');

const wb = XLSX.readFile(filePath);
console.log('=== EMPLOYEE ===');
const emp = XLSX.utils.sheet_to_json(wb.Sheets.EMPLOYEE, { defval: '' });
emp.forEach(e => {
  const desc = String(e.faceDescriptor || '');
  const descPreview = desc.length > 30 ? desc.substring(0, 30) + '...' : desc;
  console.log(`${e.employeeId} | ${e.fullName} | faceReg: ${e.faceRegistered} | descLen: ${desc.length}`);
});

console.log('\n=== DEPARTMENT ===');
const dept = XLSX.utils.sheet_to_json(wb.Sheets.DEPARTMENT, { defval: '' });
dept.forEach(d => console.log(`${d.id} | ${d.code} | ${d.name}`));

console.log('\n=== DIVISION ===');
const div = XLSX.utils.sheet_to_json(wb.Sheets.DIVISION, { defval: '' });
div.forEach(d => console.log(`${d.id} | ${d.code} | ${d.name} | dept: ${d.departmentId}`));

console.log('\n=== POSITION ===');
const pos = XLSX.utils.sheet_to_json(wb.Sheets.POSITION, { defval: '' });
pos.forEach(p => console.log(`${p.id} | ${p.code} | ${p.name} | dept: ${p.departmentId}`));

console.log('\n=== USERS ===');
const usr = XLSX.utils.sheet_to_json(wb.Sheets.USERS, { defval: '' });
usr.forEach(u => console.log(`${u.email} | ${u.role} | empId: ${u.employeeId}`));