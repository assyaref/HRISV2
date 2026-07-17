import type {
  User,
  Employee,
  Department,
  Division,
  Position,
  Attendance,
  Leave,
  Permission,
  Payroll,
  Announcement,
  CompanySetting,
  ActivityLog,
} from '../types';

const today = new Date();
const fmt = (d: Date) => d.toISOString().split('T')[0];
const daysAgo = (n: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  return fmt(d);
};
const thisMonth = () => {
  const d = new Date(today);
  d.setDate(15);
  return fmt(d);
};

export const departments: Department[] = [
  { id: 'dept-1', code: 'IT', name: 'Information Technology', description: 'IT & Digital', isActive: true, createdAt: '2024-01-01' },
  { id: 'dept-2', code: 'HR', name: 'Human Resources', description: 'People & Culture', isActive: true, createdAt: '2024-01-01' },
  { id: 'dept-3', code: 'FIN', name: 'Finance', description: 'Finance & Accounting', isActive: true, createdAt: '2024-01-01' },
  { id: 'dept-4', code: 'MKT', name: 'Marketing', description: 'Marketing & Sales', isActive: true, createdAt: '2024-01-01' },
  { id: 'dept-5', code: 'OPS', name: 'Operations', description: 'Operations', isActive: true, createdAt: '2024-01-01' },
];

export const divisions: Division[] = [
  { id: 'div-1', code: 'DEV', name: 'Software Development', departmentId: 'dept-1', isActive: true, createdAt: '2024-01-01' },
  { id: 'div-2', code: 'INFRA', name: 'Infrastructure', departmentId: 'dept-1', isActive: true, createdAt: '2024-01-01' },
  { id: 'div-3', code: 'RECRUIT', name: 'Recruitment', departmentId: 'dept-2', isActive: true, createdAt: '2024-01-01' },
  { id: 'div-4', code: 'ACC', name: 'Accounting', departmentId: 'dept-3', isActive: true, createdAt: '2024-01-01' },
  { id: 'div-5', code: 'BRAND', name: 'Brand Marketing', departmentId: 'dept-4', isActive: true, createdAt: '2024-01-01' },
  { id: 'div-6', code: 'LOG', name: 'Logistics', departmentId: 'dept-5', isActive: true, createdAt: '2024-01-01' },
];

export const positions: Position[] = [
  { id: 'pos-1', code: 'SE', name: 'Software Engineer', departmentId: 'dept-1', level: 3, isActive: true, createdAt: '2024-01-01' },
  { id: 'pos-2', code: 'SSE', name: 'Senior Software Engineer', departmentId: 'dept-1', level: 4, isActive: true, createdAt: '2024-01-01' },
  { id: 'pos-3', code: 'TL', name: 'Team Lead', departmentId: 'dept-1', level: 5, isActive: true, createdAt: '2024-01-01' },
  { id: 'pos-4', code: 'HRBP', name: 'HR Business Partner', departmentId: 'dept-2', level: 4, isActive: true, createdAt: '2024-01-01' },
  { id: 'pos-5', code: 'HRO', name: 'HR Officer', departmentId: 'dept-2', level: 3, isActive: true, createdAt: '2024-01-01' },
  { id: 'pos-6', code: 'FA', name: 'Finance Analyst', departmentId: 'dept-3', level: 3, isActive: true, createdAt: '2024-01-01' },
  { id: 'pos-7', code: 'MM', name: 'Marketing Manager', departmentId: 'dept-4', level: 5, isActive: true, createdAt: '2024-01-01' },
  { id: 'pos-8', code: 'OM', name: 'Operations Manager', departmentId: 'dept-5', level: 5, isActive: true, createdAt: '2024-01-01' },
  { id: 'pos-9', code: 'CEO', name: 'Chief Executive Officer', departmentId: 'dept-5', level: 10, isActive: true, createdAt: '2024-01-01' },
];

