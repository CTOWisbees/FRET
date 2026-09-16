'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  PlusCircle,
  Users,
  CheckCircle2,
  X,
  RefreshCw,
  Building2,
  Layers,
  Table,
  Sparkles,
  Lock
} from 'lucide-react';
import { api } from '@/lib/api';

const DEFAULT_DEPT_CATALOG: Record<string, { id: string; name: string; description: string }[]> = {
  'Digital Marketing': [
    { id: 'bulk_email', name: 'Bulk email', description: 'High-volume transactional and campaign email dispatch' },
    { id: 'campaign_analytics', name: 'Campaign Analytics', description: 'CTR, open rate, and conversion metrics' },
    { id: 'social_media_mgmt', name: 'Social Media Strategy', description: 'Post scheduling and community branding' }
  ],
  'IT': [
    { id: 'task_management', name: 'Task Management', description: 'Core task dispatch, sprint workflows, and SLA tracking' },
    { id: 'system_admin', name: 'System Administration', description: 'Access control, infrastructure, and automation pipelines' },
    { id: 'api_web_portals', name: 'API & Web Portals', description: 'REST APIs, Next.js frontend interfaces, and integrations' }
  ],
  'IA - Research': [
    { id: 'report_generation', name: 'Report Generation', description: 'Automated investment and equity research reporting' },
    { id: 'portfolio_tracking', name: 'portfolio tracking dashboard', description: 'Real-time client portfolio metrics and asset performance' },
    { id: 'market_intelligence', name: 'Market Intelligence', description: 'Macro analysis, filings, and competitor intelligence' }
  ],
  'WBC': [
    { id: 'client_advisory', name: 'Client Advisory', description: 'WisBees consulting client interactions & proposals' },
    { id: 'ops_coordination', name: 'Operations Coordination', description: 'Cross-functional consulting deliverables' }
  ],
  'Wealth': [
    { id: 'portfolio_management', name: 'Portfolio Management', description: 'Wealth strategy, asset allocation, and rebalancing' },
    { id: 'wealth_analytics', name: 'Wealth Analytics', description: 'Risk profiling, CAGR, and yield tracking' }
  ],
  'Content Publishing': [
    { id: 'content_editor', name: 'Content Editor', description: 'Research note editing, editorial approvals & SEO' },
    { id: 'publishing_pipeline', name: 'Publishing Pipeline', description: 'Multi-channel broadcast and newsletter distributions' }
  ]
};

