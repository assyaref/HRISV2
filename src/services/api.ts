/**
 * API Service - HRIS Lite Enterprise
 * 
 * Terintegrasi dengan Google Apps Script Backend (GAS).
 * Semua operasi data dilakukan melalui GAS Web App.
 * Jika GAS tidak tersedia, fallback ke localStorage untuk development.
 */

import { gasRequest, GAS_API_URL } from './gasClient';
import { getItem, setItem, removeItem } from '../lib/storage';
import { db } from '../lib/db';
import {
  generateId,
  generateToken,
  generateEmployeeId,
  todayStr,
  calcLeaveDays,
  isBirthdayThisMonth,
  haversineDistance,
} from '../lib/utils';
import type {
  ApiResponse,
  Session,
  Employee,
  Department,
  Division,
  Position,
  Leave,
  Permission,
  Payroll,
  Announcement,
  CompanySetting,
  DashboardStats,
  LeaveBalance,
  Role,
  Attendance,
  User,
} from '../types';

const SESSION_KEY = 'gas_session';
const FALLBACK_KEY = 'use_gas_backend';
const API_DELAY = 300;

/**
 * Cek apakah harus menggunakan GAS backend atau fallback ke localStorage.
 * Default: true (GAS backend) jika ada konfigurasi URL.
 */
function shouldUseGAS(): boolean {
  const stored = getItem<boolean | null>(FALLBACK_KEY, null);
  if (stored !== null) return stored;
  return !!GAS_API_URL;
}

/**
 * Set mode penggunaan backend
 */
export function setBackendMode(useGas: boolean): void {
  setItem(FALLBACK_KEY, useGas);
}

/**
 * Get current session token from storage
 */
function getSessionToken(): string {
  const session = getItem<Session | null>(SESSION_KEY, null);
  return session?.token || '';
}

/**
 * Get full session object
 */
function getSession(): Session | null {
  const session = getItem<Session | null>(SESSION_KEY, null);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    removeItem(SESSION_KEY);
    return null;
  }
  return session;
}

/**
 * Save session to storage
 */
function saveSession(session: Session): void {
  setItem(SESSION_KEY, session);
}

/**
 * Require authentication
 */
function requireAuth(): Session {
  const session = getSession();
  if (!session) throw new Error('Sesi tidak valid. Silakan login kembali.');
  return session;
}

/**
 * Require specific role
 */
function requireRole(roles: Role[]): Session {
  const session = requireAuth();
  if (!roles.includes(session.role) && session.role !== 'Administrator') {
    throw new Error('Anda tidak memiliki akses ke fitur ini.');
  }
  return session;
}

// ========== RESPONSE HELPERS ==========
function ok<T>(data: T, message = 'Success'): ApiResponse<T> {
  return { success: true, message, data };
}

function fail<T = never>(message: string): ApiResponse<T> {
  return { success: false, message };
}

function delay(ms = API_DELAY) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Universal API caller - mencoba GAS dulu, fallback ke local jika gagal
 */
async function callAPI<T>(action: string, payload: Record<string, unknown> = {}): Promise<ApiResponse<T>> {
  const useGas = shouldUseGAS();

  if (useGas) {
    try {
      const token = getSessionToken();
      const result = await gasRequest<ApiResponse<T>>(action, payload, token);
      return result;
    } catch (error) {
      console.warn(`GAS API error for "${action}":`, error);
      // Jika GAS gagal, coba local fallback
      console.info('Falling back to local storage...');
    }
  }

  // Fallback: gunakan method yang sesuai
  throw new Error(`GAS backend tidak tersedia untuk action: ${action}. Silakan deploy backend terlebih dahulu.`);
}

// ========== AUTH ==========
export async function login(email: string, password: string, remember = false): Promise<ApiResponse<Session>> {
  const useGas = shouldUseGAS();

  if (useGas) {
    try {
      const result = await gasRequest<ApiResponse<Session>>('login', { 
        email, 
        password, 
        remember 
      });
      
      if (result.success && result.data) {
        saveSession(result.data);
      }
      if (result.success && result.token && result.data) {
        // Pastikan token juga ada di data session
        result.data.token = result.token;
        saveSession(result.data);
      }
      return result;
    } catch (error) {
      console.warn('GAS login failed, trying local fallback:', error);
    }
  }

  // Fallback ke localStorage
  await delay();
  const user = db.getUserByEmail(email);
  if (!user || user.password !== password) {
    return fail('Email atau password salah');
  }
  if (!user.isActive) {
    return fail('Akun Anda dinonaktifkan. Hubungi administrator.');
  }
  const token = generateToken();
  const expiresAt = Date.now() + (remember ? 30 : 1) * 24 * 60 * 60 * 1000;
  const session: Session = {
    token,
    userId: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    employeeId: user.employeeId,
    avatar: user.avatar,
    expiresAt,
  };
  saveSession(session);
  db.addLog({ userId: user.id, userName: user.name, action: 'LOGIN', module: 'Auth', details: 'Successful login' });
  return { success: true, message: 'Login berhasil', data: session, token };
}

export async function logout(): Promise<ApiResponse> {
  const useGas = shouldUseGAS();

  if (useGas) {
    try {
      const token = getSessionToken();
      await gasRequest<ApiResponse>('logout', {}, token);
    } catch {
      // ignore logout errors
    }
  }

  await delay(100);
  const session = getSession();
  if (session) {
    db.addLog({ userId: session.userId, userName: session.name, action: 'LOGOUT', module: 'Auth' });
  }
  removeItem(SESSION_KEY);
  return ok(null, 'Logout berhasil');
}

export async function verifySession(): Promise<ApiResponse<Session>> {
  const useGas = shouldUseGAS();

  if (useGas) {
    try {
      const token = getSessionToken();
      const result = await gasRequest<ApiResponse<Session>>('verifySession', {}, token);
      if (result.success && result.data) {
        saveSession(result.data);
      }
      return result;
    } catch {
      // fallback
    }
  }

  await delay(100);
  const session = getSession();
  if (!session) return fail('Sesi tidak valid');
  return ok(session);
}

export function getCurrentSession(): Session | null {
  return getSession();
}