export const employees: Employee[] = [
  {
    id: 'emp-1', employeeId: 'EMP001', nik: '3201011990010001', fullName: 'Ahmad Rizki Pratama',
    gender: 'Male', birthDate: '1990-01-15', religion: 'Islam',
    address: 'Jl. Sudirman No. 12, Jakarta', phone: '081234567801', email: 'ahmad.rizki@hrislite.com',
    departmentId: 'dept-1', divisionId: 'div-1', positionId: 'pos-3', joinDate: '2020-03-01',
    employmentStatus: 'Active', salary: 18000000, managerId: undefined, createdAt: '2020-03-01', updatedAt: '2020-03-01',
  },
  {
    id: 'emp-2', employeeId: 'EMP002', nik: '3201011992050002', fullName: 'Siti Nurhaliza',
    gender: 'Female', birthDate: thisMonth(), religion: 'Islam',
    address: 'Jl. Gatot Subroto No. 45, Jakarta', phone: '081234567802', email: 'siti.nurhaliza@hrislite.com',
    departmentId: 'dept-2', divisionId: 'div-3', positionId: 'pos-4', joinDate: '2019-06-15',
    employmentStatus: 'Active', salary: 15000000, createdAt: '2019-06-15', updatedAt: '2019-06-15',
  },
  {
    id: 'emp-3', employeeId: 'EMP003', nik: '3201011988120003', fullName: 'Budi Santoso',
    gender: 'Male', birthDate: '1988-12-20', religion: 'Kristen',
    address: 'Jl. Thamrin No. 8, Jakarta', phone: '081234567803', email: 'budi.santoso@hrislite.com',
    departmentId: 'dept-3', divisionId: 'div-4', positionId: 'pos-6', joinDate: '2021-01-10',
    employmentStatus: 'Active', salary: 12000000, createdAt: '2021-01-10', updatedAt: '2021-01-10',
  },
  {
    id: 'emp-4', employeeId: 'EMP004', nik: '3201011995030004', fullName: 'Dewi Lestari',
    gender: 'Female', birthDate: thisMonth(), religion: 'Islam',
    address: 'Jl. Kebon Jeruk No. 22, Jakarta', phone: '081234567804', email: 'dewi.lestari@hrislite.com',
    departmentId: 'dept-4', divisionId: 'div-5', positionId: 'pos-7', joinDate: '2022-02-01',
    employmentStatus: 'Active', salary: 16000000, createdAt: '2022-02-01', updatedAt: '2022-02-01',
  },
  {
    id: 'emp-5', employeeId: 'EMP005', nik: '3201011991080005', fullName: 'Eko Prasetyo',
    gender: 'Male', birthDate: '1991-08-05', religion: 'Islam',
    address: 'Jl. Menteng No. 3, Jakarta', phone: '081234567805', email: 'eko.prasetyo@hrislite.com',
    departmentId: 'dept-1', divisionId: 'div-1', positionId: 'pos-2', joinDate: '2021-07-20',
    employmentStatus: 'Active', salary: 14000000, managerId: 'emp-1', createdAt: '2021-07-20', updatedAt: '2021-07-20',
  },
  {
    id: 'emp-6', employeeId: 'EMP006', nik: '3201011994070006', fullName: 'Fitri Handayani',
    gender: 'Female', birthDate: '1994-07-18', religion: 'Islam',
    address: 'Jl. Senayan No. 17, Jakarta', phone: '081234567806', email: 'fitri.handayani@hrislite.com',
    departmentId: 'dept-2', divisionId: 'div-3', positionId: 'pos-5', joinDate: '2023-01-15',
    employmentStatus: 'On Leave', salary: 9000000, managerId: 'emp-2', createdAt: '2023-01-15', updatedAt: '2023-01-15',
  },
  {
    id: 'emp-7', employeeId: 'EMP007', nik: '3201011989050007', fullName: 'Gunawan Wijaya',
    gender: 'Male', birthDate: '1989-05-30', religion: 'Buddha',
    address: 'Jl. Pluit No. 55, Jakarta', phone: '081234567807', email: 'gunawan.wijaya@hrislite.com',
    departmentId: 'dept-5', divisionId: 'div-6', positionId: 'pos-8', joinDate: '2018-09-01',
    employmentStatus: 'Active', salary: 17000000, createdAt: '2018-09-01', updatedAt: '2018-09-01',
  },
  {
    id: 'emp-8', employeeId: 'EMP008', nik: '3201011996110008', fullName: 'Hana Putri',
    gender: 'Female', birthDate: '1996-11-12', religion: 'Kristen',
    address: 'Jl. Cikini No. 9, Jakarta', phone: '081234567808', email: 'hana.putri@hrislite.com',
    departmentId: 'dept-1', divisionId: 'div-2', positionId: 'pos-1', joinDate: '2023-06-01',
    employmentStatus: 'Probation', salary: 8000000, managerId: 'emp-1', createdAt: '2023-06-01', updatedAt: '2023-06-01',
  },
  {
    id: 'emp-9', employeeId: 'EMP009', nik: '3201011987030009', fullName: 'Indra Kurniawan',
    gender: 'Male', birthDate: '1987-03-25', religion: 'Islam',
    address: 'Jl. Kemang No. 30, Jakarta', phone: '081234567809', email: 'indra.kurniawan@hrislite.com',
    departmentId: 'dept-5', divisionId: 'div-6', positionId: 'pos-9', joinDate: '2015-01-01',
    employmentStatus: 'Active', salary: 35000000, createdAt: '2015-01-01', updatedAt: '2015-01-01',
  },
  {
    id: 'emp-10', employeeId: 'EMP010', nik: '3201011992090010', fullName: 'Joko Susilo',
    gender: 'Male', birthDate: '1992-09-08', religion: 'Islam',
    address: 'Jl. Cipete No. 14, Jakarta', phone: '081234567810', email: 'joko.susilo@hrislite.com',
    departmentId: 'dept-3', divisionId: 'div-4', positionId: 'pos-6', joinDate: '2020-11-01',
    employmentStatus: 'Resigned', salary: 11000000, createdAt: '2020-11-01', updatedAt: '2024-12-01',
  },
];

