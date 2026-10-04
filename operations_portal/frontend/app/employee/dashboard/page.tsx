'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Briefcase,
  CheckSquare,
  Clock,
  CheckCircle2,
  Calendar,
  CalendarCheck,
  ArrowRight,
  Shield,
  Layers,
  Sparkles,
  TrendingUp,
  FileText,
  Building2,
  Flame,
  Star
} from 'lucide-react';
import { api } from '@/lib/api';
import { StatusBadge, PriorityBadge } from '@/components/Badges';
import { AttendanceTimerWidget } from '@/components/AttendanceTimerWidget';

export default function EmployeeDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [storedUser, setStoredUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('ops_user');
        if (cached) {
          setStoredUser(JSON.parse(cached));
        }
      } catch (e) {}
    }
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await api.get('/employee/dashboard');
      if (res.data) {
        setData(res.data);
        if (res.data.employee && typeof window !== 'undefined') {
          try {
            localStorage.setItem('ops_user', JSON.stringify(res.data.employee));
            setStoredUser(res.data.employee);
          } catch (e) {}
        }
      }
    } catch (err) {
      console.error('Failed to load employee dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const employee = data?.employee || storedUser || {};
  const stats = data?.stats || {};
  const activeTasks = data?.active_tasks || [];
  const recentCompleted = data?.recent_completed || [];

  const employeeName = employee.full_name || employee.name || storedUser?.full_name || storedUser?.name || 'Operations Team Member';
  const designation = employee.designation || storedUser?.designation || employee.emp_type || 'Operations Specialist';

  const assignedRoles = (employee.assigned_roles && employee.assigned_roles.length > 0)
    ? employee.assigned_roles
    : (employee.assigned_role ? [employee.assigned_role] : (storedUser?.assigned_roles || (storedUser?.assigned_role ? [storedUser.assigned_role] : [])));

  const rawDepts = employee.assigned_departments || (employee.department ? [employee.department] : (storedUser?.assigned_departments || (storedUser?.department ? [storedUser.department] : [])));
  const assignedDepts = Array.isArray(rawDepts) ? rawDepts.filter(Boolean) : (rawDepts ? [rawDepts] : ['Operations']);
  const displayDepts = assignedDepts.length > 0 ? assignedDepts.join(' & ') : (employee.department || storedUser?.department || 'Operations');
  const assignedModules = employee.assigned_modules || storedUser?.assigned_modules || [];

  const hour = new Date().getHours();
  let greeting = 'Good Morning';
  if (hour >= 12 && hour < 17) greeting = 'Good Afternoon';
  else if (hour >= 17) greeting = 'Good Evening';

  return (
    <div className="space-y-5 sm:space-y-7 animate-fadeIn pb-12">
      {/* Welcome Banner */}
      <div className="p-5 sm:p-8 bg-gradient-to-r from-emerald-950 via-teal-950 to-amber-950 text-white rounded-2xl sm:rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-5 relative overflow-hidden border border-emerald-500/20">
        <div className="relative z-10 space-y-1.5 sm:space-y-2 w-full md:w-auto">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-emerald-200">
              Operational Workspace
            </span>
            {assignedRoles.map((r: any) => (
              <span
                key={r.id || r.title}
                className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/30 text-[10px] sm:text-[11px] font-bold text-amber-200"
              >
                🛡️ {r.title}
              </span>
            ))}
          </div>

          <h2 className="text-lg sm:text-2xl font-black tracking-tight break-words text-white">
            {greeting}, {employeeName} 👋
          </h2>

          <p className="text-xs sm:text-sm text-emerald-100/90 max-w-xl leading-relaxed">
            {designation} • <span className="text-amber-300 font-semibold">{displayDepts}</span>
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 relative z-10 w-full md:w-auto">
          <Link
            href="/employee/daily-tracker"
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl sm:rounded-2xl text-xs font-black shadow-md transition flex items-center justify-center gap-2 active:scale-95 text-center cursor-pointer border border-emerald-300/30"
          >
            <CalendarCheck className="w-4 h-4 shrink-0 text-amber-300" />
            <span>📅 Daily Work Tracker</span>
          </Link>

          <Link
            href="/employee/my-work"
            className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-xl sm:rounded-2xl text-xs font-bold shadow-md transition flex items-center justify-center gap-2 active:scale-95 text-center cursor-pointer border border-amber-300/30"
          >
            <Briefcase className="w-4 h-4 shrink-0" />
            <span>Assigned Work ({stats.in_progress_count ?? 0})</span>
          </Link>
        </div>
      </div>

      {/* ─── DAILY WORK TRACKER PROMINENT CALLOUT CARD ─── */}
      <div className="p-5 sm:p-6 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-amber-500/10 border border-emerald-300/80 dark:border-emerald-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-300 flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-800">
            <CalendarCheck className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                Today's Daily Work Tracker
              </h3>
              <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-extrabold">
                Live Sync
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Log today's tasks, link deliverables assigned by your Manager or Superadmin, and build your 52-week streak!
            </p>
          </div>
        </div>

        <Link
          href="/employee/daily-tracker"
          className="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md shadow-emerald-500/25 transition flex items-center justify-center gap-2 cursor-pointer shrink-0"
        >
          <span>Open Work Tracker</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* ─── LIVE ATTENDANCE & SHIFT TIMER ─── */}
      <AttendanceTimerWidget />

      {/* ─── 1. KEY TASK METRICS ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Assigned */}
        <div className="p-4 sm:p-5 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl sm:rounded-3xl shadow-xs space-y-2 sm:space-y-3 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Total Work</span>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center">
              <CheckSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-3xl font-black text-[var(--text-primary)]">
              {stats.total_tasks ?? 0}
            </div>
            <div className="text-[10px] sm:text-[11px] font-semibold text-[var(--text-muted)] mt-0.5">
              <span>Assigned deliverables</span>
            </div>
          </div>
        </div>

        {/* In Progress */}
        <div className="p-4 sm:p-5 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl sm:rounded-3xl shadow-xs space-y-2 sm:space-y-3 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">In Progress</span>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-300 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-3xl font-black text-[var(--text-primary)]">
              {stats.in_progress_count ?? 0}
            </div>
            <div className="text-[10px] sm:text-[11px] font-semibold text-blue-600 dark:text-blue-400 mt-0.5">
              <span>Active in development</span>
            </div>
          </div>
        </div>

        {/* Under Review */}
        <div className="p-4 sm:p-5 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl sm:rounded-3xl shadow-xs space-y-2 sm:space-y-3 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Under Review</span>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-300 flex items-center justify-center">
              <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-3xl font-black text-[var(--text-primary)]">
              {stats.under_review_count ?? 0}
            </div>
            <div className="text-[10px] sm:text-[11px] font-semibold text-amber-600 dark:text-amber-400 mt-0.5">
              <span>Awaiting admin review</span>
            </div>
          </div>
        </div>

        {/* Completed */}
        <div className="p-4 sm:p-5 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl sm:rounded-3xl shadow-xs space-y-2 sm:space-y-3 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Completed</span>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-300 flex items-center justify-center">
              <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-3xl font-black text-[var(--text-primary)]">
              {stats.completed_count ?? 0}
            </div>
            <div className="text-[10px] sm:text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
              <span>{stats.completion_rate ?? 0}% completed rate</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 2. ACTIVE DELIVERABLES & ROLE SCOPE ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-7">
        {/* Active Tasks List (8 cols) */}
        <div className="lg:col-span-8 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xs space-y-4 sm:space-y-5 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-[var(--text-primary)]">Current Work Queue</h3>
              <p className="text-[11px] sm:text-xs text-[var(--text-secondary)]">Tasks assigned to you by Operations Admin</p>
            </div>
            <Link
              href="/employee/my-work"
              className="text-xs font-bold text-[var(--accent)] hover:underline flex items-center gap-1"
            >
              <span>Manage All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3">
            {activeTasks.length === 0 ? (
              <div className="py-12 text-center text-[var(--text-muted)] text-xs">
                No pending tasks. Great job on completing your work!
              </div>
            ) : (
              activeTasks.map((t: any) => (
                <div
                  key={t.id}
                  className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-[var(--card-border)] hover:bg-[var(--hover-bg)] transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1.5 min-w-0 w-full sm:w-auto">
                    <div className="flex flex-wrap items-center gap-2">
                      <PriorityBadge priority={t.priority} />
                      <h4 className="text-xs sm:text-sm font-bold text-[var(--text-primary)] leading-snug">
                        {t.title}
                      </h4>
                    </div>

                    <p className="text-xs text-[var(--text-secondary)] line-clamp-2 sm:line-clamp-1">
                      {t.description || 'No specific description provided.'}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--text-muted)] pt-0.5">
                      {t.deadline && (
                        <span className="font-semibold text-[var(--text-primary)] flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                          <span>Due: {t.deadline}</span>
                        </span>
                      )}
                      {t.estimated_hours > 0 && (
                        <span>Est: {t.estimated_hours} hrs</span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-[var(--card-border)]">
                    <StatusBadge status={t.status} />
                    <Link
                      href="/employee/my-work"
                      className="px-3 py-1.5 bg-[var(--hover-bg)] hover:bg-sky-50 dark:hover:bg-sky-950 hover:text-sky-600 font-bold rounded-xl text-xs transition border border-[var(--card-border)]"
                    >
                      Update
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Multi-Role & Modules Overview (4 cols) */}
        <div className="lg:col-span-4 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xs space-y-4 flex flex-col justify-between transition-colors">
          <div className="space-y-3.5">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 dark:text-purple-400" />
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-[var(--text-primary)]">Operational Matrix Scope</h3>
                <p className="text-[11px] sm:text-xs text-[var(--text-secondary)]">Assigned Multi-Roles & Modules</p>
              </div>
            </div>

            {/* Assigned Roles */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Assigned Functional Roles:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {assignedRoles.map((r: any) => (
                  <span
                    key={r.id || r.title}
                    className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-purple-50 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800 flex items-center gap-1"
                  >
                    <Shield className="w-3 h-3 text-purple-500" />
                    <span>{r.title}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Modules Unlocked */}
            {assignedModules.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Active Modules (Google Sheets Matrix):
                </div>
                <div className="flex flex-wrap gap-1">
                  {assignedModules.map((m: string) => (
                    <span
                      key={m}
                      className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                      <span>{m}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Link
            href="/employee/my-role"
            className="w-full py-2.5 text-center bg-[var(--hover-bg)] hover:bg-purple-50 dark:hover:bg-purple-950 text-purple-700 dark:text-purple-300 font-bold text-xs rounded-xl border border-[var(--card-border)] hover:border-purple-300 transition mt-2 cursor-pointer"
          >
            View Full Role Scope & Permissions →
          </Link>
        </div>
      </div>
    </div>
  );
}