// ========== DASHBOARD ==========
export async function getDashboard(): Promise<ApiResponse<DashboardStats>> {
  try {
    return await callAPI<DashboardStats>('dashboard');
  } catch {
    // Fallback ke local
    await delay();
    requireAuth();
    const employees = db.getEmployees();
    const attendances = db.getAttendances();
    const announcements = db.getAnnouncements().filter((a) => a.isActive).slice(0, 5);
    const today = todayStr();
    const todayAtt = attendances.filter((a) => a.date === today);

    const months: DashboardStats['attendanceMonthly'] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthAtt = attendances.filter((a) => a.date.startsWith(key));
      months.push({
        month: d.toLocaleDateString('id-ID', { month: 'short' }),
        present: monthAtt.filter((a) => a.status === 'Present').length,
        late: monthAtt.filter((a) => a.status === 'Late').length,
        absent: monthAtt.filter((a) => a.status === 'Absent').length,
      });
    }

    const depts = db.getDepartments();
    const employeeByDepartment = depts.map((d) => ({
      name: d.name,
      count: employees.filter((e) => e.departmentId === d.id && e.employmentStatus !== 'Resigned').length,
    }));

    const statuses = ['Active', 'On Leave', 'Resigned', 'Probation'];
    const employeeByStatus = statuses.map((s) => ({
      status: s,
      count: employees.filter((e) => e.employmentStatus === s).length,
    }));

    const stats: DashboardStats = {
      totalEmployee: employees.filter((e) => e.employmentStatus !== 'Resigned').length,
      activeEmployee: employees.filter((e) => e.employmentStatus === 'Active').length,
      onLeave: employees.filter((e) => e.employmentStatus === 'On Leave').length,
      resigned: employees.filter((e) => e.employmentStatus === 'Resigned').length,
      attendanceToday: todayAtt.length,
      lateToday: todayAtt.filter((a) => a.status === 'Late').length,
      attendanceMonthly: months,
      employeeByDepartment,
      employeeByStatus,
      recentAttendance: [...attendances].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8),
      recentEmployees: [...employees].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5),
      birthdaysThisMonth: employees.filter((e) => isBirthdayThisMonth(e.birthDate) && e.employmentStatus !== 'Resigned'),
      announcements,
    };
    return ok(stats);
  }
}

// ========== EMPLOYEE ==========
export async function getEmployees(filters?: {
  search?: string;
  departmentId?: string;
  status?: string;
}): Promise<ApiResponse<Employee[]>> {
  try {
    return await callAPI<Employee[]>('getEmployees', {
      search: filters?.search || '',
      departmentId: filters?.departmentId || '',
      status: filters?.status || '',
    });
  } catch {
    // Fallback
    await delay();
    requireAuth();
    let list = db.getEmployees();
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(
        (e) =>
          e.fullName.toLowerCase().includes(q) ||
          e.employeeId.toLowerCase().includes(q) ||
          e.email.toLowerCase().includes(q) ||
          e.nik.includes(q) ||
          e.phone.includes(q)
      );
    }
    if (filters?.departmentId) list = list.filter((e) => e.departmentId === filters.departmentId);
    if (filters?.status) list = list.filter((e) => e.employmentStatus === filters.status);
    return ok(list);
  }
}

export async function getEmployee(id: string): Promise<ApiResponse<Employee>> {
  try {
    return await callAPI<Employee>('getEmployees', { id });
  } catch {
    await delay();
    requireAuth();
    const emp = db.getEmployeeById(id);
    if (!emp) return fail('Karyawan tidak ditemukan') as ApiResponse<Employee>;
    return ok(emp);
  }
}

export async function saveEmployee(data: Partial<Employee> & { fullName: string }): Promise<ApiResponse<Employee>> {
  try {
    return await callAPI<Employee>('saveEmployee', { ...data });
  } catch {
    await delay();
    const session = requireRole(['Administrator', 'HR']);
    const employees = db.getEmployees();
    const now = new Date().toISOString();

    if (data.id) {
      const idx = employees.findIndex((e) => e.id === data.id);
      if (idx < 0) return fail('Karyawan tidak ditemukan') as ApiResponse<Employee>;
      employees[idx] = { ...employees[idx], ...data, updatedAt: now } as Employee;
      db.setEmployees(employees);
      db.addLog({ userId: session.userId, userName: session.name, action: 'UPDATE', module: 'Employee', details: `Updated ${employees[idx].employeeId}` });
      return ok(employees[idx], 'Karyawan berhasil diperbarui');
    }

    const employeeId = data.employeeId || generateEmployeeId(employees.map((e) => e.employeeId));
    const emp: Employee = {
      id: generateId('emp'),
      employeeId,
      nik: data.nik || '',
      fullName: data.fullName,
      gender: data.gender || 'Male',
      birthDate: data.birthDate || '',
      religion: data.religion || '',
      address: data.address || '',
      phone: data.phone || '',
      email: data.email || '',
      departmentId: data.departmentId || '',
      divisionId: data.divisionId || '',
      positionId: data.positionId || '',
      joinDate: data.joinDate || todayStr(),
      employmentStatus: data.employmentStatus || 'Active',
      salary: data.salary || 0,
      photo: data.photo,
      managerId: data.managerId,
      createdAt: now,
      updatedAt: now,
    };
    employees.push(emp);
    db.setEmployees(employees);
    db.addLog({ userId: session.userId, userName: session.name, action: 'CREATE', module: 'Employee', details: `Created ${emp.employeeId}` });
    return ok(emp, 'Karyawan berhasil ditambahkan');
  }
}

export async function deleteEmployee(id: string): Promise<ApiResponse> {
  try {
    return await callAPI('deleteEmployee', { id });
  } catch {
    await delay();
    const session = requireRole(['Administrator', 'HR']);
    const employees = db.getEmployees().filter((e) => e.id !== id);
    db.setEmployees(employees);
    db.addLog({ userId: session.userId, userName: session.name, action: 'DELETE', module: 'Employee', details: `Deleted ${id}` });
    return ok(null, 'Karyawan berhasil dihapus');
  }
}

