'use client';

import React, { useState, useEffect } from 'react';
import {
  CheckSquare,
  PlusCircle,
  Search,
  Kanban,
  List,
  Calendar,
  ExternalLink,
  Trash2,
  X,
  RefreshCw,
  CheckCircle2,
  Users,
  User,
  Building2,
  Globe,
  Tag,
  Clock,
  AlertCircle
} from 'lucide-react';
import { api } from '@/lib/api';
import { StatusBadge, PriorityBadge } from '@/components/Badges';

const DEPARTMENTS = [
  'Digital Marketing',
  'IT',
  'IA - Research',
  'WBC',
  'Wealth',
  'Content Publishing'
];

export default function AdminTasksPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [search, setSearch] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // Create Form State
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [assignMode, setAssignMode] = useState<'single' | 'multiple' | 'department' | 'everyone'>('single');
  const [formAssigneeId, setFormAssigneeId] = useState('');
  const [formSelectedAssigneeIds, setFormSelectedAssigneeIds] = useState<number[]>([]);
  const [formTargetDept, setFormTargetDept] = useState('IT');
  const [formPriority, setFormPriority] = useState('Medium');
  const [formStatus, setFormStatus] = useState('Todo');
  const [formDeadline, setFormDeadline] = useState('');
  const [formEstimatedHours, setFormEstimatedHours] = useState('4.0');
  const [formTags, setFormTags] = useState('Operations, Delivery');

  const showAlert = (text: string, type: 'success' | 'error' = 'success') => {
    setAlertMsg({ type, text });
    setTimeout(() => setAlertMsg(null), 4000);
  };

  const fetchTasksAndEmployees = async () => {
    try {
      setLoading(true);
      const [tasksRes, empRes] = await Promise.all([
        api.get('/admin/tasks'),
        api.get('/admin/employees'),
      ]);
      if (tasksRes.data?.tasks) setTasks(tasksRes.data.tasks);
      if (empRes.data?.employees) setEmployees(empRes.data.employees);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasksAndEmployees();
  }, []);

  const openCreateModal = () => {
    setFormTitle('');
    setFormDesc('');
    setAssignMode('single');
    setFormAssigneeId(employees[0]?.id ? String(employees[0].id) : '');
    setFormSelectedAssigneeIds(employees[0]?.id ? [employees[0].id] : []);
    setFormTargetDept('IT');
    setFormPriority('Medium');
    setFormStatus('Todo');
    setFormDeadline('');
    setFormEstimatedHours('4.0');
    setFormTags('Operations, Delivery');
    setShowCreateModal(true);
  };

  const toggleMultipleAssignee = (id: number) => {
    if (formSelectedAssigneeIds.includes(id)) {
      setFormSelectedAssigneeIds(formSelectedAssigneeIds.filter((empId) => empId !== id));
    } else {
      setFormSelectedAssigneeIds([...formSelectedAssigneeIds, id]);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle) {
      showAlert('Please enter task title.', 'error');
      return;
    }

    const payload: any = {
      title: formTitle,
      description: formDesc,
      priority: formPriority,
      status: formStatus,
      deadline: formDeadline || null,
      estimated_hours: Number(formEstimatedHours) || 0,
      tags: formTags,
      assign_mode: assignMode,
    };

    if (assignMode === 'single') {
      if (!formAssigneeId) {
        showAlert('Please select an assignee.', 'error');
        return;
      }
      payload.assigned_to_id = Number(formAssigneeId);
    } else if (assignMode === 'multiple') {
      if (formSelectedAssigneeIds.length === 0) {
        showAlert('Please select at least one assignee.', 'error');
        return;
      }
      payload.assigned_to_ids = formSelectedAssigneeIds;
    } else if (assignMode === 'department') {
      if (!formTargetDept) {
        showAlert('Please choose a department.', 'error');
        return;
      }
      payload.target_department = formTargetDept;
    }
    // 'everyone' mode needs no extra IDs

    setSaving(true);
    try {
      const res = await api.post('/admin/tasks', payload);
      if (res.data?.success) {
        showAlert(res.data.message || 'Task assigned successfully!');
        setShowCreateModal(false);
        fetchTasksAndEmployees();
      }
    } catch (err: any) {
      showAlert(err.response?.data?.error || 'Failed to assign task.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (taskId: number, newStatus: string) => {
    try {
      await api.put(`/admin/tasks/${taskId}`, { status: newStatus });
      showAlert(`Task marked as ${newStatus}!`);
      fetchTasksAndEmployees();
      if (selectedTask?.id === taskId) {
        setSelectedTask((prev: any) => ({ ...prev, status: newStatus }));
      }
    } catch (err) {
      showAlert('Failed to update task status.', 'error');
    }
  };

  const handleDeleteTask = async (id: number, title: string) => {
    if (!confirm(`Delete task '${title}'?`)) return;
    try {
      await api.delete(`/admin/tasks/${id}`);
      showAlert('Task deleted successfully.');
      setShowDetailModal(false);
      fetchTasksAndEmployees();
    } catch (err) {
      showAlert('Failed to delete task.', 'error');
    }
  };

  // Filter Tasks
  const filteredTasks = tasks.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(search.toLowerCase())) ||
      (t.assigned_to?.name && t.assigned_to.name.toLowerCase().includes(search.toLowerCase()));

    const matchesAssignee = filterAssignee ? String(t.assigned_to?.id) === filterAssignee : true;
    const matchesDept = filterDept ? t.assigned_to?.department === filterDept : true;
    const matchesPriority = filterPriority ? t.priority === filterPriority : true;

    return matchesSearch && matchesAssignee && matchesDept && matchesPriority;
  });

  const columns = [
    { id: 'Todo', label: 'To Do', border: 'border-slate-300 dark:border-slate-700' },
    { id: 'In Progress', label: 'In Progress', border: 'border-blue-400 dark:border-blue-800' },
    { id: 'Under Review', label: 'Under Review', border: 'border-amber-400 dark:border-amber-800' },
    { id: 'Completed', label: 'Completed', border: 'border-emerald-400 dark:border-emerald-800' },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              Operations Task Engine
            </span>
            <span className="text-xs text-[var(--text-muted)]">• Individual & Multi-Assign Broadcast</span>
          </div>
          <h2 className="text-2xl font-black text-[var(--text-primary)] tracking-tight">
            Work & Task Assignment Manager
          </h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Dispatch operational deliverables to individuals, cross-functional teams, entire departments, or broadcast to everyone.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-1 shadow-2xs">
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'kanban'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Kanban className="w-4 h-4" />
              <span className="hidden sm:inline">Kanban</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <List className="w-4 h-4" />
              <span className="hidden sm:inline">List</span>
            </button>
          </div>

          <button
            onClick={openCreateModal}
            className="px-4 py-2.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white rounded-2xl text-xs font-bold shadow-md hover:shadow-lg transition flex items-center gap-2 cursor-pointer active:scale-95 shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create & Assign Task</span>
          </button>
        </div>
      </div>

      {/* Alert Banner */}
      {alertMsg && (
        <div className={`p-4 rounded-2xl text-xs font-bold border flex items-center justify-between animate-fadeIn ${
          alertMsg.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
            : 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800'
        }`}>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{alertMsg.text}</span>
          </div>
          <button onClick={() => setAlertMsg(null)} className="cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-[var(--card-bg)] border border-[var(--card-border)] p-3.5 rounded-2xl">
        <div className="relative">
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks..."
            className="w-full pl-9 pr-3 py-2 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl text-xs font-medium text-[var(--text-primary)] focus:outline-none focus:border-sky-500"
          />
        </div>

        <div>
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl text-xs font-medium text-[var(--text-primary)] focus:outline-none focus:border-sky-500"
          >
            <option value="">All Departments</option>
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl text-xs font-medium text-[var(--text-primary)] focus:outline-none focus:border-sky-500"
          >
            <option value="">All Team Members</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.name} ({emp.department})</option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl text-xs font-medium text-[var(--text-primary)] focus:outline-none focus:border-sky-500"
          >
            <option value="">All Priorities</option>
            <option value="Urgent">Urgent</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>
      </div>

      {/* ─── KANBAN VIEW ─── */}
      {viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {columns.map((col) => {
            const colTasks = filteredTasks.filter((t) => t.status === col.id);
            return (
              <div
                key={col.id}
                className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl p-4 space-y-3 min-h-[500px] flex flex-col"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-2 border-b border-[var(--card-border)]">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-xs text-[var(--text-primary)]">{col.label}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[var(--hover-bg)] text-[var(--text-secondary)]">
                      {colTasks.length}
                    </span>
                  </div>
                </div>

                {/* Task Cards */}
                <div className="space-y-3 flex-1 overflow-y-auto max-h-[600px] pr-1">
                  {colTasks.length === 0 ? (
                    <div className="h-32 flex items-center justify-center text-center text-xs text-[var(--text-muted)] italic">
                      No tasks in this lane
                    </div>
                  ) : (
                    colTasks.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => {
                          setSelectedTask(t);
                          setShowDetailModal(true);
                        }}
                        className="p-4 bg-[var(--hover-bg)]/50 hover:bg-[var(--hover-bg)] border border-[var(--card-border)] hover:border-sky-400 dark:hover:border-sky-600 rounded-2xl shadow-2xs hover:shadow-md transition cursor-pointer space-y-3 group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <PriorityBadge priority={t.priority} />
                          {t.deadline && (
                            <span className="text-[10px] font-bold text-[var(--text-muted)] flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-sky-500" />
                              <span>{t.deadline}</span>
                            </span>
                          )}
                        </div>

                        <div>
                          <h4 className="font-extrabold text-xs text-[var(--text-primary)] line-clamp-2 leading-snug group-hover:text-sky-600 dark:group-hover:text-sky-400 transition">
                            {t.title}
                          </h4>
                          {t.description && (
                            <p className="text-[11px] text-[var(--text-muted)] mt-1 line-clamp-2">
                              {t.description}
                            </p>
                          )}
                        </div>

                        <div className="pt-2 border-t border-[var(--card-border)] flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-1.5 min-w-0 pr-1">
                            <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-sky-600 to-indigo-600 text-white flex items-center justify-center text-[10px] font-black shrink-0">
                              {t.assigned_to?.name ? t.assigned_to.name[0].toUpperCase() : 'U'}
                            </div>
                            <span className="font-bold text-[var(--text-secondary)] truncate">
                              {t.assigned_to?.name || 'Unassigned'}
                            </span>
                          </div>

                          <span className="text-[10px] font-bold text-[var(--text-muted)] shrink-0">
                            {t.estimated_hours}h
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ─── LIST VIEW ─── */
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl overflow-hidden shadow-xs transition-colors">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--hover-bg)] border-b border-[var(--card-border)] text-[var(--text-muted)] uppercase tracking-wider font-bold text-[10px]">
                <tr>
                  <th className="py-4 px-6">Task Title & Details</th>
                  <th className="py-4 px-6">Assignee</th>
                  <th className="py-4 px-6">Department</th>
                  <th className="py-4 px-6">Priority</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6">Deadline</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--card-border)]">
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-[var(--text-muted)]">
                      No tasks found.
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => {
                        setSelectedTask(t);
                        setShowDetailModal(true);
                      }}
                      className="hover:bg-[var(--hover-bg)] transition cursor-pointer"
                    >
                      <td className="py-4 px-6 max-w-sm">
                        <div className="font-extrabold text-[var(--text-primary)] text-sm line-clamp-1">
                          {t.title}
                        </div>
                        {t.description && (
                          <div className="text-[11px] text-[var(--text-muted)] line-clamp-1 mt-0.5">
                            {t.description}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-sky-600 to-indigo-600 text-white flex items-center justify-center text-[10px] font-black shrink-0">
                            {t.assigned_to?.name ? t.assigned_to.name[0].toUpperCase() : 'U'}
                          </div>
                          <div className="font-bold text-[var(--text-primary)]">{t.assigned_to?.name}</div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                          {t.assigned_to?.department || 'Operations'}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <PriorityBadge priority={t.priority} />
                      </td>
                      <td className="py-4 px-6">
                        <StatusBadge status={t.status} />
                      </td>
                      <td className="py-4 px-6 text-[var(--text-secondary)] font-medium">
                        {t.deadline || '—'}
                      </td>
                      <td className="py-4 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleDeleteTask(t.id, t.title)}
                          className="p-1.5 text-[var(--text-muted)] hover:text-red-500 rounded-lg transition"
                          title="Delete Task"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── CREATE & ASSIGN TASK MODAL (SINGLE, MULTIPLE, DEPT, EVERYONE) ─── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-3 sm:p-6 overflow-hidden">
          <div className="relative w-full max-w-xl bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--text-primary)] rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden my-auto animate-fadeIn">
            {/* Modal Header (Fixed at top) */}
            <div className="px-6 py-4.5 border-b border-[var(--card-border)] flex items-center justify-between shrink-0 bg-[var(--card-bg)]">
              <div>
                <h3 className="text-base sm:text-lg font-black text-[var(--text-primary)]">
                  Create & Assign Task
                </h3>
                <p className="text-[11px] sm:text-xs text-[var(--text-muted)]">
                  Assign to an individual, multiple people, a department, or broadcast to everyone.
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] rounded-xl cursor-pointer transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form with Scrollable Content */}
            <form onSubmit={handleCreateTask} className="flex flex-col flex-1 overflow-hidden">
              <div className="px-6 py-5 overflow-y-auto space-y-4 flex-1 text-xs">
                {/* Task Title */}
                <div>
                  <label className="block font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                    Task Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Bulk Email Campaign Setup / Report Automation"
                    className="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl font-semibold text-[var(--text-primary)] focus:outline-none focus:border-sky-500"
                  />
                </div>

                {/* Task Description */}
                <div>
                  <label className="block font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                    Task Description & Requirements
                  </label>
                  <textarea
                    rows={3}
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    placeholder="Provide explicit instructions, guidelines, and expected deliverable outputs..."
                    className="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl font-medium text-[var(--text-primary)] focus:outline-none focus:border-sky-500 leading-relaxed"
                  />
                </div>

                {/* ── ASSIGNMENT MODE SELECTOR ── */}
                <div className="p-3.5 bg-sky-50/40 dark:bg-sky-950/20 rounded-2xl border border-sky-200 dark:border-sky-900/60 space-y-3">
                  <label className="font-extrabold uppercase tracking-wider text-sky-900 dark:text-sky-300 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-sky-600" />
                    <span>Assign To / Target Scope</span>
                  </label>

                  {/* 4 Mode Pills */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setAssignMode('single')}
                      className={`py-2 px-2.5 rounded-xl font-bold text-center transition flex flex-col items-center gap-1 cursor-pointer ${
                        assignMode === 'single'
                          ? 'bg-sky-600 text-white shadow-xs'
                          : 'bg-[var(--card-bg)] text-[var(--text-secondary)] border border-[var(--card-border)] hover:bg-[var(--hover-bg)]'
                      }`}
                    >
                      <User className="w-3.5 h-3.5" />
                      <span className="text-[11px]">Single Person</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAssignMode('multiple')}
                      className={`py-2 px-2.5 rounded-xl font-bold text-center transition flex flex-col items-center gap-1 cursor-pointer ${
                        assignMode === 'multiple'
                          ? 'bg-sky-600 text-white shadow-xs'
                          : 'bg-[var(--card-bg)] text-[var(--text-secondary)] border border-[var(--card-border)] hover:bg-[var(--hover-bg)]'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span className="text-[11px]">Multiple Team</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAssignMode('department')}
                      className={`py-2 px-2.5 rounded-xl font-bold text-center transition flex flex-col items-center gap-1 cursor-pointer ${
                        assignMode === 'department'
                          ? 'bg-sky-600 text-white shadow-xs'
                          : 'bg-[var(--card-bg)] text-[var(--text-secondary)] border border-[var(--card-border)] hover:bg-[var(--hover-bg)]'
                      }`}
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      <span className="text-[11px]">By Department</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAssignMode('everyone')}
                      className={`py-2 px-2.5 rounded-xl font-bold text-center transition flex flex-col items-center gap-1 cursor-pointer ${
                        assignMode === 'everyone'
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'bg-[var(--card-bg)] text-[var(--text-secondary)] border border-[var(--card-border)] hover:bg-[var(--hover-bg)]'
                      }`}
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span className="text-[11px]">Everyone</span>
                    </button>
                  </div>

                  {/* Sub-selectors depending on mode */}
                  {assignMode === 'single' && (
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-[var(--text-muted)] mb-1">
                        Select Team Member:
                      </label>
                      <select
                        value={formAssigneeId}
                        onChange={(e) => setFormAssigneeId(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl font-semibold text-[var(--text-primary)] focus:outline-none focus:border-sky-500"
                      >
                        {employees.map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.name} — {emp.designation || emp.department} ({emp.email})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {assignMode === 'multiple' && (
                    <div>
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase text-[var(--text-muted)] mb-1.5">
                        <span>Select Target Employees:</span>
                        <span className="text-sky-600 dark:text-sky-400">{formSelectedAssigneeIds.length} selected</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-1">
                        {employees.map((emp) => {
                          const isSel = formSelectedAssigneeIds.includes(emp.id);
                          return (
                            <button
                              key={emp.id}
                              type="button"
                              onClick={() => toggleMultipleAssignee(emp.id)}
                              className={`p-2 rounded-xl border text-left text-xs transition flex items-center justify-between cursor-pointer ${
                                isSel
                                  ? 'bg-sky-600 text-white border-sky-600 font-bold'
                                  : 'bg-[var(--card-bg)] text-[var(--text-primary)] border-[var(--card-border)] hover:bg-[var(--hover-bg)]'
                              }`}
                            >
                              <div className="truncate pr-1">
                                <div className="truncate font-bold">{emp.name}</div>
                                <div className={`text-[10px] ${isSel ? 'text-sky-100' : 'text-[var(--text-muted)]'}`}>{emp.department}</div>
                              </div>
                              {isSel ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <div className="w-3.5 h-3.5 rounded border border-[var(--card-border)] shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {assignMode === 'department' && (
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-[var(--text-muted)] mb-1">
                        Select Department to Assign to All Members:
                      </label>
                      <select
                        value={formTargetDept}
                        onChange={(e) => setFormTargetDept(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl font-semibold text-[var(--text-primary)] focus:outline-none focus:border-sky-500"
                      >
                        {DEPARTMENTS.map((dept) => {
                          const count = employees.filter((e) => e.assigned_departments?.includes(dept) || e.department === dept).length;
                          return (
                            <option key={dept} value={dept}>
                              {dept} ({count} active members)
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}

                  {assignMode === 'everyone' && (
                    <div className="p-3 bg-purple-100 dark:bg-purple-950/50 rounded-xl text-purple-900 dark:text-purple-200 text-xs font-semibold flex items-center gap-2">
                      <Globe className="w-4 h-4 shrink-0 text-purple-600" />
                      <span>This task will be automatically dispatched to all {employees.length} active employees across all departments.</span>
                    </div>
                  )}
                </div>

                {/* Priority & Deadline */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                      Priority Level
                    </label>
                    <select
                      value={formPriority}
                      onChange={(e) => setFormPriority(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl font-semibold text-[var(--text-primary)] focus:outline-none focus:border-sky-500"
                    >
                      <option value="Urgent">Urgent (Immediate SLA)</option>
                      <option value="High">High Priority</option>
                      <option value="Medium">Medium Priority</option>
                      <option value="Low">Low Priority</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                      Target Deadline
                    </label>
                    <input
                      type="date"
                      value={formDeadline}
                      onChange={(e) => setFormDeadline(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl font-semibold text-[var(--text-primary)] focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                {/* Estimated Hours & Tags */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                      Estimated Hours
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={formEstimatedHours}
                      onChange={(e) => setFormEstimatedHours(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl font-semibold text-[var(--text-primary)] focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                      Tags (Comma Separated)
                    </label>
                    <input
                      type="text"
                      value={formTags}
                      onChange={(e) => setFormTags(e.target.value)}
                      placeholder="e.g. Bulk Email, API, Research"
                      className="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl font-semibold text-[var(--text-primary)] focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>
              </div>

              {/* Modal Footer (Sticky at bottom) */}
              <div className="px-6 py-4 border-t border-[var(--card-border)] bg-[var(--card-bg)] flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-[var(--card-border)] text-[var(--text-secondary)] font-bold hover:bg-[var(--hover-bg)] transition cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white rounded-xl font-bold shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50 text-xs"
                >
                  {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>{assignMode === 'everyone' ? 'Broadcast to Everyone' : 'Dispatch Task'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── TASK DETAIL MODAL ─── */}
      {showDetailModal && selectedTask && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-3 sm:p-4 overflow-hidden">
          <div className="bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--text-primary)] rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl space-y-5 animate-fadeIn my-auto max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-[var(--card-border)]">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <PriorityBadge priority={selectedTask.priority} />
                  <StatusBadge status={selectedTask.status} />
                </div>
                <h3 className="text-lg font-black text-[var(--text-primary)]">
                  {selectedTask.title}
                </h3>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                  Description
                </div>
                <div className="p-3.5 bg-[var(--hover-bg)] rounded-xl text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap font-medium">
                  {selectedTask.description || 'No additional instructions provided.'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3.5 bg-[var(--hover-bg)]/60 rounded-2xl border border-[var(--card-border)]">
                <div>
                  <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Assignee</div>
                  <div className="font-extrabold text-[var(--text-primary)] mt-0.5">{selectedTask.assigned_to?.name}</div>
                  <div className="text-[10px] text-sky-600 dark:text-sky-400 font-semibold">{selectedTask.assigned_to?.department}</div>
                </div>

                <div>
                  <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Deadline</div>
                  <div className="font-extrabold text-[var(--text-primary)] mt-0.5">{selectedTask.deadline || 'Flexible'}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">{selectedTask.estimated_hours} hours planned</div>
                </div>
              </div>

              {/* Status Update Quick Buttons */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Update Task Status:
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {['Todo', 'In Progress', 'Under Review', 'Completed'].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleUpdateStatus(selectedTask.id, s)}
                      className={`py-2 rounded-xl font-bold transition text-xs cursor-pointer ${
                        selectedTask.status === s
                          ? 'bg-sky-600 text-white shadow-xs'
                          : 'bg-[var(--card-bg)] text-[var(--text-secondary)] border border-[var(--card-border)] hover:bg-[var(--hover-bg)]'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-[var(--card-border)]">
                <button
                  onClick={() => handleDeleteTask(selectedTask.id, selectedTask.title)}
                  className="px-3.5 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer text-xs"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Task</span>
                </button>

                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-4 py-2 bg-[var(--hover-bg)] hover:bg-[var(--card-border)] text-[var(--text-primary)] rounded-xl font-bold transition cursor-pointer text-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
