'use client';

import React, { useState, useEffect } from 'react';
import {
  Award,
  Lock,
  CheckCircle2,
  Shield,
  Building2,
  Layers,
  Sparkles,
  CheckSquare
} from 'lucide-react';
import { api } from '@/lib/api';

export default function EmployeeMyRolePage() {
  const [roleData, setRoleData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRole = async () => {
      try {
        setLoading(true);
        const res = await api.get('/employee/my-role');
        if (res.data) {
          setRoleData(res.data);
        }
      } catch (err) {
        console.error('Failed to load role details:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRole();
  }, []);

  if (loading && !roleData) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const assignedRoles = roleData?.roles || [];
  const assignedDepts = roleData?.assigned_departments || (roleData?.department ? [roleData.department] : []);
  const assignedModules = roleData?.assigned_modules || [];

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fadeIn pb-12">
      {/* Header Banner */}
      <div className="p-7 bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 text-white rounded-3xl shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 border border-white/10">
        <div className="space-y-2">
          <span className="px-3 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] font-extrabold uppercase tracking-wider text-purple-300 inline-block">
            Official Multi-Role & Permissions Matrix
          </span>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight">
            {roleData?.employee_name}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300">
            {roleData?.designation} • <span className="text-sky-300 font-semibold">{roleData?.department}</span>
          </p>
        </div>

        <div className="px-4 py-2 bg-white/10 border border-white/20 rounded-2xl text-center shrink-0">
          <div className="text-[10px] uppercase font-bold text-purple-200">Level</div>
          <div className="text-base font-black text-white">{roleData?.level || 'Intern'}</div>
        </div>
      </div>

      {/* ─── 1. ASSIGNED MULTIPLE ROLES ─── */}
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl p-6 sm:p-7 shadow-xs space-y-4 transition-colors">
        <div className="flex items-center gap-2 text-[var(--text-primary)] font-black text-sm">
          <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <span>Assigned Functional Roles ({assignedRoles.length})</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {assignedRoles.map((r: any) => (
            <div
              key={r.id || r.title}
              className="p-4 bg-purple-50/40 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/50 rounded-2xl space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <div className="font-extrabold text-xs text-[var(--text-primary)]">{r.title}</div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-600 text-white">
                  {r.level}
                </span>
              </div>
              <div className="text-[11px] text-purple-700 dark:text-purple-300 font-semibold flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5" />
                <span>Department: {r.department}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── 2. DEPARTMENT & MODULE ACCESS MATRIX ─── */}
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl p-6 sm:p-7 shadow-xs space-y-4 transition-colors">
        <div className="flex items-center gap-2 text-[var(--text-primary)] font-black text-sm">
          <Layers className="w-5 h-5 text-sky-600 dark:text-sky-400" />
          <span>Departmental Scope & Authorized Modules</span>
        </div>

        <div className="space-y-3">
          {/* Departments */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
              Authorized Departments:
            </div>
            <div className="flex flex-wrap gap-2">
              {assignedDepts.map((d: string) => (
                <span
                  key={d}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-sky-50 dark:bg-sky-950/50 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800 flex items-center gap-1.5"
                >
                  <Building2 className="w-3.5 h-3.5 text-sky-600" />
                  <span>{d}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Modules */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
              Unlocked Operational Modules (Google Sheets Matrix):
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {assignedModules.length > 0 ? (
                assignedModules.map((m: string) => (
                  <div
                    key={m}
                    className="p-3 bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-2.5 text-xs font-bold text-emerald-900 dark:text-emerald-200"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{m}</span>
                  </div>
                ))
              ) : (
                <div className="text-xs text-[var(--text-muted)] italic">
                  Standard access enabled for your department.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── 3. CORE RESPONSIBILITIES ─── */}
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl p-6 sm:p-7 shadow-xs space-y-4 transition-colors">
        <div className="flex items-center gap-2 text-[var(--text-primary)] font-black text-sm">
          <Award className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <span>Core Operational Responsibilities</span>
        </div>

        <div className="p-5 bg-slate-50 dark:bg-slate-800/40 border border-[var(--card-border)] rounded-2xl">
          <div className="text-xs text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed font-medium">
            {roleData?.responsibilities || 'Execute assigned operational workflows, development tasks, and deliver daily progress updates.'}
          </div>
        </div>
      </div>

      {/* ─── 4. GRANTED PERMISSIONS ─── */}
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl p-6 sm:p-7 shadow-xs space-y-4 transition-colors">
        <div className="flex items-center gap-2 text-[var(--text-primary)] font-black text-sm">
          <Lock className="w-5 h-5 text-sky-600 dark:text-sky-400" />
          <span>Granted System Capabilities & Permissions</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {roleData?.permissions?.map((perm: string) => (
            <div
              key={perm}
              className="p-3.5 bg-[var(--hover-bg)] border border-[var(--card-border)] rounded-xl flex items-center gap-2.5 text-xs font-semibold text-[var(--text-primary)]"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="capitalize">{perm.replace(/_/g, ' ')}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Profile Meta */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        <div className="p-4 bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] space-y-1">
          <div className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Technical Skills</div>
          <div className="font-bold text-[var(--text-primary)]">{roleData?.skills || 'Full Stack & Automation'}</div>
        </div>

        <div className="p-4 bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] space-y-1">
          <div className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Joining Date</div>
          <div className="font-bold text-[var(--text-primary)]">{roleData?.joining_date || 'Active Member'}</div>
        </div>
      </div>
    </div>
  );
}