export async function importEmployees(rows: Partial<Employee>[]): Promise<ApiResponse<{ imported: number }>> {
  // Import selalu local karena bulk operation
  await delay(500);
  const session = requireRole(['Administrator', 'HR']);
  const employees = db.getEmployees();
  let imported = 0;
  for (const row of rows) {
    if (!row.fullName) continue;
    const employeeId = row.employeeId || generateEmployeeId(employees.map((e) => e.employeeId));
    const now = new Date().toISOString();
    employees.push({
      id: generateId('emp'),
      employeeId,
      nik: row.nik || '',
      fullName: row.fullName,
      gender: row.gender || 'Male',
      birthDate: row.birthDate || '',
      religion: row.religion || '',
      address: row.address || '',
      phone: row.phone || '',
      email: row.email || '',
      departmentId: row.departmentId || '',
      divisionId: row.divisionId || '',
      positionId: row.positionId || '',
      joinDate: row.joinDate || todayStr(),
      employmentStatus: row.employmentStatus || 'Active',
      salary: Number(row.salary) || 0,
      createdAt: now,
      updatedAt: now,
    });
    imported++;
  }
  db.setEmployees(employees);
  db.addLog({ userId: session.userId, userName: session.name, action: 'IMPORT', module: 'Employee', details: `Imported ${imported} employees` });
  return ok({ imported }, `${imported} karyawan berhasil diimpor`);
}

// ========== DEPARTMENT / DIVISION / POSITION ==========
export async function getDepartments(): Promise<ApiResponse<Department[]>> {
  try {
    return await callAPI<Department[]>('department');
  } catch {
    await delay();
    requireAuth();
    return ok(db.getDepartments());
  }
}

export async function saveDepartment(data: Partial<Department> & { name: string; code: string }): Promise<ApiResponse<Department>> {
  try {
    return await callAPI<Department>('saveDepartment', { ...data });
  } catch {
    await delay();
    const session = requireRole(['Administrator', 'HR']);
    const list = db.getDepartments();
    if (data.id) {
      const idx = list.findIndex((d) => d.id === data.id);
      if (idx < 0) return fail('Departemen tidak ditemukan') as ApiResponse<Department>;
      list[idx] = { ...list[idx], ...data } as Department;
      db.setDepartments(list);
      return ok(list[idx], 'Departemen diperbarui');
    }
    const dept: Department = {
      id: generateId('dept'),
      code: data.code,
      name: data.name,
      description: data.description,
      headId: data.headId,
      isActive: data.isActive ?? true,
      createdAt: todayStr(),
    };
    list.push(dept);
    db.setDepartments(list);
    db.addLog({ userId: session.userId, userName: session.name, action: 'CREATE', module: 'Department', details: dept.name });
    return ok(dept, 'Departemen ditambahkan');
  }
}

export async function deleteDepartment(id: string): Promise<ApiResponse> {
  try {
    return await callAPI('deleteDepartment', { id });
  } catch {
    await delay();
    requireRole(['Administrator', 'HR']);
    db.setDepartments(db.getDepartments().filter((d) => d.id !== id));
    return ok(null, 'Departemen dihapus');
  }
}

export async function getDivisions(): Promise<ApiResponse<Division[]>> {
  try {
    return await callAPI<Division[]>('division');
  } catch {
    await delay();
    requireAuth();
    return ok(db.getDivisions());
  }
}

export async function saveDivision(data: Partial<Division> & { name: string; code: string; departmentId: string }): Promise<ApiResponse<Division>> {
  try {
    return await callAPI<Division>('saveDivision', { ...data });
  } catch {
    await delay();
    requireRole(['Administrator', 'HR']);
    const list = db.getDivisions();
    if (data.id) {
      const idx = list.findIndex((d) => d.id === data.id);
      if (idx < 0) return fail('Divisi tidak ditemukan') as ApiResponse<Division>;
      list[idx] = { ...list[idx], ...data } as Division;
      db.setDivisions(list);
      return ok(list[idx], 'Divisi diperbarui');
    }
    const div: Division = {
      id: generateId('div'),
      code: data.code,
      name: data.name,
      departmentId: data.departmentId,
      description: data.description,
      isActive: data.isActive ?? true,
      createdAt: todayStr(),
    };
    list.push(div);
    db.setDivisions(list);
    return ok(div, 'Divisi ditambahkan');
  }
}

export async function deleteDivision(id: string): Promise<ApiResponse> {
  try {
    return await callAPI('deleteDivision', { id });
  } catch {
    await delay();
    requireRole(['Administrator', 'HR']);
    db.setDivisions(db.getDivisions().filter((d) => d.id !== id));
    return ok(null, 'Divisi dihapus');
  }
}

export async function getPositions(): Promise<ApiResponse<Position[]>> {
  try {
    return await callAPI<Position[]>('position');
  } catch {
    await delay();
    requireAuth();
    return ok(db.getPositions());
  }
}

export async function savePosition(data: Partial<Position> & { name: string; code: string; departmentId: string }): Promise<ApiResponse<Position>> {
  try {
    return await callAPI<Position>('savePosition', { ...data });
  } catch {
    await delay();
    requireRole(['Administrator', 'HR']);
    const list = db.getPositions();
    if (data.id) {
      const idx = list.findIndex((p) => p.id === data.id);
      if (idx < 0) return fail('Jabatan tidak ditemukan') as ApiResponse<Position>;
      list[idx] = { ...list[idx], ...data } as Position;
      db.setPositions(list);
      return ok(list[idx], 'Jabatan diperbarui');
    }
    const pos: Position = {
      id: generateId('pos'),
      code: data.code,
      name: data.name,
      departmentId: data.departmentId,
      level: data.level ?? 1,
      description: data.description,
      isActive: data.isActive ?? true,
      createdAt: todayStr(),
    };
    list.push(pos);
    db.setPositions(list);
    return ok(pos, 'Jabatan ditambahkan');
  }
}

export async function deletePosition(id: string): Promise<ApiResponse> {
  try {
    return await callAPI('deletePosition', { id });
  } catch {
    await delay();
    requireRole(['Administrator', 'HR']);
    db.setPositions(db.getPositions().filter((p) => p.id !== id));
    return ok(null, 'Jabatan dihapus');
  }
}

