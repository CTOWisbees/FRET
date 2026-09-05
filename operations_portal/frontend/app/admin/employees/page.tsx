'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Shield,
  Edit2,
  Trash2,
  CheckCircle2,
  X,
  RefreshCw,
  Mail,
  Phone,
  Briefcase,
  Layers,
  Key
} from 'lucide-react';
import { api } from '@/lib/api';

export default function AdminEmployeesPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // Form State
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('employee123');
  const [formPhone, setFormPhone] = useState('');
  const [formDesignation, setFormDesignation] = useState('Operations Associate');
  const [formDepartment, setFormDepartment] = useState('Data & Analytics');
  const [formRoleId, setFormRoleId] = useState<string>('');
  const [formStatus, setFormStatus] = useState('Active');
  const [formSkills, setFormSkills] = useState('');

  const showAlert = (text: string, type: 'success' | 'error' = 'success') => {
    setAlertMsg({ type, text });
    setTimeout(() => setAlertMsg(null), 4000);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [empRes, roleRes] = await Promise.all([
        api.get('/admin/employees'),
        api.get('/admin/roles'),
      ]);
      if (empRes.data?.employees) setEmployees(empRes.data.employees);
      if (roleRes.data?.roles) setRoles(roleRes.data.roles);
    } catch (err) {
      console.error('Failed to load employee list:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openAddModal = () => {
    setFormName('');
    setFormEmail('');
    setFormPassword('employee123');
    setFormPhone('');
    setFormDesignation('Operations Associate');
    setFormDepartment('Data & Analytics');
    setFormRoleId(roles[0]?.id ? String(roles[0].id) : '');
    setFormStatus('Active');
    setFormSkills('');
    setShowAddModal(true);
  };

  const openEditModal = (emp: any) => {
    setSelectedEmp(emp);
    setFormName(emp.name);
    setFormEmail(emp.email);
    setFormPassword('');
    setFormPhone(emp.phone || '');
    setFormDesignation(emp.designation || '');
    setFormDepartment(emp.department || 'Operations');
    setFormRoleId(emp.assigned_role?.id ? String(emp.assigned_role.id) : '');
    setFormStatus(emp.status || 'Active');
    setFormSkills(emp.skills || '');
    setShowEditModal(true);
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.post('/admin/employees', {
        name: formName,
        email: formEmail,
        password: formPassword,
        phone: formPhone,
        designation: formDesignation,
        department: formDepartment,
        assigned_role_id: formRoleId ? Number(formRoleId) : null,
        status: formStatus,
        skills: formSkills,
      });

      if (res.data?.success) {
        showAlert('Employee account created successfully!');
        setShowAddModal(false);
        fetchData();
      }
    } catch (err: any) {
      showAlert(err.response?.data?.error || 'Failed to create employee.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmp) return;
    setSaving(true);
    try {
      const payload: any = {
        name: formName,
        phone: formPhone,
        designation: formDesignation,
        department: formDepartment,
        assigned_role_id: formRoleId ? Number(formRoleId) : null,
        status: formStatus,
        skills: formSkills,
      };
      if (formPassword) payload.new_password = formPassword;

      const res = await api.put(`/admin/employees/${selectedEmp.id}`, payload);
      if (res.data?.success) {
        showAlert('Employee profile and role updated successfully!');
        setShowEditModal(false);
        fetchData();
      }
    } catch (err: any) {
      showAlert(err.response?.data?.error || 'Failed to update employee.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEmployee = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to remove ${name} from operations?`)) return;
    try {
      await api.delete(`/admin/employees/${id}`);
      showAlert(`Employee ${name} deleted.`);
      fetchData();
    } catch (err) {
      showAlert('Failed to delete employee.', 'error');
    }
  };

  const filteredEmployees = employees.filter((emp) =>
    emp.name.toLowerCase().includes(search.toLowerCase()) ||
    emp.email.toLowerCase().includes(search.toLowerCase()) ||
    (emp.designation && emp.designation.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-[var(--text-primary)] tracking-tight">
            Employee Directory & Role Assignment
          </h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Manage operational team members, configure system designations, and assign operational roles.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="px-4 py-2.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white rounded-2xl text-xs font-bold shadow-md transition flex items-center gap-2 cursor-pointer active:scale-95"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add New Employee</span>
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

      {/* Search Filter */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative max-w-sm w-full">
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, designation..."
            className="w-full pl-10 pr-4 py-2.5 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl text-xs font-medium text-[var(--text-primary)] focus:outline-none focus:border-sky-500 shadow-2xs"
          />
        </div>
      </div>

      {/* Employees Table */}
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl overflow-hidden shadow-xs transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--hover-bg)] border-b border-[var(--card-border)] text-[var(--text-muted)] uppercase tracking-wider font-bold text-[10px]">
              <tr>
                <th className="py-4 px-6">Employee</th>
                <th className="py-4 px-6">Contact & Code</th>
                <th className="py-4 px-6">Assigned Operational Role</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--card-border)]">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[var(--text-muted)]">
                    No employees matching search criteria.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-[var(--hover-bg)] transition">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                          {emp.name ? emp.name[0].toUpperCase() : 'E'}
                        </div>
                        <div>
                          <div className="font-extrabold text-[var(--text-primary)] text-sm">{emp.name}</div>
                          <div className="text-[11px] text-[var(--text-secondary)] font-medium">
                            {emp.designation || 'Operations Staff'}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-6 space-y-0.5">
                      <div className="font-semibold text-[var(--text-primary)]">{emp.email}</div>
                      <div className="text-[11px] text-[var(--text-muted)]">{emp.phone || 'No phone'} • <span className="font-mono font-bold">{emp.emp_code}</span></div>
                    </td>

                    <td className="py-4 px-6">
                      {emp.assigned_role ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                          <Shield className="w-3.5 h-3.5" />
                          <span>{emp.assigned_role.title}</span>
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)] text-xs italic">No Role Assigned</span>
                      )}
                    </td>

                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        emp.status === 'Active'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${emp.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                        <span>{emp.status}</span>
                      </span>
                    </td>

                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(emp)}
                          className="p-2 text-[var(--text-secondary)] hover:text-sky-500 hover:bg-[var(--hover-bg)] rounded-xl transition cursor-pointer"
                          title="Edit & Assign Role"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteEmployee(emp.id, emp.name)}
                          className="p-2 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition cursor-pointer"
                          title="Delete Employee"
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--text-primary)] rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl space-y-5 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--card-border)]">
              <h3 className="text-lg font-black text-[var(--text-primary)]">
                {showAddModal ? 'Add New Team Member' : `Edit ${selectedEmp?.name}`}
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setShowEditModal(false);
                }}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={showAddModal ? handleCreateEmployee : handleUpdateEmployee} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Chhayakanta Maharana"
                    className="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl font-semibold text-[var(--text-primary)] focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    disabled={showEditModal}
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="e.g. chhayakanta@wisbees.com"
                    className="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl font-semibold text-[var(--text-primary)] focus:outline-none focus:border-sky-500 disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                    Designation Title
                  </label>
                  <input
                    type="text"
                    value={formDesignation}
                    onChange={(e) => setFormDesignation(e.target.value)}
                    placeholder="e.g. IT Intern – Web & Automation Developer"
                    className="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl font-semibold text-[var(--text-primary)] focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="+91 8260770510"
                    className="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl font-semibold text-[var(--text-primary)] focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              {/* Assign Operational Role */}
              <div>
                <label className="block font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                  Assign Operational Role & Permissions Scope
                </label>
                <select
                  value={formRoleId}
                  onChange={(e) => setFormRoleId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl font-semibold text-[var(--text-primary)] focus:outline-none focus:border-sky-500"
                >
                  <option value="">-- No Specific Role Assigned --</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title} ({r.department} - {r.level})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                    Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl font-semibold text-[var(--text-primary)] focus:outline-none focus:border-sky-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="On Leave">On Leave</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                    {showAddModal ? 'Initial Password' : 'Change Password (Optional)'}
                  </label>
                  <input
                    type="password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder={showAddModal ? 'employee123' : 'Leave empty to keep current'}
                    className="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl font-semibold text-[var(--text-primary)] focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                  Skills & Tools
                </label>
                <input
                  type="text"
                  value={formSkills}
                  onChange={(e) => setFormSkills(e.target.value)}
                  placeholder="React, Next.js, Django, REST APIs, Automation"
                  className="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl font-semibold text-[var(--text-primary)] focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--card-border)]">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setShowEditModal(false);
                  }}
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
                  <span>{showAddModal ? 'Create Employee' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
