import { getItem, setItem } from './storage';
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
import * as mock from '../data/mockData';

const KEYS = {
  users: 'users',
  employees: 'employees',
  departments: 'departments',
  divisions: 'divisions',
  positions: 'positions',
  attendances: 'attendances',
  leaves: 'leaves',
  permissions: 'permissions',
  payrolls: 'payrolls',
  announcements: 'announcements',
  settings: 'settings',
  logs: 'logs',
  initialized: 'db_initialized',
} as const;

function ensureInit() {
  if (getItem(KEYS.initialized, false)) return;
  setItem(KEYS.users, mock.users);
  setItem(KEYS.employees, mock.employees);
  setItem(KEYS.departments, mock.departments);
  setItem(KEYS.divisions, mock.divisions);
  setItem(KEYS.positions, mock.positions);
  setItem(KEYS.attendances, mock.attendances);
  setItem(KEYS.leaves, mock.leaves);
  setItem(KEYS.permissions, mock.permissions);
  setItem(KEYS.payrolls, mock.payrolls);
  setItem(KEYS.announcements, mock.announcements);
  setItem(KEYS.settings, mock.settings);
  setItem(KEYS.logs, mock.activityLogs);
  setItem(KEYS.initialized, true);
}

ensureInit();

export function getUsers(): User[] {
  return getItem(KEYS.users, mock.users);
}
export function setUsers(data: User[]) {
  setItem(KEYS.users, data);
}
export function getUserByEmail(email: string): User | undefined {
  return getUsers().find((u) => u.email.toLowerCase() === email.toLowerCase());
}
export function getUserById(id: string): User | undefined {
  return getUsers().find((u) => u.id === id);
}

export function getEmployees(): Employee[] {
  return getItem(KEYS.employees, mock.employees);
}
export function setEmployees(data: Employee[]) {
  setItem(KEYS.employees, data);
}
export function getEmployeeById(id: string): Employee | undefined {
  return getEmployees().find((e) => e.id === id);
}
export function getEmployeeByEmployeeId(employeeId: string): Employee | undefined {
  return getEmployees().find((e) => e.employeeId === employeeId);
}
export function getEmployeeByEmail(email: string): Employee | undefined {
  return getEmployees().find((e) => e.email.toLowerCase() === email.toLowerCase());
}

export function getDepartments(): Department[] {
  return getItem(KEYS.departments, mock.departments);
}
export function setDepartments(data: Department[]) {
  setItem(KEYS.departments, data);
}
export function getDepartmentById(id: string): Department | undefined {
  return getDepartments().find((d) => d.id === id);
}

export function getDivisions(): Division[] {
  return getItem(KEYS.divisions, mock.divisions);
}
export function setDivisions(data: Division[]) {
  setItem(KEYS.divisions, data);
}
export function getDivisionById(id: string): Division | undefined {
  return getDivisions().find((d) => d.id === id);
}

export function getPositions(): Position[] {
  return getItem(KEYS.positions, mock.positions);
}
export function setPositions(data: Position[]) {
  setItem(KEYS.positions, data);
}
export function getPositionById(id: string): Position | undefined {
  return getPositions().find((p) => p.id === id);
}

export function getAttendances(): Attendance[] {
  return getItem(KEYS.attendances, mock.attendances);
}
export function setAttendances(data: Attendance[]) {
  setItem(KEYS.attendances, data);
}

export function getLeaves(): Leave[] {
  return getItem(KEYS.leaves, mock.leaves);
}
export function setLeaves(data: Leave[]) {
  setItem(KEYS.leaves, data);
}

export function getPermissions(): Permission[] {
  return getItem(KEYS.permissions, mock.permissions);
}
export function setPermissions(data: Permission[]) {
  setItem(KEYS.permissions, data);
}

export function getPayrolls(): Payroll[] {
  return getItem(KEYS.payrolls, mock.payrolls);
}
export function setPayrolls(data: Payroll[]) {
  setItem(KEYS.payrolls, data);
}

export function getAnnouncements(): Announcement[] {
  return getItem(KEYS.announcements, mock.announcements);
}
export function setAnnouncements(data: Announcement[]) {
  setItem(KEYS.announcements, data);
}

export function getSettings(): CompanySetting {
  return getItem(KEYS.settings, mock.settings);
}
export function setSettings(data: CompanySetting) {
  setItem(KEYS.settings, data);
}

export function getLogs(): ActivityLog[] {
  return getItem(KEYS.logs, mock.activityLogs);
}
export function setLogs(data: ActivityLog[]) {
  setItem(KEYS.logs, data);
}
export function addLog(log: Omit<ActivityLog, 'id' | 'createdAt'>) {
  const logs = getLogs();
  logs.unshift({
    ...log,
    id: `log-${Date.now()}`,
    createdAt: new Date().toISOString(),
  });
  setLogs(logs.slice(0, 500));
}

export function exportAll() {
  return {
    users: getUsers(),
    employees: getEmployees(),
    departments: getDepartments(),
    divisions: getDivisions(),
    positions: getPositions(),
    attendances: getAttendances(),
    leaves: getLeaves(),
    permissions: getPermissions(),
    payrolls: getPayrolls(),
    announcements: getAnnouncements(),
    settings: getSettings(),
    logs: getLogs(),
    exportedAt: new Date().toISOString(),
  };
}

export function importAll(data: Partial<ReturnType<typeof exportAll>>) {
  if (data.users) setUsers(data.users);
  if (data.employees) setEmployees(data.employees);
  if (data.departments) setDepartments(data.departments);
  if (data.divisions) setDivisions(data.divisions);
  if (data.positions) setPositions(data.positions);
  if (data.attendances) setAttendances(data.attendances);
  if (data.leaves) setLeaves(data.leaves);
  if (data.permissions) setPermissions(data.permissions);
  if (data.payrolls) setPayrolls(data.payrolls);
  if (data.announcements) setAnnouncements(data.announcements);
  if (data.settings) setSettings(data.settings);
  if (data.logs) setLogs(data.logs);
}

export function resetDatabase() {
  setItem(KEYS.initialized, false);
  ensureInit();
}

export const db = {
  getUsers,
  setUsers,
  getUserByEmail,
  getUserById,
  getEmployees,
  setEmployees,
  getEmployeeById,
  getEmployeeByEmployeeId,
  getEmployeeByEmail,
  getDepartments,
  setDepartments,
  getDepartmentById,
  getDivisions,
  setDivisions,
  getDivisionById,
  getPositions,
  setPositions,
  getPositionById,
  getAttendances,
  setAttendances,
  getLeaves,
  setLeaves,
  getPermissions,
  setPermissions,
  getPayrolls,
  setPayrolls,
  getAnnouncements,
  setAnnouncements,
  getSettings,
  setSettings,
  getLogs,
  setLogs,
  addLog,
  exportAll,
  importAll,
  reset: resetDatabase,
};