export const users: User[] = [
  { id: 'usr-1', email: 'admin@hrislite.com', password: 'admin123', role: 'Administrator', name: 'System Admin', employeeId: 'emp-9', isActive: true, createdAt: '2024-01-01' },
  { id: 'usr-2', email: 'hr@hrislite.com', password: 'hr123', role: 'HR', name: 'Siti Nurhaliza', employeeId: 'emp-2', isActive: true, createdAt: '2024-01-01' },
  { id: 'usr-3', email: 'manager@hrislite.com', password: 'manager123', role: 'Manager', name: 'Ahmad Rizki Pratama', employeeId: 'emp-1', isActive: true, createdAt: '2024-01-01' },
  { id: 'usr-4', email: 'employee@hrislite.com', password: 'employee123', role: 'Employee', name: 'Eko Prasetyo', employeeId: 'emp-5', isActive: true, createdAt: '2024-01-01' },
  { id: 'usr-5', email: 'dewi.lestari@hrislite.com', password: 'dewi123', role: 'Manager', name: 'Dewi Lestari', employeeId: 'emp-4', isActive: true, createdAt: '2024-01-01' },
];

function makeAttendance(empId: string, dayOffset: number, late = false): Attendance {
  const date = daysAgo(dayOffset);
  const checkInHour = late ? 9 : 8;
  const checkInMin = late ? 15 + Math.floor(Math.random() * 30) : Math.floor(Math.random() * 20);
  const checkOutHour = 17 + Math.floor(Math.random() * 2);
  const checkOutMin = Math.floor(Math.random() * 60);
  const lateMinutes = late ? (checkInHour - 8) * 60 + checkInMin : 0;
  const workHours = +(checkOutHour + checkOutMin / 60 - (checkInHour + checkInMin / 60)).toFixed(2);
  return {
    id: `att-${empId}-${date}`,
    employeeId: empId,
    date,
    checkIn: `${String(checkInHour).padStart(2, '0')}:${String(checkInMin).padStart(2, '0')}:00`,
    checkOut: dayOffset === 0 ? undefined : `${String(checkOutHour).padStart(2, '0')}:${String(checkOutMin).padStart(2, '0')}:00`,
    checkInLat: -6.2088 + (Math.random() - 0.5) * 0.01,
    checkInLng: 106.8456 + (Math.random() - 0.5) * 0.01,
    status: late ? 'Late' : 'Present',
    workHours: dayOffset === 0 ? undefined : workHours,
    lateMinutes,
    createdAt: `${date}T08:00:00Z`,
  };
}

