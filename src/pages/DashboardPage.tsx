import { useEffect, useState } from 'react';
import {
  Users,
  UserCheck,
  CalendarOff,
  UserX,
  Clock,
  AlertTriangle,
  Cake,
  Megaphone,
  RefreshCw,
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { getDashboard } from '../services/api';
import type { DashboardStats } from '../types';
import { StatCard } from '../components/ui/StatCard';
import { Card, CardHeader, CardTitle, CardBody } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { SkeletonCard } from '../components/ui/Skeleton';
import { formatDate, formatTime } from '../lib/utils';
import { db } from '../lib/db';
import { useTheme } from '../context/ThemeContext';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const load = async () => {
    setLoading(true);
    const res = await getDashboard();
    if (res.success && res.data) setStats(res.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  const getEmpName = (id: string) => db.getEmployeeById(id)?.fullName || id;
  const getDeptName = (id: string) => db.getDepartmentById(id)?.name || '-';

  const chartText = isDark ? '#94a3b8' : '#64748b';
  const chartGrid = isDark ? 'rgba(148,163,184,0.1)' : 'rgba(100,116,139,0.1)';

  const attendanceChart = {
    labels: stats?.attendanceMonthly.map((m) => m.month) || [],
    datasets: [
      {
        label: 'Hadir',
        data: stats?.attendanceMonthly.map((m) => m.present) || [],
        backgroundColor: '#0D47A1',
        borderRadius: 6,
      },
      {
        label: 'Terlambat',
        data: stats?.attendanceMonthly.map((m) => m.late) || [],
        backgroundColor: '#F9A825',
        borderRadius: 6,
      },
      {
        label: 'Absen',
        data: stats?.attendanceMonthly.map((m) => m.absent) || [],
        backgroundColor: '#D32F2F',
        borderRadius: 6,
      },
    ],
  };

  const deptChart = {
    labels: stats?.employeeByDepartment.map((d) => d.name) || [],
    datasets: [
      {
        data: stats?.employeeByDepartment.map((d) => d.count) || [],
        backgroundColor: ['#0D47A1', '#1565C0', '#2E7D32', '#F9A825', '#7B1FA2'],
        borderWidth: 0,
      },
    ],
  };

  const statusChart = {
    labels: stats?.employeeByStatus.map((s) => s.status) || [],
    datasets: [
      {
        data: stats?.employeeByStatus.map((s) => s.count) || [],
        backgroundColor: ['#2E7D32', '#F9A825', '#D32F2F', '#1565C0'],
        borderWidth: 0,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: chartText, font: { family: 'Poppins', size: 11 } } } },
    scales: {
      x: { ticks: { color: chartText, font: { size: 11 } }, grid: { color: chartGrid } },
      y: { ticks: { color: chartText, font: { size: 11 } }, grid: { color: chartGrid } },
    },
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' as const, labels: { color: chartText, font: { family: 'Poppins', size: 11 }, padding: 12 } },
    },
  };

  if (loading && !stats) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white sm:hidden">Dashboard</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Ringkasan data HR per {formatDate(new Date().toISOString())}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} loading={loading}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-4">
        <StatCard title="Total Karyawan" value={stats?.totalEmployee ?? 0} icon={<Users className="h-5 w-5" />} color="primary" />
        <StatCard title="Aktif" value={stats?.activeEmployee ?? 0} icon={<UserCheck className="h-5 w-5" />} color="success" />
        <StatCard title="Cuti" value={stats?.onLeave ?? 0} icon={<CalendarOff className="h-5 w-5" />} color="warning" />
        <StatCard title="Resign" value={stats?.resigned ?? 0} icon={<UserX className="h-5 w-5" />} color="danger" />
        <StatCard title="Hadir Hari Ini" value={stats?.attendanceToday ?? 0} icon={<Clock className="h-5 w-5" />} color="info" />
        <StatCard title="Terlambat" value={stats?.lateToday ?? 0} icon={<AlertTriangle className="h-5 w-5" />} color="warning" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Absensi Bulanan</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="h-72">
              <Bar data={attendanceChart} options={chartOptions} />
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Per Departemen</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="h-72">
              <Doughnut data={deptChart} options={doughnutOptions} />
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* Status chart */}
        <Card>
          <CardHeader>
            <CardTitle>Status Karyawan</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="h-56">
              <Doughnut data={statusChart} options={doughnutOptions} />
            </div>
          </CardBody>
        </Card>

        {/* Recent Attendance */}
        <Card>
          <CardHeader>
            <CardTitle>Absensi Terbaru</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3 max-h-72 overflow-y-auto">
            {stats?.recentAttendance.map((a) => (
              <div key={a.id} className="flex items-center gap-3">
                <Avatar name={getEmpName(a.employeeId)} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{getEmpName(a.employeeId)}</p>
                  <p className="text-xs text-slate-400">
                    {formatDate(a.date)} · {formatTime(a.checkIn)}
                  </p>
                </div>
                <Badge status={a.status}>{a.status}</Badge>
              </div>
            ))}
          </CardBody>
        </Card>

        {/* Birthdays */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cake className="h-4 w-4 text-pink-500" /> Ulang Tahun Bulan Ini
            </CardTitle>
          </CardHeader>
          <CardBody className="space-y-3 max-h-72 overflow-y-auto">
            {stats?.birthdaysThisMonth.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-6">Tidak ada ulang tahun bulan ini</p>
            )}
            {stats?.birthdaysThisMonth.map((e) => (
              <div key={e.id} className="flex items-center gap-3">
                <Avatar name={e.fullName} src={e.photo} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{e.fullName}</p>
                  <p className="text-xs text-slate-400">{formatDate(e.birthDate, 'dd MMMM')} · {getDeptName(e.departmentId)}</p>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Employees */}
        <Card>
          <CardHeader>
            <CardTitle>Karyawan Terbaru</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            {stats?.recentEmployees.map((e) => (
              <div key={e.id} className="flex items-center gap-3">
                <Avatar name={e.fullName} src={e.photo} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{e.fullName}</p>
                  <p className="text-xs text-slate-400">
                    {e.employeeId} · {getDeptName(e.departmentId)} · Join {formatDate(e.joinDate)}
                  </p>
                </div>
                <Badge status={e.employmentStatus}>{e.employmentStatus}</Badge>
              </div>
            ))}
          </CardBody>
        </Card>

        {/* Announcements */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-primary" /> Pengumuman
            </CardTitle>
          </CardHeader>
          <CardBody className="space-y-3 max-h-80 overflow-y-auto">
            {stats?.announcements.map((a) => (
              <div key={a.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{a.title}</p>
                  <Badge status={a.priority}>{a.priority}</Badge>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{a.content}</p>
                <p className="text-[11px] text-slate-400">{formatDate(a.publishDate)}</p>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
