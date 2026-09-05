'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  PlusCircle,
  Users,
  CheckCircle2,
  X,
  RefreshCw
} from 'lucide-react';
import { api } from '@/lib/api';

export default function AdminRolesPage() {
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formDept, setFormDept] = useState('Data & Analytics');
  const [formLevel, setFormLevel] = useState('Intern');
  const [formDesc, setFormDesc] = useState('');
  const [formResponsibilities, setFormResponsibilities] = useState('');
  const [formPermissions, setFormPermissions] = useState<string[]>([
    'view_assigned_work',
    'update_task_status',
    'submit_work_logs',
  ]);

  const availablePermissions = [
    { id: 'view_assigned_work', label: 'View Assigned Operational Work', desc: 'Allows employee to view tasks assigned to them' },
    { id: 'update_task_status', label: 'Update Task Lifecycle Status', desc: 'Allows moving tasks between Todo, In Progress, Under Review' },
    { id: 'submit_work_logs', label: 'Submit Daily Progress Logs', desc: 'Allows logging hours spent and work summaries' },
    { id: 'attach_deliverables', label: 'Attach Links & Deliverable Proofs', desc: 'Allows submitting repository/preview links' },
    { id: 'request_resources', label: 'Request Operational Resources', desc: 'Enables resource request capabilities' },
    { id: 'manage_employees', label: 'Employee Administration (Admin Only)', desc: 'Add or modify employee accounts' },
    { id: 'assign_roles', label: 'Assign & Reassign Roles (Admin Only)', desc: 'Modify employee operational scopes' },
    { id: 'create_tasks', label: 'Create & Prioritize Tasks (Admin Only)', desc: 'Dispatch operational work' },
    { id: 'review_submissions', label: 'Review & Sign-Off Work (Admin Only)', desc: 'Approve submitted deliverables' },
  ];

  const showAlert = (text: string, type: 'success' | 'error' = 'success') => {
    setAlertMsg({ type, text });
    setTimeout(() => setAlertMsg(null), 4000);
  };

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/roles');
      if (res.data?.roles) {
        setRoles(res.data.roles);
      }
    } catch (err) {
      console.error('Failed to load roles:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const togglePermission = (permId: string) => {
    if (formPermissions.includes(permId)) {
      setFormPermissions(formPermissions.filter((p) => p !== permId));
    } else {
      setFormPermissions([...formPermissions, permId]);
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle) return;
    setSaving(true);
    try {
      const res = await api.post('/admin/roles', {
        title: formTitle,
        department: formDept,
        level: formLevel,
        description: formDesc,
        responsibilities: formResponsibilities,
        permissions: formPermissions,
      });

      if (res.data?.success) {
        showAlert('Operational role created successfully!');
        setShowCreateModal(false);
        fetchRoles();
      }
    } catch (err: any) {
      showAlert(err.response?.data?.error || 'Failed to create role.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-[var(--text-primary)] tracking-tight">
            Role Definitions & Permission Scopes
          </h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Define operational responsibilities and assign granular system permissions for team members.
          </p>
        </div>

        <button
          onClick={() => {
            setFormTitle('');
            setFormDept('Data & Analytics');
            setFormLevel('Intern');
            setFormDesc('');
            setFormResponsibilities('');
            setFormPermissions(['view_assigned_work', 'update_task_status', 'submit_work_logs']);
            setShowCreateModal(true);
          }}
          className="px-4 py-2.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white rounded-2xl text-xs font-bold shadow-md transition flex items-center gap-2 cursor-pointer active:scale-95"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Create New Role</span>
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

      {/* Role Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {roles.map((r) => (
          <div
            key={r.id}
            className="p-6 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl shadow-xs hover:border-purple-400 dark:hover:border-purple-500 hover:shadow-md transition space-y-4 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-300 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[var(--hover-bg)] text-[var(--text-secondary)] border border-[var(--card-border)]">
                    {r.department}
                  </span>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300">
                    {r.level}
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-base font-extrabold text-[var(--text-primary)] leading-snug">
                  {r.title}
                </h3>
                {r.description && (
                  <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed line-clamp-2">
                    {r.description}
                  </p>
                )}
              </div>

              {/* Responsibilities snippet */}
              {r.responsibilities && (
                <div className="p-3 bg-[var(--hover-bg)] rounded-2xl border border-[var(--card-border)] text-[11px] text-[var(--text-secondary)] space-y-1">
                  <div className="font-bold text-[var(--text-primary)] text-[10px] uppercase">Core Scope</div>
                  <div className="whitespace-pre-wrap line-clamp-3">
                    {r.responsibilities}
                  </div>
                </div>
              )}

              {/* Permissions list */}
              <div className="space-y-1.5 pt-2">
                <div className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Granted Capabilities</div>
                <div className="flex flex-wrap gap-1.5">
                  {r.permissions?.map((p: string) => (
                    <span key={p} className="px-2 py-0.5 rounded-md bg-[var(--hover-bg)] text-[10px] font-medium text-[var(--text-secondary)] font-mono border border-[var(--card-border)]">
                      ✓ {p.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-[var(--card-border)] flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span className="flex items-center gap-1 font-semibold text-[var(--text-primary)]">
                <Users className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                <span>{r.member_count} Assigned Members</span>
              </span>
              <span className="text-[10px]">ID #{r.id}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ─── CREATE ROLE MODAL ─── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--text-primary)] rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl space-y-5 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--card-border)]">
              <h3 className="text-lg font-black text-[var(--text-primary)]">Define New Operational Role</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRole} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                  Role Title
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. IT Intern – Web & Automation Developer"
                  className="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl font-semibold text-[var(--text-primary)] focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                    Department
                  </label>
                  <select
                    value={formDept}
                    onChange={(e) => setFormDept(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl font-semibold text-[var(--text-primary)] focus:outline-none focus:border-sky-500"
                  >
                    <option value="Data & Analytics">Data & Analytics</option>
                    <option value="Operations">Operations</option>
                    <option value="Engineering">Engineering</option>
                    <option value="Product & QA">Product & QA</option>
                    <option value="Design & UX">Design & UX</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                    Experience / Seniority Level
                  </label>
                  <select
                    value={formLevel}
                    onChange={(e) => setFormLevel(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl font-semibold text-[var(--text-primary)] focus:outline-none focus:border-sky-500"
                  >
                    <option value="Intern">Intern</option>
                    <option value="Junior">Junior</option>
                    <option value="Mid-Level">Mid-Level</option>
                    <option value="Senior">Senior</option>
                    <option value="Lead">Lead</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                  Role Summary / Purpose
                </label>
                <textarea
                  rows={2}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Summary of this operational role's objectives..."
                  className="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl font-semibold text-[var(--text-primary)] focus:outline-none focus:border-sky-500"
                ></textarea>
              </div>

              <div>
                <label className="block font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                  Core Responsibilities (Bullet Points)
                </label>
                <textarea
                  rows={3}
                  value={formResponsibilities}
                  onChange={(e) => setFormResponsibilities(e.target.value)}
                  placeholder="• Develop Next.js interfaces&#10;• Integrate Django APIs&#10;• Submit daily work logs"
                  className="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl font-semibold text-[var(--text-primary)] focus:outline-none focus:border-sky-500 font-mono"
                ></textarea>
              </div>

              {/* Permissions Checklist */}
              <div>
                <label className="block font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-2">
                  System Permissions & Scope
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto p-3 bg-[var(--input-bg)] rounded-2xl border border-[var(--card-border)]">
                  {availablePermissions.map((p) => {
                    const checked = formPermissions.includes(p.id);
                    return (
                      <label
                        key={p.id}
                        className={`flex items-start gap-2.5 p-2 rounded-xl transition cursor-pointer ${
                          checked ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200' : 'hover:bg-[var(--hover-bg)] text-[var(--text-secondary)]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePermission(p.id)}
                          className="mt-0.5 rounded text-purple-600 focus:ring-purple-500"
                        />
                        <div>
                          <div className="font-bold text-[var(--text-primary)]">{p.label}</div>
                          <div className="text-[10px] text-[var(--text-muted)]">{p.desc}</div>
                        </div>
                      </label>
                    );
                  })}
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
                  <span>Save Role Definition</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
