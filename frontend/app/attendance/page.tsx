'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Calendar, Clock, CheckCircle, CalendarCheck, XCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function AttendancePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        setLoading(true);
        const res = await api.get('/attendance');
        setData(res.data);
      } catch (err) {
        console.error('Error fetching attendance logs:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAttendance();
  }, []);

  const [cachedUser, setCachedUser] = useState<any>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('fret_user');
      if (saved) setCachedUser(JSON.parse(saved));
    } catch (e) {}
  }, []);

  const employee = data?.employee || cachedUser || {};
  const records = data?.records || [];

  return (
    <div className="flex min-h-screen bg-[var(--bg)] text-[var(--text)] font-sans">
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
          title="My Attendance Logs" 
          onMenuClick={() => setMobileOpen(prev => !prev)}
        />

        <main className="p-4 sm:p-8 flex-1 overflow-y-auto space-y-6 max-w-7xl mx-auto w-full">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <Link href="/employee-dashboard" className="text-xs font-bold text-[var(--accent)] hover:underline flex items-center gap-1">
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Dashboard</span>
                </Link>
              </div>
              <h1 className="text-2xl font-extrabold text-[var(--text)] tracking-tight font-['Plus_Jakarta_Sans']">
                Personal Attendance Logs
              </h1>
              <p className="text-[var(--text3)] text-sm mt-0.5">Review your complete check-in history and work logs</p>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="stat-card p-5">
              <div className="stat-label">Present Days</div>
              <div className="stat-value text-emerald-600">{data?.present_days ?? 0}</div>
              <div className="stat-change text-xs text-[var(--text3)]">Total days present</div>
            </div>

            <div className="stat-card p-5">
              <div className="stat-label">Absent Days</div>
              <div className="stat-value text-rose-500">{data?.absent_days ?? 0}</div>
              <div className="stat-change text-xs text-[var(--text3)]">Unaccounted absences</div>
            </div>

            <div className="stat-card p-5">
              <div className="stat-label">Attendance Rate</div>
              <div className="stat-value text-[var(--accent)]">{data?.attendance_percentage ?? 96}%</div>
              <div className="stat-change text-xs text-[var(--text3)]">Current standing</div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-sm space-y-4">
            <div className="table-wrapper overflow-x-auto rounded-xl border border-[var(--border)]">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--bg)] border-b border-[var(--border)]">
                  <tr>
                    <th className="py-3.5 px-4 text-xs font-bold uppercase tracking-wider text-[var(--text3)]">Date</th>
                    <th className="py-3.5 px-4 text-xs font-bold uppercase tracking-wider text-[var(--text3)]">Check In</th>
                    <th className="py-3.5 px-4 text-xs font-bold uppercase tracking-wider text-[var(--text3)]">Check Out</th>
                    <th className="py-3.5 px-4 text-xs font-bold uppercase tracking-wider text-[var(--text3)]">Working Hours</th>
                    <th className="py-3.5 px-4 text-xs font-bold uppercase tracking-wider text-[var(--text3)] text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] bg-[var(--surface)]">
                  {records.length > 0 ? (
                    records.map((r: any) => (
                      <tr key={r.id} className="hover:bg-[var(--hover)] transition">
                        <td className="py-4 px-4 font-semibold font-mono text-xs text-[var(--text)]">{r.date}</td>
                        <td className="py-4 px-4 font-mono text-emerald-600 font-bold text-xs">{r.check_in}</td>
                        <td className="py-4 px-4 font-mono text-blue-600 font-bold text-xs">{r.check_out}</td>
                        <td className="py-4 px-4 font-mono text-xs font-bold text-[var(--text2)]">{r.worked_duration || '--'}</td>
                        <td className="py-4 px-4 text-right">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${
                            r.status === 'Present'
                              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                          }`}>
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-[var(--text3)] text-sm">
                        No attendance records recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
