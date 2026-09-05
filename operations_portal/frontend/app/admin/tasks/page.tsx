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
  CheckCircle2
} from 'lucide-react';
import { api } from '@/lib/api';
import { StatusBadge, PriorityBadge } from '@/components/Badges';

export default function AdminTasksPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [search, setSearch] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
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
  const [formAssigneeId, setFormAssigneeId] = useState('');
  const [formPriority, setFormPriority] = useState('Medium');
  const [formStatus, setFormStatus] = useState('Todo');
  const [formDeadline, setFormDeadline] = useState('');
  const [formEstimatedHours, setFormEstimatedHours] = useState('');
  const [formTags, setFormTags] = useState('');

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
    setFormAssigneeId(employees[0]?.id ? String(employees[0].id) : '');
    setFormPriority('Medium');
    setFormStatus('Todo');
    setFormDeadline('');
    setFormEstimatedHours('4.0');
    setFormTags('Frontend, API');
    setShowCreateModal(true);
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle || !formAssigneeId) {
      showAlert('Please enter task title and select an assignee.', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post('/admin/tasks', {
        title: formTitle,
        description: formDesc,
        assigned_to_id: Number(formAssigneeId),
        priority: formPriority,
        status: formStatus,
        deadline: formDeadline || null,
        estimated_hours: Number(formEstimatedHours) || 0,
        tags: formTags,
      });

      if (res.data?.success) {
        showAlert('Task created and assigned successfully!');
        setShowCreateModal(false);
        fetchTasksAndEmployees();
      }
    } catch (err: any) {
      showAlert(err.response?.data?.error || 'Failed to create task.', 'error');
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
      showAlert('Task deleted.');
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
    const matchesPriority = filterPriority ? t.priority === filterPriority : true;

    return matchesSearch && matchesAssignee && matchesPriority;
  });

  const columns = [
    { id: 'Todo', label: 'To Do', border: 'border-slate-300 dark:border-slate-700' },
    { id: 'In Progress', label: 'In Progress', border: 'border-blue-400 dark:border-blue-800' },
    { id: 'Under Review', label: 'Under Review', border: 'border-amber-400 dark:border-amber-800' },
    { id: 'Completed', label: 'Completed', border: 'border-emerald-400 dark:border-emerald-800' },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-[var(--text-primary)] tracking-tight">
            Work & Task Manager
          </h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Create, prioritize, assign, and track operational deliverables across team members.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="p-1 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl flex items-center shadow-xs">
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                viewMode === 'kanban'
                  ? 'bg-[var(--accent-light)] text-[var(--accent)] font-extrabold shadow-2xs'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              <Kanban className="w-4 h-4" />
              <span className="hidden sm:inline">Kanban</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-[var(--accent-light)] text-[var(--accent)] font-extrabold shadow-2xs'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              <List className="w-4 h-4" />
              <span className="hidden sm:inline">List</span>
            </button>
          </div>

          <button
            onClick={openCreateModal}
            className="px-4 py-2.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white rounded-2xl text-xs font-bold shadow-md transition flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create Task</span>
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

      {/* Search & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--card-bg)] p-3.5 rounded-2xl border border-[var(--card-border)] shadow-2xs transition-colors">
        <div className="relative max-w-xs w-full">
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks..."
            className="w-full pl-9 pr-3 py-2 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl text-xs font-medium text-[var(--text-primary)] focus:outline-none focus:border-sky-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Assignee filter */}
          <select
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            className="px-3 py-2 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl font-semibold text-[var(--text-primary)] focus:outline-none focus:border-sky-500"
          >
            <option value="">All Team Members</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>

          {/* Priority filter */}
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="px-3 py-2 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl font-semibold text-[var(--text-primary)] focus:outline-none focus:border-sky-500"
          >
            <option value="">All Priorities</option>
            <option value="Urgent">Urgent</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>
      </div>

      {/* ─── KANBAN BOARD VIEW ─── */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 items-start">
          {columns.map((col) => {
            const colTasks = filteredTasks.filter((t) => t.status === col.id);
            return (
              <div
                key={col.id}
                className={`bg-[var(--card-bg)] border ${col.border} rounded-3xl p-4 shadow-xs space-y-3.5 flex flex-col min-h-[500px] transition-colors`}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between px-1 pb-2 border-b border-[var(--card-border)]">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-[var(--text-primary)]">{col.label}</span>
                    <span className="w-5 h-5 rounded-full bg-[var(--hover-bg)] text-[var(--text-primary)] flex items-center justify-center text-[10px] font-black">
                      {colTasks.length}
                    </span>
                  </div>
                </div>

                {/* Task Cards */}
                <div className="space-y-3 flex-1">
                  {colTasks.length === 0 ? (
                    <div className="py-12 text-center text-[var(--text-muted)] text-xs italic">
                      No tasks in this stage.
                    </div>
                  ) : (
                    colTasks.map((task) => (
                      <div
                        key={task.id}
                        onClick={() => {
                          setSelectedTask(task);
                          setShowDetailModal(true);
                        }}
                        className="p-4 bg-[var(--card-bg)] border border-[var(--card-border)] hover:border-sky-400 dark:hover:border-sky-500 hover:shadow-md rounded-2xl cursor-pointer transition space-y-2.5 group"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <PriorityBadge priority={task.priority} />
                          {task.deadline && (
                            <span className="text-[10px] font-bold text-[var(--text-muted)] flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              <span>{task.deadline}</span>
                            </span>
                          )}
                        </div>

                        <h4 className="text-xs font-extrabold text-[var(--text-primary)] group-hover:text-sky-500 transition leading-snug">
                          {task.title}
                        </h4>

                        {task.description && (
                          <p className="text-[11px] text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
                            {task.description}
                          </p>
                        )}

                        <div className="pt-2 border-t border-[var(--card-border)] flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 text-[var(--text-primary)] font-bold text-[11px]">
                            <div className="w-5 h-5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 flex items-center justify-center text-[9px] font-black">
                              {task.assigned_to?.name ? task.assigned_to.name[0] : 'U'}
                            </div>
                            <span className="truncate max-w-[100px]">{task.assigned_to?.name || 'Unassigned'}</span>
                          </div>

                          {task.tags?.length > 0 && (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 bg-[var(--hover-bg)] rounded text-[var(--text-muted)] border border-[var(--card-border)]">
                              {task.tags[0]}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── LIST VIEW ─── */}
      {viewMode === 'list' && (
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl overflow-hidden shadow-xs transition-colors">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--hover-bg)] border-b border-[var(--card-border)] text-[var(--text-muted)] uppercase tracking-wider font-bold text-[10px]">
              <tr>
                <th className="py-4 px-6">Task Details</th>
                <th className="py-4 px-6">Assignee</th>
                <th className="py-4 px-6">Priority</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6">Deadline</th>
                <th className="py-4 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--card-border)]">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[var(--text-muted)]">
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
                    className="hover:bg-[var(--hover-bg)] cursor-pointer transition"
                  >
                    <td className="py-4 px-6">
                      <div className="font-extrabold text-[var(--text-primary)] text-sm">{t.title}</div>
                      <div className="text-[11px] text-[var(--text-secondary)] line-clamp-1">{t.description || 'No description provided'}</div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-bold text-[var(--text-primary)]">{t.assigned_to?.name || 'Unassigned'}</div>
                      <div className="text-[10px] text-[var(--text-muted)]">{t.assigned_to?.designation}</div>
                    </td>
                    <td className="py-4 px-6">
                      <PriorityBadge priority={t.priority} />
                    </td>
                    <td className="py-4 px-6">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="py-4 px-6 text-[var(--text-secondary)] font-medium">
                      {t.deadline || 'No deadline'}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTask(t.id, t.title);
                        }}
                        className="p-1.5 text-[var(--text-muted)] hover:text-red-500 rounded-lg"
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
      )}

      {/* ─── CREATE TASK MODAL ─── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--text-primary)] rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl space-y-5 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--card-border)]">
              <h3 className="text-lg font-black text-[var(--text-primary)]">Create & Assign Operational Task</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                  Task Title
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Build Next.js Operations Frontend Portal"
                  className="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl font-semibold text-[var(--text-primary)] focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                  Assign To Employee
                </label>
                <select
                  required
                  value={formAssigneeId}
                  onChange={(e) => setFormAssigneeId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl font-semibold text-[var(--text-primary)] focus:outline-none focus:border-sky-500"
                >
                  <option value="">-- Select Employee --</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} — {e.designation} ({e.department})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                  Detailed Instructions / Scope
                </label>
                <textarea
                  rows={3}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Describe the operational deliverable, expected output, and guidelines..."
                  className="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl font-semibold text-[var(--text-primary)] focus:outline-none focus:border-sky-500"
                ></textarea>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                    Priority
                  </label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl font-semibold text-[var(--text-primary)] focus:outline-none focus:border-sky-500"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                    Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl font-semibold text-[var(--text-primary)] focus:outline-none focus:border-sky-500"
                  >
                    <option value="Todo">To Do</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Under Review">Under Review</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                    Deadline Date
                  </label>
                  <input
                    type="date"
                    value={formDeadline}
                    onChange={(e) => setFormDeadline(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl font-semibold text-[var(--text-primary)] focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                    Est. Hours
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={formEstimatedHours}
                    onChange={(e) => setFormEstimatedHours(e.target.value)}
                    placeholder="e.g. 8.0"
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
                    placeholder="Frontend, API, Automation"
                    className="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl font-semibold text-[var(--text-primary)] focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--card-border)]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-[var(--card-border)] text-[var(--text-secondary)] font-bold hover:bg-[var(--hover-bg)] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white rounded-xl font-bold shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>Assign Task</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── TASK DETAIL & REVIEW MODAL ─── */}
      {showDetailModal && selectedTask && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--text-primary)] rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl space-y-5 animate-fadeIn">
            <div className="flex items-start justify-between pb-3 border-b border-[var(--card-border)]">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <PriorityBadge priority={selectedTask.priority} />
                  <StatusBadge status={selectedTask.status} />
                </div>
                <h3 className="text-lg font-black text-[var(--text-primary)]">{selectedTask.title}</h3>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-4 bg-[var(--hover-bg)] rounded-2xl border border-[var(--card-border)] space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Deliverable Scope
                </div>
                <p className="text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
                  {selectedTask.description || 'No detailed instructions provided.'}
                </p>
              </div>

              {/* Assignee & Deadline details */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-[var(--hover-bg)] rounded-2xl border border-[var(--card-border)]">
                <div>
                  <div className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Assigned To</div>
                  <div className="font-extrabold text-[var(--text-primary)] text-sm">{selectedTask.assigned_to?.name}</div>
                  <div className="text-[11px] text-[var(--text-secondary)]">{selectedTask.assigned_to?.designation}</div>
                </div>

                <div>
                  <div className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Target Deadline</div>
                  <div className="font-extrabold text-[var(--text-primary)] text-sm">{selectedTask.deadline || 'No deadline set'}</div>
                  <div className="text-[11px] text-[var(--text-secondary)]">Est. Hours: {selectedTask.estimated_hours}h</div>
                </div>
              </div>

              {/* Employee Submission Notes (if any) */}
              {selectedTask.submission_notes && (
                <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-2xl space-y-1.5">
                  <div className="text-[11px] font-bold uppercase text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Employee Work Submission Notes</span>
                  </div>
                  <p className="text-indigo-950 dark:text-indigo-200 font-medium whitespace-pre-wrap">
                    {selectedTask.submission_notes}
                  </p>
                  {selectedTask.submission_link && (
                    <a
                      href={selectedTask.submission_link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold text-sky-500 hover:underline pt-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>{selectedTask.submission_link}</span>
                    </a>
                  )}
                </div>
              )}

              {/* Status Action Buttons */}
              <div className="pt-3 border-t border-[var(--card-border)] flex flex-wrap items-center justify-between gap-2">
                <div className="text-[11px] font-bold text-[var(--text-muted)]">Quick Change Stage:</div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() => handleUpdateStatus(selectedTask.id, 'Todo')}
                    className="px-2.5 py-1.5 rounded-lg border border-[var(--card-border)] text-[11px] font-bold hover:bg-[var(--hover-bg)]"
                  >
                    To Do
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(selectedTask.id, 'In Progress')}
                    className="px-2.5 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-[11px] font-bold hover:bg-blue-100 dark:hover:bg-blue-900/50"
                  >
                    In Progress
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(selectedTask.id, 'Completed')}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 shadow-xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approve & Complete</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
