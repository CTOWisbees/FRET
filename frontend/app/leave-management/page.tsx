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
  Calendar,
  ShieldCheck,
  Crown,
  Users,
  Building,
  UserCheck
} from 'lucide-react';
import { api, getApiUrl } from '@/lib/api';

export default function LeaveManagementPage() {
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'all' | 'manager_leaves'>('all');
  const [actionLoading, setActionLoading] = useState<Record<number, boolean>>({});
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [serverMeta, setServerMeta] = useState<any>({
    role: 'hr',
    is_hr: false,
    is_manager: false,
    is_superadmin: false,
    managed_department: ''
  });

  // 1. Instantly hydrate cached leaves and user for 0ms initial render
  useEffect(() => {
    try {
      const cached = localStorage.getItem('fret_leaves_cache');
      if (cached) {
        setLeaveRequests(JSON.parse(cached));
        setLoading(false);
      }
      const savedUser = localStorage.getItem('fret_user');
      if (savedUser) {
        setCurrentUser(JSON.parse(savedUser));
      }
    } catch (e) {}

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('filter') === 'manager_leaves') {
        setActiveSubTab('manager_leaves');
      }
    }
  }, []);

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/leave-management');
      if (res.data) {
        setLeaveRequests(res.data.leaves || []);
        setServerMeta({
          role: res.data.role,
          is_hr: res.data.is_hr,
          is_manager: res.data.is_manager,
          is_superadmin: res.data.is_superadmin,
          managed_department: res.data.managed_department
        });
        localStorage.setItem('fret_leaves_cache', JSON.stringify(res.data.leaves || []));
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
    const reasonPrompt = prompt(`Please enter the rejection reason for ${employeeName} (Optional):`, '');
    if (reasonPrompt === null) {
      return; // Cancelled
    }

    setActionLoading(prev => ({ ...prev, [id]: true }));
    setAlertMsg(null);

    try {
      const res = await api.post(`/api/leave/${id}/reject`, { reason: reasonPrompt });
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

  const isSuperAdmin = Boolean(serverMeta.is_superadmin || currentUser?.is_superadmin);
  const isManager = Boolean(serverMeta.is_manager || currentUser?.is_manager);
  const isHr = Boolean(serverMeta.is_hr || currentUser?.role === 'hr' || (typeof window !== 'undefined' && localStorage.getItem('fret_token')?.startsWith('hr:')));

  const departments = Array.from(new Set(leaveRequests.map(l => l.department).filter(Boolean))) as string[];

  const filtered = leaveRequests.filter((lr) => {
    const matchesSearch = !search ||
      (lr.employee && lr.employee.toLowerCase().includes(search.toLowerCase())) ||
      (lr.emp_id && lr.emp_id.toLowerCase().includes(search.toLowerCase())) ||
      (lr.leave_type && lr.leave_type.toLowerCase().includes(search.toLowerCase())) ||
      (lr.department && lr.department.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus = !statusFilter || lr.status === statusFilter;
    const matchesDept = !deptFilter || lr.department === deptFilter;

    const matchesSubTab = activeSubTab === 'manager_leaves' ? lr.is_manager : true;

    return matchesSearch && matchesStatus && matchesDept && matchesSubTab;
  });

  const pendingCount = filtered.filter(l => l.status === 'Pending').length;
  const approvedCount = filtered.filter(l => l.status === 'Approved').length;
  const rejectedCount = filtered.filter(l => l.status === 'Rejected').length;
  const managerLeavesCount = leaveRequests.filter(l => l.is_manager).length;

  return (
    <div className="flex min-h-screen bg-[var(--bg)] text-[var(--text)] font-sans antialiased">
      <Sidebar 
        user={currentUser ? {
          name: currentUser.name,
          designation: currentUser.designation,
          emp_type: currentUser.emp_type,
          is_manager: currentUser.is_manager,
          managed_department: currentUser.managed_department,
          is_superadmin: currentUser.is_superadmin,
          role: currentUser.role
        } : undefined}
        mobileOpen={mobileOpen} 
        setMobileOpen={setMobileOpen} 
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header title="Leave Management" onMenuClick={() => setMobileOpen(true)} />

        <main className="p-4 sm:p-6 lg:p-8 flex-1 overflow-y-auto space-y-6 max-w-7xl mx-auto w-full">
          {/* Top Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-sm">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black text-[var(--text)] tracking-tight font-['Plus_Jakarta_Sans']">
                  {isManager && !isSuperAdmin && !isHr
                    ? `Department Leave Approvals — ${serverMeta.managed_department || currentUser?.managed_department || 'Department'}`
                    : isSuperAdmin
                    ? 'SuperAdmin Leave Governance'
                    : 'Organization Leave Management'}
                </h1>
                {isSuperAdmin && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/10 text-purple-600 border border-purple-500/20">
                    <Crown className="w-3.5 h-3.5" /> SuperAdmin Review
                  </span>
                )}
                {isManager && !isSuperAdmin && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                    <ShieldCheck className="w-3.5 h-3.5" /> {serverMeta.managed_department || 'Dept'} Manager
                  </span>
                )}
              </div>
              <p className="text-[var(--text3)] text-xs sm:text-sm mt-0.5">
                {isManager && !isSuperAdmin && !isHr
                  ? `Review and approve/reject leave applications submitted by team members in ${serverMeta.managed_department || 'your department'}.`
                  : isSuperAdmin
                  ? 'Approve and reject leave applications from Department Managers and oversee organizational time-off.'
                  : 'Review, sanction, and dispatch official leave approval letters with digital HR signature.'}
              </p>
            </div>

            <button
              onClick={fetchLeaves}
              className="px-4 py-2 bg-[var(--surface2)] hover:bg-[var(--hover)] border border-[var(--border)] rounded-xl text-xs font-semibold flex items-center space-x-2 transition self-start sm:self-auto cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>

          {/* SuperAdmin Priority Tab Switcher */}
          {isSuperAdmin && (
            <div className="flex items-center gap-2.5 border-b border-[var(--border)] pb-2">
              <button
                onClick={() => setActiveSubTab('all')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                  activeSubTab === 'all'
                    ? 'bg-[var(--accent)] text-white shadow-sm'
                    : 'text-[var(--text2)] hover:bg-[var(--surface2)]'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>All Department Leaves ({leaveRequests.length})</span>
              </button>

              <button
                onClick={() => setActiveSubTab('manager_leaves')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                  activeSubTab === 'manager_leaves'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-purple-600 border border-purple-500/30 hover:bg-purple-500/10'
                }`}
              >
                <Crown className="w-4 h-4" />
                <span>Department Manager Leaves ({managerLeavesCount})</span>
              </button>
            </div>
          )}

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
              <button onClick={() => setAlertMsg(null)} className="text-xs font-bold hover:underline opacity-80 cursor-pointer">
                Dismiss
              </button>
            </div>
          )}

          {/* 3 Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[var(--surface)] p-5 flex items-center justify-between rounded-2xl border border-[var(--border)] shadow-sm">
              <div>
                <div className="text-xs font-bold uppercase text-[var(--text3)] tracking-wider">Pending Approvals</div>
                <div className="text-2xl font-black text-amber-500 mt-1">{pendingCount}</div>
              </div>
              <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-[var(--surface)] p-5 flex items-center justify-between rounded-2xl border border-[var(--border)] shadow-sm">
              <div>
                <div className="text-xs font-bold uppercase text-[var(--text3)] tracking-wider">Approved Leaves</div>
                <div className="text-2xl font-black text-emerald-600 mt-1">{approvedCount}</div>
              </div>
              <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-[var(--surface)] p-5 flex items-center justify-between rounded-2xl border border-[var(--border)] shadow-sm">
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
          <div className="bg-[var(--surface)] p-4 rounded-2xl border border-[var(--border)] shadow-sm flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text3)]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search employee, ID, department..."
                className="w-full pl-9 pr-4 py-2 bg-[var(--input-bg)] border border-[var(--border)] rounded-xl text-xs font-medium text-[var(--text)] focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {departments.length > 1 && (
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="px-3.5 py-2 bg-[var(--input-bg)] border border-[var(--border)] rounded-xl text-xs font-semibold text-[var(--text)] focus:outline-none"
                >
                  <option value="">All Departments</option>
                  {departments.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              )}

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3.5 py-2 bg-[var(--input-bg)] border border-[var(--border)] rounded-xl text-xs font-semibold text-[var(--text)] focus:outline-none"
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
          <div className="bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border)] shadow-sm space-y-4">
            <div className="border-b border-[var(--border)] pb-3 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg text-[var(--text)] font-['Plus_Jakarta_Sans']">
                  {activeSubTab === 'manager_leaves' ? 'Department Manager Leave Requests' : 'Leave Requests'}
                </h3>
                <p className="text-xs text-[var(--text3)]">
                  {filtered.length} request{filtered.length !== 1 ? 's' : ''} found
                </p>
              </div>
            </div>

            <div className="table-wrapper overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[var(--bg)] border-b border-[var(--border)] text-[11px] font-bold uppercase tracking-wider text-[var(--text3)]">
                    <th className="py-3.5 px-4">EMPLOYEE</th>
                    <th className="py-3.5 px-4">DEPARTMENT / ROLE</th>
                    <th className="py-3.5 px-4">LEAVE TYPE</th>
                    <th className="py-3.5 px-4">PERIOD</th>
                    <th className="py-3.5 px-4">DURATION</th>
                    <th className="py-3.5 px-4">REASON</th>
                    <th className="py-3.5 px-4">STATUS & REVIEW</th>
                    <th className="py-3.5 px-4 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] text-sm">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-xs text-[var(--text3)]">
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
                            <div className="font-bold text-xs text-[var(--text)]">{req.employee}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="font-mono text-[10px] text-[var(--text3)]">{req.emp_id}</span>
                              {req.is_manager && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                                  Manager
                                </span>
                              )}
                              {req.emp_type === 'Intern' && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-500/10 text-purple-600 border border-purple-500/20">
                                  Intern
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Department & Role */}
                          <td className="py-3.5 px-4 text-xs font-semibold text-[var(--text2)]">
                            <div>{req.department || 'General'}</div>
                            <div className="text-[10px] text-[var(--text3)] font-normal">{req.designation || 'Staff'}</div>
                          </td>

                          {/* Leave Type */}
                          <td className="py-3.5 px-4 text-xs font-bold text-[var(--text)]">
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
                          <td className="py-3.5 px-4 text-xs text-[var(--text3)] max-w-[180px] truncate" title={req.reason}>
                            {req.reason || '—'}
                          </td>

                          {/* Status & Review Metadata */}
                          <td className="py-3.5 px-4 text-xs">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                              req.status === 'Approved'
                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                : req.status === 'Rejected'
                                ? 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                                : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                            }`}>
                              {req.status}
                            </span>
                            {req.approved_by && (
                              <div className="text-[10px] text-[var(--text3)] mt-0.5">
                                By {req.approved_by} ({req.approved_by_role || 'Lead'})
                              </div>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              {req.status === 'Pending' ? (
                                <>
                                  <button
                                    onClick={() => handleApprove(req.id, req.employee)}
                                    disabled={isActing}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-sm disabled:opacity-50 active:scale-95 cursor-pointer"
                                    title={isSuperAdmin && req.is_manager ? "SuperAdmin: Approve Manager leave" : "Approve leave and dispatch official PDF letter"}
                                  >
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    <span>{isActing ? '...' : 'Approve'}</span>
                                  </button>

                                  <button
                                    onClick={() => handleReject(req.id, req.employee)}
                                    disabled={isActing}
                                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-sm disabled:opacity-50 active:scale-95 cursor-pointer"
                                    title={isSuperAdmin && req.is_manager ? "SuperAdmin: Reject Manager leave" : "Reject leave and send decline notification"}
                                  >
                                    <XCircle className="w-3.5 h-3.5" />
                                    <span>{isActing ? '...' : 'Reject'}</span>
                                  </button>
                                </>
                              ) : req.status === 'Approved' ? (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => downloadApprovalPdf(req.id)}
                                    className="px-2.5 py-1.5 bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border border-blue-500/20 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                                    title="Download Official Leave Sanction Letter PDF"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>PDF Letter</span>
                                  </button>

                                  <button
                                    onClick={() => handleReject(req.id, req.employee)}
                                    disabled={isActing}
                                    className="px-2 py-1.5 bg-[var(--surface2)] hover:bg-[var(--hover)] text-rose-500 border border-[var(--border)] rounded-xl text-[11px] font-semibold transition cursor-pointer"
                                    title="Change to Reject"
                                  >
                                    Reject
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleApprove(req.id, req.employee)}
                                  disabled={isActing}
                                  className="px-2.5 py-1.5 bg-[var(--surface2)] hover:bg-[var(--hover)] text-emerald-600 border border-[var(--border)] rounded-xl text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
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
                      <td colSpan={8} className="py-8 text-center text-xs text-[var(--text3)]">
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
