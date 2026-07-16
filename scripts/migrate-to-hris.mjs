import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';

const sourcePath = 'C:/Users/ASUS TUF/Downloads/Database_Aplikasi_Absensi_Karyawan (1).xlsx';
const outputPath = path.resolve('output/Database_HRIS_Lengkap.xlsx');
const source = XLSX.readFile(sourcePath, { cellDates: true });
const rows = (name) => XLSX.utils.sheet_to_json(source.Sheets[name], { defval: '', raw: false });
const clean = (value) => String(value ?? '').trim();
const slug = (value) => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'umum';
const asBool = (value) => value === true || ['true', '1', 'yes', 'aktif'].includes(clean(value).toLowerCase());
const dateIso = (value) => {
  const text = clean(value);
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : text;
};
const now = new Date().toISOString();
const sourceUsers = rows('USERS').filter((row) => clean(row.NIK) || clean(row.Nama));
const sourceAttendance = rows('Absensi').filter((row) => clean(row.ID));
const sourcePayroll = rows('SlipGaji').filter((row) => clean(row.ID));
const sourceAnnouncements = rows('Informasi').filter((row) => clean(row.ID) || clean(row.Judul));
const sourceFences = rows('Geofencing').filter((row) => clean(row.ID));
const sourceSessions = rows('Sessions').filter((row) => clean(row.token));
// ActivityLog tidak memiliki baris header pada workbook sumber, jadi baca sebagai array.
const sourceLogs = XLSX.utils.sheet_to_json(source.Sheets.ActivityLog, { header: 1, defval: '', raw: false })
  .filter((row) => clean(row[0]));

const department = { id: 'dept-operasional', code: 'OPS', name: 'Operasional', description: 'Departemen default hasil migrasi', headId: '', isActive: true, createdAt: now };
const division = { id: 'div-umum', code: 'UMUM', name: 'Umum', departmentId: department.id, description: 'Divisi default hasil migrasi', isActive: true, createdAt: now };
const positionsByName = new Map();
for (const user of sourceUsers) {
  const name = clean(user.Jabatan) || 'Karyawan';
  if (!positionsByName.has(name)) positionsByName.set(name, {
    id: `pos-${slug(name)}`, code: slug(name).toUpperCase().slice(0, 12), name,
    departmentId: department.id, level: 1, description: '', isActive: true, createdAt: now,
  });
}

const employees = sourceUsers.map((user, index) => {
  const nik = clean(user.NIK).padStart(5, '0');
  const sourceEmployeeId = clean(user.employeeId) || nik;
  const id = `emp-${slug(sourceEmployeeId)}-${index + 1}`;
  const position = positionsByName.get(clean(user.Jabatan) || 'Karyawan');
  return {
    id, employeeId: `EMP-${sourceEmployeeId}`, nik, fullName: clean(user.Nama) || `Karyawan ${index + 1}`,
    gender: 'Male', birthDate: '', religion: '', address: '', phone: '', email: `${nik}@hris.local`,
    departmentId: department.id, divisionId: division.id, positionId: position.id, joinDate: '',
    employmentStatus: 'Active', salary: 0, photo: clean(user.Foto_URL), managerId: '', createdAt: now, updatedAt: now,
  };
});
const lookupEmployee = (value) => {
  const normalized = clean(value).replace(/^0+/, '');
  return employees.find((employee) => employee.nik.replace(/^0+/, '') === normalized || employee.employeeId.replace(/^EMP-0*/, '') === normalized);
};
const roleMap = { administrator: 'Administrator', admin: 'Administrator', hrd: 'HR', hr: 'HR', manager: 'Manager', karyawan: 'Employee', employee: 'Employee' };
const users = sourceUsers.map((user, index) => {
  const employee = lookupEmployee(user.employeeId || user.NIK);
  const nik = clean(user.NIK).padStart(5, '0');
  return {
    id: `usr-${slug(nik)}-${index + 1}`, email: `${nik}@hris.local`, password: clean(user.Password_Hash),
    role: roleMap[clean(user.Role).toLowerCase()] || 'Employee', employeeId: employee?.id || '',
    name: clean(user.Nama), avatar: clean(user.Foto_URL), isActive: true, createdAt: now,
  };
});
const attendance = sourceAttendance.map((row) => {
  const employee = lookupEmployee(row.NIK);
  const [inLat = '', inLng = ''] = clean(row.Lokasi_Masuk).split(',');
  const [outLat = '', outLng = ''] = clean(row.Lokasi_Pulang).split(',');
  return {
    id: clean(row.ID), employeeId: employee?.id || '', date: dateIso(row.Tanggal), checkIn: clean(row.Jam_Masuk), checkOut: clean(row.Jam_Pulang),
    checkInLat: inLat, checkInLng: inLng, checkOutLat: outLat, checkOutLng: outLng,
    checkInPhoto: clean(row.Foto_Masuk), checkOutPhoto: clean(row.Foto_Pulang),
    status: clean(row.Status) === 'TERLAMBAT' ? 'Late' : (clean(row.Status) === 'HADIR' ? 'Present' : clean(row.Status)),
    workHours: '', lateMinutes: 0, notes: clean(row.Metadata_Masuk), createdAt: now,
  };
});
const payroll = sourcePayroll.map((row) => {
  const employee = lookupEmployee(row.NIK);
  const number = (value) => Number(String(value).replace(/[^0-9.-]/g, '')) || 0;
  return {
    id: clean(row.ID), employeeId: employee?.id || '', period: clean(row.Periode), basicSalary: number(row.Gaji_Pokok),
    allowance: number(row.Tunjangan), overtime: 0, deduction: number(row.Potongan), bpjs: 0, pph21: 0,
    netSalary: number(row.Total), status: 'Generated', generatedAt: now, paidAt: '', notes: clean(row.FilePDF_URL),
  };
});
const announcements = sourceAnnouncements.map((row, index) => ({
  id: clean(row.ID) || `ann-${index + 1}`, title: clean(row.Judul), content: clean(row.Isi), priority: 'Normal',
  targetRole: clean(row.Target_Role) || 'All', isActive: true, publishDate: dateIso(row.Tanggal), expiryDate: '', createdBy: 'migration', createdAt: now,
}));
const settings = [
  ['companyName', 'HRIS Lite Enterprise'], ['workStartTime', '08:00'], ['workEndTime', '17:00'],
  ['lateToleranceMinutes', '15'], ['annualLeaveQuota', '12'],
  ['officeLat', clean(sourceFences[0]?.Latitude) || '-6.2088'], ['officeLng', clean(sourceFences[0]?.Longitude) || '106.8456'],
  ['officeRadiusMeters', (clean(sourceFences[0]?.Radius_Meter).match(/\d+/) || ['200'])[0]],
  ['geofenceName', clean(sourceFences[0]?.Nama_Lokasi) || 'Kantor Utama'],
];
const sessions = sourceSessions.map((row) => {
  const employee = lookupEmployee(row.employeeId);
  const user = users.find((item) => item.employeeId === employee?.id);
  return { token: clean(row.token), userId: user?.id || '', email: user?.email || '', role: user?.role || 'Employee', name: clean(row.name), employeeId: employee?.id || '', avatar: '', expiresAt: clean(row.expiresAt) };
});
const logs = sourceLogs.map((row, index) => {
  const employee = lookupEmployee(row[1]);
  return { id: `log-migrated-${index + 1}`, userId: employee?.id || clean(row[1]), userName: '', action: clean(row[2]), module: 'Migration', details: clean(row[3]), ip: '', createdAt: clean(row[0]) };
});

