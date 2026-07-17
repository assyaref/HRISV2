export type Role = 'Administrator' | 'HR' | 'Manager' | 'Employee';

export type EmploymentStatus = 'Active' | 'On Leave' | 'Resigned' | 'Probation';

export type Gender = 'Male' | 'Female';

export type LeaveStatus = 'Pending' | 'Approved Manager' | 'Approved HR' | 'Rejected' | 'Cancelled';

export type PermissionType = 'Izin' | 'Sakit' | 'Dinas' | 'WFH';

export type PermissionStatus = 'Pending' | 'Approved' | 'Rejected';

export interface User {
  id: string;
  email: string;
  password: string;
  role: Role;
  employeeId?: string;
  name: string;
  avatar?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Employee {
  id: string;
  employeeId: string;
  nik: string;
  fullName: string;
  gender: Gender;
  birthDate: string;
  religion: string;
  address: string;
  phone: string;
  email: string;
  departmentId: string;
  divisionId: string;
  positionId: string;
  joinDate: string;
  employmentStatus: EmploymentStatus;
  salary: number;
  photo?: string;
  qrCode?: string;
  managerId?: string;
  faceDescriptor?: string; // JSON string dari Float32Array untuk face recognition
  faceRegistered?: boolean; // Status registrasi wajah
  createdAt: string;
  updatedAt: string;
}

export interface Department {
  id: string;
  code: string;
  name: string;
  description?: string;
  headId?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Division {
  id: string;
  code: string;
  name: string;
  departmentId: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Position {
  id: string;
  code: string;
  name: string;
  departmentId: string;
  level: number;
  description?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Attendance {
  id: string;
  employeeId: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  checkInLat?: number;
  checkInLng?: number;
  checkOutLat?: number;
  checkOutLng?: number;
  checkInPhoto?: string;
  checkOutPhoto?: string;
  status: 'Present' | 'Late' | 'Absent' | 'Half Day' | 'On Leave';
  workHours?: number;
  lateMinutes?: number;
  notes?: string;
  createdAt: string;
}

export interface Leave {
  id: string;
  employeeId: string;
  leaveType: 'Annual' | 'Sick' | 'Maternity' | 'Unpaid' | 'Other';
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  managerNote?: string;
  hrNote?: string;
  approvedByManager?: string;
  approvedByHR?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Permission {
  id: string;
  employeeId: string;
  type: PermissionType;
  date: string;
  startTime?: string;
  endTime?: string;
  reason: string;
  status: PermissionStatus;
  approvedBy?: string;
  note?: string;
  attachment?: string;
  createdAt: string;
}

export interface Payroll {
  id: string;
  employeeId: string;
  period: string; // YYYY-MM
  basicSalary: number;
  allowance: number;
  overtime: number;
  deduction: number;
  bpjs: number;
  pph21: number;
  netSalary: number;
  status: 'Draft' | 'Generated' | 'Paid';
  generatedAt?: string;
  paidAt?: string;
  notes?: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: 'Low' | 'Normal' | 'High' | 'Urgent';
  targetRole?: Role | 'All';
  isActive: boolean;
  publishDate: string;
  expiryDate?: string;
  createdBy: string;
  createdAt: string;
}

export interface CompanySetting {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyLogo?: string;
  workStartTime: string;
  workEndTime: string;
  lateToleranceMinutes: number;
  officeLat: number;
  officeLng: number;
  officeRadiusMeters: number;
  holidays: string[];
  theme: 'light' | 'dark' | 'system';
  annualLeaveQuota: number;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  module: string;
  details?: string;
  ip?: string;
  createdAt: string;
}

export interface Session {
  token: string;
  userId: string;
  email: string;
  role: Role;
  name: string;
  employeeId?: string;
  avatar?: string;
  expiresAt: number;
}

export interface DashboardStats {
  totalEmployee: number;
  activeEmployee: number;
  onLeave: number;
  resigned: number;
  attendanceToday: number;
  lateToday: number;
  attendanceMonthly: { month: string; present: number; late: number; absent: number }[];
  employeeByDepartment: { name: string; count: number }[];
  employeeByStatus: { status: string; count: number }[];
  recentAttendance: Attendance[];
  recentEmployees: Employee[];
  birthdaysThisMonth: Employee[];
  announcements: Announcement[];
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  token?: string;
}

export interface LeaveBalance {
  annual: number;
  used: number;
  remaining: number;
  sick: number;
  other: number;
}