export const attendances: Attendance[] = [
  makeAttendance('emp-1', 0, false),
  makeAttendance('emp-2', 0, true),
  makeAttendance('emp-3', 0, false),
  makeAttendance('emp-4', 0, false),
  makeAttendance('emp-5', 0, true),
  makeAttendance('emp-7', 0, false),
  makeAttendance('emp-9', 0, false),
  makeAttendance('emp-1', 1, false),
  makeAttendance('emp-2', 1, false),
  makeAttendance('emp-3', 1, true),
  makeAttendance('emp-5', 1, false),
  makeAttendance('emp-1', 2, false),
  makeAttendance('emp-5', 2, true),
  makeAttendance('emp-2', 3, false),
  makeAttendance('emp-4', 3, false),
  makeAttendance('emp-1', 4, false),
  makeAttendance('emp-3', 5, true),
  makeAttendance('emp-5', 5, false),
  makeAttendance('emp-7', 6, false),
  makeAttendance('emp-9', 7, false),
];

export const leaves: Leave[] = [
  {
    id: 'leave-1', employeeId: 'emp-6', leaveType: 'Annual',
    startDate: daysAgo(2), endDate: daysAgo(-5), days: 7,
    reason: 'Liburan keluarga ke Bali', status: 'Approved HR',
    approvedByManager: 'emp-2', approvedByHR: 'emp-2',
    createdAt: daysAgo(10), updatedAt: daysAgo(5),
  },
  {
    id: 'leave-2', employeeId: 'emp-5', leaveType: 'Sick',
    startDate: daysAgo(-3), endDate: daysAgo(-3), days: 1,
    reason: 'Demam dan flu', status: 'Pending',
    createdAt: daysAgo(1), updatedAt: daysAgo(1),
  },
  {
    id: 'leave-3', employeeId: 'emp-8', leaveType: 'Annual',
    startDate: daysAgo(-10), endDate: daysAgo(-12), days: 3,
    reason: 'Acara keluarga', status: 'Approved Manager',
    approvedByManager: 'emp-1',
    createdAt: daysAgo(5), updatedAt: daysAgo(3),
  },
  {
    id: 'leave-4', employeeId: 'emp-3', leaveType: 'Annual',
    startDate: daysAgo(20), endDate: daysAgo(18), days: 3,
    reason: 'Cuti tahunan', status: 'Approved HR',
    approvedByManager: 'emp-9', approvedByHR: 'emp-2',
    createdAt: daysAgo(30), updatedAt: daysAgo(25),
  },
];

export const permissions: Permission[] = [
  {
    id: 'perm-1', employeeId: 'emp-5', type: 'Izin', date: daysAgo(3),
    startTime: '13:00', endTime: '17:00', reason: 'Urusan keluarga ke kelurahan',
    status: 'Approved', approvedBy: 'emp-1', createdAt: daysAgo(4),
  },
  {
    id: 'perm-2', employeeId: 'emp-8', type: 'WFH', date: daysAgo(1),
    reason: 'Renovasi rumah, tidak bisa ke kantor', status: 'Pending', createdAt: daysAgo(2),
  },
  {
    id: 'perm-3', employeeId: 'emp-3', type: 'Dinas', date: daysAgo(-2),
    reason: 'Meeting klien di Bandung', status: 'Approved', approvedBy: 'emp-9', createdAt: daysAgo(5),
  },
  {
    id: 'perm-4', employeeId: 'emp-4', type: 'Sakit', date: daysAgo(7),
    reason: 'Sakit kepala migrain', status: 'Approved', approvedBy: 'emp-9', createdAt: daysAgo(8),
  },
];

const currentPeriod = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
const prevDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
const prevPeriod = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