const tables = {
  EMPLOYEE: { headers: ['id','employeeId','nik','fullName','gender','birthDate','religion','address','phone','email','departmentId','divisionId','positionId','joinDate','employmentStatus','salary','photo','managerId','createdAt','updatedAt'], rows: employees },
  ATTENDANCE: { headers: ['id','employeeId','date','checkIn','checkOut','checkInLat','checkInLng','checkOutLat','checkOutLng','checkInPhoto','checkOutPhoto','status','workHours','lateMinutes','notes','createdAt'], rows: attendance },
  LEAVE: { headers: ['id','employeeId','leaveType','startDate','endDate','days','reason','status','managerNote','hrNote','approvedByManager','approvedByHR','createdAt','updatedAt'], rows: [] },
  PERMISSION: { headers: ['id','employeeId','type','date','startTime','endTime','reason','status','approvedBy','note','createdAt'], rows: [] },
  PAYROLL: { headers: ['id','employeeId','period','basicSalary','allowance','overtime','deduction','bpjs','pph21','netSalary','status','generatedAt','paidAt','notes'], rows: payroll },
  DEPARTMENT: { headers: ['id','code','name','description','headId','isActive','createdAt'], rows: [department] },
  DIVISION: { headers: ['id','code','name','departmentId','description','isActive','createdAt'], rows: [division] },
  POSITION: { headers: ['id','code','name','departmentId','level','description','isActive','createdAt'], rows: [...positionsByName.values()] },
  USERS: { headers: ['id','email','password','role','employeeId','name','avatar','isActive','createdAt'], rows: users },
  SETTING: { headers: ['key','value'], rows: settings.map(([key, value]) => ({ key, value })) },
  ANNOUNCEMENT: { headers: ['id','title','content','priority','targetRole','isActive','publishDate','expiryDate','createdBy','createdAt'], rows: announcements },
  LOGS: { headers: ['id','userId','userName','action','module','details','ip','createdAt'], rows: logs },
  SESSIONS: { headers: ['token','userId','email','role','name','employeeId','avatar','expiresAt'], rows: sessions },
};

const workbook = XLSX.utils.book_new();
for (const [sheetName, table] of Object.entries(tables)) {
  const data = [table.headers, ...table.rows.map((row) => table.headers.map((header) => row[header] ?? ''))];
  const sheet = XLSX.utils.aoa_to_sheet(data);
  sheet['!freeze'] = { xSplit: 0, ySplit: 1 };
  sheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 0, c: table.headers.length - 1 } }) };
  sheet['!cols'] = table.headers.map((header) => ({ wch: Math.min(Math.max(header.length + 2, 14), 30) }));
  for (let column = 0; column < table.headers.length; column += 1) {
    const cell = sheet[XLSX.utils.encode_cell({ r: 0, c: column })];
    cell.s = { fill: { fgColor: { rgb: '0D47A1' } }, font: { bold: true, color: { rgb: 'FFFFFF' } }, alignment: { horizontal: 'center' } };
  }
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
}
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
XLSX.writeFile(workbook, outputPath, { compression: true });
console.log(`Created ${outputPath}`);
