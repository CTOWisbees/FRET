'use client';

import React, { useState, useEffect } from 'react';
import {
  CalendarCheck, Calendar, Filter, Star, CheckCircle2, AlertCircle,
  Clock, User, Building2, Download, Search, ChevronRight, X,
  MessageSquare, ShieldAlert, Award, Unlock, Check, ThumbsUp, Eye
} from 'lucide-react';
import { api, getOpsBaseUrl } from '@/lib/api';

export default function ManagerTrackerReviewPage() {
  const [trackers, setTrackers] = useState<any[]>([]);
  const [unlockRequests, setUnlockRequests] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'trackers' | 'unlocks'>('trackers');
  const [filterDate, setFilterDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Review Modal State
  const [selectedTracker, setSelectedTracker] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [rating, setRating] = useState<number>(0);
  const [remarks, setRemarks] = useState<string>('');
  const [submittingReview, setSubmittingReview] = useState<boolean>(false);

  // Unlock Decision Modal State
  const [selectedUnlock, setSelectedUnlock] = useState<any>(null);
  const [unlockDecision, setUnlockDecision] = useState<'approve' | 'reject'>('approve');
  const [unlockNotes, setUnlockNotes] = useState<string>('');
  const [submittingUnlock, setSubmittingUnlock] = useState<boolean>(false);

  const fetchTrackers = async () => {
    setLoading(true);
    try {
      let query = `?date=${filterDate}`;
      if (statusFilter) query += `&status=${statusFilter}`;
      const res = await api.get(`/tracker/admin/list${query}`);
      if (res.data?.success) {
        setTrackers(res.data.trackers || []);
      }
    } catch (err) {
      console.error('Failed to load department trackers:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnlockRequests = async () => {
    try {
      const res = await api.get('/tracker/admin/unlock-requests?status=Pending');
      if (res.data?.success) {
        setUnlockRequests(res.data.requests || []);
      }
    } catch (err) {
      console.error('Failed to load unlock requests:', err);
    }
  };

  useEffect(() => {
    fetchTrackers();
    fetchUnlockRequests();
  }, [filterDate, statusFilter]);

  const openReviewModal = async (t: any) => {
    setDetailLoading(true);
    setSelectedTracker(null);
    setRating(t.manager_rating || 0);
    setRemarks(t.manager_remarks || '');
    try {
      const res = await api.get(`/tracker/daily?date=${t.date}&user_id=${t.user_id}`);
      if (res.data) {
        setSelectedTracker(res.data);
      }
    } catch (err) {
      console.error(err);
      setSelectedTracker(t);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSaveReview = async () => {
    if (!selectedTracker) return;
    setSubmittingReview(true);
    setMessage(null);
    try {
      const res = await api.post('/tracker/admin/review', {
        tracker_day_id: selectedTracker.id,
        manager_rating: rating,
        manager_remarks: remarks
      });
      if (res.data?.success) {
        setMessage({ type: 'success', text: res.data.message || 'Review saved successfully!' });
        setSelectedTracker(null);
        await fetchTrackers();
      } else {
        setMessage({ type: 'error', text: res.data?.error || 'Failed to save review.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to save review.' });
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleUnlockDecisionSubmit = async () => {
    if (!selectedUnlock) return;
    setSubmittingUnlock(true);
    setMessage(null);
    try {
      const res = await api.post('/tracker/admin/unlock-decision', {
        request_id: selectedUnlock.id,
        decision: unlockDecision,
        review_notes: unlockNotes
      });
      if (res.data?.success) {
        setMessage({ type: 'success', text: res.data.message || 'Decision processed.' });
        setSelectedUnlock(null);
        setUnlockNotes('');
        await fetchUnlockRequests();
        await fetchTrackers();
      } else {
        setMessage({ type: 'error', text: res.data?.error || 'Failed to process decision.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to process decision.' });
    } finally {
      setSubmittingUnlock(false);
    }
  };

  const filteredTrackers = trackers.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (t.user_name && t.user_name.toLowerCase().includes(q)) ||
      (t.user_department && t.user_department.toLowerCase().includes(q)) ||
      (t.user_email && t.user_email.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header Banner */}
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-black text-xl">
            <CalendarCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-[var(--text-primary)]">
              Department Tracker Review
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-muted)]">
              Manager Console • Review daily work submissions, assign ratings, and resolve unlock requests
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={`${getOpsBaseUrl()}/tracker/export?date=${filterDate}`}
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-2 rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--card-border)]/20 transition flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-500" />
            <span>Export CSV</span>
          </a>
        </div>
      </div>

      {/* Tabs & Stats */}
      <div className="flex items-center gap-2 border-b border-[var(--card-border)] pb-2">
        <button
          onClick={() => setActiveTab('trackers')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'trackers'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-[var(--text-secondary)] hover:bg-[var(--card-border)]/20'
          }`}
        >
          <CalendarCheck className="w-4 h-4" />
          <span>Daily Trackers ({filteredTrackers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('unlocks')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 relative ${
            activeTab === 'unlocks'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-[var(--text-secondary)] hover:bg-[var(--card-border)]/20'
          }`}
        >
          <Unlock className="w-4 h-4" />
          <span>Unlock Requests</span>
          {unlockRequests.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black">
              {unlockRequests.length}
            </span>
          )}
        </button>
      </div>

      {/* Feedback Message */}
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

      {activeTab === 'trackers' && (
        <>
          {/* Filter Bar */}
          <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--card-border)] bg-[var(--sidebar-bg)]">
                <Calendar className="w-4 h-4 text-purple-500" />
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="bg-transparent text-xs font-bold text-[var(--text-primary)] focus:outline-none cursor-pointer"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] text-xs font-bold text-[var(--text-primary)] focus:outline-none cursor-pointer"
              >
                <option value="">All Statuses</option>
                <option value="Submitted">Submitted</option>
                <option value="Draft">Draft</option>
                <option value="Locked">Locked</option>
              </select>
            </div>

            <div className="relative w-full md:w-64">
              <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search employee or role..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Trackers List Table */}
          <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-xs text-[var(--text-muted)]">Loading trackers...</div>
            ) : filteredTrackers.length === 0 ? (
              <div className="p-12 text-center text-xs text-[var(--text-muted)]">
                No tracker submissions found for this date.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--sidebar-bg)] border-b border-[var(--card-border)] text-[var(--text-muted)] uppercase tracking-wider font-extrabold text-[10px]">
                    <tr>
                      <th className="p-4">Employee</th>
                      <th className="p-4">Department</th>
                      <th className="p-4 text-center">Hours</th>
                      <th className="p-4 text-center">Tasks</th>
                      <th className="p-4 text-center">Status</th>
                      <th className="p-4 text-center">Manager Rating</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--card-border)]">
                    {filteredTrackers.map((t) => (
                      <tr key={t.id} className="hover:bg-[var(--card-border)]/10 transition">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-xs">
                              {t.user_name ? t.user_name[0].toUpperCase() : 'U'}
                            </div>
                            <div>
                              <p className="font-black text-[var(--text-primary)]">{t.user_name}</p>
                              <p className="text-[10px] text-[var(--text-muted)]">{t.user_designation || t.user_email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 font-medium text-[var(--text-secondary)]">{t.user_department}</td>
                        <td className="p-4 text-center font-black text-emerald-600 dark:text-emerald-400">
                          {t.total_hours?.toFixed(1) || '0.0'}h
                        </td>
                        <td className="p-4 text-center font-bold text-[var(--text-primary)]">
                          {t.tasks_count || 0}
                          {t.achievements_count > 0 && (
                            <span className="ml-1 text-amber-500 font-bold">⭐ {t.achievements_count}</span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            t.status === 'Submitted'
                              ? 'bg-emerald-500/10 text-emerald-600'
                              : t.status === 'Locked'
                              ? 'bg-rose-500/10 text-rose-600'
                              : 'bg-amber-500/10 text-amber-600'
                          }`}>
                            {t.status}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          {t.manager_rating > 0 ? (
                            <div className="flex items-center justify-center gap-0.5 text-amber-500">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star
                                  key={s}
                                  className={`w-3.5 h-3.5 ${s <= t.manager_rating ? 'fill-amber-500' : 'text-slate-300 dark:text-slate-700'}`}
                                />
                              ))}
                            </div>
                          ) : (
                            <span className="text-[10px] text-[var(--text-muted)]">Not Rated</span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => openReviewModal(t)}
                            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 ml-auto cursor-pointer shadow-xs"
                          >
                            <Eye className="w-3.5 h-3.5" /> Review
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'unlocks' && (
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-[var(--card-border)] flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-[var(--text-primary)]">
              Pending Tracker Unlock Requests
            </h3>
            <span className="text-xs text-[var(--text-muted)]">{unlockRequests.length} pending</span>
          </div>

          {unlockRequests.length === 0 ? (
            <div className="p-12 text-center text-xs text-[var(--text-muted)]">
              No pending unlock requests at this time.
            </div>
          ) : (
            <div className="divide-y divide-[var(--card-border)]">
              {unlockRequests.map((req) => (
                <div key={req.id} className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-[var(--card-border)]/5 transition">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-[var(--text-primary)]">{req.user_name}</span>
                      <span className="text-xs text-[var(--text-muted)]">({req.department})</span>
                      <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 text-[10px] font-bold">
                        Date: {req.date}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)]">
                      <strong className="text-[var(--text-primary)]">Reason:</strong> {req.reason}
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)]">
                      Requested on: {new Date(req.requested_at).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        setSelectedUnlock(req);
                        setUnlockDecision('approve');
                      }}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" /> Approve Unlock
                    </button>
                    <button
                      onClick={() => {
                        setSelectedUnlock(req);
                        setUnlockDecision('reject');
                      }}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" /> Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Review Modal */}
      {selectedTracker && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--card-border)]">
              <div>
                <h3 className="text-base font-black text-[var(--text-primary)]">
                  Reviewing {selectedTracker.employee_name || selectedTracker.user_name}'s Tracker
                </h3>
                <p className="text-xs text-[var(--text-muted)]">Date: {selectedTracker.date}</p>
              </div>
              <button onClick={() => setSelectedTracker(null)} className="p-1 hover:opacity-75 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Task rows breakdown */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)]">Logged Tasks</h4>
              {selectedTracker.tasks && selectedTracker.tasks.length > 0 ? (
                <div className="space-y-2">
                  {selectedTracker.tasks.map((task: any, idx: number) => (
                    <div key={idx} className="p-3 rounded-xl border border-[var(--card-border)] bg-[var(--sidebar-bg)] space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/10 text-purple-600">
                            {task.task_type}
                          </span>
                          {task.is_achievement && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-600 flex items-center gap-1">
                              ⭐ Achievement
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                          {task.hours_worked}h
                        </span>
                      </div>
                      <p className="text-xs font-medium text-[var(--text-primary)]">{task.task_description}</p>
                      {task.remarks && (
                        <p className="text-[11px] text-[var(--text-muted)] italic">Remarks: {task.remarks}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[var(--text-muted)]">No tasks logged.</p>
              )}
            </div>

            {/* Rating & Feedback input */}
            <div className="pt-4 border-t border-[var(--card-border)] space-y-3">
              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                  Manager Rating (1 to 5 Stars)
                </label>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      type="button"
                      key={s}
                      onClick={() => setRating(s)}
                      className="p-1 hover:scale-125 transition cursor-pointer"
                    >
                      <Star
                        className={`w-6 h-6 ${s <= rating ? 'text-amber-500 fill-amber-500' : 'text-slate-300 dark:text-slate-700'}`}
                      />
                    </button>
                  ))}
                  <span className="text-xs font-bold text-[var(--text-muted)] ml-2">{rating}/5 Stars</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                  Feedback & Remarks
                </label>
                <textarea
                  rows={3}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Provide constructive feedback, appreciation, or action items..."
                  className="w-full px-3 py-2 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-[var(--card-border)] flex justify-end gap-2">
              <button
                onClick={() => setSelectedTracker(null)}
                className="px-4 py-2 rounded-xl border border-[var(--card-border)] text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={submittingReview}
                onClick={handleSaveReview}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
              >
                <Check className="w-4 h-4" /> Save Review
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unlock Decision Modal */}
      {selectedUnlock && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--card-border)]">
              <h3 className="text-base font-black text-[var(--text-primary)]">
                {unlockDecision === 'approve' ? 'Approve' : 'Reject'} Unlock Request
              </h3>
              <button onClick={() => setSelectedUnlock(null)} className="p-1 hover:opacity-75 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-[var(--text-secondary)] space-y-1">
              <p><strong>Employee:</strong> {selectedUnlock.user_name}</p>
              <p><strong>Date:</strong> {selectedUnlock.date}</p>
              <p><strong>Reason:</strong> {selectedUnlock.reason}</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                Review Notes (Optional)
              </label>
              <textarea
                rows={2}
                value={unlockNotes}
                onChange={(e) => setUnlockNotes(e.target.value)}
                placeholder="Add notes for the employee..."
                className="w-full px-3 py-2 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              />
            </div>

            <div className="pt-3 border-t border-[var(--card-border)] flex justify-end gap-2">
              <button
                onClick={() => setSelectedUnlock(null)}
                className="px-4 py-2 rounded-xl border border-[var(--card-border)] text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={submittingUnlock}
                onClick={handleUnlockDecisionSubmit}
                className={`px-4 py-2 text-white rounded-xl text-xs font-bold transition cursor-pointer ${
                  unlockDecision === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                Confirm {unlockDecision === 'approve' ? 'Approval' : 'Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
