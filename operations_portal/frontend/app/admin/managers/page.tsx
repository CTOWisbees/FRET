'use client';

import React, { useState, useEffect } from 'react';
import {
  Crown,
  Building2,
  Users,
  Search,
  CheckCircle2,
  AlertCircle,
  UserCheck,
  UserX,
  RefreshCw,
  X,
  Shield,
  Briefcase,
  ArrowRight,
  Sparkles,
  Calendar
} from 'lucide-react';
import { api } from '@/lib/api';

interface DepartmentManager {
  id: number;
  manager_id: number;
  manager_name: string;
  manager_email: string;
  manager_designation: string;
  assigned_by_name: string;
  assigned_at: string;
}

interface DepartmentItem {
  id: number;
  name: string;
  page_key: string;
  manager: DepartmentManager | null;
  has_manager: boolean;
}

interface CandidateUser {
  id: number;
  name: string;
  email: string;
  emp_code: string;
  designation: string;
  department: string;
  emp_type: string;
  is_manager: boolean;
  managed_department?: string;
  managed_departments?: string[];
}

export default function AdminManagersPage() {
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [candidates, setCandidates] = useState<CandidateUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState<'ALL' | 'ASSIGNED' | 'UNASSIGNED'>('ALL');
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal State
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedDeptName, setSelectedDeptName] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<number | ''>('');
  const [candidateSearch, setCandidateSearch] = useState('');
  const [saving, setSaving] = useState(false);

  // Remove confirmation modal
  const [removeTarget, setRemoveTarget] = useState<{ assignmentId?: number; deptName: string; managerName: string } | null>(null);
  const [removing, setRemoving] = useState(false);

  const showAlert = (text: string, type: 'success' | 'error' = 'success') => {
    setAlertMsg({ type, text });
    setTimeout(() => setAlertMsg(null), 4500);
  };

  const fetchManagersData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/managers');
      if (res.data?.success) {
        setDepartments(res.data.departments || []);
        setCandidates(res.data.candidates || []);
      }
    } catch (err: any) {
      console.error('Failed to load managers data:', err);
      showAlert(err.response?.data?.error || 'Failed to fetch department managers.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchManagersData();
  }, []);

  const openAssignModal = (deptName: string = '') => {
    setSelectedDeptName(deptName || (departments[0]?.name || ''));
    setSelectedUserId('');
    setCandidateSearch('');
    setShowAssignModal(true);
  };

  const handleAssignManager = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeptName || !selectedUserId) {
      showAlert('Please select both a department and a team member.', 'error');
      return;
    }

    setSaving(true);
    try {
      const res = await api.post('/admin/managers/assign', {
        department_name: selectedDeptName,
        user_id: selectedUserId,
      });

      if (res.data?.success) {
        showAlert(res.data.message || 'Department Manager appointed successfully!');
        setShowAssignModal(false);
        fetchManagersData();
      }
    } catch (err: any) {
      showAlert(err.response?.data?.error || 'Failed to appoint manager.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmRemove = async () => {
    if (!removeTarget) return;

    setRemoving(true);
    try {
      const res = await api.post('/admin/managers/remove', {
        assignment_id: removeTarget.assignmentId,
        department_name: removeTarget.deptName,
      });

      if (res.data?.success) {
        showAlert(res.data.message || `Manager for ${removeTarget.deptName} removed successfully.`);
        setRemoveTarget(null);
        fetchManagersData();
      }
    } catch (err: any) {
      showAlert(err.response?.data?.error || 'Failed to remove manager.', 'error');
    } finally {
      setRemoving(false);
    }
  };

  // Filtered lists
  const filteredDepartments = departments.filter((d) => {
    const matchesSearch =
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      (d.manager?.manager_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (d.manager?.manager_email || '').toLowerCase().includes(search.toLowerCase()) ||
      (d.manager?.manager_designation || '').toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;
    if (filterTab === 'ASSIGNED') return d.has_manager;
    if (filterTab === 'UNASSIGNED') return !d.has_manager;
    return true;
  });

  const filteredCandidates = candidates.filter((c) => {
    const query = candidateSearch.toLowerCase();
    return (
      c.name.toLowerCase().includes(query) ||
      c.email.toLowerCase().includes(query) ||
      (c.designation || '').toLowerCase().includes(query) ||
      (c.department || '').toLowerCase().includes(query) ||
      (c.emp_code || '').toLowerCase().includes(query)
    );
  });

  const totalAssigned = departments.filter((d) => d.has_manager).length;
  const totalUnassigned = departments.length - totalAssigned;

  return (
    <div className="space-y-6">
      {/* Alert Banner */}
      {alertMsg && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between text-xs font-bold shadow-md transition-all animate-in fade-in slide-in-from-top-2 ${
            alertMsg.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {alertMsg.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
            )}
            <span>{alertMsg.text}</span>
          </div>
          <button
            onClick={() => setAlertMsg(null)}
            className="p-1 hover:opacity-75 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-700 via-indigo-700 to-sky-700 text-white p-6 sm:p-8 shadow-xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-xs font-bold text-white mb-3">
              <Crown className="w-3.5 h-3.5 text-amber-300" />
              <span>Superadmin Leadership Hub</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Department Manager Appointments
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-purple-100/90 leading-relaxed">
              Appoint department managers from active employees and interns, authorize team work allocation, and delegate daily tracker approval scopes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={fetchManagersData}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-xs font-bold text-white transition cursor-pointer disabled:opacity-50 shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => openAssignModal()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white text-purple-900 hover:bg-purple-50 font-extrabold text-xs shadow-lg hover:shadow-xl transition transform active:scale-95 cursor-pointer"
            >
              <Crown className="w-4 h-4 text-purple-700" />
              <span>Appoint Department Manager</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-3xl bg-[var(--card-bg)] border border-[var(--card-border)] shadow-xs transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              Total Departments
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-300 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-[var(--text-primary)]">
            {departments.length}
          </div>
          <div className="mt-1 text-[11px] font-medium text-[var(--text-muted)]">
            Active organizational domains
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-[var(--card-bg)] border border-[var(--card-border)] shadow-xs transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              Managers Appointed
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-300 flex items-center justify-center">
              <Crown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {totalAssigned}
          </div>
          <div className="mt-1 text-[11px] font-medium text-[var(--text-muted)]">
            Active department leaders
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-[var(--card-bg)] border border-[var(--card-border)] shadow-xs transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
              Unassigned Depts
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-300 flex items-center justify-center">
              <UserX className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-amber-600 dark:text-amber-400">
            {totalUnassigned}
          </div>
          <div className="mt-1 text-[11px] font-medium text-[var(--text-muted)]">
            Awaiting manager appointment
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-[var(--card-bg)] border border-[var(--card-border)] shadow-xs transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
              Eligible Candidates
            </span>
            <div className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-300 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-sky-600 dark:text-sky-400">
            {candidates.length}
          </div>
          <div className="mt-1 text-[11px] font-medium text-[var(--text-muted)]">
            Active OP employees & interns
          </div>
        </div>
      </div>

      {/* Search & Tabs Controls */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by department, manager name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] text-xs font-semibold text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-hidden focus:ring-2 focus:ring-purple-500/30 transition"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-1.5 p-1 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl shrink-0 overflow-x-auto">
          <button
            onClick={() => setFilterTab('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              filterTab === 'ALL'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'
            }`}
          >
            All Departments ({departments.length})
          </button>
          <button
            onClick={() => setFilterTab('ASSIGNED')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              filterTab === 'ASSIGNED'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'
            }`}
          >
            Assigned ({totalAssigned})
          </button>
          <button
            onClick={() => setFilterTab('UNASSIGNED')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              filterTab === 'UNASSIGNED'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'
            }`}
          >
            Unassigned ({totalUnassigned})
          </button>
        </div>
      </div>

      {/* Grid of Department Cards */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl">
          <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
            Loading Department Managers...
          </span>
        </div>
      ) : filteredDepartments.length === 0 ? (
        <div className="py-16 text-center bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl p-8">
          <Crown className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3 opacity-40" />
          <h3 className="text-sm font-bold text-[var(--text-primary)]">No departments found</h3>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Try adjusting your search query or filter options.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredDepartments.map((dept) => {
            const hasMgr = dept.has_manager && dept.manager;
            return (
              <div
                key={dept.id}
                className={`flex flex-col justify-between rounded-3xl bg-[var(--card-bg)] border transition-all duration-200 shadow-xs hover:shadow-md ${
                  hasMgr
                    ? 'border-[var(--card-border)] hover:border-purple-300 dark:hover:border-purple-800'
                    : 'border-amber-200 dark:border-amber-900/60 bg-gradient-to-b from-[var(--card-bg)] to-amber-500/5'
                }`}
              >
                <div className="p-6">
                  {/* Department Header */}
                  <div className="flex items-start justify-between gap-3 mb-5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-300 border border-purple-200 dark:border-purple-800 flex items-center justify-center shrink-0 shadow-2xs font-black">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-black text-[var(--text-primary)] truncate">
                          {dept.name}
                        </h3>
                        <span className="font-mono text-[10px] text-[var(--text-muted)]">
                          Scope: {dept.page_key}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide shrink-0 ${
                        hasMgr
                          ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                      }`}
                    >
                      {hasMgr ? 'Managed' : 'Unassigned'}
                    </span>
                  </div>

                  {/* Manager Details / Empty State */}
                  {hasMgr ? (
                    <div className="p-4 rounded-2xl bg-[var(--hover-bg)] border border-[var(--card-border)] space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-xs">
                          {dept.manager?.manager_name ? dept.manager.manager_name[0].toUpperCase() : 'M'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-black text-[var(--text-primary)] truncate">
                              {dept.manager?.manager_name}
                            </span>
                            <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          </div>
                          <div className="text-[11px] text-[var(--text-muted)] truncate">
                            {dept.manager?.manager_designation || 'Department Manager'}
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-[var(--card-border)]/60 text-[11px] space-y-1.5">
                        <div className="text-[var(--text-secondary)] truncate flex items-center gap-1.5">
                          <span className="font-bold text-[var(--text-muted)] text-[10px]">Email:</span>
                          <span className="truncate">{dept.manager?.manager_email}</span>
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)] flex items-center justify-between">
                          <span>Appointed by: {dept.manager?.assigned_by_name || 'Superadmin'}</span>
                          <span>{dept.manager?.assigned_at || ''}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-5 rounded-2xl border border-dashed border-amber-300 dark:border-amber-800 text-center space-y-2 bg-amber-500/5">
                      <UserX className="w-7 h-7 text-amber-500 mx-auto opacity-70" />
                      <div className="text-xs font-bold text-[var(--text-primary)]">
                        No Manager Appointed
                      </div>
                      <p className="text-[10px] text-[var(--text-muted)] leading-normal">
                        Appoint a lead to delegate task assignments and review daily trackers for this department.
                      </p>
                    </div>
                  )}
                </div>

                {/* Card Footer Actions */}
                <div className="p-4 px-6 border-t border-[var(--card-border)] bg-[var(--hover-bg)]/40 flex items-center justify-between gap-2 rounded-b-3xl">
                  {hasMgr ? (
                    <>
                      <button
                        onClick={() => openAssignModal(dept.name)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[var(--card-bg)] hover:bg-[var(--hover-bg)] border border-[var(--card-border)] text-xs font-bold text-purple-700 dark:text-purple-300 transition cursor-pointer shadow-2xs"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Reassign Manager</span>
                      </button>
                      <button
                        onClick={() =>
                          setRemoveTarget({
                            assignmentId: dept.manager?.id,
                            deptName: dept.name,
                            managerName: dept.manager?.manager_name || 'Current Manager',
                          })
                        }
                        title="Revoke manager appointment"
                        className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 dark:hover:border-rose-800 transition cursor-pointer shrink-0"
                      >
                        <UserX className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => openAssignModal(dept.name)}
                      className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-extrabold transition cursor-pointer shadow-xs hover:shadow"
                    >
                      <Crown className="w-3.5 h-3.5" />
                      <span>Appoint Manager</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── APPOINT / REASSIGN MANAGER MODAL ─── */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-xl bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-[var(--card-border)] flex items-center justify-between bg-gradient-to-r from-purple-700/10 via-transparent to-transparent">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center font-bold shadow-md">
                  <Crown className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[var(--text-primary)]">
                    Appoint Department Manager
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    Grant manager permissions and scope to any employee or intern
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAssignModal(false)}
                className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleAssignManager} className="p-6 space-y-5">
              {/* 1. Select Department */}
              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider mb-2">
                  Target Department *
                </label>
                <select
                  value={selectedDeptName}
                  onChange={(e) => setSelectedDeptName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl bg-[var(--hover-bg)] border border-[var(--card-border)] text-xs font-bold text-[var(--text-primary)] focus:outline-hidden focus:ring-2 focus:ring-purple-500/30"
                  required
                >
                  <option value="" disabled>Select Department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.name} {d.has_manager ? `(Current: ${d.manager?.manager_name})` : '(No Manager)'}
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Select Candidate Employee / Intern */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                    Select Member to Appoint *
                  </label>
                  <span className="text-[10px] text-[var(--text-muted)]">
                    {filteredCandidates.length} candidate(s)
                  </span>
                </div>

                {/* Candidate Search */}
                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search candidate by name, code, designation..."
                    value={candidateSearch}
                    onChange={(e) => setCandidateSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-[var(--hover-bg)] border border-[var(--card-border)] text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-hidden"
                  />
                </div>

                {/* Candidate List Picker */}
                <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 border border-[var(--card-border)] rounded-2xl p-2 bg-[var(--hover-bg)]/50">
                  {filteredCandidates.length === 0 ? (
                    <div className="py-6 text-center text-xs text-[var(--text-muted)]">
                      No matching candidate found
                    </div>
                  ) : (
                    filteredCandidates.map((cand) => {
                      const isSelected = selectedUserId === cand.id;
                      const isIntern = cand.emp_type === 'Intern' || cand.designation?.toLowerCase().includes('intern');
                      return (
                        <div
                          key={cand.id}
                          onClick={() => setSelectedUserId(cand.id)}
                          className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition ${
                            isSelected
                              ? 'bg-purple-600 text-white shadow-xs font-bold'
                              : 'hover:bg-[var(--hover-bg)] text-[var(--text-primary)]'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                                isSelected
                                  ? 'bg-white text-purple-700'
                                  : 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300'
                              }`}
                            >
                              {cand.name ? cand.name[0].toUpperCase() : 'U'}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs truncate font-bold">{cand.name}</span>
                                {isIntern && (
                                  <span
                                    className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold ${
                                      isSelected
                                        ? 'bg-white/20 text-white'
                                        : 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300'
                                    }`}
                                  >
                                    Intern
                                  </span>
                                )}
                              </div>
                              <div
                                className={`text-[10px] truncate ${
                                  isSelected ? 'text-purple-100' : 'text-[var(--text-muted)]'
                                }`}
                              >
                                {cand.designation || 'Team Member'} • {cand.emp_code || `ID: ${cand.id}`}
                              </div>
                            </div>
                          </div>

                          {isSelected ? (
                            <CheckCircle2 className="w-4 h-4 text-white shrink-0 ml-2" />
                          ) : cand.is_manager ? (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 font-bold shrink-0 ml-2">
                              Already Mgr
                            </span>
                          ) : null}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Notice Box */}
              <div className="p-3.5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 text-[11px] text-purple-900 dark:text-purple-200 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                <span>
                  Appointing this member will grant them access to the <strong>Dept Manager Hub</strong>, enabling them to assign tasks and review/unlock daily trackers for <strong>{selectedDeptName || 'the department'}</strong>.
                </span>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !selectedDeptName || !selectedUserId}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-extrabold transition disabled:opacity-50 cursor-pointer shadow-md flex items-center gap-2"
                >
                  {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{saving ? 'Appointing...' : 'Confirm Appointment'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── REMOVE / REVOKE MANAGER MODAL ─── */}
      {removeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl shadow-2xl overflow-hidden p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 flex items-center justify-center mb-4">
              <UserX className="w-6 h-6" />
            </div>

            <h3 className="text-base font-black text-[var(--text-primary)]">
              Revoke Manager Appointment?
            </h3>
            <p className="mt-2 text-xs text-[var(--text-muted)] leading-relaxed">
              Are you sure you want to remove <strong>{removeTarget.managerName}</strong> as the Manager of <strong>{removeTarget.deptName}</strong> department?
              They will revert to regular employee/intern access privileges.
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setRemoveTarget(null)}
                disabled={removing}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemove}
                disabled={removing}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold transition disabled:opacity-50 cursor-pointer shadow-md flex items-center gap-2"
              >
                {removing && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{removing ? 'Revoking...' : 'Yes, Revoke Appointment'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
