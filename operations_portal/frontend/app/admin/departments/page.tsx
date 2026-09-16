'use client';

import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  X,
  RefreshCw,
  AlertTriangle,
  Key,
  Users,
  ExternalLink
} from 'lucide-react';
import { api } from '@/lib/api';

export default function AdminDepartmentsPage() {
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedDept, setSelectedDept] = useState<any | null>(null);
  const [deleteConfirmDept, setDeleteConfirmDept] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  // Form State
  const [formName, setFormName] = useState('');
  const [formPageKey, setFormPageKey] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);

  const showAlert = (text: string, type: 'success' | 'error' = 'success') => {
    setAlertMsg({ type, text });
    setTimeout(() => setAlertMsg(null), 4000);
  };

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/departments');
      if (res.data?.departments) {
        setDepartments(res.data.departments);
      }
    } catch (err) {
      console.error('Failed to load departments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const openAddModal = () => {
    setFormName('');
    setFormPageKey('');
    setFormIsActive(true);
    setShowAddModal(true);
  };

  const openEditModal = (dept: any) => {
    setSelectedDept(dept);
    setFormName(dept.name);
    setFormPageKey(dept.page_key);
    setFormIsActive(dept.is_active);
    setShowEditModal(true);
  };

  const handleNameChange = (val: string) => {
    setFormName(val);
    if (!formPageKey || formPageKey === formName) {
      setFormPageKey(val);
    }
  };

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showAlert('Department name is required', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post('/admin/departments', {
        name: formName.trim(),
        page_key: formPageKey.trim() || formName.trim(),
        is_active: formIsActive,
      });
      if (res.data?.success) {
        showAlert(`Department '${formName}' created successfully!`);
        setShowAddModal(false);
        fetchDepartments();
      }
    } catch (err: any) {
      showAlert(err.response?.data?.error || 'Failed to create department.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDept) return;
    if (!formName.trim()) {
      showAlert('Department name is required', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await api.put(`/admin/departments/${selectedDept.id}`, {
        name: formName.trim(),
        page_key: formPageKey.trim() || formName.trim(),
        is_active: formIsActive,
      });
      if (res.data?.success) {
        showAlert(`Department '${formName}' updated successfully!`);
        setShowEditModal(false);
        fetchDepartments();
      }
    } catch (err: any) {
      showAlert(err.response?.data?.error || 'Failed to update department.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (dept: any) => {
    try {
      const res = await api.put(`/admin/departments/${dept.id}`, {
        is_active: !dept.is_active,
      });
      if (res.data?.success) {
        setDepartments((prev) =>
          prev.map((d) => (d.id === dept.id ? { ...d, is_active: !d.is_active } : d))
        );
        showAlert(`Department '${dept.name}' is now ${!dept.is_active ? 'Active' : 'Inactive'}.`);
      }
    } catch (err: any) {
      showAlert(err.response?.data?.error || 'Failed to toggle status.', 'error');
    }
  };

  const handleDeleteDepartment = async () => {
    if (!deleteConfirmDept) return;
    setSaving(true);
    try {
      const res = await api.delete(`/admin/departments/${deleteConfirmDept.id}`);
      if (res.data?.success) {
        showAlert(`Department '${deleteConfirmDept.name}' deleted successfully.`);
        setDeleteConfirmDept(null);
        fetchDepartments();
      }
    } catch (err: any) {
      showAlert(err.response?.data?.error || 'Failed to delete department.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const filteredDepartments = departments.filter((dept) => {
    const matchesSearch =
      dept.name.toLowerCase().includes(search.toLowerCase()) ||
      dept.page_key.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === 'ALL'
        ? true
        : statusFilter === 'ACTIVE'
        ? dept.is_active
        : !dept.is_active;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
              OP Access Management
            </span>
            <span className="text-xs text-[var(--text-muted)]">• Department Scopes & Page Keys</span>
          </div>
          <h2 className="text-2xl font-black text-[var(--text-primary)] tracking-tight">
            Departments & Access Scopes
          </h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Manage organizational departments, route page keys, and control active operational scopes across the enterprise.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={openAddModal}
            className="px-4 py-2.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white rounded-2xl text-xs font-bold shadow-md hover:shadow-lg transition flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add Department</span>
          </button>
        </div>
      </div>

      {/* Alert Banner */}
      {alertMsg && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold border flex items-center justify-between animate-fadeIn ${
            alertMsg.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
              : 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{alertMsg.text}</span>
          </div>
          <button onClick={() => setAlertMsg(null)} className="cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="relative max-w-md w-full">
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search departments by name or page key..."
            className="w-full pl-10 pr-4 py-2.5 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl text-xs font-medium text-[var(--text-primary)] focus:outline-none focus:border-sky-500 shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-sky-600 text-white'
                : 'bg-[var(--card-bg)] text-[var(--text-secondary)] border border-[var(--card-border)]'
            }`}
          >
            All ({departments.length})
          </button>
          <button
            onClick={() => setStatusFilter('ACTIVE')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              statusFilter === 'ACTIVE'
                ? 'bg-emerald-600 text-white'
                : 'bg-[var(--card-bg)] text-[var(--text-secondary)] border border-[var(--card-border)]'
            }`}
          >
            Active ({departments.filter((d) => d.is_active).length})
          </button>
          <button
            onClick={() => setStatusFilter('INACTIVE')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              statusFilter === 'INACTIVE'
                ? 'bg-slate-600 text-white'
                : 'bg-[var(--card-bg)] text-[var(--text-secondary)] border border-[var(--card-border)]'
            }`}
          >
            Inactive ({departments.filter((d) => !d.is_active).length})
          </button>
        </div>
      </div>

      {/* Departments Table (Matching Screenshot Image 4) */}
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl overflow-hidden shadow-xs transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--hover-bg)] border-b border-[var(--card-border)] text-[var(--text-muted)] uppercase tracking-wider font-bold text-[10px]">
              <tr>
                <th className="py-4 px-6">NAME</th>
                <th className="py-4 px-6">PAGE KEY</th>
                <th className="py-4 px-6">ASSIGNED USERS</th>
                <th className="py-4 px-6">IS ACTIVE</th>
                <th className="py-4 px-6 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--card-border)]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[var(--text-muted)]">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-sky-500" />
                      <span>Loading departments list...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredDepartments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[var(--text-muted)]">
                    No departments found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredDepartments.map((dept) => (
                  <tr key={dept.id} className="hover:bg-[var(--hover-bg)] transition">
                    {/* Name */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-300 border border-sky-200 dark:border-sky-800 flex items-center justify-center shrink-0 shadow-2xs">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-extrabold text-[var(--text-primary)] text-sm">{dept.name}</div>
                          <div className="text-[10px] text-[var(--text-muted)]">
                            Created: {dept.created_at || 'Default Enterprise Scope'}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Page Key */}
                    <td className="py-4 px-6">
                      <span className="font-mono font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 px-2.5 py-1 rounded-lg border border-sky-200 dark:border-sky-800/60 text-xs">
                        {dept.page_key}
                      </span>
                    </td>

                    {/* Members Count */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-1.5 text-[var(--text-secondary)] font-semibold">
                        <Users className="w-3.5 h-3.5 text-indigo-500" />
                        <span>{dept.user_count || 0} Member(s)</span>
                      </div>
                    </td>

                    {/* Is Active Toggle */}
                    <td className="py-4 px-6">
                      <button
                        onClick={() => handleToggleActive(dept)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
                          dept.is_active
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                        }`}
                        title="Click to toggle status"
                      >
                        {dept.is_active ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Active</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3.5 h-3.5 text-slate-400" />
                            <span>Inactive</span>
                          </>
                        )}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(dept)}
                          className="p-2 text-[var(--text-secondary)] hover:text-sky-500 hover:bg-[var(--hover-bg)] rounded-xl transition cursor-pointer"
                          title="Edit Department"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmDept(dept)}
                          className="p-2 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition cursor-pointer"
                          title="Delete Department"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── ADD / EDIT MODAL ─── */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--text-primary)] rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--card-border)]">
              <div>
                <h3 className="text-base font-black text-[var(--text-primary)]">
                  {showAddModal ? 'Add New Department' : `Edit Department: ${selectedDept?.name}`}
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Configure department title, system page key, and active availability.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setShowEditModal(false);
                }}
                className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={showAddModal ? handleCreateDepartment : handleUpdateDepartment}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                  Department Name *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Accounts, Compliance, Equity, HR, Treasury"
                  className="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl font-semibold text-[var(--text-primary)] focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-sky-500" />
                  <span>Page Key (System Identifier) *</span>
                </label>
                <input
                  type="text"
                  required
                  value={formPageKey}
                  onChange={(e) => setFormPageKey(e.target.value)}
                  placeholder="e.g. Accounts, Compliance, Compliance Checker"
                  className="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl font-mono font-semibold text-[var(--text-primary)] focus:outline-none focus:border-sky-500"
                />
                <span className="text-[10px] text-[var(--text-muted)] mt-1 block">
                  Identifies the department route and permissions scope across OP Portal.
                </span>
              </div>

              <div className="p-3 bg-[var(--input-bg)] rounded-xl border border-[var(--card-border)] flex items-center justify-between">
                <div>
                  <div className="font-bold text-[var(--text-primary)]">Is Active Status</div>
                  <div className="text-[10px] text-[var(--text-muted)]">
                    Active departments appear in employee access dropdowns and matrices.
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-500"></div>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--card-border)]">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setShowEditModal(false);
                  }}
                  className="px-4 py-2.5 rounded-xl border border-[var(--card-border)] text-[var(--text-secondary)] font-bold hover:bg-[var(--hover-bg)] transition cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white rounded-xl font-bold shadow-md transition flex items-center gap-2 cursor-pointer text-xs disabled:opacity-50"
                >
                  {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>{showAddModal ? 'Create Department' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── DELETE MODAL ─── */}
      {deleteConfirmDept && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--text-primary)] rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-fadeIn">
            <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-black text-[var(--text-primary)]">
                Delete Department?
              </h4>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Are you sure you want to delete department <span className="font-bold text-[var(--text-primary)]">{deleteConfirmDept.name}</span>?
              </p>
            </div>
            <div className="p-3 bg-red-50/50 dark:bg-red-950/30 rounded-xl border border-red-200 dark:border-red-900/50 text-[11px] text-red-700 dark:text-red-300 font-medium">
              Existing users assigned to this department scope will lose access to this specific department.
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmDept(null)}
                className="px-4 py-2 rounded-xl border border-[var(--card-border)] text-[var(--text-secondary)] font-bold hover:bg-[var(--hover-bg)] transition cursor-pointer text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteDepartment}
                disabled={saving}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-md transition flex items-center gap-2 cursor-pointer text-xs disabled:opacity-50"
              >
                {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
