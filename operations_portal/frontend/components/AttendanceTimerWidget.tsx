'use client';

import React, { useState, useEffect } from 'react';
import {
  Clock,
  Play,
  Square,
  CheckCircle2,
  AlertCircle,
  Building,
  Home,
  RefreshCw,
  Sparkles,
  CalendarCheck
} from 'lucide-react';
import { api } from '@/lib/api';

export function AttendanceTimerWidget({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [workMode, setWorkMode] = useState('Office');
  const [notes, setNotes] = useState('');
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const fetchToday = async () => {
    try {
      setLoading(true);
      const res = await api.get('/attendance/today');
      if (res.data) {
        setData(res.data);
        setElapsedSeconds(res.data.elapsed_seconds || 0);
        if (res.data.work_mode) setWorkMode(res.data.work_mode);
      }
    } catch (err) {
      // Ignore or log quietly
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchToday();
  }, []);

  // Live timer tick every 1 second when checked in
  useEffect(() => {
    if (!data?.is_checked_in) return;
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [data?.is_checked_in]);

  const formatTimer = (totalSecs: number) => {
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleCheckIn = async () => {
    setErrorBanner(null);
    try {
      setActionLoading(true);
      const res = await api.post('/attendance/check-in', {
        work_mode: workMode,
        notes,
      });
      if (res.data?.success) {
        fetchToday();
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to check in.';
      setErrorBanner(msg);
      alert(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!confirm('Are you sure you want to Check Out and conclude your shift for today? Note: Once checked out, your attendance is finalized for the day.')) return;
    setErrorBanner(null);
    try {
      setActionLoading(true);
      const res = await api.post('/attendance/check-out', {
        notes,
      });
      if (res.data?.success) {
        fetchToday();
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to check out.';
      setErrorBanner(msg);
      alert(msg);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[var(--hover-bg)] text-[10px] text-[var(--text-muted)] animate-pulse">
        <Clock className="w-3 h-3" />
        <span className="hidden sm:inline">Loading attendance...</span>
      </div>
    );
  }

  const isCheckedIn = data?.is_checked_in;
  const isCompleted = data?.status === 'Completed';

  // Compact Version for Navbar Header
  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        {isCheckedIn ? (
          <div className="flex items-center gap-1.5 p-1 pl-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-[10px] sm:text-xs shadow-xs">
            <span className="flex h-1.5 w-1.5 sm:h-2 sm:w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-full w-full bg-emerald-500"></span>
            </span>
            <span className="font-mono font-black">{formatTimer(elapsedSeconds)}</span>
            <button
              onClick={handleCheckOut}
              disabled={actionLoading}
              title="Check Out"
              className="px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-lg bg-red-500 hover:bg-red-600 text-white font-bold text-[9px] sm:text-[10px] transition cursor-pointer flex items-center gap-0.5 active:scale-95"
            >
              <Square className="w-2 h-2 fill-current" />
              <span>Out</span>
            </button>
          </div>
        ) : isCompleted ? (
          <div className="flex items-center gap-1 px-2 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-[10px] sm:text-xs font-bold whitespace-nowrap">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            <span className="hidden sm:inline">Shift Done ({data.total_hours}h)</span>
            <span className="sm:hidden">{data.total_hours}h Done</span>
          </div>
        ) : (
          <button
            onClick={handleCheckIn}
            disabled={actionLoading}
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-[10px] sm:text-xs shadow-xs transition cursor-pointer active:scale-95"
          >
            <Play className="w-2.5 h-2.5 fill-current" />
            <span>Check In</span>
          </button>
        )}
      </div>
    );
  }

  // Full Rich Attendance Card Component for Dashboard
  return (
    <div className="p-4 sm:p-6 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl sm:rounded-3xl shadow-xs space-y-3 sm:space-y-4 transition-colors relative overflow-hidden">
      
      {/* Background Subtle Accent Glow */}
      <div className={`absolute top-0 right-0 w-48 h-48 rounded-full blur-3xl pointer-events-none ${
        isCheckedIn ? 'bg-emerald-500/10' : isCompleted ? 'bg-sky-500/10' : 'bg-slate-500/5'
      }`} />

      {/* Header */}
      <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2 relative z-10">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center shrink-0 ${
            isCheckedIn
              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
              : isCompleted
              ? 'bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
          }`}>
            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-black text-[var(--text-primary)]">Daily Attendance & Work Shift</h3>
            <p className="text-[10px] sm:text-[11px] text-[var(--text-secondary)]">Single-shift logging per working day</p>
          </div>
        </div>

        {/* Status Badge */}
        <div className={`self-start xs:self-auto px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold flex items-center gap-1.5 border shrink-0 ${
          isCheckedIn
            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
            : isCompleted
            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${
            isCheckedIn ? 'bg-emerald-500 animate-ping' : isCompleted ? 'bg-emerald-500' : 'bg-slate-400'
          }`} />
          <span>{isCompleted ? 'Shift Completed' : isCheckedIn ? 'Currently Working' : 'Not Checked In'}</span>
        </div>
      </div>

      {/* Error / Alert notice */}
      {errorBanner && (
        <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-[11px] font-semibold flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{errorBanner}</span>
        </div>
      )}

      {/* Center Live Timer & Details */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4 items-center pt-1 relative z-10">
        
        {/* Digital Stopwatch Display */}
        <div className="sm:col-span-6 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-center sm:text-left space-y-0.5 sm:space-y-1">
          <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center justify-center sm:justify-start gap-1">
            <span>{isCompleted ? 'Total Shift Logged Today' : 'Current Shift Duration'}</span>
          </div>
          <div className="text-2xl sm:text-4xl font-black font-mono tracking-tight text-[var(--text-primary)]">
            {isCompleted ? `${data?.total_hours} hrs` : formatTimer(elapsedSeconds)}
          </div>
          <div className="text-[10px] sm:text-[11px] text-[var(--text-secondary)] font-medium truncate">
            {isCheckedIn
              ? `Checked In at ${data?.check_in_time} • ${data?.work_mode}`
              : isCompleted
              ? `Completed: ${data?.check_in_time} to ${data?.check_out_time} (${data?.work_mode})`
              : 'Clock in to start recording today\'s work shift'}
          </div>
        </div>

        {/* Action Panel: Checked Out (Completed) vs Checked In vs Not Checked In */}
        <div className="sm:col-span-6 flex flex-col justify-center gap-2">
          {isCompleted ? (
            /* Completed state: Cannot check in again today */
            <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 space-y-1 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs font-black text-emerald-800 dark:text-emerald-300">
                <CalendarCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Attendance Finalized for Today</span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-emerald-700 dark:text-emerald-400 font-medium leading-relaxed">
                You have concluded your shift for today ({data?.total_hours} hrs recorded). You can check in again on your next working day.
              </p>
            </div>
          ) : isCheckedIn ? (
            /* Checked in state: Can check out */
            <div className="space-y-2">
              <div className="text-[10px] sm:text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center justify-center sm:justify-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Shift is actively recording. Click below when leaving.</span>
              </div>
              <button
                type="button"
                onClick={handleCheckOut}
                disabled={actionLoading}
                className="w-full py-2.5 sm:py-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
              >
                {actionLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>Check Out & Conclude Shift</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            /* Not checked in yet: Can check in */
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setWorkMode('Office')}
                  className={`flex-1 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                    workMode === 'Office'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <Building className="w-3 h-3" />
                  <span>In Office</span>
                </button>
                <button
                  type="button"
                  onClick={() => setWorkMode('Remote')}
                  className={`flex-1 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                    workMode === 'Remote'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <Home className="w-3 h-3" />
                  <span>Remote / WFH</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleCheckIn}
                disabled={actionLoading}
                className="w-full py-2.5 sm:py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
              >
                {actionLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Play className="w-3 h-3 fill-current" />
                    <span>Check In Now</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