export default function AdminRolesPage() {
  const [roles, setRoles] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [deptCatalog, setDeptCatalog] = useState<Record<string, any[]>>(DEFAULT_DEPT_CATALOG);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formDept, setFormDept] = useState('IT');
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
    { id: 'bulk_email_access', label: 'Bulk Email Campaign Execution', desc: 'Allows sending transactional and mass emails' },
    { id: 'task_management_access', label: 'Task Management Engine Control', desc: 'Allows managing team task workflows' },
    { id: 'report_generation_access', label: 'Investment Report Generation', desc: 'Allows generating automated research PDFs' },
    { id: 'portfolio_dashboard_access', label: 'Portfolio Tracking Dashboard', desc: 'Access to real-time client portfolio analytics' },
    { id: 'manage_employees', label: 'Employee Administration (Admin Only)', desc: 'Add, modify, or delete employee accounts' },
    { id: 'assign_roles', label: 'Assign & Reassign Roles (Admin Only)', desc: 'Modify employee operational scopes' },
    { id: 'create_tasks', label: 'Create & Prioritize Tasks (Admin Only)', desc: 'Dispatch operational work' },
  ];

  const showAlert = (text: string, type: 'success' | 'error' = 'success') => {
    setAlertMsg({ type, text });
    setTimeout(() => setAlertMsg(null), 4000);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [roleRes, empRes] = await Promise.all([
        api.get('/admin/roles'),
        api.get('/admin/employees'),
      ]);
      if (roleRes.data?.roles) setRoles(roleRes.data.roles);
      if (roleRes.data?.department_catalog) setDeptCatalog(roleRes.data.department_catalog);
      if (empRes.data?.employees) setEmployees(empRes.data.employees);
    } catch (err) {
      console.error('Failed to load roles and catalog:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
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
        fetchData();
      }
    } catch (err: any) {
      showAlert(err.response?.data?.error || 'Failed to create role.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
              Role & Access Control
            </span>
            <span className="text-xs text-[var(--text-muted)]">• Google Sheets Matrix Architecture</span>
          </div>
          <h2 className="text-2xl font-black text-[var(--text-primary)] tracking-tight">
            Department Scope & Role Matrix
          </h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Official department-level module breakdown and multi-role definitions for operations and deliverables.
          </p>
        </div>

        <button
          onClick={() => {
            setFormTitle('');
            setFormDept('IT');
            setFormLevel('Intern');
            setFormDesc('');
            setFormResponsibilities('');
            setFormPermissions(['view_assigned_work', 'update_task_status', 'submit_work_logs']);
            setShowCreateModal(true);
          }}
          className="px-4 py-2.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white rounded-2xl text-xs font-bold shadow-md hover:shadow-lg transition flex items-center gap-2 cursor-pointer active:scale-95 shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Create New Role</span>
        </button>
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

      {/* ─── GOOGLE SHEETS INTERACTIVE MATRIX VIEW ─── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Table className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <h3 className="text-base font-black text-[var(--text-primary)]">
              Enterprise Department & Module Access Matrix
            </h3>
          </div>
          <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/50 px-2.5 py-1 rounded-full border border-sky-200 dark:border-sky-800">
            Reference: Google Sheets UAM Structure
          </span>
        </div>

        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800/80 border-b border-[var(--card-border)] text-[var(--text-primary)] uppercase tracking-wider font-extrabold text-[11px]">
                <tr>
                  <th className="py-4 px-6 w-48 border-r border-[var(--card-border)]">Department</th>
                  <th className="py-4 px-6 border-r border-[var(--card-border)]">Modules 1</th>
                  <th className="py-4 px-6 border-r border-[var(--card-border)]">Modules 2</th>
                  <th className="py-4 px-6 border-r border-[var(--card-border)]">Modules 3</th>
                  <th className="py-4 px-6">Authorized Team Members</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--card-border)]">
                {Object.entries(deptCatalog).map(([deptName, modules]) => {
                  const m1 = modules[0];
                  const m2 = modules[1];
                  const m3 = modules[2];

                  const authorizedEmps = employees.filter(
                    (e) => e.assigned_departments?.includes(deptName) || e.department === deptName
                  );

                  return (
                    <tr key={deptName} className="hover:bg-[var(--hover-bg)] transition">
                      {/* Department Name */}
                      <td className="py-4 px-6 font-extrabold text-sm text-[var(--text-primary)] border-r border-[var(--card-border)] bg-slate-50/50 dark:bg-slate-800/30">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                          <span>{deptName}</span>
                        </div>
                      </td>

                      {/* Module 1 */}
                      <td className="py-4 px-6 border-r border-[var(--card-border)]">
                        {m1 ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>{m1.name}</span>
                            </span>
                            <div className="text-[10px] text-[var(--text-muted)] font-medium pl-1">{m1.description}</div>
                          </div>
                        ) : (
                          <span className="text-[var(--text-muted)] italic text-xs">—</span>
                        )}
                      </td>

                      {/* Module 2 */}
                      <td className="py-4 px-6 border-r border-[var(--card-border)]">
                        {m2 ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-sky-50 dark:bg-sky-950/50 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                              <CheckCircle2 className="w-3 h-3 text-sky-600" />
                              <span>{m2.name}</span>
                            </span>
                            <div className="text-[10px] text-[var(--text-muted)] font-medium pl-1">{m2.description}</div>
                          </div>
                        ) : (
                          <span className="text-[var(--text-muted)] italic text-xs">—</span>
                        )}
                      </td>

                      {/* Module 3 */}
                      <td className="py-4 px-6 border-r border-[var(--card-border)]">
                        {m3 ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-50 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                              <CheckCircle2 className="w-3 h-3 text-purple-600" />
                              <span>{m3.name}</span>
                            </span>
                            <div className="text-[10px] text-[var(--text-muted)] font-medium pl-1">{m3.description}</div>
                          </div>
                        ) : (
                          <span className="text-[var(--text-muted)] italic text-xs">—</span>
                        )}
                      </td>

                      {/* Authorized Members */}
                      <td className="py-4 px-6">
                        <div className="flex flex-wrap gap-1.5 max-w-xs">
                          {authorizedEmps.length > 0 ? (
                            authorizedEmps.map((emp) => (
                              <span
                                key={emp.id}
                                className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[var(--hover-bg)] text-[var(--text-primary)] border border-[var(--card-border)]"
                              >
                                {emp.name}
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] text-[var(--text-muted)] italic">No assigned staff</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ─── ROLE DEFINITION CARDS ─── */}
      <div className="space-y-3 pt-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          <h3 className="text-base font-black text-[var(--text-primary)]">
            Defined Operational Roles & Permissions
          </h3>
        </div>

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
                    <span className="px-2 py-1 rounded-full text-[10px] font-extrabold bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                      {r.level}
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="font-extrabold text-sm text-[var(--text-primary)]">{r.title}</h4>
                  <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2">
                    {r.description || 'Defines operational deliverables and tasks for this functional role.'}
                  </p>
                </div>

                {/* Granted Permissions */}
                <div className="space-y-1.5 pt-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Granted Permissions ({r.permissions?.length || 0})
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {r.permissions?.map((p: string) => (
                      <span
                        key={p}
                        className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-[var(--hover-bg)] text-[var(--text-secondary)] border border-[var(--card-border)] flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span className="capitalize">{p.replace(/_/g, ' ')}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--card-border)] flex items-center justify-between text-xs">
                <div className="flex items-center gap-1 text-[var(--text-muted)] font-medium">
                  <Users className="w-3.5 h-3.5" />
                  <span>{r.member_count || 0} Members Holding Role</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── CREATE ROLE MODAL ─── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-3 sm:p-4 overflow-hidden">
          <div className="bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--text-primary)] rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl space-y-5 animate-fadeIn my-auto max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--card-border)]">
              <div>
                <h3 className="text-lg font-black text-[var(--text-primary)]">
                  Create Operational Role
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Configure title, level, and granular system access rights.
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRole} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                  Role Title *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Wealth & Portfolio Strategy Intern"
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
                    {Object.keys(deptCatalog).map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                    Seniority Level
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
                    <option value="Lead">Lead / Manager</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Brief summary of this role's purpose..."
                  className="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl font-medium text-[var(--text-primary)] focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Permissions Checkboxes */}
              <div>
                <label className="block font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                  Granular Permissions Scope
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {availablePermissions.map((perm) => {
                    const isSelected = formPermissions.includes(perm.id);
                    return (
                      <button
                        key={perm.id}
                        type="button"
                        onClick={() => togglePermission(perm.id)}
                        className={`p-2.5 rounded-xl border text-left transition flex items-start justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-purple-600 text-white border-purple-600 font-bold'
                            : 'bg-[var(--card-bg)] text-[var(--text-primary)] border-[var(--card-border)] hover:bg-[var(--hover-bg)] font-medium'
                        }`}
                      >
                        <div className="min-w-0 pr-1">
                          <div className="text-xs truncate">{perm.label}</div>
                          <div className={`text-[9px] ${isSelected ? 'text-purple-200' : 'text-[var(--text-muted)]'} truncate`}>
                            {perm.desc}
                          </div>
                        </div>
                        {isSelected ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" /> : <div className="w-3.5 h-3.5 rounded border border-[var(--card-border)] shrink-0 mt-0.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--card-border)]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-[var(--card-border)] text-[var(--text-secondary)] font-bold hover:bg-[var(--hover-bg)] transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white rounded-xl font-bold shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>Save Role</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
