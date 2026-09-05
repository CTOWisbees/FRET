'use client';

import React, { useState, useEffect } from 'react';
import {
  Award,
  Lock,
  CheckCircle2
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

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fadeIn">
      {/* Header Banner */}
      <div className="p-7 bg-gradient-to-r from-slate-900 via-purple-950 to-indigo-950 text-white rounded-3xl shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 border border-white/10">
        <div className="space-y-2">
          <span className="px-3 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] font-extrabold uppercase tracking-wider text-purple-300 inline-block">
            Official Role Scope
          </span>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight">
            {roleData?.role_title || 'Operations Team Member'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300">
            Assigned to <span className="font-bold text-white">{roleData?.employee_name}</span> in the <span className="text-sky-300 font-semibold">{roleData?.department}</span> department.
          </p>
        </div>

        <div className="px-4 py-2 bg-white/10 border border-white/20 rounded-2xl text-center">
          <div className="text-[10px] uppercase font-bold text-purple-200">Level</div>
          <div className="text-base font-black text-white">{roleData?.level || 'Intern'}</div>
        </div>
      </div>

      {/* Role Details Card */}
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl p-6 sm:p-7 shadow-xs space-y-6 transition-colors">
        {/* Responsibilities */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[var(--text-primary)] font-black text-sm">
            <Award className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <span>Assigned Core Responsibilities</span>
          </div>

          <div className="p-5 bg-purple-50/40 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/50 rounded-2xl">
            <div className="text-xs text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed font-medium">
              {roleData?.responsibilities || 'Execute and maintain assigned operational workflows, feature modules, and deliver daily progress updates.'}
            </div>
          </div>
        </div>

        {/* Permissions Scope */}
        <div className="space-y-3 pt-2">
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

        {/* Skills & Profile Meta */}
        <div className="pt-4 border-t border-[var(--card-border)] grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-4 bg-[var(--hover-bg)] rounded-2xl border border-[var(--card-border)] space-y-1">
            <div className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Technical Skills</div>
            <div className="font-bold text-[var(--text-primary)]">{roleData?.skills || 'Full Stack & Automation'}</div>
          </div>

          <div className="p-4 bg-[var(--hover-bg)] rounded-2xl border border-[var(--card-border)] space-y-1">
            <div className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Joining Date</div>
            <div className="font-bold text-[var(--text-primary)]">{roleData?.joining_date || 'Active Member'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
