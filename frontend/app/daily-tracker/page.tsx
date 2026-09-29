'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { 
  ClipboardCheck, Plus, Trash2, Star, Save, Send, Lock, Unlock, 
  ChevronLeft, ChevronRight, Calendar, Info, Clock, CheckCircle2, 
  AlertCircle, Building2, User, Hash, X, Sparkles, Flame, Trophy,
  Award, Zap, Shield, Crown, Gem
} from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface TaskRow {
  id?: number | string;
  task_description: string;
  task_type: string;
  hours_worked: number;
  is_achievement: boolean;
  remarks: string;
}

export default function DailyTrackerPage() {
  const [employee, setEmployee] = useState<any>(null);
  const [currentDate, setCurrentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [trackerDay, setTrackerDay] = useState<any>(null);
  const [tasks, setTasks] = useState<TaskRow[]>([
    { task_description: '', task_type: 'Major', hours_worked: 0, is_achievement: false, remarks: '' }
  ]);
  const [dayStatus, setDayStatus] = useState<string>('Working Day');
  const [dayNumber, setDayNumber] = useState<number>(1);
  const [status, setStatus] = useState<string>('Draft');
  const [taskTypes, setTaskTypes] = useState<string[]>(['Major', 'Minor', 'Research', 'Documentation', 'Meeting', 'Support']);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

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
      // Get current employee
      const meRes = await api.get('/api/employee/me');
      if (meRes.data?.authenticated) {
        setEmployee(meRes.data);
      }

      const res = await api.get(`/api/daily-tracker?date=${dateStr}`);
      if (res.data) {
        setTrackerDay(res.data);
        if (!employee && res.data.employee_name) {
          setEmployee({
            name: res.data.employee_name,
            emp_type: res.data.emp_type || 'Employee',
            emp_id: res.data.emp_id || `EMP${res.data.employee_id}`,
            department: res.data.department || '',
            designation: res.data.designation || ''
          });
        }
        setDayStatus(res.data.day_status || 'Working Day');
        setDayNumber(res.data.day_number || 1);
        setStatus(res.data.status || 'Draft');
        setPendingUnlock(res.data.pending_unlock || null);
        setHeatmap(res.data.heatmap || null);

        if (res.data.tasks && res.data.tasks.length > 0) {
          setTasks(res.data.tasks.map((t: any) => ({
            id: t.id,
            task_description: t.task_description || '',
            task_type: t.task_type || 'Major',
            hours_worked: Number(t.hours_worked) || 0,
            is_achievement: Boolean(t.is_achievement),
            remarks: t.remarks || ''
          })));
        } else {
          setTasks([
            { task_description: '', task_type: 'Major', hours_worked: 0, is_achievement: false, remarks: '' }
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

  const handleAddRow = () => {
    setTasks([
      ...tasks,
      { task_description: '', task_type: 'Major', hours_worked: 0, is_achievement: false, remarks: '' }
    ]);
  };

  const handleDeleteRow = (index: number) => {
    if (tasks.length <= 1) {
      setTasks([
        { task_description: '', task_type: 'Major', hours_worked: 0, is_achievement: false, remarks: '' }
      ]);
    } else {
      setTasks(tasks.filter((_, i) => i !== index));
    }
  };

  const totalHours = tasks.reduce((sum, t) => sum + (Number(t.hours_worked) || 0), 0);
  const totalAchievements = tasks.filter(t => t.is_achievement).length;
  const isLocked = status === 'Locked';

  const handleSave = async (actionType: 'draft' | 'submit') => {
    setMessage(null);
    if (actionType === 'submit' && dayStatus === 'Working Day') {
      if (tasks.length === 0 || tasks.every(t => !t.task_description.trim())) {
        setMessage({ type: 'error', text: 'Please add at least one task description before submitting.' });
        return;
      }
      for (let i = 0; i < tasks.length; i++) {
        if (!tasks[i].task_description.trim()) {
          setMessage({ type: 'error', text: `Task description is required on row #${i + 1}.` });
          return;
        }
        if (tasks[i].hours_worked < 0 || tasks[i].hours_worked > 24) {
          setMessage({ type: 'error', text: `Hours worked must be between 0 and 24 on row #${i + 1}.` });
          return;
        }
      }
      if (totalHours > 24) {
        setMessage({ type: 'error', text: 'Total hours worked cannot exceed 24 hours in a single day.' });
        return;
      }
    }

    setSaving(true);
    try {
      const res = await api.post('/api/daily-tracker/save', {
        date: currentDate,
        day_status: dayStatus,
        action: actionType,
        tasks: tasks
      });

      if (res.data?.success) {
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

  const handleRequestUnlock = async () => {
    if (!unlockReason.trim()) {
      alert('Please provide a reason for the unlock request.');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post('/api/daily-tracker/request-unlock', {
        date: currentDate,
        reason: unlockReason
      });
      if (res.data?.success) {
        alert(res.data.message);
        setShowUnlockModal(false);
        setUnlockReason('');
        await fetchTracker(currentDate);
      } else {
        alert(res.data?.error || 'Failed to request unlock.');
      }
    } catch (e: any) {
      alert(e.response?.data?.error || 'Network error requesting unlock.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[var(--bg)] text-[var(--text)] font-sans">
      <Sidebar 
        user={{
          name: employee?.name || 'Employee',
          designation: employee?.designation || 'Staff',
          emp_type: employee?.emp_type || 'Normal'
        }}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header 
          title="Daily Work Tracker" 
          onMenuClick={() => setMobileOpen(prev => !prev)}
        />

        <main className="p-4 sm:p-8 flex-1 overflow-y-auto space-y-6 max-w-7xl mx-auto w-full">
          
          {/* TOP IDENTITY & DATE NAV CARD */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[var(--accent)] to-[var(--accent2)] text-white flex items-center justify-center font-bold text-lg shadow-md">
                {(employee?.name || 'U')[0].toUpperCase()}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-lg font-extrabold text-[var(--text)] font-['Plus_Jakarta_Sans']">
                    {employee?.name || trackerDay?.employee_name || 'Employee'}
                  </h2>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                    (employee?.emp_type || trackerDay?.emp_type) === 'Intern' 
                      ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' 
                      : 'bg-indigo-500/10 text-indigo-600 border border-indigo-500/20'
                  }`}>
                    {employee?.emp_type || trackerDay?.emp_type || 'Employee'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text2)] mt-0.5">
                  <span className="flex items-center gap-1"><User className="w-3.5 h-3.5 text-[var(--accent)]" /> {employee?.emp_id || (trackerDay?.employee_id ? `EMP${trackerDay.employee_id}` : '')}</span>
                  {(employee?.department || trackerDay?.department) && (
                    <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5 text-[var(--accent)]" /> {employee?.department || trackerDay?.department}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Date Navigator */}
            <div className="flex items-center space-x-2 bg-[var(--bg3)] border border-[var(--border)] px-3 py-1.5 rounded-xl">
              <button 
                onClick={() => changeDateByDays(-1)} 
                className="p-1 hover:bg-[var(--surface)] rounded-lg transition text-[var(--text2)] hover:text-[var(--text)]"
                title="Previous Day"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <Calendar className="w-4 h-4 text-[var(--accent)]" />
              <input 
                type="date" 
                value={currentDate} 
                onChange={(e) => setCurrentDate(e.target.value)}
                className="bg-transparent text-sm font-semibold text-[var(--text)] outline-none cursor-pointer"
              />
              <button 
                onClick={() => changeDateByDays(1)} 
                className="p-1 hover:bg-[var(--surface)] rounded-lg transition text-[var(--text2)] hover:text-[var(--text)]"
                title="Next Day"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Day Status & Submission State */}
            <div className="flex items-center space-x-3">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text3)]">Day Status</span>
                <select 
                  value={dayStatus} 
                  onChange={(e) => setDayStatus(e.target.value)}
                  disabled={isLocked}
                  className="bg-[var(--bg3)] border border-[var(--border)] rounded-lg px-2.5 py-1 text-xs font-semibold text-[var(--text)] outline-none cursor-pointer disabled:opacity-75"
                >
                  <option value="Working Day">💼 Working Day</option>
                  <option value="Weekly Off">🏖️ Weekly Off</option>
                  <option value="Holiday">🎉 Holiday</option>
                  <option value="Leave">🌴 Leave / Time-Off</option>
                  <option value="Other">📌 Other</option>
                </select>
              </div>

              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text3)]">Status</span>
                <div>
                  {status === 'Locked' ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide bg-rose-500/10 text-rose-600 border border-rose-500/20">
                      <Lock className="w-3 h-3" /> Locked
                    </span>
                  ) : status === 'Submitted' ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                      <CheckCircle2 className="w-3 h-3" /> Submitted
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide bg-amber-500/10 text-amber-600 border border-amber-500/20">
                      Draft
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* KPI CARDS ROW */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 flex items-center space-x-3.5 shadow-sm">
              <div className="w-11 h-11 rounded-xl bg-indigo-500/10 text-[var(--accent)] flex items-center justify-center">
                <Hash className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-extrabold text-[var(--text)] font-['Plus_Jakarta_Sans']">Day {dayNumber}</div>
                <div className="text-[11px] font-semibold text-[var(--text3)] uppercase">Day Sequence</div>
              </div>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 flex items-center space-x-3.5 shadow-sm">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-extrabold text-[var(--text)] font-['Plus_Jakarta_Sans']">{totalHours.toFixed(1)}h</div>
                <div className="text-[11px] font-semibold text-[var(--text3)] uppercase">Logged Today</div>
              </div>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 flex items-center space-x-3.5 shadow-sm">
              <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <Star className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-extrabold text-[var(--text)] font-['Plus_Jakarta_Sans']">{totalAchievements}</div>
                <div className="text-[11px] font-semibold text-[var(--text3)] uppercase">Achievements</div>
              </div>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 flex items-center space-x-3.5 shadow-sm">
              <div className="w-11 h-11 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-extrabold text-[var(--text)] font-['Plus_Jakarta_Sans']">{status}</div>
                <div className="text-[11px] font-semibold text-[var(--text3)] uppercase">Current State</div>
              </div>
            </div>
          </div>

          {/* GITHUB-STYLE CONTRIBUTION HEATMAP CARD */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-2.5">
                <span className="font-bold text-sm text-[var(--text)] font-['Plus_Jakarta_Sans']">
                  {heatmap?.total_submitted_days || 0} submissions in the last year
                </span>
                {(heatmap?.longest_streak || 0) > 0 && (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center gap-1">
                    🔥 Best Streak: {heatmap.longest_streak} days
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-4 text-xs text-[var(--text2)] font-semibold">
                <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-[var(--accent)]" /> {heatmap?.total_hours_year || 0}h Logged</span>
                <span className="flex items-center gap-1.5"><Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" /> {heatmap?.total_achievements_year || 0} Achievements</span>
              </div>
            </div>

            {/* Heatmap Grid Wrapper */}
            <div className="overflow-x-auto pb-2 pt-1">
              <div className="min-w-[760px] inline-flex flex-col space-y-2">
                {/* Months Header Labels */}
                <div className="flex items-center pl-7 text-[11px] font-semibold text-[var(--text3)]" style={{ display: 'grid', gridTemplateColumns: 'repeat(53, 12px)', gap: '3px' }}>
                  {heatmap?.months_labels && heatmap.months_labels.map((m: any, idx: number) => (
                    <span key={idx} style={{ gridColumn: m.week_col + 1 }}>{m.name}</span>
                  ))}
                </div>

                {/* Body: Weekday column + 52-week squares */}
                <div className="flex items-start gap-2">
                  {/* Weekday labels */}
                  <div className="grid text-[10px] font-semibold text-[var(--text3)] text-right w-5 pr-1 select-none" style={{ gridTemplateRows: 'repeat(7, 12px)', gap: '3px', lineHeight: '12px' }}>
                    <span>Mon</span>
                    <span></span>
                    <span>Wed</span>
                    <span></span>
                    <span>Fri</span>
                    <span></span>
                    <span></span>
                  </div>

                  {/* 52-week Columns */}
                  <div className="flex gap-[3px]">
                    {((heatmap?.weeks && heatmap.weeks.length > 0) ? heatmap.weeks : Array.from({ length: 52 }, () => Array.from({ length: 7 }, () => ({ level: 0, date: '', hours: 0, status: 'None', achievements: 0 })))).map((week: any[], wIdx: number) => (
                      <div key={wIdx} className="grid flex-shrink-0" style={{ gridTemplateRows: 'repeat(7, 12px)', gap: '3px' }}>
                        {week.map((day: any, dIdx: number) => {
                          const isSelected = day.date && day.date === currentDate;
                          const isToday = day.is_today;
                          const level = day.level ?? 0;

                          return (
                            <div
                              key={dIdx}
                              onClick={() => day.date && setCurrentDate(day.date)}
                              onMouseEnter={(e) => {
                                if (day.date) {
                                  setHoveredDay(day);
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setTooltipPos({ x: rect.left + window.scrollX, y: rect.top + window.scrollY - 36 });
                                }
                              }}
                              onMouseLeave={() => setHoveredDay(null)}
                              className={`gh-day-box level-${level} cursor-pointer relative flex-shrink-0 ${
                                isSelected ? '!ring-2 !ring-[var(--accent)] !border-[var(--accent)] shadow-md scale-125 z-10' : ''
                              } ${isToday ? 'outline-2 outline-dashed outline-[var(--accent)]' : ''}`}
                            >
                              {day.achievements > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 text-[8px] text-amber-500 font-bold leading-none select-none drop-shadow">★</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Heatmap Footer Legend */}
            <div className="flex flex-wrap items-center justify-between pt-3 border-t border-[var(--border)] text-xs text-[var(--text3)]">
              <button
                type="button"
                onClick={() => setShowInfoModal(true)}
                className="hover:text-[var(--accent)] hover:underline transition text-xs font-medium"
              >
                Learn how we count contributions
              </button>

              <div className="flex items-center space-x-1.5 text-[11px] font-medium">
                <span>Less</span>
                <span className="gh-day-box level-0 inline-block"></span>
                <span className="gh-day-box level-1 inline-block"></span>
                <span className="gh-day-box level-2 inline-block"></span>
                <span className="gh-day-box level-3 inline-block"></span>
                <span className="gh-day-box level-4 inline-block"></span>
                <span>More</span>
              </div>
            </div>
          </div>

          {/* STREAK MILESTONE BADGES CARD */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <Flame className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[var(--text)] font-['Plus_Jakarta_Sans'] flex items-center gap-2">
                    Streak & Consistency Badges
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                      {heatmap?.unlocked_badges_count || 0} / 6 Unlocked
                    </span>
                  </h3>
                  <p className="text-[11px] text-[var(--text3)]">
                    Keep logging daily work to unlock exclusive streak badges at 21, 30, 60, 120, 240, and 360 days.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 text-xs">
                <span className="px-3 py-1 rounded-lg bg-[var(--bg3)] border border-[var(--border)] font-bold text-[var(--text)] flex items-center gap-1.5">
                  🔥 Current Streak: <span className="text-amber-500">{heatmap?.current_streak || 0}d</span>
                </span>
                <span className="px-3 py-1 rounded-lg bg-[var(--bg3)] border border-[var(--border)] font-bold text-[var(--text)] flex items-center gap-1.5">
                  🏆 Longest: <span className="text-[var(--accent)]">{heatmap?.longest_streak || 0}d</span>
                </span>
              </div>
            </div>

            {/* Badges Grid (21, 30, 60, 120, 240, 360 days) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-1">
              {(heatmap?.badges || [
                { id: 'streak_21', days: 21, title: 'Habit Builder', tier: 'Bronze', emoji: '🔥', color: '#d97706', description: '21-day routine', is_unlocked: false, progress_percent: 0, current_days: 0 },
                { id: 'streak_30', days: 30, title: 'Monthly Master', tier: 'Silver', emoji: '✨', color: '#64748b', description: '30-day streak', is_unlocked: false, progress_percent: 0, current_days: 0 },
                { id: 'streak_60', days: 60, title: 'Consistency Pro', tier: 'Gold', emoji: '⚡', color: '#eab308', description: '60-day momentum', is_unlocked: false, progress_percent: 0, current_days: 0 },
                { id: 'streak_120', days: 120, title: 'Centurion', tier: 'Platinum', emoji: '🛡️', color: '#06b6d4', description: '120-day focus', is_unlocked: false, progress_percent: 0, current_days: 0 },
                { id: 'streak_240', days: 240, title: 'Iron Will', tier: 'Diamond', emoji: '💎', color: '#8b5cf6', description: '240-day discipline', is_unlocked: false, progress_percent: 0, current_days: 0 },
                { id: 'streak_360', days: 360, title: 'Grandmaster Legend', tier: 'Legend', emoji: '👑', color: '#ec4899', description: '360-day mastery', is_unlocked: false, progress_percent: 0, current_days: 0 },
              ]).map((badge: any) => {
                const unlocked = badge.is_unlocked;
                return (
                  <div
                    key={badge.id || badge.days}
                    className={`relative rounded-xl p-3.5 flex flex-col justify-between border transition-all duration-200 ${
                      unlocked
                        ? 'bg-gradient-to-b from-[var(--surface)] to-[var(--bg3)] border-amber-500/40 shadow-sm ring-1 ring-amber-500/20 hover:scale-102'
                        : 'bg-[var(--bg3)]/50 border-[var(--border)] opacity-75 hover:opacity-100'
                    }`}
                  >
                    {/* Top Tier Tag & Status */}
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wider ${
                        unlocked ? 'bg-amber-500/20 text-amber-600' : 'bg-gray-200 dark:bg-gray-800 text-gray-500'
                      }`}>
                        {badge.tier}
                      </span>
                      {unlocked ? (
                        <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
                          <CheckCircle2 className="w-3 h-3" /> Unlocked
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-[var(--text3)] flex items-center gap-0.5">
                          <Lock className="w-2.5 h-2.5" /> {badge.days}d
                        </span>
                      )}
                    </div>

                    {/* Badge Emblem & Name */}
                    <div className="text-center my-1.5">
                      <div className={`w-12 h-12 mx-auto rounded-2xl flex items-center justify-center text-2xl mb-2 transition-transform duration-200 ${
                        unlocked 
                          ? 'bg-gradient-to-tr from-amber-500/20 to-orange-500/20 shadow-md ring-2 ring-amber-500/40 animate-pulse' 
                          : 'bg-[var(--bg)] text-gray-400 grayscale'
                      }`}>
                        {badge.emoji}
                      </div>
                      <div className="font-extrabold text-xs text-[var(--text)] leading-snug">
                        {badge.title}
                      </div>
                      <div className="text-[10px] font-bold text-[var(--text3)] mt-0.5">
                        {badge.days} Days Streak
                      </div>
                    </div>

                    {/* Progress Bar & Subtitle */}
                    <div className="mt-2.5 pt-2 border-t border-[var(--border)]">
                      <div className="flex justify-between items-center text-[10px] font-bold mb-1 text-[var(--text3)]">
                        <span>Progress</span>
                        <span>{badge.current_days || 0}/{badge.days}d</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            unlocked 
                              ? 'bg-gradient-to-r from-amber-500 to-emerald-500' 
                              : 'bg-[var(--accent)]'
                          }`}
                          style={{ width: `${badge.progress_percent || 0}%` }}
                        />
                      </div>
                      <div className="text-[9px] text-[var(--text3)] text-center mt-1.5 line-clamp-1" title={badge.description}>
                        {badge.description}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>


          {/* FLOATING HOVER TOOLTIP */}
          {hoveredDay && (
            <div 
              style={{ top: `${tooltipPos.y}px`, left: `${tooltipPos.x}px` }} 
              className="fixed -translate-x-1/2 pointer-events-none z-50 bg-[#24292f] text-white text-[11px] px-2.5 py-1.5 rounded-lg shadow-xl border border-white/10 whitespace-nowrap"
            >
              <strong>{hoveredDay.day_name}, {hoveredDay.date_display}</strong>: {hoveredDay.hours}h ({hoveredDay.tasks_count} tasks{hoveredDay.achievements > 0 ? `, ${hoveredDay.achievements} ★` : ''} — {hoveredDay.status})
            </div>
          )}


          {/* MANAGER REVIEW FEEDBACK (If available) */}
          {trackerDay && (trackerDay.manager_rating > 0 || trackerDay.manager_remarks) && (
            <div className="bg-gradient-to-r from-indigo-500/5 to-purple-500/5 border border-indigo-500/20 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="font-bold text-sm text-[var(--text)] flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" /> Manager Rating & Feedback
                  <span className="text-xs text-[var(--text3)] font-normal">({trackerDay.reviewed_by || 'Reporting Manager'})</span>
                </div>
                <div className="flex items-center space-x-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star 
                      key={s} 
                      className={`w-4 h-4 ${s <= trackerDay.manager_rating ? 'text-amber-500 fill-amber-500' : 'text-gray-300 dark:text-gray-600'}`} 
                    />
                  ))}
                </div>
              </div>
              {trackerDay.manager_remarks && (
                <p className="text-sm text-[var(--text2)] italic">"{trackerDay.manager_remarks}"</p>
              )}
            </div>
          )}

          {/* MESSAGE ALERT */}
          {message && (
            <div className={`p-4 rounded-xl flex items-center space-x-3 text-sm font-medium ${
              message.type === 'success' 
                ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' 
                : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
            }`}>
              {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
              <span>{message.text}</span>
            </div>
          )}

          {/* SPREADSHEET GRID TABLE */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-sm flex flex-col">
            <div className="p-4 bg-[var(--bg3)] border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-3">
              <div className="font-bold text-sm text-[var(--text)] flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-[var(--accent)]" />
                Work Log Sheet — {currentDate}
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setShowInfoModal(true)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--surface)] hover:bg-[var(--bg)] text-[var(--text2)] hover:text-[var(--text)] border border-[var(--border)] flex items-center gap-1.5 transition"
                >
                  <Info className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span>Achievement Info</span>
                </button>

                {!isLocked && (
                  <button
                    type="button"
                    onClick={handleAddRow}
                    className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-gradient-to-r from-[var(--accent)] to-[var(--accent2)] text-white flex items-center gap-1.5 shadow-sm hover:opacity-95 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Row</span>
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[var(--bg3)] text-[var(--text3)] uppercase tracking-wider text-[11px] font-bold border-b border-[var(--border)]">
                    <th className="p-3.5 text-center w-16">Day</th>
                    <th className="p-3.5 w-24">Date</th>
                    <th className="p-3.5">Task Worked On <span className="text-rose-500">*</span></th>
                    <th className="p-3.5 w-32">Type</th>
                    <th className="p-3.5 w-28 text-center">Hours (0-24) <span className="text-rose-500">*</span></th>
                    <th className="p-3.5 w-28 text-center">Achievement</th>
                    <th className="p-3.5">Remarks / Blockers / Dependencies</th>
                    <th className="p-3.5 text-center w-16">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {tasks.map((task, idx) => (
                    <tr 
                      key={idx} 
                      className={`hover:bg-[var(--bg3)]/50 transition ${task.is_achievement ? 'bg-amber-500/[0.03]' : ''}`}
                    >
                      <td className="p-3 text-center font-bold text-[var(--text2)]">
                        Day {dayNumber}
                      </td>
                      <td className="p-3 text-[var(--text2)] font-medium whitespace-nowrap">
                        {currentDate}
                      </td>
                      <td className="p-2.5">
                        <input
                          type="text"
                          value={task.task_description}
                          onChange={(e) => handleTaskChange(idx, 'task_description', e.target.value)}
                          disabled={isLocked}
                          placeholder="Describe the task or project deliverable..."
                          className="w-full bg-transparent border border-transparent focus:border-[var(--accent)] focus:bg-[var(--bg)] px-2.5 py-1.5 rounded-lg text-xs text-[var(--text)] outline-none transition disabled:opacity-75"
                        />
                      </td>
                      <td className="p-2.5">
                        <select
                          value={task.task_type}
                          onChange={(e) => handleTaskChange(idx, 'task_type', e.target.value)}
                          disabled={isLocked}
                          className="w-full bg-[var(--bg3)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-xs text-[var(--text)] outline-none cursor-pointer disabled:opacity-75"
                        >
                          {taskTypes.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2.5 text-center">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="24"
                          value={task.hours_worked}
                          onChange={(e) => handleTaskChange(idx, 'hours_worked', parseFloat(e.target.value) || 0)}
                          disabled={isLocked}
                          className="w-20 mx-auto text-center font-bold bg-transparent border border-transparent focus:border-[var(--accent)] focus:bg-[var(--bg)] px-2 py-1.5 rounded-lg text-xs text-[var(--text)] outline-none transition disabled:opacity-75"
                        />
                      </td>
                      <td className="p-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleTaskChange(idx, 'is_achievement', !task.is_achievement)}
                          disabled={isLocked}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition ${
                            task.is_achievement
                              ? 'bg-amber-500/20 text-amber-600 border border-amber-500/30'
                              : 'bg-[var(--bg3)] text-[var(--text3)] hover:text-amber-500 border border-[var(--border)]'
                          }`}
                        >
                          <Star className={`w-3.5 h-3.5 ${task.is_achievement ? 'fill-amber-500 text-amber-500' : ''}`} />
                          <span>{task.is_achievement ? 'Flagged' : 'Mark'}</span>
                        </button>
                      </td>
                      <td className="p-2.5">
                        <input
                          type="text"
                          value={task.remarks}
                          onChange={(e) => handleTaskChange(idx, 'remarks', e.target.value)}
                          disabled={isLocked}
                          placeholder="Blockers, dependencies, support required..."
                          className="w-full bg-transparent border border-transparent focus:border-[var(--accent)] focus:bg-[var(--bg)] px-2.5 py-1.5 rounded-lg text-xs text-[var(--text)] outline-none transition disabled:opacity-75"
                        />
                      </td>
                      <td className="p-2.5 text-center">
                        {!isLocked ? (
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(idx)}
                            className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition"
                            title="Delete Row"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <Lock className="w-3.5 h-3.5 text-gray-400 mx-auto" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ACTION FOOTER */}
            <div className="p-4 bg-[var(--surface)] border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-3">
              <div>
                {!isLocked && (
                  <button
                    type="button"
                    onClick={handleAddRow}
                    className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-[var(--bg3)] hover:bg-[var(--bg)] text-[var(--text)] border border-[var(--border)] flex items-center gap-1.5 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Row</span>
                  </button>
                )}
              </div>

              <div className="flex items-center space-x-3">
                {isLocked ? (
                  pendingUnlock ? (
                    <span className="text-xs font-bold text-amber-600 bg-amber-500/10 px-3.5 py-2 rounded-xl border border-amber-500/20 flex items-center gap-1.5">
                      <Clock className="w-4 h-4" /> Unlock Request Pending Review
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowUnlockModal(true)}
                      className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1.5 shadow-sm transition"
                    >
                      <Unlock className="w-4 h-4" />
                      <span>Request Unlock</span>
                    </button>
                  )
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => handleSave('draft')}
                      disabled={saving}
                      className="px-4 py-2 text-xs font-semibold rounded-xl bg-[var(--bg3)] hover:bg-[var(--bg)] text-[var(--text)] border border-[var(--border)] flex items-center gap-1.5 transition disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      <span>Save Draft</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSave('submit')}
                      disabled={saving}
                      className="px-5 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-[var(--accent)] to-[var(--accent2)] text-white flex items-center gap-1.5 shadow-md hover:opacity-95 transition disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                      <span>Submit Day</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

        </main>
      </div>

      {/* ACHIEVEMENT CRITERIA INFO MODAL */}
      {showInfoModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="font-bold text-base text-[var(--text)] flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                Achievement Guidelines
              </div>
              <button onClick={() => setShowInfoModal(false)} className="text-[var(--text3)] hover:text-[var(--text)]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-[var(--text2)] leading-relaxed">
              Marking a task as an <strong>Achievement (★)</strong> distinguishes key deliverables, milestone completions, and high-impact resolutions.
            </p>
            <ul className="text-xs text-[var(--text2)] space-y-2 list-disc pl-5">
              <li>Completed a major feature release or critical client fix.</li>
              <li>Published an in-depth stock research dossier or report.</li>
              <li>Resolved critical system blockers ahead of schedule.</li>
            </ul>
            <button
              type="button"
              onClick={() => setShowInfoModal(false)}
              className="w-full py-2.5 text-xs font-bold rounded-xl bg-[var(--accent)] text-white"
            >
              Understood
            </button>
          </div>
        </div>
      )}

      {/* UNLOCK REQUEST MODAL */}
      {showUnlockModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="font-bold text-base text-[var(--text)] flex items-center gap-2">
                <Unlock className="w-5 h-5 text-[var(--accent)]" />
                Request Tracker Unlock
              </div>
              <button onClick={() => setShowUnlockModal(false)} className="text-[var(--text3)] hover:text-[var(--text)]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-[var(--text2)]">
              This tracker is locked. Please specify the reason for requesting a backdated correction. Your Manager & HR will review this request.
            </p>
            <div>
              <label className="text-[11px] font-bold uppercase text-[var(--text3)] mb-1 block">Reason for Unlock</label>
              <textarea
                value={unlockReason}
                onChange={(e) => setUnlockReason(e.target.value)}
                placeholder="e.g., Need to adjust task hours / missed submission deadline..."
                className="w-full bg-[var(--bg3)] border border-[var(--border)] rounded-xl p-3 text-xs text-[var(--text)] outline-none h-24"
              />
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowUnlockModal(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-[var(--bg3)] text-[var(--text)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRequestUnlock}
                disabled={saving}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-[var(--accent)] text-white"
              >
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