export const payrolls: Payroll[] = employees
  .filter((e) => e.employmentStatus !== 'Resigned')
  .flatMap((e) => {
    const allowance = Math.round(e.salary * 0.1);
    const overtime = Math.round(Math.random() * 500000);
    const bpjs = Math.round(e.salary * 0.04);
    const pph21 = Math.round(e.salary * 0.05);
    const deduction = Math.round(Math.random() * 200000);
    const net = e.salary + allowance + overtime - deduction - bpjs - pph21;
    return [
      {
        id: `pay-${e.id}-${prevPeriod}`,
        employeeId: e.id,
        period: prevPeriod,
        basicSalary: e.salary,
        allowance,
        overtime,
        deduction,
        bpjs,
        pph21,
        netSalary: net,
        status: 'Paid' as const,
        generatedAt: daysAgo(20),
        paidAt: daysAgo(15),
      },
      {
        id: `pay-${e.id}-${currentPeriod}`,
        employeeId: e.id,
        period: currentPeriod,
        basicSalary: e.salary,
        allowance,
        overtime: Math.round(Math.random() * 400000),
        deduction: Math.round(Math.random() * 100000),
        bpjs,
        pph21,
        netSalary: e.salary + allowance + Math.round(Math.random() * 400000) - Math.round(Math.random() * 100000) - bpjs - pph21,
        status: 'Generated' as const,
        generatedAt: daysAgo(2),
      },
    ];
  });

export const announcements: Announcement[] = [
  {
    id: 'ann-1', title: 'Libur Nasional Hari Raya',
    content: 'Diberitahukan kepada seluruh karyawan bahwa kantor akan libur pada tanggal yang telah ditetapkan pemerintah. Mohon untuk menyesuaikan jadwal kerja.',
    priority: 'High', targetRole: 'All', isActive: true,
    publishDate: daysAgo(2), createdBy: 'usr-1', createdAt: daysAgo(2),
  },
  {
    id: 'ann-2', title: 'Update Kebijakan Work From Home',
    content: 'Mulai bulan ini, karyawan dapat mengajukan WFH maksimal 2 hari per minggu dengan persetujuan atasan langsung.',
    priority: 'Normal', targetRole: 'All', isActive: true,
    publishDate: daysAgo(5), createdBy: 'usr-2', createdAt: daysAgo(5),
  },
  {
    id: 'ann-3', title: 'Pelatihan Soft Skills',
    content: 'HR mengadakan pelatihan soft skills untuk seluruh manager. Pendaftaran dibuka hingga akhir bulan.',
    priority: 'Low', targetRole: 'Manager', isActive: true,
    publishDate: daysAgo(7), createdBy: 'usr-2', createdAt: daysAgo(7),
  },
  {
    id: 'ann-4', title: 'Deadline Laporan Absensi',
    content: 'Mohon seluruh manager menyelesaikan approval cuti dan izin sebelum tanggal 25 setiap bulannya.',
    priority: 'Urgent', targetRole: 'Manager', isActive: true,
    publishDate: daysAgo(1), createdBy: 'usr-1', createdAt: daysAgo(1),
  },
];

export const settings: CompanySetting = {
  companyName: 'HRIS Lite Enterprise',
  companyAddress: 'Pekanbaru, Riau',
  companyPhone: '+62 21 1234 5678',
  companyEmail: 'info@hrislite.com',
  workStartTime: '08:00',
  workEndTime: '17:00',
  lateToleranceMinutes: 15,
  officeLat: -1.282646,
  officeLng: 101.181111,
  officeRadiusMeters: 200,
  holidays: ['2026-01-01', '2026-03-30', '2026-05-01', '2026-08-17', '2026-12-25'],
  theme: 'light',
  annualLeaveQuota: 12,
};

export const activityLogs: ActivityLog[] = [
  { id: 'log-1', userId: 'usr-1', userName: 'System Admin', action: 'LOGIN', module: 'Auth', details: 'Successful login', createdAt: daysAgo(0) + 'T07:30:00Z' },
  { id: 'log-2', userId: 'usr-2', userName: 'Siti Nurhaliza', action: 'UPDATE', module: 'Employee', details: 'Updated employee EMP006', createdAt: daysAgo(1) + 'T10:15:00Z' },
  { id: 'log-3', userId: 'usr-3', userName: 'Ahmad Rizki', action: 'APPROVE', module: 'Leave', details: 'Approved leave leave-3', createdAt: daysAgo(3) + 'T14:00:00Z' },
];

export const DEMO_ACCOUNTS = [
  { email: 'admin@hrislite.com', password: 'admin123', role: 'Administrator' },
  { email: 'hr@hrislite.com', password: 'hr123', role: 'HR' },
  { email: 'manager@hrislite.com', password: 'manager123', role: 'Manager' },
  { email: 'employee@hrislite.com', password: 'employee123', role: 'Employee' },
];
