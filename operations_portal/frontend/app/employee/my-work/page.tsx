'use client';

import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  CheckCircle2,
  Calendar,
  X,
  RefreshCw,
  Search,
  CheckSquare,
  Send
} from 'lucide-react';
import { api } from '@/lib/api';
import { StatusBadge, PriorityBadge } from '@/components/Badges';

export default function EmployeeMyWorkPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Status Update / Submission Form
  const [updateStatus, setUpdateStatus] = useState('');
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [submissionLink, setSubmissionLink] = useState('');
  const [hoursSpent, setHoursSpent] = useState('1.5');
  const [submitting, setSubmitting] = useState(false);

  const showAlert = (text: string, type: 'success' | 'error' = 'success') => {
    setAlertMsg({ type, text });
    setTimeout(() => setAlertMsg(null), 4000);
  };

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await api.get('/employee/tasks');
      if (res.data?.tasks) {
        setTasks(res.data.tasks);
      }
    } catch (err) {
      console.error('Failed to load employee tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const openTaskModal = (task: any) => {
    setSelectedTask(task);
    setUpdateStatus(task.status);
    setSubmissionNotes(task.submission_notes || '');
    setSubmissionLink(task.submission_link || '');
    setHoursSpent('1.0');
    setShowModal(true);
  };

  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;
    setSubmitting(true);
    try {
      const res = await api.post(`/employee/tasks/${selectedTask.id}/status`, {
        status: updateStatus,
        submission_notes: submissionNotes,
        submission_link: submissionLink,
        hours_spent: Number(hoursSpent) || 0,
      });

      if (res.data?.success) {
        showAlert(`Task successfully moved to ${updateStatus}!`);
        setShowModal(false);
        fetchTasks();
      }
    } catch (err: any) {
      showAlert(err.response?.data?.error || 'Failed to update task status.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
    const matchesSearch =
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(search.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-[var(--text-primary)] tracking-tight">
            My Assigned Deliverables & Work
          </h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Track tasks assigned to you by Operations Admin, log work progress, and submit deliverables.
          </p>
        </div>

        <button
          onClick={fetchTasks}
          className="p-2 text-[var(--text-secondary)] hover:text-sky-500 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl shadow-2xs transition cursor-pointer"
          title="Refresh List"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
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

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[var(--card-bg)] p-3 rounded-2xl border border-[var(--card-border)] shadow-2xs transition-colors">
        {/* Status Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'ALL', label: 'All Work' },
            { id: 'Todo', label: 'To Do' },
            { id: 'In Progress', label: 'In Progress' },
            { id: 'Under Review', label: 'Under Review' },
            { id: 'Completed', label: 'Completed' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-[var(--accent-light)] text-[var(--accent)] font-extrabold shadow-2xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative max-w-xs w-full">
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search deliverables..."
            className="w-full pl-9 pr-3 py-2 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl text-xs font-medium text-[var(--text-primary)] focus:outline-none focus:border-sky-500"
          />
        </div>
      </div>

      {/* Task Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredTasks.length === 0 ? (
          <div className="col-span-full py-16 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl text-center space-y-2">
            <CheckSquare className="w-8 h-8 text-[var(--text-muted)] mx-auto" />
            <div className="text-sm font-bold text-[var(--text-primary)]">No tasks in this category</div>
            <p className="text-xs text-[var(--text-muted)]">You are all caught up on your assignments.</p>
          </div>
        ) : (
          filteredTasks.map((t) => (
            <div
              key={t.id}
              onClick={() => openTaskModal(t)}
              className="p-5 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl hover:border-sky-400 dark:hover:border-sky-500 hover:shadow-md cursor-pointer transition flex flex-col justify-between space-y-4 group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <PriorityBadge priority={t.priority} />
                  <StatusBadge status={t.status} />
                </div>

                <div>
                  <h3 className="text-sm font-black text-[var(--text-primary)] group-hover:text-sky-500 transition leading-snug">
                    {t.title}
                  </h3>
                  {t.description && (
                    <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-3 leading-relaxed">
                      {t.description}
                    </p>
                  )}
                </div>

                {/* Tags */}
                {t.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {t.tags.map((tag: string) => (
                      <span key={tag} className="px-2 py-0.5 rounded-md bg-[var(--hover-bg)] text-[10px] font-mono text-[var(--text-secondary)] border border-[var(--card-border)]">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Card Footer */}
              <div className="pt-3 border-t border-[var(--card-border)] flex items-center justify-between text-xs">
                <div className="flex items-center gap-1 text-[var(--text-muted)] font-semibold">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{t.deadline ? `Due: ${t.deadline}` : 'No deadline'}</span>
                </div>

                <button
                  type="button"
                  className="px-3 py-1.5 bg-[var(--hover-bg)] group-hover:bg-sky-600 group-hover:text-white rounded-xl text-[var(--text-secondary)] text-xs font-bold transition border border-[var(--card-border)]"
                >
                  Update Status →
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ─── TASK UPDATE & SUBMISSION MODAL ─── */}
      {showModal && selectedTask && (
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
              <button onClick={() => setShowModal(false)} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scope / Instructions */}
            {selectedTask.description && (
              <div className="p-4 bg-[var(--hover-bg)] rounded-2xl border border-[var(--card-border)] text-xs space-y-1">
                <div className="font-bold text-[var(--text-primary)] uppercase tracking-wider text-[10px]">
                  Assignment Instructions
                </div>
                <p className="text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
                  {selectedTask.description}
                </p>
              </div>
            )}

            <form onSubmit={handleUpdateTask} className="space-y-4 text-xs">
              {/* Status Selector */}
              <div>
                <label className="block font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                  Update Task Stage
                </label>
                <select
                  value={updateStatus}
                  onChange={(e) => setUpdateStatus(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl font-bold text-[var(--text-primary)] focus:outline-none focus:border-sky-500"
                >
                  <option value="Todo">To Do (Not Started)</option>
                  <option value="In Progress">In Progress (Currently Working)</option>
                  <option value="Under Review">Under Review (Ready for Sign-Off)</option>
                  <option value="Completed">Completed (Final Delivery)</option>
                </select>
              </div>

              {/* Work Notes */}
              <div>
                <label className="block font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                  Work Notes & Progress Summary
                </label>
                <textarea
                  rows={3}
                  value={submissionNotes}
                  onChange={(e) => setSubmissionNotes(e.target.value)}
                  placeholder="Summarize what was accomplished, changes implemented, or items pending review..."
                  className="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl font-medium text-[var(--text-primary)] focus:outline-none focus:border-sky-500"
                ></textarea>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Deliverable Link */}
                <div>
                  <label className="block font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                    Deliverable / PR / Preview Link
                  </label>
                  <input
                    type="url"
                    value={submissionLink}
                    onChange={(e) => setSubmissionLink(e.target.value)}
                    placeholder="https://github.com/... or https://..."
                    className="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl font-medium text-[var(--text-primary)] focus:outline-none focus:border-sky-500"
                  />
                </div>

                {/* Hours Spent */}
                <div>
                  <label className="block font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                    Hours Logged for this Update
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={hoursSpent}
                    onChange={(e) => setHoursSpent(e.target.value)}
                    placeholder="e.g. 2.5"
                    className="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl font-medium text-[var(--text-primary)] focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--card-border)]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-[var(--card-border)] text-[var(--text-secondary)] font-bold hover:bg-[var(--hover-bg)] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white rounded-xl font-bold shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>Submit Work Update</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
