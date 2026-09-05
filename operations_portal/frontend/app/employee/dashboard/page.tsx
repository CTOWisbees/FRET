'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Briefcase,
  CheckSquare,
  Clock,
  CheckCircle2,
  Calendar,
  ArrowRight,
  Shield,
  Layers,
  Sparkles,
  TrendingUp,
  FileText
} from 'lucide-react';
import { api } from '@/lib/api';
import { StatusBadge, PriorityBadge } from '@/components/Badges';
import { AttendanceTimerWidget } from '@/components/AttendanceTimerWidget';

export default function EmployeeDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await api.get('/employee/dashboard');
      if (res.data) {
        setData(res.data);
      }
    } catch (err) {
      console.error('Failed to load employee dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const employee = data?.employee || {};
  const stats = data?.stats || {};
  const activeTasks = data?.active_tasks || [];
  const recentCompleted = data?.recent_completed || [];

  const hour = new Date().getHours();
  let greeting = 'Good Morning';
  if (hour >= 12 && hour < 17) greeting = 'Good Afternoon';
  else if (hour >= 17) greeting = 'Good Evening';

  return (
    <div className="space-y-5 sm:space-y-7 animate-fadeIn">
      {/* Welcome Banner */}
      <div className="p-5 sm:p-8 bg-gradient-to-r from-slate-900 via-sky-950 to-indigo-950 text-white rounded-2xl sm:rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-5 relative overflow-hidden border border-white/10">
        <div className="relative z-10 space-y-1.5 sm:space-y-2 w-full md:w-auto">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-white/10 border border-white/15 text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-sky-300">
              Operational Workspace
            </span>
            {employee.assigned_role?.title && (
              <span className="px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-[10px] sm:text-[11px] font-bold text-indigo-200 truncate max-w-[200px] sm:max-w-none">
                🛡️ {employee.assigned_role.title}
              </span>
            )}
          </div>

          <h2 className="text-lg sm:text-2xl font-black tracking-tight break-words">
            {greeting}, {employee.name || 'Team Member'} 👋
          </h2>

          <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
            {employee.designation || 'IT Intern – Web & Automation Developer'} • <span className="text-sky-300 font-semibold">{employee.department || 'Data & Analytics'}</span>
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 relative z-10 w-full md:w-auto">
          <Link
            href="/employee/my-work"
            className="px-4 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white rounded-xl sm:rounded-2xl text-xs font-bold shadow-md transition flex items-center justify-center gap-2 active:scale-95 text-center"
          >
            <Briefcase className="w-4 h-4 shrink-0" />
            <span>View Assigned Work ({stats.in_progress_count ?? 0})</span>
          </Link>

          <Link
            href="/employee/work-logs"
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl sm:rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 active:scale-95 text-center"
          >
            <Clock className="w-4 h-4 shrink-0" />
            <span>Attendance & Logs</span>
          </Link>
        </div>
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

        {/* Assigned Role Overview (4 cols) */}
        <div className="lg:col-span-4 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xs space-y-4 flex flex-col justify-between transition-colors">
          <div className="space-y-3.5">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 dark:text-purple-400" />
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-[var(--text-primary)]">My Operational Role</h3>
                <p className="text-[11px] sm:text-xs text-[var(--text-secondary)]">Role Scope & Permissions</p>
              </div>
            </div>

            <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-purple-50/50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-800 space-y-1.5">
              <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                Official Designation
              </div>
              <div className="text-xs sm:text-sm font-black text-purple-950 dark:text-purple-200">
                {employee.assigned_role?.title || employee.designation || 'Operations Staff'}
              </div>
              <div className="text-[11px] sm:text-xs text-purple-800 dark:text-purple-300 font-medium">
                Level: <span className="font-bold">{employee.assigned_role?.level || 'Intern'}</span> • Dept: <span className="font-bold">{employee.department}</span>
              </div>
            </div>

            {employee.assigned_role?.responsibilities && (
              <div className="p-3 bg-[var(--hover-bg)] rounded-xl sm:rounded-2xl border border-[var(--card-border)] text-xs text-[var(--text-secondary)] space-y-1">
                <div className="font-bold text-[var(--text-primary)] text-[10px] uppercase">My Core Focus</div>
                <div className="whitespace-pre-wrap line-clamp-3 text-[11px] leading-relaxed">
                  {employee.assigned_role.responsibilities}
                </div>
              </div>
            )}
          </div>

          <Link
            href="/employee/my-role"
            className="w-full py-2.5 text-center bg-[var(--hover-bg)] hover:bg-purple-50 dark:hover:bg-purple-950 text-purple-700 dark:text-purple-300 font-bold text-xs rounded-xl border border-[var(--card-border)] hover:border-purple-300 transition mt-2"
          >
            View Full Role Scope & Permissions →
          </Link>
        </div>
      </div>
    </div>
  );
}
