'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { 
  Users, CheckCircle2, Clock, Star, Lock, Unlock, Eye, 
  Calendar, Building2, Search, Filter, Download, ArrowRight, 
  X, Check, AlertCircle, FileSpreadsheet, PieChart, Plus,
  ClipboardList, Flag, Send, UserCheck, ShieldAlert
} from 'lucide-react';
import Link from 'next/link';
import { api, getApiUrl } from '@/lib/api';

export default function DailyTrackerManagerPage() {
  const [user, setUser] = useState<any>(null);
  const [filterDate, setFilterDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [department, setDepartment] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [empTypeFilter, setEmpTypeFilter] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'submissions' | 'delegated'>('submissions');
  
  const [teamData, setTeamData] = useState<any[]>([]);
  const [assignedTasks, setAssignedTasks] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    total_employees: 0,
    submitted_count: 0,
    pending_count: 0,
    total_hours: 0,
    total_achievements: 0
  });
  const [pendingUnlocks, setPendingUnlocks] = useState<any[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Manager Scope Info
  const [isManagerRole, setIsManagerRole] = useState(false);
  const [managerDepartment, setManagerDepartment] = useState('');

  // Review Modal State
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [activeTracker, setActiveTracker] = useState<any>(null);
  const [reviewRating, setReviewRating] = useState<number>(0);
  const [reviewRemarks, setReviewRemarks] = useState<string>('');
  const [savingReview, setSavingReview] = useState(false);

  // Assign Task Modal State
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskDept, setTaskDept] = useState('');
  const [taskAssigneeId, setTaskAssigneeId] = useState<string>('');
  const [taskType, setTaskType] = useState('Major');
  const [taskPriority, setTaskPriority] = useState('Medium');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [savingAssignTask, setSavingAssignTask] = useState(false);
  const [delegatedStatusFilter, setDelegatedStatusFilter] = useState('');

  const loadManagerData = async () => {
    setLoading(true);
    try {
      const stored = localStorage.getItem('fret_user');
      if (stored) {
        setUser(JSON.parse(stored));
      }

      const res = await api.get(`/api/daily-tracker/manager-data?date=${filterDate}&department=${department}&status=${statusFilter}&emp_type=${empTypeFilter}&search=${search}`);
      if (res.data) {
        setTeamData(res.data.team_data || []);
        setStats(res.data.stats || {});
        setPendingUnlocks(res.data.pending_unlocks || []);
        setAssignedTasks(res.data.assigned_tasks || []);
        setDepartments(res.data.departments || []);
        setIsManagerRole(Boolean(res.data.is_manager_role));
        setManagerDepartment(res.data.manager_department || '');
        if (!taskDept && res.data.manager_department) {
          setTaskDept(res.data.manager_department);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadManagerData();
  }, [filterDate, department, statusFilter, empTypeFilter]);

  const loadTeamMembers = async (deptToUse?: string) => {
    try {
      const d = deptToUse || taskDept || managerDepartment || department;
      const res = await api.get(`/api/daily-tracker/department-team?department=${d || ''}`);
      if (res.data?.members) {
        setTeamMembers(res.data.members);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const openAssignModal = async () => {
    const defaultDept = managerDepartment || department || (departments[0] || '');
    setTaskDept(defaultDept);
    setTaskTitle('');
    setTaskDesc('');
    setTaskAssigneeId('');
    setTaskType('Major');
    setTaskPriority('Medium');
    setTaskDueDate(new Date(Date.now() + 86400000).toISOString().split('T')[0]);
    await loadTeamMembers(defaultDept);
    setAssignModalOpen(true);
  };

  const handleCreateAssignedTask = async () => {
    if (!taskTitle.trim()) {
      alert('Task title is required.');
      return;
    }
    setSavingAssignTask(true);
    try {
      const res = await api.post('/api/daily-tracker/assign-task', {
        title: taskTitle.trim(),
        description: taskDesc.trim(),
        department: taskDept,
        assigned_to_id: taskAssigneeId || null,
        task_type: taskType,
        priority: taskPriority,
        due_date: taskDueDate || null
      });
      if (res.data?.success) {
        alert(res.data.message || 'Task assigned successfully!');
        setAssignModalOpen(false);
        loadManagerData();
      } else {
        alert(res.data?.error || 'Failed to assign task.');
      }
    } catch (e: any) {
      alert(e.response?.data?.error || 'Network error assigning task.');
    } finally {
      setSavingAssignTask(false);
    }
  };

  useEffect(() => {
    loadManagerData();
  }, [filterDate, department, statusFilter, empTypeFilter]);

  const handleUnlockAction = async (requestId: number, action: 'approve' | 'reject') => {
    if (!confirm(`Are you sure you want to ${action} this unlock request?`)) return;

    try {
      const res = await api.post('/api/daily-tracker/unlock-action', {
        request_id: requestId,
        action: action
      });
      if (res.data?.success) {
        alert(res.data.message);
        loadManagerData();
      } else {
        alert(res.data?.error || 'Failed to process unlock action.');
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Network error.');
    }
  };

  const handleForceUnlock = async (trackerId: number) => {
    if (!confirm('Are you sure you want to unlock this tracker?')) return;

    try {
      const res = await api.post('/api/daily-tracker/unlock-action', {
        tracker_day_id: trackerId,
        action: 'force_unlock',
        review_notes: 'Manager / HR Override Unlock'
      });
      if (res.data?.success) {
        alert(res.data.message);
        loadManagerData();
      } else {
        alert(res.data?.error || 'Failed to unlock tracker.');
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Network error.');
    }
  };

  const openReviewModal = (item: any) => {
    setActiveTracker(item);
    setReviewRating(item.manager_rating || 0);
    setReviewRemarks(item.manager_remarks || '');
    setReviewModalOpen(true);
  };

  const saveManagerReview = async () => {
    if (!activeTracker?.tracker_id) return;
    setSavingReview(true);
    try {
      const res = await api.post('/api/daily-tracker/manager-review', {
        tracker_day_id: activeTracker.tracker_id,
        rating: reviewRating,
        remarks: reviewRemarks
      });
      if (res.data?.success) {
        alert('Review saved successfully!');
        setReviewModalOpen(false);
        loadManagerData();
      } else {
        alert(res.data?.error || 'Failed to save review.');
      }
    } catch (e: any) {
      alert(e.response?.data?.error || 'Network error saving review.');
    } finally {
      setSavingReview(false);
    }
  };

  const filteredAssignedTasks = assignedTasks.filter(task => {
    if (delegatedStatusFilter && task.status !== delegatedStatusFilter) return false;
    if (department && task.department.toLowerCase() !== department.toLowerCase()) return false;
    if (search) {
      const q = search.toLowerCase();
      return task.title.toLowerCase().includes(q) || 
             task.assigned_to_name.toLowerCase().includes(q) ||
             (task.description && task.description.toLowerCase().includes(q));
    }
    return true;
  });

  return (
    <div className="flex min-h-screen bg-[var(--bg)] text-[var(--text)] font-sans">
      <Sidebar 
        user={user}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header 
          title="Daily Tracker — Manager Portal" 
          onMenuClick={() => setMobileOpen(prev => !prev)}
        />

        <main className="p-4 sm:p-8 flex-1 overflow-y-auto space-y-6 max-w-7xl mx-auto w-full">
          
          {/* HEADER BANNER & ACTIONS */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-extrabold text-[var(--text)] font-['Plus_Jakarta_Sans']">
                  Department Management & Delegation
                </h2>
                {managerDepartment && (
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
                    👑 HOD / Manager: {managerDepartment}
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--text2)] mt-0.5">
                Assign work to department employees & interns, track blocker flags, and review daily tracker submissions.
              </p>
            </div>

            <div className="flex items-center space-x-2.5">
              <button
                type="button"
                onClick={openAssignModal}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white flex items-center gap-1.5 shadow-md transition"
              >
                <Plus className="w-4 h-4" />
                <span>Assign Task to Team</span>
              </button>
            </div>
          </div>

          {/* KPI STATS ROW */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 flex items-center space-x-3.5 shadow-sm">
              <div className="w-11 h-11 rounded-xl bg-indigo-500/10 text-[var(--accent)] flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-extrabold text-[var(--text)] font-['Plus_Jakarta_Sans']">{stats.total_employees || 0}</div>
                <div className="text-[11px] font-semibold text-[var(--text3)] uppercase">Active Team</div>
              </div>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 flex items-center space-x-3.5 shadow-sm">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-extrabold text-[var(--text)] font-['Plus_Jakarta_Sans']">{stats.submitted_count || 0}</div>
                <div className="text-[11px] font-semibold text-[var(--text3)] uppercase">Submitted</div>
              </div>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 flex items-center space-x-3.5 shadow-sm">
              <div className="w-11 h-11 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-extrabold text-[var(--text)] font-['Plus_Jakarta_Sans']">{stats.pending_count || 0}</div>
                <div className="text-[11px] font-semibold text-[var(--text3)] uppercase">Pending</div>
              </div>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 flex items-center space-x-3.5 shadow-sm">
              <div className="w-11 h-11 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-extrabold text-[var(--text)] font-['Plus_Jakarta_Sans']">{Number(stats.total_hours || 0).toFixed(1)}h</div>
                <div className="text-[11px] font-semibold text-[var(--text3)] uppercase">Logged Hours</div>
              </div>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 flex items-center space-x-3.5 shadow-sm col-span-2 sm:col-span-1">
              <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <ClipboardList className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-extrabold text-[var(--text)] font-['Plus_Jakarta_Sans']">{assignedTasks.length}</div>
                <div className="text-[11px] font-semibold text-[var(--text3)] uppercase">Delegated Tasks</div>
              </div>
            </div>
          </div>

          {/* PENDING UNLOCK REQUESTS CARD (If any) */}
          {pendingUnlocks.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 shadow-sm">
              <div className="font-bold text-sm text-amber-700 dark:text-amber-400 mb-3 flex items-center gap-2">
                <Unlock className="w-4 h-4" /> Pending Unlock Requests ({pendingUnlocks.length})
              </div>
              <div className="space-y-2.5">
                {pendingUnlocks.map((req) => (
                  <div key={req.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-bold text-xs text-[var(--text)]">
                        {req.employee_name} ({req.emp_id}) — Date: {req.date}
                      </div>
                      <div className="text-xs text-[var(--text2)] mt-0.5">
                        <strong>Reason:</strong> "{req.reason}"
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => handleUnlockAction(req.id, 'approve')}
                        className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 hover:bg-emerald-500/25 flex items-center gap-1 transition"
                      >
                        <Check className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUnlockAction(req.id, 'reject')}
                        className="px-3 py-1.5 text-xs font-bold rounded-lg bg-rose-500/15 text-rose-600 border border-rose-500/30 hover:bg-rose-500/25 flex items-center gap-1 transition"
                      >
                        <X className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB CONTROLS */}
          <div className="flex items-center space-x-2 border-b border-[var(--border)] pb-2">
            <button
              type="button"
              onClick={() => setActiveTab('submissions')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-2 ${
                activeTab === 'submissions'
                  ? 'bg-gradient-to-r from-[var(--accent)] to-[var(--accent2)] text-white shadow-sm'
                  : 'text-[var(--text2)] hover:bg-[var(--bg3)]'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Team Submissions ({teamData.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('delegated')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-2 ${
                activeTab === 'delegated'
                  ? 'bg-gradient-to-r from-[var(--accent)] to-[var(--accent2)] text-white shadow-sm'
                  : 'text-[var(--text2)] hover:bg-[var(--bg3)]'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              <span>Delegated Tasks ({assignedTasks.length})</span>
            </button>
          </div>

          {/* VIEW 1: TEAM SUBMISSIONS */}
          {activeTab === 'submissions' && (
            <>
              {/* FILTER BAR */}
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="flex items-center space-x-1.5 bg-[var(--bg3)] border border-[var(--border)] px-2.5 py-1.5 rounded-lg">
                    <Calendar className="w-3.5 h-3.5 text-[var(--accent)]" />
                    <input
                      type="date"
                      value={filterDate}
                      onChange={(e) => setFilterDate(e.target.value)}
                      className="bg-transparent text-xs font-semibold text-[var(--text)] outline-none cursor-pointer"
                    />
                  </div>

                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="bg-[var(--bg3)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text)] outline-none cursor-pointer"
                  >
                    <option value="">All Departments</option>
                    {departments.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-[var(--bg3)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text)] outline-none cursor-pointer"
                  >
                    <option value="">All Statuses</option>
                    <option value="Submitted">Submitted</option>
                    <option value="Pending">Pending</option>
                    <option value="Locked">Locked</option>
                    <option value="Draft">Draft</option>
                  </select>

                  <select
                    value={empTypeFilter}
                    onChange={(e) => setEmpTypeFilter(e.target.value)}
                    className="bg-[var(--bg3)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text)] outline-none cursor-pointer"
                  >
                    <option value="">All Roles</option>
                    <option value="Normal">Employees</option>
                    <option value="Intern">Interns</option>
                  </select>

                  <div className="flex items-center bg-[var(--bg3)] border border-[var(--border)] rounded-lg px-2.5 py-1.5">
                    <Search className="w-3.5 h-3.5 text-[var(--text3)] mr-1.5" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search team member..."
                      className="bg-transparent text-xs text-[var(--text)] outline-none w-36 sm:w-44"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Link
                    href="/daily-tracker-reports"
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--bg3)] hover:bg-[var(--bg)] text-[var(--text)] border border-[var(--border)] flex items-center gap-1.5 transition"
                  >
                    <PieChart className="w-3.5 h-3.5 text-[var(--accent)]" />
                    <span>Reports</span>
                  </Link>
                  <a
                    href={getApiUrl(`/api/daily-tracker/export?from_date=${filterDate}&to_date=${filterDate}&format=xlsx`)}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--bg3)] hover:bg-[var(--bg)] text-[var(--text)] border border-[var(--border)] flex items-center gap-1.5 transition"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Excel</span>
                  </a>
                </div>
              </div>

              {/* TEAM DATA TABLE */}
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[var(--bg3)] text-[var(--text3)] uppercase tracking-wider text-[11px] font-bold border-b border-[var(--border)]">
                        <th className="p-3.5">Employee</th>
                        <th className="p-3.5">Role</th>
                        <th className="p-3.5">Department</th>
                        <th className="p-3.5">Day Status</th>
                        <th className="p-3.5 text-center">Tasks</th>
                        <th className="p-3.5 text-center">Hours</th>
                        <th className="p-3.5 text-center">Achievements</th>
                        <th className="p-3.5">Status</th>
                        <th className="p-3.5">Rating</th>
                        <th className="p-3.5 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {teamData.length > 0 ? (
                        teamData.map((item, idx) => (
                          <tr key={idx} className="hover:bg-[var(--bg3)]/50 transition">
                            <td className="p-3">
                              <div className="flex items-center space-x-2.5">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[var(--accent)] to-[var(--accent2)] text-white flex items-center justify-center font-bold text-xs">
                                  {item.employee_name[0].toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-bold text-[var(--text)] flex items-center gap-1.5">
                                    {item.employee_name}
                                    {item.is_manager && (
                                      <span className="text-[10px] text-amber-600 bg-amber-500/10 px-1.5 py-0.2 rounded font-extrabold" title={`Manager of ${item.managed_department || item.department}`}>
                                        👑 Mgr
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-[var(--text3)]">{item.emp_id}</div>
                                </div>
                              </div>
                            </td>
                            <td className="p-3">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                                item.emp_type === 'Intern' 
                                  ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' 
                                  : 'bg-indigo-500/10 text-indigo-600 border border-indigo-500/20'
                              }`}>
                                {item.emp_type || 'Employee'}
                              </span>
                            </td>
                            <td className="p-3 text-[var(--text2)] font-medium">{item.department || '--'}</td>
                            <td className="p-3 text-[var(--text)] font-semibold">{item.day_status}</td>
                            <td className="p-3 text-center font-bold text-[var(--text)]">{item.tasks_count}</td>
                            <td className="p-3 text-center font-bold text-[var(--accent)]">{Number(item.hours).toFixed(1)}h</td>
                            <td className="p-3 text-center">
                              {item.achievements > 0 ? (
                                <span className="bg-amber-500/15 text-amber-600 px-2 py-0.5 rounded-full font-bold text-[11px]">
                                  ★ {item.achievements}
                                </span>
                              ) : (
                                <span className="text-[var(--text3)]">0</span>
                              )}
                            </td>
                            <td className="p-3">
                              {item.status === 'Submitted' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                  <CheckCircle2 className="w-3 h-3" /> Submitted
                                </span>
                              ) : item.status === 'Locked' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide bg-rose-500/10 text-rose-600 border border-rose-500/20">
                                  <Lock className="w-3 h-3" /> Locked
                                </span>
                              ) : item.status === 'Draft' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide bg-amber-500/10 text-amber-600 border border-amber-500/20">
                                  Draft
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide bg-gray-500/10 text-gray-500 border border-gray-500/20">
                                  Pending
                                </span>
                              )}
                            </td>
                            <td className="p-3">
                              {item.manager_rating > 0 ? (
                                <div className="flex items-center space-x-0.5">
                                  {[1, 2, 3, 4, 5].map((s) => (
                                    <Star 
                                      key={s} 
                                      className={`w-3.5 h-3.5 ${s <= item.manager_rating ? 'text-amber-500 fill-amber-500' : 'text-gray-300 dark:text-gray-600'}`} 
                                    />
                                  ))}
                                </div>
                              ) : (
                                <span className="text-[var(--text3)] text-[11px]">Unrated</span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              <div className="inline-flex items-center space-x-1.5">
                                {item.tracker_id ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => openReviewModal(item)}
                                      className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-500/10 text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition flex items-center gap-1"
                                    >
                                      <Eye className="w-3.5 h-3.5" /> Review
                                    </button>
                                    {item.status === 'Locked' && (
                                      <button
                                        type="button"
                                        onClick={() => handleForceUnlock(item.tracker_id)}
                                        title="Force Unlock"
                                        className="p-1 text-amber-600 hover:bg-amber-500/10 rounded-lg transition"
                                      >
                                        <Unlock className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-[var(--text3)] text-[11px]">No Entry</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={10} className="p-8 text-center text-[var(--text3)]">
                            No tracker entries found for this date/filter.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* VIEW 2: DELEGATED TASKS */}
          {activeTab === 'delegated' && (
            <div className="space-y-4">
              {/* DELEGATED FILTERS */}
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <select
                    value={delegatedStatusFilter}
                    onChange={(e) => setDelegatedStatusFilter(e.target.value)}
                    className="bg-[var(--bg3)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text)] outline-none cursor-pointer"
                  >
                    <option value="">All Statuses</option>
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="Flagged">🚩 Flagged Blockers</option>
                  </select>

                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="bg-[var(--bg3)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text)] outline-none cursor-pointer"
                  >
                    <option value="">All Departments</option>
                    {departments.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>

                  <div className="flex items-center bg-[var(--bg3)] border border-[var(--border)] rounded-lg px-2.5 py-1.5">
                    <Search className="w-3.5 h-3.5 text-[var(--text3)] mr-1.5" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search task / assignee..."
                      className="bg-transparent text-xs text-[var(--text)] outline-none w-36 sm:w-48"
                    />
                  </div>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={openAssignModal}
                    className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Assign New Task</span>
                  </button>
                </div>
              </div>

              {/* DELEGATED TASKS TABLE */}
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[var(--bg3)] text-[var(--text3)] uppercase tracking-wider text-[11px] font-bold border-b border-[var(--border)]">
                        <th className="p-3.5">Task Title & Details</th>
                        <th className="p-3.5">Assigned To</th>
                        <th className="p-3.5">Department</th>
                        <th className="p-3.5">Type</th>
                        <th className="p-3.5">Priority</th>
                        <th className="p-3.5">Due Date</th>
                        <th className="p-3.5">Status</th>
                        <th className="p-3.5">Assigned By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {filteredAssignedTasks.length > 0 ? (
                        filteredAssignedTasks.map((t) => (
                          <tr key={t.id} className={`hover:bg-[var(--bg3)]/50 transition ${t.is_flagged ? 'bg-rose-500/[0.04]' : ''}`}>
                            <td className="p-3">
                              <div className="space-y-1">
                                <div className="font-bold text-xs text-[var(--text)] flex items-center gap-1.5">
                                  {t.title}
                                  {t.is_flagged && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-500/15 text-rose-600 border border-rose-500/30 flex items-center gap-1">
                                      <Flag className="w-3 h-3 fill-rose-600" /> Blocker Flagged
                                    </span>
                                  )}
                                </div>
                                {t.description && (
                                  <p className="text-[11px] text-[var(--text2)] line-clamp-2">{t.description}</p>
                                )}
                                {t.is_flagged && t.flag_reason && (
                                  <div className="text-[11px] text-rose-700 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-md p-2 mt-1">
                                    <strong>Blocker Reason from Assignee:</strong> "{t.flag_reason}"
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="p-3 font-semibold text-[var(--text)]">
                              {t.assigned_to_name || 'All Team Members'}
                            </td>
                            <td className="p-3 text-[var(--text2)]">{t.department}</td>
                            <td className="p-3">
                              <span className="bg-indigo-500/10 text-[var(--accent)] px-2 py-0.5 rounded text-[10px] font-semibold">
                                {t.task_type}
                              </span>
                            </td>
                            <td className="p-3">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                                t.priority === 'Urgent' ? 'bg-rose-500/15 text-rose-600' :
                                t.priority === 'High' ? 'bg-orange-500/15 text-orange-600' :
                                t.priority === 'Low' ? 'bg-gray-500/15 text-gray-500' :
                                'bg-blue-500/15 text-blue-600'
                              }`}>
                                {t.priority}
                              </span>
                            </td>
                            <td className="p-3 font-medium text-[var(--text2)]">
                              {t.due_date || '--'}
                            </td>
                            <td className="p-3">
                              {t.status === 'Completed' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                  <CheckCircle2 className="w-3 h-3" /> Completed
                                </span>
                              ) : t.status === 'Flagged' || t.is_flagged ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-500/10 text-rose-600 border border-rose-500/20">
                                  <Flag className="w-3 h-3 fill-rose-600" /> Flagged
                                </span>
                              ) : t.status === 'In Progress' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-500/10 text-blue-600 border border-blue-500/20">
                                  In Progress
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-500/10 text-amber-600 border border-amber-500/20">
                                  Pending
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-[var(--text3)]">
                              {t.assigned_by_name}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-[var(--text3)]">
                            No delegated tasks found for this department/filter.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ASSIGN TASK MODAL */}
      {assignModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="font-bold text-base text-[var(--text)] flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-blue-600" />
                Assign Task to Department / Employee
              </div>
              <button onClick={() => setAssignModalOpen(false)} className="text-[var(--text3)] hover:text-[var(--text)]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[var(--text2)]">
              Delegate specific tasks, assignments, or research deliverables to your department members (Employees & Interns).
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold uppercase text-[var(--text3)] mb-1 block">Task Title <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="e.g., Implement User Auth OAuth Flow"
                  className="w-full bg-[var(--bg3)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs text-[var(--text)] outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-[var(--text3)] mb-1 block">Detailed Instructions / Description</label>
                <textarea
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  placeholder="Provide context, acceptance criteria, or links..."
                  className="w-full bg-[var(--bg3)] border border-[var(--border)] rounded-xl p-3 text-xs text-[var(--text)] outline-none h-20 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase text-[var(--text3)] mb-1 block">Department</label>
                  <select
                    value={taskDept}
                    onChange={(e) => {
                      setTaskDept(e.target.value);
                      loadTeamMembers(e.target.value);
                    }}
                    className="w-full bg-[var(--bg3)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs text-[var(--text)] outline-none cursor-pointer"
                  >
                    {departments.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase text-[var(--text3)] mb-1 block">Assign To</label>
                  <select
                    value={taskAssigneeId}
                    onChange={(e) => setTaskAssigneeId(e.target.value)}
                    className="w-full bg-[var(--bg3)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs text-[var(--text)] outline-none cursor-pointer"
                  >
                    <option value="">👥 Whole Department (All Members)</option>
                    {teamMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.emp_type} - {m.emp_id})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase text-[var(--text3)] mb-1 block">Task Type</label>
                  <select
                    value={taskType}
                    onChange={(e) => setTaskType(e.target.value)}
                    className="w-full bg-[var(--bg3)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs text-[var(--text)] outline-none cursor-pointer"
                  >
                    <option value="Major">Major</option>
                    <option value="Minor">Minor</option>
                    <option value="Research">Research</option>
                    <option value="Documentation">Documentation</option>
                    <option value="Meeting">Meeting</option>
                    <option value="Support">Support</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase text-[var(--text3)] mb-1 block">Priority</label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value)}
                    className="w-full bg-[var(--bg3)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs text-[var(--text)] outline-none cursor-pointer"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase text-[var(--text3)] mb-1 block">Due Date</label>
                  <input
                    type="date"
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="w-full bg-[var(--bg3)] border border-[var(--border)] rounded-xl px-3 py-1.5 text-xs text-[var(--text)] outline-none cursor-pointer"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setAssignModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-[var(--bg3)] text-[var(--text)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateAssignedTask}
                disabled={savingAssignTask}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-md transition disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Assign Task</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REVIEW & RATING MODAL */}
      {reviewModalOpen && activeTracker && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="font-bold text-base text-[var(--text)] flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                Review Tracker — {activeTracker.employee_name} ({filterDate})
              </div>
              <button onClick={() => setReviewModalOpen(false)} className="text-[var(--text3)] hover:text-[var(--text)]">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tasks Summary */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase text-[var(--text3)]">Logged Tasks</label>
              {activeTracker.tasks && activeTracker.tasks.length > 0 ? (
                activeTracker.tasks.map((t: any, i: number) => (
                  <div key={i} className={`p-3 rounded-xl border text-xs bg-[var(--bg3)] ${t.is_flagged ? 'border-rose-500/40 bg-rose-500/5' : t.is_achievement ? 'border-amber-500/40 bg-amber-500/5' : 'border-[var(--border)]'}`}>
                    <div className="flex items-center justify-between font-bold text-[var(--text)] mb-1">
                      <span>#{i+1}. {t.task_description}</span>
                      <div className="flex items-center space-x-2">
                        <span className="bg-indigo-500/10 text-[var(--accent)] px-2 py-0.5 rounded text-[10px]">{t.task_type}</span>
                        <span className="font-bold text-[var(--accent)]">{t.hours_worked}h</span>
                        {t.is_achievement && <span className="bg-amber-500/20 text-amber-600 px-2 py-0.5 rounded text-[10px] font-bold">★ Achievement</span>}
                        {t.is_flagged && <span className="bg-rose-500/20 text-rose-600 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1"><Flag className="w-3 h-3 fill-rose-600" /> Blocker</span>}
                      </div>
                    </div>
                    {t.remarks && <div className="text-[var(--text2)] text-[11px] mt-1"><strong>Remarks:</strong> {t.remarks}</div>}
                    {t.flag_reason && <div className="text-rose-600 text-[11px] mt-1"><strong>Blocker Reason:</strong> {t.flag_reason}</div>}
                  </div>
                ))
              ) : (
                <div className="p-3 text-center text-xs text-[var(--text3)] bg-[var(--bg3)] rounded-xl">No tasks logged ({activeTracker.day_status}).</div>
              )}
            </div>

            {/* Rating Picker */}
            <div>
              <label className="text-[11px] font-bold uppercase text-[var(--text3)] mb-1 block">Manager Rating (1 to 5 Stars)</label>
              <div className="flex items-center space-x-1.5 text-2xl text-amber-500">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setReviewRating(s)}
                    className="p-1 hover:scale-125 transition"
                  >
                    <Star className={`w-6 h-6 ${s <= reviewRating ? 'fill-amber-500' : 'text-gray-300 dark:text-gray-600'}`} />
                  </button>
                ))}
              </div>
            </div>

            {/* Remarks */}
            <div>
              <label className="text-[11px] font-bold uppercase text-[var(--text3)] mb-1 block">Manager Feedback & Remarks</label>
              <textarea
                value={reviewRemarks}
                onChange={(e) => setReviewRemarks(e.target.value)}
                placeholder="Praise performance, note blockers, or write feedback..."
                className="w-full bg-[var(--bg3)] border border-[var(--border)] rounded-xl p-3 text-xs text-[var(--text)] outline-none h-20"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setReviewModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-[var(--bg3)] text-[var(--text)]"
              >
                Close
              </button>
              <button
                type="button"
                onClick={saveManagerReview}
                disabled={savingReview}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-[var(--accent)] text-white"
              >
                Save Review
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

