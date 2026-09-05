'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  CheckSquare,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Activity,
  PlusCircle,
  Sparkles
} from 'lucide-react';
import { api } from '@/lib/api';
import { StatusBadge, PriorityBadge } from '@/components/Badges';

export default function AdminDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/dashboard');
      if (res.data) {
        setData(res.data);
      }
    } catch (err) {
      console.error('Failed to load admin dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const stats = data?.stats || {};
  const recentTasks = data?.recent_tasks || [];
  const activities = data?.recent_activities || [];

  return (
    <div className="space-y-7 animate-fadeIn">
      {/* Top Banner with Quick Actions */}
      <div className="p-6 sm:p-8 bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 text-white rounded-3xl shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 relative overflow-hidden border border-white/10">
        <div className="relative z-10 space-y-1.5">
          <span className="px-3 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] font-extrabold uppercase tracking-wider text-purple-300 inline-block">
            Operations Management Console
          </span>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight">
            Welcome to Operations Command Hub
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
            Assign work, manage team permissions, configure operational roles, and review deliverable submissions in real-time.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 relative z-10">
          <Link
            href="/admin/tasks"
            className="px-4 py-2.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white rounded-2xl text-xs font-bold shadow-md transition flex items-center gap-2 active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create & Assign Task</span>
          </Link>

          <Link
            href="/admin/employees"
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-2xl text-xs font-bold transition flex items-center gap-2 active:scale-95"
          >
            <Users className="w-4 h-4" />
            <span>Manage Employees</span>
          </Link>
        </div>
      </div>

      {/* ─── 1. KEY METRIC CARDS ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Active Staff */}
        <div className="p-5 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl shadow-xs space-y-3 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Total Staff</span>
            <div className="w-9 h-9 rounded-2xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-300 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-[var(--text-primary)]">
              {stats.total_employees ?? 0}
            </div>
            <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
              <span>{stats.active_employees ?? 0} active in operations</span>
            </div>
          </div>
        </div>

        {/* Total Tasks */}
        <div className="p-5 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl shadow-xs space-y-3 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Total Tasks</span>
            <div className="w-9 h-9 rounded-2xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-300 flex items-center justify-center">
              <CheckSquare className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-[var(--text-primary)]">
              {stats.total_tasks ?? 0}
            </div>
            <div className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 flex items-center gap-1 mt-0.5">
              <span>{stats.in_progress_tasks ?? 0} currently in progress</span>
            </div>
          </div>
        </div>

        {/* Under Review */}
        <div className="p-5 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl shadow-xs space-y-3 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Under Review</span>
            <div className="w-9 h-9 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-300 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-[var(--text-primary)]">
              {stats.under_review_tasks ?? 0}
            </div>
            <div className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-0.5">
              <span>Submissions awaiting sign-off</span>
            </div>
          </div>
        </div>

        {/* Completed Rate */}
        <div className="p-5 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl shadow-xs space-y-3 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Completion</span>
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-300 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-[var(--text-primary)]">
              {stats.completion_rate ?? 0}%
            </div>
            <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
              <span>{stats.completed_tasks ?? 0} completed deliverables</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 2. RECENT TASKS & ACTIVITY FEED ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
        {/* Recent Tasks List (8 cols) */}
        <div className="lg:col-span-8 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl p-6 shadow-xs space-y-5 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-[var(--text-primary)]">Live Operation Tasks</h3>
              <p className="text-xs text-[var(--text-secondary)]">Most recently assigned operational deliverables</p>
            </div>
            <Link
              href="/admin/tasks"
              className="text-xs font-bold text-[var(--accent)] hover:underline flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3">
            {recentTasks.length === 0 ? (
              <div className="py-12 text-center text-[var(--text-muted)] text-xs">
                No active tasks found. Create a task to get started!
              </div>
            ) : (
              recentTasks.map((t: any) => (
                <div
                  key={t.id}
                  className="p-4 rounded-2xl border border-[var(--card-border)] hover:bg-[var(--hover-bg)] transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <PriorityBadge priority={t.priority} />
                      <h4 className="text-sm font-bold text-[var(--text-primary)] truncate">
                        {t.title}
                      </h4>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-secondary)]">
                      <span className="font-semibold text-[var(--text-primary)]">
                        👤 {t.assigned_to?.name || 'Unassigned'}
                      </span>
                      {t.deadline && <span>📅 Due: {t.deadline}</span>}
                      {t.tags?.length > 0 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-[var(--hover-bg)] font-mono border border-[var(--card-border)]">
                          {t.tags.join(', ')}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <StatusBadge status={t.status} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Team Activity Feed (4 cols) */}
        <div className="lg:col-span-4 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl p-6 shadow-xs space-y-5 transition-colors">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-500" />
            <div>
              <h3 className="text-base font-extrabold text-[var(--text-primary)]">Operations Log</h3>
              <p className="text-xs text-[var(--text-secondary)]">Recent system actions</p>
            </div>
          </div>

          <div className="space-y-4">
            {activities.length === 0 ? (
              <div className="py-8 text-center text-[var(--text-muted)] text-xs">
                No activity recorded yet.
              </div>
            ) : (
              activities.map((act: any) => (
                <div key={act.id} className="flex items-start gap-3 text-xs pb-3 border-b border-[var(--card-border)] last:border-0 last:pb-0">
                  <div className="w-2 h-2 rounded-full bg-sky-500 mt-1.5 shrink-0"></div>
                  <div className="space-y-0.5 min-w-0">
                    <div className="font-bold text-[var(--text-primary)]">
                      {act.user_name}
                    </div>
                    <div className="text-[var(--text-secondary)] leading-snug">
                      {act.action}
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)] font-medium">
                      {act.time}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