// ========== ATTENDANCE ==========
export async function getAttendances(filters?: {
  employeeId?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<ApiResponse<Attendance[]>> {
  try {
    return await callAPI<Attendance[]>('getAttendances', {
      employeeId: filters?.employeeId || '',
      dateFrom: filters?.dateFrom || '',
      dateTo: filters?.dateTo || '',
    });
  } catch {
    await delay();
    requireAuth();
    let list = db.getAttendances();
    if (filters?.employeeId) list = list.filter((a) => a.employeeId === filters.employeeId);
    if (filters?.dateFrom) list = list.filter((a) => a.date >= filters.dateFrom!);
    if (filters?.dateTo) list = list.filter((a) => a.date <= filters.dateTo!);
    list = [...list].sort((a, b) => b.date.localeCompare(a.date) || (b.checkIn || '').localeCompare(a.checkIn || ''));
    return ok(list);
  }
}

export async function checkIn(payload: {
  lat?: number;
  lng?: number;
  photo?: string;
  faceDescriptor?: number[];
  faceVerified?: boolean;
}): Promise<ApiResponse<Attendance>> {
  try {
    return await callAPI<Attendance>('checkin', {
      lat: payload.lat || 0,
      lng: payload.lng || 0,
      photo: payload.photo || '',
      faceDescriptor: payload.faceDescriptor || [],
      faceVerified: payload.faceVerified || false,
    });
  } catch {
    await delay(400);
    const session = requireAuth();
    if (!session.employeeId) return fail('Akun tidak terhubung ke data karyawan') as ApiResponse<Attendance>;

    const today = todayStr();
    const list = db.getAttendances();
    const existing = list.find((a) => a.employeeId === session.employeeId && a.date === today);
    if (existing?.checkIn) return fail('Anda sudah check-in hari ini') as ApiResponse<Attendance>;

    const settings = db.getSettings();
    const now = new Date();
    const checkInTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    const [startH, startM] = settings.workStartTime.split(':').map(Number);
    const workStartMinutes = startH * 60 + startM + settings.lateToleranceMinutes;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const lateMinutes = Math.max(0, currentMinutes - workStartMinutes);
    const status = lateMinutes > 0 ? 'Late' : 'Present';

    // 1. CEK APAKAH WAJAH SUDAH TERDAFTAR
    const employee = db.getEmployeeById(session.employeeId);
    if (!employee?.faceRegistered || !employee?.faceDescriptor) {
      return fail(
        'Wajah Anda belum terdaftar. Silakan daftarkan wajah terlebih dahulu di menu Face ID sebelum melakukan absensi.'
      ) as ApiResponse<Attendance>;
    }

    // 2. VERIFIKASI WAJAH DENGAN DATABASE
    //    Jika faceVerified=true dari frontend, terima saja.
    //    Jika photo tersedia, lakukan similarity check dengan threshold lebih rendah (0.40).
    const faceVerifiedByClient = payload.faceVerified === true;
    
    if (payload.photo && !faceVerifiedByClient) {
      const faceRes = await verifyAttendanceFace(payload.photo);
      if (!faceRes.success || !faceRes.data?.match) {
        return fail(
          faceRes.message || 'Verifikasi wajah gagal. Wajah tidak cocok dengan data terdaftar.'
        ) as ApiResponse<Attendance>;
      }
    }

    // 3. GEOFENCING VALIDATION - HARUS DALAM RADIUS KANTOR
    if (payload.lat != null && payload.lng != null) {
      const dist = haversineDistance(payload.lat, payload.lng, settings.officeLat, settings.officeLng);
      if (dist > settings.officeRadiusMeters) {
        return fail(
          `Anda berada ${Math.round(dist)}m dari kantor. Absensi hanya dalam radius ${settings.officeRadiusMeters}m dari kantor (${settings.officeLat}, ${settings.officeLng}).`
        ) as ApiResponse<Attendance>;
      }
    }

    const att: Attendance = {
      id: generateId('att'),
      employeeId: session.employeeId,
      date: today,
      checkIn: checkInTime,
      checkInLat: payload.lat,
      checkInLng: payload.lng,
      checkInPhoto: payload.photo,
      status,
      lateMinutes: lateMinutes > 0 ? lateMinutes : 0,
      createdAt: now.toISOString(),
    };
    list.push(att);
    db.setAttendances(list);
    db.addLog({ userId: session.userId, userName: session.name, action: 'CHECK_IN', module: 'Attendance', details: `${status}${lateMinutes ? ` (${lateMinutes}m late)` : ''}` });
    return ok(att, status === 'Late' ? `Check-in berhasil (Terlambat ${lateMinutes} menit)` : 'Check-in berhasil');
  }
}

export async function checkOut(payload: {
  lat?: number;
  lng?: number;
  photo?: string;
  faceDescriptor?: number[];
  faceVerified?: boolean;
}): Promise<ApiResponse<Attendance>> {
  try {
    return await callAPI<Attendance>('checkout', {
      lat: payload.lat || 0,
      lng: payload.lng || 0,
      photo: payload.photo || '',
      faceDescriptor: payload.faceDescriptor || [],
      faceVerified: payload.faceVerified || false,
    });
  } catch {
    await delay(400);
    const session = requireAuth();
    if (!session.employeeId) return fail('Akun tidak terhubung ke data karyawan') as ApiResponse<Attendance>;

    const today = todayStr();
    const list = db.getAttendances();
    const idx = list.findIndex((a) => a.employeeId === session.employeeId && a.date === today);
    if (idx < 0 || !list[idx].checkIn) return fail('Anda belum check-in hari ini') as ApiResponse<Attendance>;
    if (list[idx].checkOut) return fail('Anda sudah check-out hari ini') as ApiResponse<Attendance>;

    // 1. CEK APAKAH WAJAH SUDAH TERDAFTAR
    const employee = db.getEmployeeById(session.employeeId);
    if (!employee?.faceRegistered || !employee?.faceDescriptor) {
      return fail(
        'Wajah Anda belum terdaftar. Silakan daftarkan wajah terlebih dahulu di menu Face ID.'
      ) as ApiResponse<Attendance>;
    }

    // 2. VERIFIKASI WAJAH DENGAN DATABASE
    //    Jika faceVerified=true dari frontend, skip similarity check.
    const faceVerifiedByClient2 = payload.faceVerified === true;
    
    if (payload.photo && !faceVerifiedByClient2) {
      const faceRes = await verifyAttendanceFace(payload.photo);
      if (!faceRes.success || !faceRes.data?.match) {
        return fail(
          faceRes.message || 'Verifikasi wajah gagal. Wajah tidak cocok dengan data terdaftar.'
        ) as ApiResponse<Attendance>;
      }
    }

    // 3. GEOFENCING VALIDATION untuk Check Out
    if (payload.lat != null && payload.lng != null) {
      const settings = db.getSettings();
      const dist = haversineDistance(payload.lat, payload.lng, settings.officeLat, settings.officeLng);
      if (dist > settings.officeRadiusMeters) {
        return fail(
          `Anda berada ${Math.round(dist)}m dari kantor. Check-out hanya dalam radius ${settings.officeRadiusMeters}m.`
        ) as ApiResponse<Attendance>;
      }
    }

    const now = new Date();
    const checkOutTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const [inH, inM] = list[idx].checkIn!.split(':').map(Number);
    const workHours = +((now.getHours() + now.getMinutes() / 60) - (inH + inM / 60)).toFixed(2);

    list[idx] = {
      ...list[idx],
      checkOut: checkOutTime,
      checkOutLat: payload.lat,
      checkOutLng: payload.lng,
      checkOutPhoto: payload.photo,
      workHours,
    };
    db.setAttendances(list);
    db.addLog({ userId: session.userId, userName: session.name, action: 'CHECK_OUT', module: 'Attendance', details: `Work hours: ${workHours}h` });
    return ok(list[idx], 'Check-out berhasil');
  }
}

// ========== LEAVE ==========
export async function getLeaves(filters?: { employeeId?: string; status?: string }): Promise<ApiResponse<Leave[]>> {
  try {
    return await callAPI<Leave[]>('getLeaves', {
      employeeId: filters?.employeeId || '',
      status: filters?.status || '',
    });
  } catch {
    await delay();
    requireAuth();
    let list = db.getLeaves();
    if (filters?.employeeId) list = list.filter((l) => l.employeeId === filters.employeeId);
    if (filters?.status) list = list.filter((l) => l.status === filters.status);
    return ok([...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }
}

export async function saveLeave(data: {
  leaveType: Leave['leaveType'];
  startDate: string;
  endDate: string;
  reason: string;
}): Promise<ApiResponse<Leave>> {
  try {
    return await callAPI<Leave>('saveLeave', { ...data });
  } catch {
    await delay();
    const session = requireAuth();
    if (!session.employeeId) return fail('Akun tidak terhubung ke data karyawan') as ApiResponse<Leave>;
    const days = calcLeaveDays(data.startDate, data.endDate);
    const leave: Leave = {
      id: generateId('leave'),
      employeeId: session.employeeId,
      leaveType: data.leaveType,
      startDate: data.startDate,
      endDate: data.endDate,
      days,
      reason: data.reason,
      status: 'Pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const list = db.getLeaves();
    list.push(leave);
    db.setLeaves(list);
    db.addLog({ userId: session.userId, userName: session.name, action: 'CREATE', module: 'Leave', details: `${data.leaveType} ${days} days` });
    return ok(leave, 'Pengajuan cuti berhasil dikirim');
  }
}

export async function approveLeave(
  id: string,
  action: 'approve_manager' | 'approve_hr' | 'reject',
  note?: string
): Promise<ApiResponse<Leave>> {
  try {
    return await callAPI<Leave>('approval', { id, action, note: note || '' });
  } catch {
    await delay();
    const session = requireRole(['Administrator', 'HR', 'Manager']);
    const list = db.getLeaves();
    const idx = list.findIndex((l) => l.id === id);
    if (idx < 0) return fail('Data cuti tidak ditemukan') as ApiResponse<Leave>;

    if (action === 'reject') {
      list[idx].status = 'Rejected';
      if (session.role === 'HR' || session.role === 'Administrator') list[idx].hrNote = note;
      else list[idx].managerNote = note;
    } else if (action === 'approve_manager') {
      list[idx].status = 'Approved Manager';
      list[idx].approvedByManager = session.employeeId || session.userId;
      list[idx].managerNote = note;
    } else {
      list[idx].status = 'Approved HR';
      list[idx].approvedByHR = session.employeeId || session.userId;
      list[idx].hrNote = note;
    }
    list[idx].updatedAt = new Date().toISOString();
    db.setLeaves(list);
    db.addLog({ userId: session.userId, userName: session.name, action: action.toUpperCase(), module: 'Leave', details: id });
    return ok(list[idx], 'Status cuti diperbarui');
  }
}

export async function getLeaveBalance(employeeId?: string): Promise<ApiResponse<LeaveBalance>> {
  try {
    return await callAPI<LeaveBalance>('leave', { 
      action: 'getLeaveBalance',
      employeeId: employeeId || '' 
    });
  } catch {
    await delay();
    const session = requireAuth();
    const empId = employeeId || session.employeeId;
    if (!empId) return fail('Employee ID tidak ditemukan') as ApiResponse<LeaveBalance>;
    const settings = db.getSettings();
    const leaves = db.getLeaves().filter((l) => l.employeeId === empId && l.status === 'Approved HR');
    const used = leaves.filter((l) => l.leaveType === 'Annual').reduce((s, l) => s + l.days, 0);
    const sick = leaves.filter((l) => l.leaveType === 'Sick').reduce((s, l) => s + l.days, 0);
    const other = leaves.filter((l) => !['Annual', 'Sick'].includes(l.leaveType)).reduce((s, l) => s + l.days, 0);
    return ok({
      annual: settings.annualLeaveQuota,
      used,
      remaining: Math.max(0, settings.annualLeaveQuota - used),
      sick,
      other,
    });
  }
}

// ========== PERMISSION ==========
export async function getPermissions(filters?: { employeeId?: string }): Promise<ApiResponse<Permission[]>> {
  try {
    return await callAPI<Permission[]>('permission', {
      employeeId: filters?.employeeId || '',
    });
  } catch {
    await delay();
    requireAuth();
    let list = db.getPermissions();
    if (filters?.employeeId) list = list.filter((p) => p.employeeId === filters.employeeId);
    return ok([...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }
}

export async function savePermission(data: {
  type: Permission['type'];
  date: string;
  startTime?: string;
  endTime?: string;
  reason: string;
}): Promise<ApiResponse<Permission>> {
  try {
    return await callAPI<Permission>('savePermission', { ...data });
  } catch {
    await delay();
    const session = requireAuth();
    if (!session.employeeId) return fail('Akun tidak terhubung ke data karyawan') as ApiResponse<Permission>;
    const perm: Permission = {
      id: generateId('perm'),
      employeeId: session.employeeId,
      type: data.type,
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      reason: data.reason,
      status: 'Pending',
      createdAt: new Date().toISOString(),
    };
    const list = db.getPermissions();
    list.push(perm);
    db.setPermissions(list);
    return ok(perm, 'Pengajuan izin berhasil dikirim');
  }
}

export async function approvePermission(id: string, action: 'approve' | 'reject', note?: string): Promise<ApiResponse<Permission>> {
  try {
    return await callAPI<Permission>('approvePermission', { id, action, note: note || '' });
  } catch {
    await delay();
    const session = requireRole(['Administrator', 'HR', 'Manager']);
    const list = db.getPermissions();
    const idx = list.findIndex((p) => p.id === id);
    if (idx < 0) return fail('Data izin tidak ditemukan') as ApiResponse<Permission>;
    list[idx].status = action === 'approve' ? 'Approved' : 'Rejected';
    list[idx].approvedBy = session.employeeId || session.userId;
    list[idx].note = note;
    db.setPermissions(list);
    return ok(list[idx], 'Status izin diperbarui');
  }
}

// ========== PAYROLL ==========
export async function getPayrolls(filters?: { period?: string; employeeId?: string }): Promise<ApiResponse<Payroll[]>> {
  try {
    return await callAPI<Payroll[]>('payroll', {
      period: filters?.period || '',
      employeeId: filters?.employeeId || '',
    });
  } catch {
    await delay();
    requireAuth();
    let list = db.getPayrolls();
    if (filters?.period) list = list.filter((p) => p.period === filters.period);
    if (filters?.employeeId) list = list.filter((p) => p.employeeId === filters.employeeId);
    return ok([...list].sort((a, b) => b.period.localeCompare(a.period)));
  }
}

export async function generatePayroll(period: string): Promise<ApiResponse<Payroll[]>> {
  try {
    return await callAPI<Payroll[]>('generatePayroll', { period });
  } catch {
    await delay(600);
    const session = requireRole(['Administrator', 'HR']);
    const employees = db.getEmployees().filter((e) => e.employmentStatus !== 'Resigned');
    const list = db.getPayrolls().filter((p) => p.period !== period);
    const generated: Payroll[] = [];

    for (const e of employees) {
      const allowance = Math.round(e.salary * 0.1);
      const overtime = 0;
      const deduction = 0;
      const bpjs = Math.round(e.salary * 0.04);
      const pph21 = Math.round(e.salary * 0.05);
      const netSalary = e.salary + allowance + overtime - deduction - bpjs - pph21;
      const pay: Payroll = {
        id: generateId('pay'),
        employeeId: e.id,
        period,
        basicSalary: e.salary,
        allowance,
        overtime,
        deduction,
        bpjs,
        pph21,
        netSalary,
        status: 'Generated',
        generatedAt: new Date().toISOString(),
      };
      generated.push(pay);
      list.push(pay);
    }
    db.setPayrolls(list);
    db.addLog({ userId: session.userId, userName: session.name, action: 'GENERATE', module: 'Payroll', details: `Period ${period}: ${generated.length} slips` });
    return ok(generated, `Payroll ${period} berhasil digenerate (${generated.length} slip)`);
  }
}

export async function updatePayroll(id: string, data: Partial<Payroll>): Promise<ApiResponse<Payroll>> {
  // Payroll update - fallback only, no GAS update endpoint
  await delay();
  requireRole(['Administrator', 'HR']);
  const list = db.getPayrolls();
  const idx = list.findIndex((p) => p.id === id);
  if (idx < 0) return fail('Payroll tidak ditemukan') as ApiResponse<Payroll>;
  const updated = { ...list[idx], ...data };
  updated.netSalary =
    updated.basicSalary + updated.allowance + updated.overtime - updated.deduction - updated.bpjs - updated.pph21;
  list[idx] = updated;
  db.setPayrolls(list);
  return ok(list[idx], 'Payroll diperbarui');
}

// ========== ANNOUNCEMENT ==========
export async function getAnnouncements(): Promise<ApiResponse<Announcement[]>> {
  try {
    return await callAPI<Announcement[]>('announcement');
  } catch {
    await delay();
    requireAuth();
    return ok([...db.getAnnouncements()].sort((a, b) => b.publishDate.localeCompare(a.publishDate)));
  }
}

export async function saveAnnouncement(data: Partial<Announcement> & { title: string; content: string }): Promise<ApiResponse<Announcement>> {
  try {
    return await callAPI<Announcement>('saveAnnouncement', { ...data });
  } catch {
    await delay();
    const session = requireRole(['Administrator', 'HR']);
    const list = db.getAnnouncements();
    if (data.id) {
      const idx = list.findIndex((a) => a.id === data.id);
      if (idx < 0) return fail('Pengumuman tidak ditemukan') as ApiResponse<Announcement>;
      list[idx] = { ...list[idx], ...data } as Announcement;
      db.setAnnouncements(list);
      return ok(list[idx], 'Pengumuman diperbarui');
    }
    const ann: Announcement = {
      id: generateId('ann'),
      title: data.title,
      content: data.content,
      priority: data.priority || 'Normal',
      targetRole: data.targetRole || 'All',
      isActive: data.isActive ?? true,
      publishDate: data.publishDate || todayStr(),
      expiryDate: data.expiryDate,
      createdBy: session.userId,
      createdAt: new Date().toISOString(),
    };
    list.unshift(ann);
    db.setAnnouncements(list);
    return ok(ann, 'Pengumuman ditambahkan');
  }
}

export async function deleteAnnouncement(id: string): Promise<ApiResponse> {
  try {
    return await callAPI('deleteAnnouncement', { id });
  } catch {
    await delay();
    requireRole(['Administrator', 'HR']);
    db.setAnnouncements(db.getAnnouncements().filter((a) => a.id !== id));
    return ok(null, 'Pengumuman dihapus');
  }
}

// ========== SETTINGS ==========
export async function getSettings(): Promise<ApiResponse<CompanySetting>> {
  try {
    return await callAPI<CompanySetting>('getSettings');
  } catch {
    await delay();
    requireAuth();
    return ok(db.getSettings());
  }
}

export async function saveSettings(data: Partial<CompanySetting>): Promise<ApiResponse<CompanySetting>> {
  try {
    return await callAPI<CompanySetting>('saveSetting', { ...data });
  } catch {
    await delay();
    const session = requireRole(['Administrator']);
    const current = db.getSettings();
    const updated = { ...current, ...data };
    db.setSettings(updated);
    db.addLog({ userId: session.userId, userName: session.name, action: 'UPDATE', module: 'Setting' });
    return ok(updated, 'Pengaturan disimpan');
  }
}

// ========== PROFILE ==========
export async function updateProfile(data: { name?: string; avatar?: string; password?: string; currentPassword?: string }): Promise<ApiResponse> {
  // Profile update - mix of GAS and local
  await delay();
  const session = requireAuth();
  const users = db.getUsers();
  const idx = users.findIndex((u) => u.id === session.userId);
  if (idx < 0) return fail('User tidak ditemukan');

  if (data.password) {
    if (users[idx].password !== data.currentPassword) return fail('Password saat ini salah');
    users[idx].password = data.password;
  }
  if (data.name) {
    users[idx].name = data.name;
    session.name = data.name;
  }
  if (data.avatar !== undefined) {
    users[idx].avatar = data.avatar;
    session.avatar = data.avatar;
  }
  db.setUsers(users);
  saveSession(session);

  if (session.employeeId && data.avatar) {
    const emps = db.getEmployees();
    const eidx = emps.findIndex((e) => e.id === session.employeeId);
    if (eidx >= 0) {
      emps[eidx].photo = data.avatar;
      db.setEmployees(emps);
    }
  }
  return ok(null, 'Profil berhasil diperbarui');
}

// ========== LOOKUPS ==========
export async function getLookups() {
  await delay(100);
  requireAuth();
  return ok({
    departments: db.getDepartments(),
    divisions: db.getDivisions(),
    positions: db.getPositions(),
    employees: db.getEmployees().map((e) => ({ id: e.id, employeeId: e.employeeId, fullName: e.fullName, departmentId: e.departmentId })),
  });
}

// ========== BACKUP ==========
export async function backupDatabase(): Promise<ApiResponse<ReturnType<typeof db.exportAll>>> {
  await delay();
  requireRole(['Administrator']);
  return ok(db.exportAll(), 'Backup berhasil');
}

export async function restoreDatabase(data: ReturnType<typeof db.exportAll>): Promise<ApiResponse> {
  await delay(500);
  requireRole(['Administrator']);
  db.importAll(data);
  return ok(null, 'Restore berhasil');
}

export async function getActivityLogs(): Promise<ApiResponse> {
  await delay();
  requireRole(['Administrator', 'HR']);
  return ok(db.getLogs());
}

// ========== USER MANAGEMENT (ACCESS CONTROL) ==========
export async function getUsers(): Promise<ApiResponse<User[]>> {
  try {
    return await callAPI<User[]>('getUsers');
  } catch {
    await delay();
    requireAuth();
    return ok(db.getUsers());
  }
}

export async function saveUser(data: {
  id?: string;
  email: string;
  password?: string;
  role: Role;
  name: string;
  employeeId?: string;
  isActive: boolean;
}): Promise<ApiResponse<User>> {
  try {
    return await callAPI<User>('saveUser', { ...data });
  } catch {
    await delay();
    const session = requireRole(['Administrator']);
    const users = db.getUsers();
    const now = new Date().toISOString();

    if (data.id) {
      const idx = users.findIndex((u) => u.id === data.id);
      if (idx < 0) return fail('User tidak ditemukan') as ApiResponse<User>;
      
      const updated: User = {
        ...users[idx],
        email: data.email,
        role: data.role,
        name: data.name,
        employeeId: data.employeeId || users[idx].employeeId,
        isActive: data.isActive,
      };
      if (data.password && data.password.length >= 4) {
        updated.password = data.password;
      }
      users[idx] = updated;
      db.setUsers(users);
      db.addLog({ userId: session.userId, userName: session.name, action: 'UPDATE', module: 'User', details: `Updated user ${updated.email}` });
      return ok(updated, 'User berhasil diperbarui');
    }

    // Cek duplicate email
    if (users.find((u) => u.email.toLowerCase() === data.email.toLowerCase())) {
      return fail('Email sudah terdaftar') as ApiResponse<User>;
    }

    const user: User = {
      id: generateId('usr'),
      email: data.email,
      password: data.password || '123456',
      role: data.role,
      name: data.name,
      employeeId: data.employeeId || '',
      avatar: '',
      isActive: data.isActive,
      createdAt: now,
    };
    users.push(user);
    db.setUsers(users);
    db.addLog({ userId: session.userId, userName: session.name, action: 'CREATE', module: 'User', details: `Created user ${user.email}` });
    return ok(user, 'User berhasil ditambahkan');
  }
}

export async function deleteUser(id: string): Promise<ApiResponse> {
  try {
    return await callAPI('deleteUser', { id });
  } catch {
    await delay();
    const session = requireRole(['Administrator']);
    const users = db.getUsers();
    const target = users.find((u) => u.id === id);
    if (!target) return fail('User tidak ditemukan');
    
    // Prevent deleting self
    if (id === session.userId) {
      return fail('Tidak dapat menghapus akun sendiri');
    }
    
    db.setUsers(users.filter((u) => u.id !== id));
    db.addLog({ userId: session.userId, userName: session.name, action: 'DELETE', module: 'User', details: `Deleted user ${target.email}` });
    return ok(null, 'User berhasil dihapus');
  }
}

export async function resetUserPassword(id: string, newPassword: string): Promise<ApiResponse> {
  try {
    return await callAPI('resetUserPassword', { id, password: newPassword });
  } catch {
    await delay();
    const session = requireRole(['Administrator']);
    const users = db.getUsers();
    const idx = users.findIndex((u) => u.id === id);
    if (idx < 0) return fail('User tidak ditemukan');
    users[idx].password = newPassword;
    db.setUsers(users);
    db.addLog({ userId: session.userId, userName: session.name, action: 'RESET_PASSWORD', module: 'User', details: `Reset password for ${users[idx].email}` });
    return ok(null, 'Password berhasil direset');
  }
}

// ========== HEALTH CHECK ==========
export async function checkGASHealth(): Promise<ApiResponse> {
  try {
    return await callAPI('health');
  } catch {
    return fail('GAS backend tidak tersedia');
  }
}

// ========== FACE ENROLLMENT & VERIFICATION ==========

/**
 * Helper: Validasi apakah faceDescriptor benar-benar valid (bukan cuma faceRegistered=true)
 * Mencegah inconsistent state: faceRegistered=true tapi descriptor kosong/rusak
 */
function isFaceEnrolled(employee: { faceDescriptor?: string; faceRegistered?: boolean } | null | undefined): boolean {
  if (!employee) return false;
  const desc = String(employee.faceDescriptor || '').trim();
  return desc.length > 2 && desc !== '[]';
}

export async function enrollFace(faceDescriptor: number[]): Promise<ApiResponse> {
  if (!faceDescriptor || faceDescriptor.length === 0) {
    return fail('Data wajah tidak valid. Silakan ambil foto ulang.') as ApiResponse;
  }

  try {
    // Kirim descriptor sebagai array number, bukan string
    return await callAPI('enrollFace', { faceDescriptor });
  } catch {
    // Fallback ke localStorage
    await delay();
    const session = requireAuth();
    if (!session.employeeId) return fail('Akun tidak terhubung ke data karyawan') as ApiResponse;

    const employees = db.getEmployees();
    const idx = employees.findIndex((e) => e.id === session.employeeId);
    if (idx < 0) return fail('Karyawan tidak ditemukan') as ApiResponse;

    const descriptorJSON = JSON.stringify(faceDescriptor);
    employees[idx].faceDescriptor = descriptorJSON;
    employees[idx].faceRegistered = true;
    db.setEmployees(employees);
    db.addLog({ 
      userId: session.userId, userName: session.name, 
      action: 'ENROLL_FACE', module: 'Face Recognition', 
      details: `Face enrolled for ${employees[idx].fullName} (descriptor: ${descriptorJSON.substring(0, 30)}...)`
    });
    
    return ok({ descriptorLength: faceDescriptor.length }, 'Wajah berhasil didaftarkan');
  }
}

export async function verifyAttendanceFace(photo: string): Promise<ApiResponse<{ match: boolean; similarity: number }>> {
  await delay();
  const session = requireAuth();
  if (!session.employeeId) return fail('Akun tidak terhubung ke data karyawan') as unknown as ApiResponse<{ match: boolean; similarity: number }>;

  const employee = db.getEmployeeById(session.employeeId);
  
  // Validasi descriptor - konsisten dengan GAS UserService.gs
  if (!isFaceEnrolled(employee)) {
    return fail('Wajah belum terdaftar. Silakan daftarkan wajah Anda terlebih dahulu di menu Face ID.') as ApiResponse<{ match: boolean; similarity: number }>;
  }

  // Decode enrolled descriptor dengan try-catch
  let enrolledDescriptor: number[];
  try {
    enrolledDescriptor = JSON.parse(employee!.faceDescriptor!) as number[];
  } catch {
    return fail('Data wajah rusak. Silakan daftarkan ulang wajah Anda di menu Face ID.') as ApiResponse<{ match: boolean; similarity: number }>;
  }

  if (!enrolledDescriptor || enrolledDescriptor.length === 0) {
    return fail('Data wajah tidak valid. Silakan daftarkan ulang.') as ApiResponse<{ match: boolean; similarity: number }>;
  }
  
  // Verify face from photo
  const { verifyFaceFromBase64 } = await import('./faceRecognition');
  const result = await verifyFaceFromBase64(photo, enrolledDescriptor);
  
  const faceResult: { match: boolean; similarity: number } = {
    match: result.matched,
    similarity: result.similarity,
  };
  return ok(faceResult, result.message);
}

export async function getFaceEnrollmentStatus(): Promise<ApiResponse<{ enrolled: boolean; employeeName?: string }>> {
  try {
    return await callAPI<{ enrolled: boolean; employeeName?: string }>('getFaceEnrollmentStatus');
  } catch {
    // Fallback ke localStorage
    await delay();
    const session = requireAuth();
    if (!session.employeeId) return fail('Akun tidak terhubung ke data karyawan') as ApiResponse<{ enrolled: boolean; employeeName?: string }>;

    const employee = db.getEmployeeById(session.employeeId);
    if (!employee) return fail('Karyawan tidak ditemukan') as ApiResponse<{ enrolled: boolean; employeeName?: string }>;

    // KRITIS: validasi descriptor, bukan cuma faceRegistered flag
    // Konsisten dengan GAS UserService.gs getFaceStatus()
    const enrolled = isFaceEnrolled(employee);

    // Auto-healing: jika faceRegistered=true tapi descriptor kosong, reset flag
    if (!enrolled && employee.faceRegistered) {
      console.warn(`Auto-healing: ${employee.fullName} had faceRegistered=true but empty descriptor - resetting`);
      const employees = db.getEmployees();
      const idx = employees.findIndex((e) => e.id === employee.id);
      if (idx >= 0) {
        employees[idx].faceRegistered = false;
        employees[idx].faceDescriptor = '';
        db.setEmployees(employees);
      }
    }

    return ok({
      enrolled,
      employeeName: employee.fullName,
    });
  }
}

// ========== UPLOAD ==========
export async function uploadPhoto(base64: string, filename: string, mimeType: string): Promise<ApiResponse<{ url: string }>> {
  try {
    return await callAPI<{ url: string }>('uploadPhoto', { base64, filename, mimeType });
  } catch {
    return fail('Upload foto tidak tersedia di mode lokal');
  }
}

export async function uploadPayslip(base64: string, filename: string, employeeId: string, period: string): Promise<ApiResponse<{ url: string }>> {
  try {
    return await callAPI<{ url: string }>('uploadPayslip', { base64, filename, employeeId, period });
  } catch {
    return fail('Upload slip gaji tidak tersedia di mode lokal');
  }
}
