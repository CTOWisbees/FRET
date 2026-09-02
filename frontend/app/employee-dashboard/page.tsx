'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import {
  CalendarCheck, Calendar, Clock, PlaneTakeoff, CheckCircle2,
  AlertCircle, Megaphone, UserCircle2, ArrowUp, ArrowRight,
  TrendingUp, ShieldCheck, Sun, Moon, Sparkles, Fingerprint,
  LogOut, RefreshCw, XCircle, ChevronRight, Check, LogIn,
  Umbrella, ListChecks, CheckCircle
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, CartesianGrid
} from 'recharts';
import { api } from '@/lib/api';

export default function EmployeeDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [cachedUser, setCachedUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [liveDuration, setLiveDuration] = useState<string>('');
  const router = useRouter();

  // Load saved user from local storage immediately
  useEffect(() => {
    try {
      const saved = localStorage.getItem('fret_user');
      if (saved) {
        setCachedUser(JSON.parse(saved));
      }
    } catch (e) {}
  }, []);

  // Fetch dashboard data
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/employee-dashboard');
      if (res.data && res.data.authenticated) {
        setData(res.data);
        if (res.data.employee) {
          localStorage.setItem('fret_user', JSON.stringify(res.data.employee));
          setCachedUser(res.data.employee);
        }
      } else {
        router.push('/login');
      }
    } catch (err: any) {
      console.error('Failed to load employee dashboard:', err);
      if (err.response?.status === 401) {
        // Retry with me endpoint
        try {
          const meRes = await api.get('/api/employee/me');
          if (meRes.data?.authenticated) {
            setCachedUser(meRes.data);
          } else {
            router.push('/login');
          }
        } catch (e) {
          router.push('/login');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const todayAttendance = data?.today_attendance || {};

  // Live Timer for active shift
  useEffect(() => {
    if (todayAttendance?.is_checked_in && !todayAttendance?.is_checked_out) {
      const checkInMs = todayAttendance?.check_in_timestamp ||
        (todayAttendance?.check_in_iso ? new Date(todayAttendance.check_in_iso).getTime() : null);

      if (!checkInMs || isNaN(checkInMs)) return;

      const updateTimer = () => {
        const now = Date.now();
        const diffMs = Math.max(0, now - checkInMs);
        const diffSecs = Math.floor(diffMs / 1000);
        const hours = Math.floor(diffSecs / 3600);
        const minutes = Math.floor((diffSecs % 3600) / 60);
        const seconds = diffSecs % 60;
        setLiveDuration(`${hours}h ${minutes}m ${seconds}s`);
      };

      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    } else {
      setLiveDuration('');
    }
  }, [
    todayAttendance?.is_checked_in, 
    todayAttendance?.is_checked_out, 
    todayAttendance?.check_in_timestamp, 
    todayAttendance?.check_in_iso
  ]);

  // Check In handler
  const handleCheckin = async () => {
    try {
      setActionLoading(true);
      const res = await api.post('/attendance/checkin');
      if (res.data?.success) {
        setAlertMessage(`Check-in successful at ${res.data.check_in}`);
        await fetchDashboardData();
        setTimeout(() => setAlertMessage(null), 4000);
      }
    } catch (err) {
      console.error('Checkin error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // Check Out confirm handler
  const confirmCheckout = async () => {
    try {
      setActionLoading(true);
      setShowCheckoutModal(false);
      const res = await api.post('/attendance/checkout');
      if (res.data?.success) {
        setAlertMessage(`Check-out successful! Total Shift Worked: ${res.data.worked_duration || 'Recorded'}`);
        await fetchDashboardData();
        setTimeout(() => setAlertMessage(null), 5000);
      }
    } catch (err) {
      console.error('Checkout error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // Time-aware greeting
  const hour = data?.now_hour ?? new Date().getHours();
  let greeting = 'Good Morning';
  if (hour >= 12 && hour < 17) {
    greeting = 'Good Afternoon';
  } else if (hour >= 17) {
    greeting = 'Good Evening';
  }

  const employee = data?.employee || cachedUser || {};
  const stats = data?.stats || {};
  const weeklyOverview = data?.weekly_overview || [];
  const monthlyTrend = data?.monthly_trend || [];
  const announcements = data?.latest_announcements || [];
  const leaveRequests = data?.leave_request_list || [];

  // Leave chart data (Remaining vs Taken)
  const remainingLeaves = stats.leave_balance ?? 12;
  const takenLeaves = stats.leaves_taken ?? 0;
  const leaveDonutData = [
    { name: 'Remaining', value: remainingLeaves, color: '#6366f1' },
    { name: 'Taken', value: takenLeaves, color: '#1e293b' }
  ];

  return (
    <div className="flex min-h-screen bg-[var(--bg)] text-[var(--text)] font-sans antialiased">
      {/* Sidebar with exact company styling and dynamic employee name */}
      <Sidebar 
        user={{
          name: employee.name || 'Employee',
          designation: employee.designation || 'Staff',
          emp_type: employee.emp_type || 'Normal'
        }}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header 
          title="Dashboard" 
          onMenuClick={() => setMobileOpen(prev => !prev)} 
        />

        <main className="p-4 sm:p-8 flex-1 overflow-y-auto space-y-6 max-w-7xl mx-auto w-full">
          {/* Flash Alert Banner */}
          {alertMessage && (
            <div className="flex items-center space-x-2 px-4 py-3 bg-[#E6FDF4] border border-[#A7F3D0] rounded-xl text-emerald-800 text-sm font-medium animate-fadeIn">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>{alertMessage}</span>
            </div>
          )}

          {/* ─── 1. GREETING & APPLY FOR LEAVE BUTTON ─── */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text)] tracking-tight font-['Plus_Jakarta_Sans'] flex items-center gap-2">
                <span>{greeting}, {employee.first_name || employee.name || 'Employee'}</span>
                <span className="animate-wave select-none text-2xl">👋</span>
              </h1>
              <p className="text-sm font-medium text-[var(--text3)] mt-1">
                {employee.designation || 'IT Intern – Web & Automation Developer'}
              </p>
            </div>

            <Link
              href="/apply-leave"
              className="px-5 py-2.5 bg-[#6366F1] hover:bg-[#4F46E5] text-white font-bold rounded-xl shadow-sm transition flex items-center justify-center space-x-2 text-sm w-fit active:scale-95"
            >
              <PlaneTakeoff className="w-4 h-4" />
              <span>Apply for Leave</span>
            </Link>
          </div>

          {/* ─── 2. TOP GRID: ATTENDANCE OVERVIEW (LINE) & TODAY'S ATTENDANCE ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Attendance Overview Area Chart (7 cols) */}
            <div className="lg:col-span-7 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2 font-bold text-sm text-[var(--text)]">
                  <Calendar className="w-4 h-4 text-[#6366F1]" />
                  <span>Attendance Overview</span>
                </div>

                <div className="flex items-center space-x-2 text-xs font-semibold text-[var(--text3)]">
                  <span className="w-6 h-2 rounded-sm border border-[#6366F1] bg-[#6366F1]/20 inline-block"></span>
                  <span>Attendance %</span>
                </div>
              </div>

              <div className="h-[230px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weeklyOverview} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="attendanceGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366F1" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#6366F1" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} vertical={false} />
                    <XAxis 
                      dataKey="week" 
                      stroke="var(--text3)" 
                      fontSize={11} 
                      tickLine={false} 
                      axisLine={false} 
                    />
                    <YAxis 
                      domain={[90, 100]} 
                      ticks={[92, 93, 94, 95, 96, 97, 98]} 
                      stroke="var(--text3)" 
                      fontSize={11} 
                      tickLine={false} 
                      axisLine={false} 
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'var(--surface)', 
                        borderColor: 'var(--border)', 
                        borderRadius: '8px', 
                        color: 'var(--text)', 
                        fontSize: '12px',
                        fontWeight: 'bold',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }} 
                      formatter={(val: any) => [`${val}%`, 'Attendance']}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="attendance" 
                      stroke="#6366F1" 
                      strokeWidth={3} 
                      fillOpacity={1} 
                      fill="url(#attendanceGradient)" 
                      dot={{ r: 4, fill: '#6366F1', strokeWidth: 2, stroke: '#FFFFFF' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Today's Attendance Punch Card (5 cols) */}
            <div className="lg:col-span-5 bg-[var(--surface)] border border-[var(--border)] rounded-3xl p-6 sm:p-7 shadow-sm flex flex-col justify-between text-center">
              <div className="flex items-center space-x-2.5 font-extrabold text-base text-[var(--text)] text-left font-['Plus_Jakarta_Sans']">
                <CalendarCheck className="w-5 h-5 text-[#6366F1]" />
                <span>Today&apos;s Attendance</span>
              </div>

              {/* Centered Status Pill Badge */}
              <div className="my-2">
                {!todayAttendance.is_checked_in ? (
                  <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]">
                    <Clock className="w-4 h-4 text-[#64748B]" />
                    <span>Not Checked In</span>
                  </span>
                ) : !todayAttendance.is_checked_out ? (
                  <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                    <span>Present (Active Shift)</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]">
                    <CheckCircle className="w-4 h-4 text-[#2563EB]" />
                    <span>Shift Completed</span>
                  </span>
                )}
              </div>

              {/* Side-by-Side Rounded Timestamp Cards */}
              <div className="space-y-3 my-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="py-5 px-3 bg-[#F8FAFC] border border-[#F1F5F9] rounded-2xl flex flex-col items-center justify-center">
                    <div className="text-2xl sm:text-3xl font-black tracking-widest text-[#1E293B] font-mono">
                      {todayAttendance.check_in || '-- : --'}
                    </div>
                    <div className="text-[11px] font-bold text-[#64748B] tracking-wider uppercase mt-2">
                      CHECK IN
                    </div>
                  </div>

                  <div className="py-5 px-3 bg-[#F8FAFC] border border-[#F1F5F9] rounded-2xl flex flex-col items-center justify-center">
                    <div className="text-2xl sm:text-3xl font-black tracking-widest text-[#1E293B] font-mono">
                      {todayAttendance.check_out || '-- : --'}
                    </div>
                    <div className="text-[11px] font-bold text-[#64748B] tracking-wider uppercase mt-2">
                      CHECK OUT
                    </div>
                  </div>
                </div>

                {/* Duration Display if Active / Completed */}
                {todayAttendance.is_checked_in && (
                  <div className="py-1.5 px-3.5 bg-[#EEF2FF] border border-[#C7D2FE] rounded-xl text-xs font-bold text-[#4F46E5] flex items-center justify-between">
                    <span>{todayAttendance.is_checked_out ? 'Total Shift Duration:' : 'Current Worked Time:'}</span>
                    <span className="font-mono">{liveDuration || todayAttendance.worked_duration || 'In Progress'}</span>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div>
                {!todayAttendance.is_checked_in ? (
                  <button
                    onClick={handleCheckin}
                    disabled={actionLoading}
                    className="w-full py-3.5 bg-[#0B9B6A] hover:bg-[#09835A] text-white font-bold rounded-2xl shadow-sm transition flex items-center justify-center space-x-2 text-sm disabled:opacity-50 active:scale-98 cursor-pointer"
                  >
                    {actionLoading ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Fingerprint className="w-5 h-5" />
                        <span>Check In Now</span>
                      </>
                    )}
                  </button>
                ) : !todayAttendance.is_checked_out ? (
                  <button
                    onClick={() => setShowCheckoutModal(true)}
                    disabled={actionLoading}
                    className="w-full py-3.5 bg-[#E11D48] hover:bg-[#BE123C] text-white font-bold rounded-2xl shadow-sm transition flex items-center justify-center space-x-2 text-sm disabled:opacity-50 active:scale-98 cursor-pointer"
                  >
                    {actionLoading ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <LogIn className="w-5 h-5 rotate-180" />
                        <span>Check Out</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    disabled
                    className="w-full py-3.5 bg-[var(--bg3)] text-[#059669] font-bold rounded-2xl flex items-center justify-center space-x-2 text-sm cursor-not-allowed opacity-90 border border-[var(--border)]"
                  >
                    <CheckCircle className="w-5 h-5" />
                    <span>Attendance Completed</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ─── 3. 4 KEY METRIC CARDS ─── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Card 1: Attendance This Month */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text3)]">
                  Attendance This Month
                </div>
                <div className="text-2xl font-extrabold text-[var(--text)] my-1 font-['Plus_Jakarta_Sans']">
                  {stats.attendance_percent ?? 100.0}%
                </div>
                <div className="text-xs font-semibold text-[#16A34A] flex items-center gap-1">
                  <ArrowUp className="w-3 h-3" />
                  <span>On track</span>
                </div>
              </div>
              <div className="w-11 h-11 rounded-xl bg-[#EEF2FF] text-[#6366F1] flex items-center justify-center">
                <Calendar className="w-5 h-5" />
              </div>
            </div>

            {/* Card 2: Leave Balance */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text3)]">
                  Leave Balance
                </div>
                <div className="text-2xl font-extrabold text-[var(--text)] my-1 font-['Plus_Jakarta_Sans']">
                  {stats.leave_balance ?? 12} days
                </div>
                <div className="text-xs text-[var(--text3)]">
                  {stats.leaves_taken ?? 0} taken this year
                </div>
              </div>
              <div className="w-11 h-11 rounded-xl bg-[#ECFEFF] text-[#06B6D4] flex items-center justify-center">
                <Umbrella className="w-5 h-5" />
              </div>
            </div>

            {/* Card 3: Awaiting HR Approval */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text3)]">
                  Awaiting HR Approval
                </div>
                <div className="text-2xl font-extrabold text-[var(--text)] my-1 font-['Plus_Jakarta_Sans']">
                  {stats.pending_leaves ?? 0}
                </div>
                <div className="text-xs font-semibold text-[#DC2626] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#DC2626]"></span>
                  <span>Needs attention</span>
                </div>
              </div>
              <div className="w-11 h-11 rounded-xl bg-[#FEF3C7] text-[#F59E0B] flex items-center justify-center">
                <ListChecks className="w-5 h-5" />
              </div>
            </div>

            {/* Card 4: Status */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text3)]">
                  Status
                </div>
                <div className="text-2xl font-extrabold text-[#16A34A] my-1 font-['Plus_Jakarta_Sans']">
                  {employee.status || 'Active'}
                </div>
                <div className="text-xs font-medium text-[var(--text3)]">
                  {employee.emp_type || 'Intern'}
                </div>
              </div>
              <div className="w-11 h-11 rounded-xl bg-[#DCFCE7] text-[#16A34A] flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* ─── 4. CHARTS: ATTENDANCE TREND & LEAVE BALANCE DONUT ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* 6 Months Bar Trend (8 cols) */}
            <div className="lg:col-span-8 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-sm">
              <div className="flex items-center space-x-2 font-bold text-sm text-[var(--text)] mb-4">
                <TrendingUp className="w-4 h-4 text-[#6366F1]" />
                <span>Attendance Trend (Last 6 Months)</span>
              </div>

              <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyTrend} margin={{ top: 15, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} vertical={false} />
                    <XAxis 
                      dataKey="month" 
                      stroke="var(--text3)" 
                      fontSize={11} 
                      tickLine={false} 
                      axisLine={false} 
                    />
                    <YAxis 
                      domain={[0, 100]} 
                      ticks={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]} 
                      stroke="var(--text3)" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false} 
                    />
                    <Tooltip 
                      cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }}
                      contentStyle={{ 
                        backgroundColor: 'var(--surface)', 
                        borderColor: 'var(--border)', 
                        borderRadius: '8px', 
                        color: 'var(--text)', 
                        fontSize: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }} 
                      formatter={(val: any) => [`${val}%`, 'Attendance %']}
                    />
                    <Bar 
                      dataKey="attendance" 
                      fill="#A5B4FC" 
                      activeBar={{ fill: '#6366F1' }}
                      radius={[4, 4, 0, 0]} 
                      maxBarSize={32} 
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Leave Balance Donut Chart (4 cols) */}
            <div className="lg:col-span-4 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-sm flex flex-col justify-between">
              <div className="flex items-center space-x-2 font-bold text-sm text-[var(--text)] mb-2">
                <Clock className="w-4 h-4 text-[#6366F1]" />
                <span>Leave Balance</span>
              </div>

              <div className="h-[210px] w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={leaveDonutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={0}
                      dataKey="value"
                    >
                      {leaveDonutData.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'var(--surface)', 
                        borderColor: 'var(--border)', 
                        borderRadius: '8px', 
                        color: 'var(--text)', 
                        fontSize: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }} 
                    />
                    <Legend 
                      verticalAlign="bottom" 
                      iconType="square" 
                      wrapperStyle={{ fontSize: '11px', paddingTop: '15px' }} 
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* ─── 5. LATEST ANNOUNCEMENTS ─── */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 font-bold text-sm text-[var(--text)]">
                <Megaphone className="w-4 h-4 text-[#6366F1]" />
                <span>Latest Announcements</span>
              </div>

              <Link 
                href="/announcements" 
                className="text-xs font-bold text-[#6366F1] hover:underline"
              >
                View All
              </Link>
            </div>

            {announcements.length > 0 ? (
              <div className="space-y-3">
                {announcements.map((ann: any) => (
                  <div 
                    key={ann.id}
                    className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg)] space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#DBEAFE] text-[#2563EB]">
                          {ann.priority || 'Normal'}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#E2E8F0] text-[#475569]">
                          {ann.audience || 'Everyone'}
                        </span>
                      </div>
                      <span className="text-xs text-[var(--text3)] font-medium">{ann.created_at || '29 Jun'}</span>
                    </div>

                    <h4 className="font-bold text-[var(--text)] text-sm">{ann.title}</h4>
                    <p className="text-xs text-[var(--text3)] leading-relaxed">{ann.message}</p>

                    <div className="flex items-center space-x-1.5 text-xs text-[var(--text3)] pt-1">
                      <UserCircle2 className="w-3.5 h-3.5 text-[#6366F1]" />
                      <span>{ann.posted_by || 'HR Team'}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center bg-[var(--bg)] rounded-xl border border-dashed border-[var(--border)] space-y-2">
                <Megaphone className="w-8 h-8 text-[var(--text3)] mx-auto opacity-50" />
                <h3 className="font-bold text-sm text-[var(--text)]">No Announcements</h3>
                <p className="text-xs text-[var(--text3)]">No announcements available.</p>
              </div>
            )}
          </div>

          {/* ─── 6. RECENT LEAVE REQUESTS ─── */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 font-bold text-sm text-[var(--text)]">
                <PlaneTakeoff className="w-4 h-4 text-[#6366F1]" />
                <span>Recent Leave Requests</span>
              </div>

              <Link 
                href="/apply-leave" 
                className="text-xs font-bold text-[#6366F1] hover:underline"
              >
                View all
              </Link>
            </div>

            {leaveRequests.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[var(--bg)] border-b border-[var(--border)]">
                    <tr>
                      <th className="py-3 px-4 text-xs font-bold uppercase text-[var(--text3)]">Type</th>
                      <th className="py-3 px-4 text-xs font-bold uppercase text-[var(--text3)]">From</th>
                      <th className="py-3 px-4 text-xs font-bold uppercase text-[var(--text3)]">To</th>
                      <th className="py-3 px-4 text-xs font-bold uppercase text-[var(--text3)] text-center">Days</th>
                      <th className="py-3 px-4 text-xs font-bold uppercase text-[var(--text3)]">Applied On</th>
                      <th className="py-3 px-4 text-xs font-bold uppercase text-[var(--text3)] text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {leaveRequests.map((lr: any) => (
                      <tr key={lr.id} className="hover:bg-[var(--hover)] transition">
                        <td className="py-3 px-4 font-semibold text-[var(--text)]">{lr.leave_type}</td>
                        <td className="py-3 px-4 text-xs text-[var(--text2)]">{lr.from_date}</td>
                        <td className="py-3 px-4 text-xs text-[var(--text2)]">{lr.to_date}</td>
                        <td className="py-3 px-4 text-center text-xs font-bold text-[var(--text)]">{lr.days}</td>
                        <td className="py-3 px-4 text-xs text-[var(--text3)]">{lr.applied_on}</td>
                        <td className="py-3 px-4 text-right">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            lr.status === 'Approved'
                              ? 'bg-[#DCFCE7] text-[#16A34A]'
                              : lr.status === 'Pending'
                              ? 'bg-[#FEF3C7] text-[#D97706]'
                              : 'bg-[#FEE2E2] text-[#DC2626]'
                          }`}>
                            {lr.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center bg-[var(--bg)] rounded-xl border border-dashed border-[var(--border)] space-y-3">
                <div className="w-12 h-12 rounded-full bg-[#EEF2FF] text-[#6366F1] flex items-center justify-center mx-auto">
                  <PlaneTakeoff className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-[var(--text3)]">No leave requests yet</p>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Check Out Confirmation Modal */}
      {showCheckoutModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl space-y-5 animate-fadeIn">
            <div className="flex items-center space-x-3 text-[var(--text)]">
              <div className="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold flex-shrink-0">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-lg text-[var(--text)] font-['Plus_Jakarta_Sans']">
                  Confirm Check Out
                </h3>
                <p className="text-xs text-[var(--text3)]">
                  Are you ready to end your working shift for today?
                </p>
              </div>
            </div>

            {/* Shift Summary Box */}
            <div className="p-4 bg-[var(--bg)] border border-[var(--border)] rounded-2xl space-y-2.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-[var(--text3)] font-semibold uppercase tracking-wider">Check In Time:</span>
                <span className="font-bold text-[var(--text)] font-mono text-sm">{todayAttendance.check_in || '--:--'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[var(--text3)] font-semibold uppercase tracking-wider">Check Out Time:</span>
                <span className="font-bold text-[var(--text)] font-mono text-sm">
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2.5 border-t border-[var(--border)] font-bold text-sm text-[#059669]">
                <span>Total Worked Duration:</span>
                <span className="font-mono">{liveDuration || todayAttendance.worked_duration || 'In Progress'}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowCheckoutModal(false)}
                className="px-4 py-2.5 rounded-xl border border-[var(--border)] text-xs font-bold text-[var(--text2)] hover:bg-[var(--hover)] transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                onClick={confirmCheckout}
                disabled={actionLoading}
                className="px-5 py-2.5 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs font-bold shadow-sm transition active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-2"
              >
                {actionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{actionLoading ? 'Recording...' : 'Confirm Check Out'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
