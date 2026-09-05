'use client';

import React, { useState, useEffect } from 'react';
import {
  Clock,
  PlusCircle,
  ExternalLink,
  Send,
  X,
  RefreshCw,
  Calendar,
  CheckCircle2,
  Building,
  Home,
  FileText,
  UserCheck
} from 'lucide-react';
import { api } from '@/lib/api';
import { AttendanceTimerWidget } from '@/components/AttendanceTimerWidget';

export default function EmployeeWorkLogsPage() {
  const [activeTab, setActiveTab] = useState<'work_logs' | 'attendance'>('attendance');
  const [logs, setLogs] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showLogModal, setShowLogModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form State
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [hoursSpent, setHoursSpent] = useState('2.0');
  const [workSummary, setWorkSummary] = useState('');
  const [submissionLink, setSubmissionLink] = useState('');

  const showAlert = (text: string, type: 'success' | 'error' = 'success') => {
    setAlertMsg({ type, text });
    setTimeout(() => setAlertMsg(null), 4000);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [logsRes, tasksRes, attRes] = await Promise.all([
        api.get('/employee/work-logs'),
        api.get('/employee/tasks'),
        api.get('/attendance/history'),
      ]);
      if (logsRes.data?.logs) setLogs(logsRes.data.logs);
      if (tasksRes.data?.tasks) setTasks(tasksRes.data.tasks);
      if (attRes.data?.records) {
        setAttendanceRecords(attRes.data.records);
        setAttendanceSummary(attRes.data.summary);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskId || !workSummary) {
      showAlert('Please select a task and enter a work summary.', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post('/employee/work-logs', {
        task_id: Number(selectedTaskId),
        hours_spent: Number(hoursSpent) || 0,
        work_summary: workSummary,
        submission_link: submissionLink,
      });

      if (res.data?.success) {
        showAlert('Work log recorded successfully!');
        setShowLogModal(false);
        setWorkSummary('');
        setSubmissionLink('');
        fetchData();
      }
    } catch (err: any) {
      showAlert(err.response?.data?.error || 'Failed to submit work log.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const totalHours = logs.reduce((acc, curr) => acc + (curr.hours_spent || 0), 0);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Live Shift Timer Widget */}
      <AttendanceTimerWidget />

      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2">
        <div className="space-y-1">
          <h2 className="text-xl font-black text-[var(--text-primary)] tracking-tight">
            Attendance & Work Logs
          </h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Check in/out shifts, view daily attendance history, and record task deliverable logs.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-[var(--card-border)]">
          <button
            onClick={() => setActiveTab('attendance')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'attendance'
                ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Attendance Records</span>
          </button>

          <button
            onClick={() => setActiveTab('work_logs')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'work_logs'
                ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-300 shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Task Work Logs</span>
          </button>
        </div>
      </div>

      {/* Alert Banner */}
      {alertMsg && (
        <div className={`p-4 rounded-2xl text-xs font-bold border flex items-center justify-between ${
          alertMsg.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
            : 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800'
        }`}>
          <span>{alertMsg.text}</span>
          <button onClick={() => setAlertMsg(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ─── 1. ATTENDANCE RECORDS VIEW ─── */}
      {activeTab === 'attendance' && (
        <div className="space-y-4">
          {/* Summary Stat Cards */}
          {attendanceSummary && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-4 rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] shadow-xs">
                <div className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Days Present</div>
                <div className="text-xl font-black text-[var(--text-primary)] mt-0.5">
                  {attendanceSummary.total_days_logged} Days
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] shadow-xs">
                <div className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Total Hours Worked</div>
                <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {attendanceSummary.total_hours} hrs
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] shadow-xs">
                <div className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Avg Daily Shift</div>
                <div className="text-xl font-black text-sky-600 dark:text-sky-400 mt-0.5">
                  {attendanceSummary.avg_daily_hours} hrs/day
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] shadow-xs">
                <div className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Completed Shifts</div>
                <div className="text-xl font-black text-purple-600 dark:text-purple-400 mt-0.5">
                  {attendanceSummary.completed_shifts} Shifts
                </div>
              </div>
            </div>
          )}

          {/* Attendance Table */}
          <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl overflow-hidden shadow-xs transition-colors">
            <div className="px-6 py-4 border-b border-[var(--card-border)] flex items-center justify-between">
              <h3 className="text-sm font-black text-[var(--text-primary)]">Daily Attendance Log History</h3>
              <span className="text-[11px] font-semibold text-[var(--text-muted)]">Past 30 Days</span>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--hover-bg)] border-b border-[var(--card-border)] text-[var(--text-muted)] uppercase tracking-wider font-bold text-[10px]">
                <tr>
                  <th className="py-4 px-6">Date & Day</th>
                  <th className="py-4 px-6">Check In</th>
                  <th className="py-4 px-6">Check Out</th>
                  <th className="py-4 px-6">Work Mode</th>
                  <th className="py-4 px-6">Total Hours</th>
                  <th className="py-4 px-6 text-right">Shift Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--card-border)]">
                {attendanceRecords.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-[var(--text-muted)]">
                      No attendance records logged yet. Check in above to start your first shift!
                    </td>
                  </tr>
                ) : (
                  attendanceRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-[var(--hover-bg)] transition">
                      <td className="py-4 px-6 font-bold text-[var(--text-primary)]">
                        <div>{r.date}</div>
                        <div className="text-[10px] text-[var(--text-muted)] font-medium">{r.day}</div>
                      </td>
                      <td className="py-4 px-6 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {r.check_in}
                      </td>
                      <td className="py-4 px-6 font-mono font-bold text-slate-700 dark:text-slate-300">
                        {r.check_out}
                      </td>
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {r.work_mode === 'Remote' ? <Home className="w-3 h-3" /> : <Building className="w-3 h-3" />}
                          <span>{r.work_mode}</span>
                        </span>
                      </td>
                      <td className="py-4 px-6 font-black text-sky-600 dark:text-sky-400 font-mono">
                        {r.total_hours > 0 ? `${r.total_hours} hrs` : 'In Progress'}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                          r.status === 'Completed'
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                            : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${r.status === 'Completed' ? 'bg-emerald-500' : 'bg-blue-500 animate-pulse'}`} />
                          <span>{r.status}</span>
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── 2. WORK LOGS TABLE VIEW ─── */}
      {activeTab === 'work_logs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="px-3.5 py-2 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 rounded-2xl text-xs font-bold flex items-center gap-1.5 shadow-2xs">
              <Clock className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              <span>Total Task Hours: {totalHours.toFixed(1)} hrs</span>
            </div>

            <button
              onClick={() => {
                setSelectedTaskId(tasks[0]?.id ? String(tasks[0].id) : '');
                setShowLogModal(true);
              }}
              className="px-4 py-2.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white rounded-2xl text-xs font-bold shadow-md transition flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Record Daily Log</span>
            </button>
          </div>

          <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl overflow-hidden shadow-xs transition-colors">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--hover-bg)] border-b border-[var(--card-border)] text-[var(--text-muted)] uppercase tracking-wider font-bold text-[10px]">
                <tr>
                  <th className="py-4 px-6">Task Title</th>
                  <th className="py-4 px-6">Work Summary</th>
                  <th className="py-4 px-6">Hours Spent</th>
                  <th className="py-4 px-6">Deliverable Link</th>
                  <th className="py-4 px-6 text-right">Logged At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--card-border)]">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-[var(--text-muted)]">
                      No task work logs submitted yet. Click &quot;Record Daily Log&quot; to log your first update!
                    </td>
                  </tr>
                ) : (
                  logs.map((l) => (
                    <tr key={l.id} className="hover:bg-[var(--hover-bg)] transition">
                      <td className="py-4 px-6 font-bold text-[var(--text-primary)]">
                        {l.task_title}
                      </td>
                      <td className="py-4 px-6 text-[var(--text-secondary)] font-medium max-w-md">
                        {l.work_summary}
                      </td>
                      <td className="py-4 px-6 font-bold text-sky-600 dark:text-sky-400">
                        {l.hours_spent} hrs
                      </td>
                      <td className="py-4 px-6">
                        {l.submission_link ? (
                          <a
                            href={l.submission_link}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-sky-500 hover:underline font-bold"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Link</span>
                          </a>
                        ) : (
                          <span className="text-[var(--text-muted)]">—</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right text-[var(--text-muted)] font-medium">
                        {l.created_at}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── LOG MODAL ─── */}
      {showLogModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--text-primary)] rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl space-y-5 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--card-border)]">
              <h3 className="text-lg font-black text-[var(--text-primary)]">Submit Daily Progress Log</h3>
              <button onClick={() => setShowLogModal(false)} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateLog} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                  Associated Task Deliverable
                </label>
                <select
                  required
                  value={selectedTaskId}
                  onChange={(e) => setSelectedTaskId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl font-semibold text-[var(--text-primary)] focus:outline-none focus:border-sky-500"
                >
                  <option value="">-- Select Task --</option>
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} ({t.status})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                  Hours Spent Today
                </label>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={hoursSpent}
                  onChange={(e) => setHoursSpent(e.target.value)}
                  placeholder="e.g. 3.5"
                  className="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl font-semibold text-[var(--text-primary)] focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                  Summary of Completed Work & Progress
                </label>
                <textarea
                  rows={3}
                  required
                  value={workSummary}
                  onChange={(e) => setWorkSummary(e.target.value)}
                  placeholder="Detailed description of what you designed, coded, or accomplished today..."
                  className="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl font-medium text-[var(--text-primary)] focus:outline-none focus:border-sky-500"
                ></textarea>
              </div>

              <div>
                <label className="block font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                  Deliverable / PR / Figma Link (Optional)
                </label>
                <input
                  type="url"
                  value={submissionLink}
                  onChange={(e) => setSubmissionLink(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl font-medium text-[var(--text-primary)] focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--card-border)]">
                <button
                  type="button"
                  onClick={() => setShowLogModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-[var(--card-border)] text-[var(--text-secondary)] font-bold hover:bg-[var(--hover-bg)] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white rounded-xl font-bold shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span>Save Work Log</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
