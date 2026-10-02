'use client';

import React, { useState, useEffect } from 'react';
import { 
  ClipboardCheck, Plus, Trash2, Star, Save, Send, Lock, Unlock, 
  ChevronLeft, ChevronRight, Calendar, Info, Clock, CheckCircle2, 
  AlertCircle, Building2, User, Hash, X, Sparkles, Flame, Trophy,
  Award, Zap, Shield, Flag, Check, ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import { api, getOpsBaseUrl } from '@/lib/api';

interface TaskRow {
  id?: number | string;
  assigned_task_id?: number | null;
  is_flagged?: boolean;
  flag_reason?: string;
  task_description: string;
  task_type: string;
  hours_worked: number;
  is_achievement: boolean;
  remarks: string;
}

export default function EmployeeDailyTrackerPage() {
  const [employee, setEmployee] = useState<any>(null);
  const [currentDate, setCurrentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [trackerDay, setTrackerDay] = useState<any>(null);
  const [tasks, setTasks] = useState<TaskRow[]>([
    { task_description: '', task_type: 'Major', hours_worked: 0, is_achievement: false, remarks: '', assigned_task_id: null, is_flagged: false, flag_reason: '' }
  ]);
  const [assignedTasks, setAssignedTasks] = useState<any[]>([]);
  const [dayStatus, setDayStatus] = useState<string>('Working Day');
  const [dayNumber, setDayNumber] = useState<number>(1);
  const [status, setStatus] = useState<string>('Draft');
  const [taskTypes, setTaskTypes] = useState<string[]>(['Major', 'Minor', 'Research', 'Documentation', 'Meeting', 'Support']);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockReason, setUnlockReason] = useState('');
  const [pendingUnlock, setPendingUnlock] = useState<any>(null);
  const [heatmap, setHeatmap] = useState<any>(null);
  const [hoveredDay, setHoveredDay] = useState<any>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const fetchTracker = async (dateStr: string) => {
    setLoading(true);
    setMessage(null);
    try {
      // Get current user profile
      const userRes = await api.get('/auth/me');
      if (userRes.data?.user) {
        setEmployee(userRes.data.user);
      }

      const res = await api.get(`/tracker/daily?date=${dateStr}`);
      if (res.data) {
        setTrackerDay(res.data);
        if (!employee && res.data.employee_name) {
          setEmployee({
            name: res.data.employee_name,
            emp_type: res.data.emp_type || 'Normal',
            id: res.data.employee_id || res.data.user_id,
            department: res.data.department || '',
            designation: res.data.designation || ''
          });
        }
        setDayStatus(res.data.day_status || 'Working Day');
        setDayNumber(res.data.day_number || 1);
        setStatus(res.data.status || 'Draft');
        setPendingUnlock(res.data.pending_unlock || null);
        setHeatmap(res.data.heatmap || null);
        setAssignedTasks(res.data.assigned_tasks || []);
        if (res.data.task_types && Array.isArray(res.data.task_types)) {
          setTaskTypes(res.data.task_types);
        }

        if (res.data.tasks && res.data.tasks.length > 0) {
          setTasks(res.data.tasks.map((t: any) => ({
            id: t.id,
            assigned_task_id: t.assigned_task_id || null,
            is_flagged: Boolean(t.is_flagged),
            flag_reason: t.flag_reason || '',
            task_description: t.task_description || '',
            task_type: t.task_type || 'Major',
            hours_worked: Number(t.hours_worked) || 0,
            is_achievement: Boolean(t.is_achievement),
            remarks: t.remarks || ''
          })));
        } else {
          setTasks([
            { task_description: '', task_type: 'Major', hours_worked: 0, is_achievement: false, remarks: '', assigned_task_id: null, is_flagged: false, flag_reason: '' }
          ]);
        }
      }
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: 'Failed to load tracker for this date.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTracker(currentDate);
  }, [currentDate]);

  const changeDateByDays = (delta: number) => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + delta);
    setCurrentDate(d.toISOString().split('T')[0]);
  };

  const handleTaskChange = (index: number, field: keyof TaskRow, value: any) => {
    const updated = [...tasks];
    updated[index] = { ...updated[index], [field]: value };
    setTasks(updated);
  };

  const handleSelectAssignedTask = (rowIndex: number, assignedTaskIdStr: string) => {
    if (!assignedTaskIdStr) {
      handleTaskChange(rowIndex, 'assigned_task_id', null);
      return;
    }
    const selected = assignedTasks.find(a => a.id === Number(assignedTaskIdStr));
    if (!selected) return;

    const updated = [...tasks];
    updated[rowIndex] = {
      ...updated[rowIndex],
      assigned_task_id: selected.id,
      task_description: selected.title + (selected.description ? ` (${selected.description})` : ''),
      task_type: selected.task_type || updated[rowIndex].task_type,
      is_flagged: Boolean(selected.is_flagged),
      flag_reason: selected.flag_reason || ''
    };
    setTasks(updated);
  };

  const handleAddAssignedTaskRow = (assignedTask: any) => {
    const existing = tasks.find(t => t.assigned_task_id === assignedTask.id);
    if (existing) {
      setMessage({ type: 'error', text: 'This assigned task is already in your daily log list.' });
      return;
    }

    const newTaskRow: TaskRow = {
      assigned_task_id: assignedTask.id,
      task_description: assignedTask.title + (assignedTask.description ? ` (${assignedTask.description})` : ''),
      task_type: assignedTask.task_type || 'Major',
      hours_worked: 0,
      is_achievement: false,
      remarks: '',
      is_flagged: Boolean(assignedTask.is_flagged),
      flag_reason: assignedTask.flag_reason || ''
    };

    if (tasks.length === 1 && !tasks[0].task_description.trim() && tasks[0].hours_worked === 0) {
      setTasks([newTaskRow]);
    } else {
      setTasks([...tasks, newTaskRow]);
    }
  };

  const addTaskRow = () => {
    setTasks([
      ...tasks,
      { task_description: '', task_type: 'Major', hours_worked: 0, is_achievement: false, remarks: '', assigned_task_id: null, is_flagged: false, flag_reason: '' }
    ]);
  };

  const removeTaskRow = (index: number) => {
    if (tasks.length === 1) {
      setTasks([
        { task_description: '', task_type: 'Major', hours_worked: 0, is_achievement: false, remarks: '', assigned_task_id: null, is_flagged: false, flag_reason: '' }
      ]);
      return;
    }
    setTasks(tasks.filter((_, i) => i !== index));
  };

  const totalHours = tasks.reduce((acc, t) => acc + (Number(t.hours_worked) || 0), 0);
  const achievementsCount = tasks.filter(t => t.is_achievement).length;
  const isLocked = status === 'Locked';
  const isSubmitted = status === 'Submitted';

  const handleSave = async (actionType: 'draft' | 'submit') => {
    setSaving(true);
    setMessage(null);

    // Frontend validations for Submit
    if (actionType === 'submit') {
      if (dayStatus === 'Working Day') {
        if (tasks.length === 0 || !tasks.some(t => t.task_description.trim().length > 0)) {
          setMessage({ type: 'error', text: 'Please add at least one task description before submitting.' });
          setSaving(false);
          return;
        }

        const emptyTask = tasks.find(t => t.task_description.trim().length > 0 && (!t.hours_worked || t.hours_worked <= 0));
        if (emptyTask) {
          setMessage({ type: 'error', text: 'All active tasks must have logged hours (> 0).' });
          setSaving(false);
          return;
        }

        if (totalHours <= 0) {
          setMessage({ type: 'error', text: 'Total hours logged must be greater than 0.' });
          setSaving(false);
          return;
        }
      }
    }

    try {
      const payload = {
        date: currentDate,
        day_status: dayStatus,
        day_number: dayNumber,
        action: actionType,
        tasks: tasks
          .filter(t => t.task_description.trim().length > 0 || t.hours_worked > 0)
          .map(t => ({
            id: t.id,
            assigned_task_id: t.assigned_task_id || null,
            task_description: t.task_description,
            task_type: t.task_type,
            hours_worked: Number(t.hours_worked) || 0,
            is_achievement: t.is_achievement,
            remarks: t.remarks
          }))
      };

      const res = await api.post('/tracker/daily/save', payload);
      if (res.data && res.data.success !== false) {
        setMessage({ 
          type: 'success', 
          text: `Daily Tracker successfully ${actionType === 'submit' ? 'submitted' : 'saved as draft'}!` 
        });
        await fetchTracker(currentDate);
      } else {
        setMessage({ type: 'error', text: res.data?.error || 'Failed to save tracker.' });
      }
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to save tracker.' });
    } finally {
      setSaving(false);
    }
  };

  const handleRequestUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockReason.trim()) return;

    try {
      const res = await api.post('/tracker/daily/request-unlock', {
        date: currentDate,
        reason: unlockReason
      });
      if (res.data && res.data.success !== false) {
        setMessage({ type: 'success', text: 'Unlock request submitted successfully to Manager/HR.' });
        setShowUnlockModal(false);
        setUnlockReason('');
        await fetchTracker(currentDate);
      } else {
        setMessage({ type: 'error', text: res.data?.error || 'Failed to submit unlock request.' });
      }
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to submit unlock request.' });
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header Banner */}
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black text-xl">
            <ClipboardCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-[var(--text-primary)]">
              Daily Work Tracker
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-muted)]">
              Operations Portal • Log your daily tasks, achievements, and time
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowInfoModal(true)}
            className="px-3.5 py-2 rounded-xl border border-[var(--card-border)] text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--card-border)]/20 transition flex items-center gap-2 cursor-pointer"
          >
            <Info className="w-4 h-4 text-sky-500" />
            <span>Guidelines</span>
          </button>
        </div>
      </div>

      {/* Profile & Date Selector Row */}
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          {/* Employee Badge */}
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-base shadow-sm">
              {employee?.name ? employee.name[0].toUpperCase() : 'U'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-[var(--text-primary)]">{employee?.name || 'Operations Team Member'}</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/10 text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                  {employee?.emp_type || 'Intern'}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] mt-0.5">
                <span className="flex items-center gap-1 font-mono">
                  <User className="w-3.5 h-3.5 text-emerald-500" /> {employee?.emp_code || `EMP${employee?.id || ''}`}
                </span>
                {employee?.department && (
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-emerald-500" /> {employee.department}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Date Picker Nav */}
          <div className="flex items-center gap-2 bg-[var(--sidebar-bg)] p-1.5 rounded-2xl border border-[var(--card-border)]">
            <button
              onClick={() => changeDateByDays(-1)}
              className="p-2 rounded-xl hover:bg-[var(--card-bg)] text-[var(--text-secondary)] transition cursor-pointer"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 px-2">
              <Calendar className="w-4 h-4 text-emerald-500" />
              <input
                type="date"
                value={currentDate}
                onChange={(e) => setCurrentDate(e.target.value)}
                className="bg-transparent text-xs font-black text-[var(--text-primary)] focus:outline-none cursor-pointer"
              />
            </div>

            <button
              onClick={() => changeDateByDays(1)}
              className="p-2 rounded-xl hover:bg-[var(--card-bg)] text-[var(--text-secondary)] transition cursor-pointer"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Day Status & Current State Badge */}
          <div className="flex items-center gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                Day Status
              </label>
              <select
                disabled={isLocked}
                value={dayStatus}
                onChange={(e) => setDayStatus(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] text-xs font-bold text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60 cursor-pointer"
              >
                <option value="Working Day">💼 Working Day</option>
                <option value="Weekly Off">🏖️ Weekly Off</option>
                <option value="Holiday">🎉 Holiday</option>
                <option value="Leave">🌴 Leave</option>
                <option value="Sick Leave">🤒 Sick Leave</option>
                <option value="Other">📝 Other</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                Status
              </label>
              <span className={`inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider ${
                status === 'Locked'
                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                  : status === 'Submitted'
                  ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
              }`}>
                {status === 'Locked' ? <Lock className="w-3.5 h-3.5 mr-1" /> : null}
                {status}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
            <Hash className="w-5 h-5" />
          </div>
          <div>
            <span className="text-base sm:text-lg font-black text-[var(--text-primary)]">Day {dayNumber}</span>
            <p className="text-[11px] text-[var(--text-muted)]">Day Sequence</p>
          </div>
        </div>

        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-base sm:text-lg font-black text-[var(--text-primary)]">{totalHours.toFixed(1)}h</span>
            <p className="text-[11px] text-[var(--text-muted)]">Logged Today</p>
          </div>
        </div>

        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
            <Star className="w-5 h-5" />
          </div>
          <div>
            <span className="text-base sm:text-lg font-black text-[var(--text-primary)]">{achievementsCount}</span>
            <p className="text-[11px] text-[var(--text-muted)]">Achievements</p>
          </div>
        </div>

        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <span className="text-base sm:text-lg font-black text-[var(--text-primary)]">{status}</span>
            <p className="text-[11px] text-[var(--text-muted)]">Current State</p>
          </div>
        </div>
      </div>

      {/* GitHub Activity Heatmap (if provided by backend) */}
      {heatmap && heatmap.weeks && (
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-5 shadow-sm relative">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-[var(--text-primary)]">
              {heatmap.total_submissions || 0} tracker submissions in the last year
            </span>
            <div className="flex items-center gap-3 text-[11px] text-[var(--text-muted)]">
              <span>🕒 {heatmap.total_hours || 0}h Logged</span>
              <span>⭐ {heatmap.total_achievements || 0} Achievements</span>
            </div>
          </div>

          <div className="overflow-x-auto pb-2">
            <div className="flex gap-1 min-w-[600px]">
              {heatmap.weeks.map((week: any, wIdx: number) => (
                <div key={wIdx} className="flex flex-col gap-1">
                  {week.days.map((day: any, dIdx: number) => {
                    const isSelected = day.date === currentDate;
                    let bgClass = 'bg-slate-100 dark:bg-slate-800';
                    if (day.hours > 0) {
                      if (day.hours < 4) bgClass = 'bg-emerald-200 dark:bg-emerald-950 text-emerald-800';
                      else if (day.hours < 8) bgClass = 'bg-emerald-400 dark:bg-emerald-800 text-white';
                      else bgClass = 'bg-emerald-600 dark:bg-emerald-600 text-white';
                    }
                    return (
                      <div
                        key={dIdx}
                        onClick={() => setCurrentDate(day.date)}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top - 8 });
                          setHoveredDay(day);
                        }}
                        onMouseLeave={() => setHoveredDay(null)}
                        className={`w-3 h-3 rounded-xs cursor-pointer transition ${bgClass} ${
                          isSelected ? 'ring-2 ring-emerald-500 scale-125 z-10' : 'hover:scale-110'
                        }`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Floating Tooltip */}
          {hoveredDay && (
            <div
              style={{ top: tooltipPos.y, left: tooltipPos.x, transform: 'translate(-50%, -100%)' }}
              className="fixed z-50 pointer-events-none px-2.5 py-1 bg-slate-900 text-white text-[10px] rounded shadow-lg font-medium whitespace-nowrap"
            >
              {hoveredDay.date}: {hoveredDay.hours || 0}h • {hoveredDay.status || 'No entry'}
            </div>
          )}
        </div>
      )}

      {/* Notifications / Feedback Message */}
      {message && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between text-xs font-bold ${
          message.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
            : 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-300'
        }`}>
          <div className="flex items-center gap-2">
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="p-1 hover:opacity-75 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Manager Review / Feedback Banner if reviewed */}
      {trackerDay && (trackerDay.manager_rating > 0 || trackerDay.manager_remarks) && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              <h4 className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
                Manager Review & Feedback
              </h4>
              <span className="text-[11px] text-[var(--text-muted)] font-normal">
                ({trackerDay.reviewed_by || 'Reporting Manager'})
              </span>
            </div>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`w-4 h-4 ${s <= trackerDay.manager_rating ? 'text-amber-500 fill-amber-500' : 'text-slate-300 dark:text-slate-600'}`}
                />
              ))}
            </div>
          </div>
          {trackerDay.manager_remarks && (
            <p className="text-xs text-[var(--text-secondary)] italic">
              "{trackerDay.manager_remarks}"
            </p>
          )}
        </div>
      )}

      {/* Locked Tracker Notice / Unlock Request */}
      {isLocked && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Lock className="w-5 h-5 text-rose-500" />
            <div>
              <h4 className="text-xs font-black text-rose-700 dark:text-rose-300">This Daily Tracker is Locked</h4>
              <p className="text-[11px] text-[var(--text-muted)]">
                Past submitted trackers are locked to ensure record integrity. If you need to make corrections, submit an unlock request.
              </p>
            </div>
          </div>

          {pendingUnlock ? (
            <span className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Unlock Request Pending Review
            </span>
          ) : (
            <button
              onClick={() => setShowUnlockModal(true)}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <Unlock className="w-3.5 h-3.5" /> Request Tracker Unlock
            </button>
          )}
        </div>
      )}

      {/* Assigned Tasks Available for Today (if any) */}
      {assignedTasks && assignedTasks.length > 0 && !isLocked && (
        <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 font-black text-xs uppercase tracking-wider">
              <Zap className="w-4 h-4" /> Assigned Tasks for You
            </div>
            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">
              {assignedTasks.length} task{assignedTasks.length > 1 ? 's' : ''} available
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {assignedTasks.map((at: any) => (
              <div
                key={at.id}
                className="p-3 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl flex items-center justify-between gap-3 shadow-xs"
              >
                <div className="space-y-0.5 truncate">
                  <p className="text-xs font-bold text-[var(--text-primary)] truncate">{at.title}</p>
                  <p className="text-[10px] text-[var(--text-muted)] truncate">
                    {at.task_type || 'Task'} • {at.priority || 'Normal'} Priority • From: {at.assigned_by_name || 'Manager'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleAddAssignedTaskRow(at)}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold transition flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Log Work
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Task Rows Section */}
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--card-border)]">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-emerald-500" />
            <h3 className="text-sm font-black text-[var(--text-primary)]">Tasks & Work Logged</h3>
          </div>
          {!isLocked && (
            <button
              type="button"
              onClick={addTaskRow}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" /> Add Task Row
            </button>
          )}
        </div>

        {/* Task Rows List */}
        <div className="space-y-3.5">
          {tasks.map((task, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl border border-[var(--card-border)] bg-[var(--sidebar-bg)]/50 space-y-3 relative group"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[11px] font-black">
                    #{idx + 1}
                  </span>
                  <span className="text-xs font-bold text-[var(--text-secondary)]">Task Item</span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Achievement Toggle */}
                  <button
                    type="button"
                    disabled={isLocked}
                    onClick={() => handleTaskChange(idx, 'is_achievement', !task.is_achievement)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                      task.is_achievement
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--text-muted)] hover:text-amber-500'
                    }`}
                  >
                    <Star className={`w-3.5 h-3.5 ${task.is_achievement ? 'fill-white' : ''}`} />
                    <span>{task.is_achievement ? 'Key Achievement' : 'Mark as Achievement'}</span>
                  </button>

                  {/* Remove Row Button */}
                  {!isLocked && tasks.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTaskRow(idx)}
                      className="p-1 text-slate-400 hover:text-rose-500 rounded-lg transition cursor-pointer"
                      title="Remove Task"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Task Description & Type Row */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-6">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                    Task Description <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    disabled={isLocked}
                    value={task.task_description}
                    onChange={(e) => handleTaskChange(idx, 'task_description', e.target.value)}
                    placeholder="Describe specific work executed, deliverables, and outcomes..."
                    className="w-full px-3 py-2 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60 resize-none"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                    Task Type
                  </label>
                  <select
                    disabled={isLocked}
                    value={task.task_type}
                    onChange={(e) => handleTaskChange(idx, 'task_type', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] text-xs font-bold text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60 cursor-pointer"
                  >
                    {taskTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-3">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                    Hours Worked <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      max="24"
                      disabled={isLocked}
                      value={task.hours_worked || ''}
                      onChange={(e) => handleTaskChange(idx, 'hours_worked', parseFloat(e.target.value) || 0)}
                      placeholder="0.0"
                      className="w-full px-3 py-2 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] text-xs font-black text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
                    />
                    <span className="absolute right-3 top-2 text-xs font-bold text-[var(--text-muted)]">hrs</span>
                  </div>
                </div>
              </div>

              {/* Remarks / Blockers */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                  Remarks / Blockers / Dependencies / Observations (Optional)
                </label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={task.remarks}
                  onChange={(e) => handleTaskChange(idx, 'remarks', e.target.value)}
                  placeholder="Note any dependencies, blockers, or support required..."
                  className="w-full px-3 py-1.5 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Footer Actions */}
        {!isLocked && (
          <div className="pt-4 border-t border-[var(--card-border)] flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-[var(--text-muted)]">
              Total Logged: <span className="font-black text-emerald-600 dark:text-emerald-400">{totalHours.toFixed(1)} Hours</span>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSave('draft')}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-[var(--card-border)] text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--card-border)]/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>Save as Draft</span>
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={() => handleSave('submit')}
                className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-95 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>Submit Daily Tracker</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Guidelines Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--card-border)]">
              <div className="flex items-center gap-2">
                <Info className="w-5 h-5 text-sky-500" />
                <h3 className="text-base font-black text-[var(--text-primary)]">Daily Work Tracker Guidelines</h3>
              </div>
              <button onClick={() => setShowInfoModal(false)} className="p-1 hover:opacity-75 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-[var(--text-secondary)] space-y-3 leading-relaxed">
              <p>
                <strong>1. Daily Submission:</strong> You are required to log your tasks each working day before EOD.
              </p>
              <p>
                <strong>2. Accuracy & Detail:</strong> Be specific in task descriptions so reporting managers and HR have full visibility into your progress.
              </p>
              <p>
                <strong>3. Achievements:</strong> Star items that represent high impact, completed milestones, or standout contributions.
              </p>
              <p>
                <strong>4. Backdated Locking:</strong> Submitted trackers auto-lock after verification. To make edits, submit an unlock request with a clear rationale.
              </p>
            </div>

            <div className="pt-3 border-t border-[var(--card-border)] flex justify-end">
              <button
                onClick={() => setShowInfoModal(false)}
                className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Request Unlock Modal */}
      {showUnlockModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleRequestUnlock} className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--card-border)]">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                <Unlock className="w-5 h-5" />
                <h3 className="text-base font-black">Request Tracker Unlock</h3>
              </div>
              <button type="button" onClick={() => setShowUnlockModal(false)} className="p-1 hover:opacity-75 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-[var(--text-primary)]">
                Reason for Unlock Request <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={unlockReason}
                onChange={(e) => setUnlockReason(e.target.value)}
                placeholder="Explain why you need to modify this locked tracker (e.g., missed logging an afternoon task)..."
                className="w-full px-3 py-2 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
              />
            </div>

            <div className="pt-3 border-t border-[var(--card-border)] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowUnlockModal(false)}
                className="px-4 py-2 rounded-xl border border-[var(--card-border)] text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Submit Request
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
