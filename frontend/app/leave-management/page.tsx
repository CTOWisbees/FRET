'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { 
  CheckCircle, 
  XCircle, 
  Download, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  RefreshCw,
  FileText,
  Send,
  Calendar
} from 'lucide-react';
import { api, getApiUrl } from '@/lib/api';

export default function LeaveManagementPage() {
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [actionLoading, setActionLoading] = useState<Record<number, boolean>>({});
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 1. Instantly hydrate cached leaves for 0ms initial render
  useEffect(() => {
    try {
      const cached = localStorage.getItem('fret_leaves_cache');
      if (cached) {
        setLeaveRequests(JSON.parse(cached));
        setLoading(false);
      }
    } catch (e) {}
  }, []);

  const fetchLeaves = async () => {
    try {
      const res = await api.get('/api/leave-management');
      if (res.data?.leaves) {
        setLeaveRequests(res.data.leaves);
        localStorage.setItem('fret_leaves_cache', JSON.stringify(res.data.leaves));
      }
    } catch (e) {
      console.error('Failed to fetch leave requests:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, []);

  const handleApprove = async (id: number, employeeName: string) => {
    if (!confirm(`Are you sure you want to approve leave for ${employeeName}? An official approval letter PDF will be generated and emailed to the employee.`)) {
      return;
    }

    setActionLoading(prev => ({ ...prev, [id]: true }));
    setAlertMsg(null);

    try {
      const res = await api.post(`/api/leave/${id}/approve`);
      if (res.data?.success) {
        setAlertMsg({
          type: 'success',
          text: res.data.message || `Leave approved and sanction letter PDF emailed to ${employeeName}.`
        });
        await fetchLeaves();
      } else {
        setAlertMsg({
          type: 'error',
          text: res.data?.message || 'Failed to approve leave.'
        });
      }
    } catch (err: any) {
      setAlertMsg({
        type: 'error',
        text: err.response?.data?.message || 'Error processing leave approval.'
      });
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleReject = async (id: number, employeeName: string) => {
    if (!confirm(`Are you sure you want to reject leave for ${employeeName}? A decline notification email will be sent.`)) {
      return;
    }

    setActionLoading(prev => ({ ...prev, [id]: true }));
    setAlertMsg(null);

    try {
      const res = await api.post(`/api/leave/${id}/reject`);
      if (res.data?.success) {
        setAlertMsg({
          type: 'success',
          text: res.data.message || `Leave request rejected and notification email sent to ${employeeName}.`
        });
        await fetchLeaves();
      } else {
        setAlertMsg({
          type: 'error',
          text: res.data?.message || 'Failed to reject leave.'
        });
      }
    } catch (err: any) {
      setAlertMsg({
        type: 'error',
        text: err.response?.data?.message || 'Error processing leave rejection.'
      });
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  const downloadApprovalPdf = (id: number) => {
    window.open(getApiUrl(`/api/leave/${id}/pdf`), '_blank');
  };

  const filtered = leaveRequests.filter((lr) => {
    const matchesSearch = !search ||
      (lr.employee && lr.employee.toLowerCase().includes(search.toLowerCase())) ||
      (lr.emp_id && lr.emp_id.toLowerCase().includes(search.toLowerCase())) ||
      (lr.leave_type && lr.leave_type.toLowerCase().includes(search.toLowerCase())) ||
      (lr.department && lr.department.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus = !statusFilter || lr.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const pendingCount = leaveRequests.filter(l => l.status === 'Pending').length;
  const approvedCount = leaveRequests.filter(l => l.status === 'Approved').length;
  const rejectedCount = leaveRequests.filter(l => l.status === 'Rejected').length;

  return (
    <div className="flex min-h-screen bg-[var(--bg)] text-[var(--text)] font-sans">
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header title="Leave Management" onMenuClick={() => setMobileOpen(true)} />

        <main className="p-4 sm:p-6 lg:p-8 flex-1 overflow-y-auto space-y-6">
          {/* Top Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold text-[var(--text)] tracking-tight font-['Plus_Jakarta_Sans']">
                Leave Management
              </h1>
              <p className="text-[var(--text3)] text-xs sm:text-sm mt-0.5">
                Review and take action on employee & intern time-off requests
              </p>
            </div>
            <button
              onClick={fetchLeaves}
              className="px-4 py-2 bg-[var(--surface2)] hover:bg-[var(--hover)] border border-[var(--border)] rounded-xl text-xs font-semibold flex items-center space-x-2 transition self-start sm:self-auto"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>

          {/* Feedback Alert */}
          {alertMsg && (
            <div className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-sm font-medium ${
              alertMsg.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
            }`}>
              <div className="flex items-center gap-2.5">
                {alertMsg.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                )}
                <span>{alertMsg.text}</span>
              </div>
              <button onClick={() => setAlertMsg(null)} className="text-xs font-bold hover:underline opacity-80">
                Dismiss
              </button>
            </div>
          )}

          {/* 3 Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="stat-card p-5 flex items-center justify-between rounded-xl border border-[var(--border)]">
              <div>
                <div className="text-xs font-bold uppercase text-[var(--text3)] tracking-wider">Pending Review</div>
                <div className="text-2xl font-black text-amber-500 mt-1">{pendingCount}</div>
              </div>
              <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            <div className="stat-card p-5 flex items-center justify-between rounded-xl border border-[var(--border)]">
              <div>
                <div className="text-xs font-bold uppercase text-[var(--text3)] tracking-wider">Approved Leaves</div>
                <div className="text-2xl font-black text-emerald-600 mt-1">{approvedCount}</div>
              </div>
              <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            <div className="stat-card p-5 flex items-center justify-between rounded-xl border border-[var(--border)]">
              <div>
                <div className="text-xs font-bold uppercase text-[var(--text3)] tracking-wider">Rejected Requests</div>
                <div className="text-2xl font-black text-rose-500 mt-1">{rejectedCount}</div>
              </div>
              <div className="w-11 h-11 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
                <XCircle className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="stat-card p-4 rounded-xl border border-[var(--border)] flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text3)]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search employee, ID, department..."
                className="form-control pl-9 text-xs w-full"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="form-control text-xs"
                style={{ minWidth: '130px' }}
              >
                <option value="">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
          </div>

          {/* Leave Requests Table */}
          <div className="stat-card p-6 rounded-xl border border-[var(--border)] space-y-4">
            <div className="border-b border-[var(--border)] pb-3">
              <h3 className="font-bold text-lg text-[var(--text)] font-['Plus_Jakarta_Sans']">
                Leave Requests
              </h3>
              <p className="text-xs text-[var(--text3)]">
                {filtered.length} request{filtered.length !== 1 ? 's' : ''} found
              </p>
            </div>

            <div className="table-wrapper overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[var(--bg3)] border-b border-[var(--border)] text-[11px] font-bold uppercase tracking-wider text-[var(--text3)]">
                    <th className="py-3.5 px-4">EMPLOYEE</th>
                    <th className="py-3.5 px-4">LEAVE TYPE</th>
                    <th className="py-3.5 px-4">PERIOD</th>
                    <th className="py-3.5 px-4">DURATION</th>
                    <th className="py-3.5 px-4">REASON</th>
                    <th className="py-3.5 px-4">STATUS</th>
                    <th className="py-3.5 px-4 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] text-sm">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-xs text-[var(--text3)]">
                        Loading leave requests...
                      </td>
                    </tr>
                  ) : filtered.length > 0 ? (
                    filtered.map((req) => {
                      const isActing = Boolean(actionLoading[req.id]);

                      return (
                        <tr key={req.id} className="hover:bg-[var(--hover)] transition">
                          {/* Employee info */}
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-xs text-[var(--text)]">{req.employee}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="font-mono text-[10px] text-[var(--text3)]">{req.emp_id}</span>
                              <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                req.emp_type === 'Intern'
                                  ? 'bg-purple-500/10 text-purple-600 border border-purple-500/20'
                                  : 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                              }`}>
                                {req.emp_type || 'Normal'}
                              </span>
                            </div>
                          </td>

                          {/* Leave Type */}
                          <td className="py-3.5 px-4 text-xs font-medium text-[var(--text)]">
                            {req.leave_type}
                          </td>

                          {/* Period */}
                          <td className="py-3.5 px-4 text-xs font-mono text-[var(--text2)]">
                            <div>{req.from_date_formatted || req.from_date}</div>
                            <div className="text-[10px] text-[var(--text3)]">to {req.to_date_formatted || req.to_date}</div>
                          </td>

                          {/* Duration */}
                          <td className="py-3.5 px-4 text-xs font-bold text-[var(--text)]">
                            {req.days} Day{req.days !== 1 ? 's' : ''}
                          </td>

                          {/* Reason */}
                          <td className="py-3.5 px-4 text-xs text-[var(--text3)] max-w-[200px] truncate" title={req.reason}>
                            {req.reason || '—'}
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4 text-xs">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                              req.status === 'Approved'
                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                : req.status === 'Rejected'
                                ? 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                                : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                            }`}>
                              {req.status}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              {req.status === 'Pending' ? (
                                <>
                                  <button
                                    onClick={() => handleApprove(req.id, req.employee)}
                                    disabled={isActing}
                                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm disabled:opacity-50"
                                    title="Approve leave and dispatch official PDF letter via email"
                                  >
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    <span>{isActing ? '...' : 'Approve'}</span>
                                  </button>

                                  <button
                                    onClick={() => handleReject(req.id, req.employee)}
                                    disabled={isActing}
                                    className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm disabled:opacity-50"
                                    title="Reject leave and send decline email notification"
                                  >
                                    <XCircle className="w-3.5 h-3.5" />
                                    <span>{isActing ? '...' : 'Reject'}</span>
                                  </button>
                                </>
                              ) : req.status === 'Approved' ? (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => downloadApprovalPdf(req.id)}
                                    className="px-2.5 py-1.5 bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg text-xs font-bold transition flex items-center gap-1"
                                    title="Download Official Leave Sanction Letter PDF"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>Letter PDF</span>
                                  </button>

                                  <button
                                    onClick={() => handleReject(req.id, req.employee)}
                                    disabled={isActing}
                                    className="px-2 py-1.5 bg-[var(--surface2)] hover:bg-[var(--hover)] text-rose-500 border border-[var(--border)] rounded-lg text-[11px] font-semibold transition"
                                    title="Change to Reject"
                                  >
                                    Reject
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleApprove(req.id, req.employee)}
                                  disabled={isActing}
                                  className="px-2.5 py-1.5 bg-[var(--surface2)] hover:bg-[var(--hover)] text-emerald-600 border border-[var(--border)] rounded-lg text-xs font-semibold transition flex items-center gap-1"
                                  title="Change to Approve"
                                >
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  <span>Approve</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-xs text-[var(--text3)]">
                        No leave requests found.
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

