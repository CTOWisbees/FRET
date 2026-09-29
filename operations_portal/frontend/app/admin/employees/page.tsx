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
  Key,
  FolderTree,
  CheckSquare,
  Square,
  AlertTriangle,
  Building2,
  Sparkles,
  Award,
  Plus,
  Trash
} from 'lucide-react';
import { api } from '@/lib/api';

interface DepartmentAccessRow {
  departmentId: number | string;
  departmentName: string;
}

export default function AdminEmployeesPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [allDepartments, setAllDepartments] = useState<any[]>([]);
  const [deptCatalog, setDeptCatalog] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('ALL');
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleteConfirmEmp, setDeleteConfirmEmp] = useState<any | null>(null);
  const [selectedEmp, setSelectedEmp] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // Form State (matching Django Admin screenshot style)
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('employee123');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formPhone, setFormPhone] = useState('');
  const [formDesignation, setFormDesignation] = useState('Operations Associate');
  const [formDepartmentAccessRows, setFormDepartmentAccessRows] = useState<DepartmentAccessRow[]>([]);
  const [formSelectedRoles, setFormSelectedRoles] = useState<number[]>([]);
  const [formSelectedModules, setFormSelectedModules] = useState<string[]>([]);
  const [formSkills, setFormSkills] = useState('');

  const showAlert = (text: string, type: 'success' | 'error' = 'success') => {
    setAlertMsg({ type, text });
    setTimeout(() => setAlertMsg(null), 4000);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [empRes, roleRes, deptRes] = await Promise.all([
        api.get('/admin/employees'),
        api.get('/admin/roles'),
        api.get('/admin/departments'),
      ]);
      if (empRes.data?.employees) setEmployees(empRes.data.employees);
      if (empRes.data?.department_catalog) setDeptCatalog(empRes.data.department_catalog);
      if (roleRes.data?.roles) setRoles(roleRes.data.roles);
      if (deptRes.data?.departments) {
        setAllDepartments(deptRes.data.departments);
      } else if (empRes.data?.departments) {
        setAllDepartments(empRes.data.departments);
      }
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
    setFormIsActive(true);
    setFormPhone('');
    setFormDesignation('Operations Associate');
    
    // Default initial department access row
    const defaultDept = allDepartments.length > 0 ? allDepartments[0] : { id: 'IT', name: 'IT' };
    setFormDepartmentAccessRows([
      { departmentId: defaultDept.id, departmentName: defaultDept.name }
    ]);

    setFormSelectedRoles(roles.length > 0 ? [roles[0].id] : []);
    setFormSelectedModules(['Task Management']);
    setFormSkills('');
    setShowAddModal(true);
  };

  const openEditModal = (emp: any) => {
    setSelectedEmp(emp);
    setFormName(emp.full_name || emp.name || '');
    setFormEmail(emp.email || '');
    setFormPassword('');
    setFormIsActive(emp.is_active !== undefined ? emp.is_active : emp.status === 'Active');
    setFormPhone(emp.phone || '');
    setFormDesignation(emp.designation || '');
    
    // Extract assigned role IDs
    const roleIds: number[] = [];
    if (emp.assigned_roles && emp.assigned_roles.length > 0) {
      emp.assigned_roles.forEach((r: any) => roleIds.push(r.id));
    } else if (emp.assigned_role?.id) {
      roleIds.push(emp.assigned_role.id);
    }
    setFormSelectedRoles(roleIds);

    // Extract department accesses (support both model department_accesses and assigned_departments)
    let deptRows: DepartmentAccessRow[] = [];
    if (emp.department_accesses && emp.department_accesses.length > 0) {
      deptRows = emp.department_accesses.map((da: any) => ({
        departmentId: da.id,
        departmentName: da.name,
      }));
    } else if (emp.assigned_departments && emp.assigned_departments.length > 0) {
      deptRows = emp.assigned_departments.map((dname: string) => {
        const found = allDepartments.find((d) => d.name === dname);
        return {
          departmentId: found ? found.id : dname,
          departmentName: dname,
        };
      });
    } else {
      const defaultDept = allDepartments.length > 0 ? allDepartments[0] : { id: 'IT', name: 'IT' };
      deptRows = [{ departmentId: defaultDept.id, departmentName: defaultDept.name }];
    }
    setFormDepartmentAccessRows(deptRows);

    setFormSelectedModules(emp.assigned_modules || []);
    setFormSkills(emp.skills || '');
    setShowEditModal(true);
  };

  // Department Access Row helpers (matching Django Admin inline)
  const addDepartmentAccessRow = () => {
    const available = allDepartments.find(
      (d) => !formDepartmentAccessRows.some((row) => row.departmentId === d.id || row.departmentName === d.name)
    );
    const chosen = available || (allDepartments.length > 0 ? allDepartments[0] : { id: 'Operations', name: 'Operations' });
    setFormDepartmentAccessRows([
      ...formDepartmentAccessRows,
      { departmentId: chosen.id, departmentName: chosen.name },
    ]);
  };

  const removeDepartmentAccessRow = (index: number) => {
    if (formDepartmentAccessRows.length <= 1) {
      showAlert('At least one department access must be assigned.', 'error');
      return;
    }
    const updated = [...formDepartmentAccessRows];
    updated.splice(index, 1);
    setFormDepartmentAccessRows(updated);
  };

  const updateDepartmentAccessRow = (index: number, deptId: string | number) => {
    const deptObj = allDepartments.find((d) => String(d.id) === String(deptId) || d.name === deptId);
    const updated = [...formDepartmentAccessRows];
    updated[index] = {
      departmentId: deptObj ? deptObj.id : deptId,
      departmentName: deptObj ? deptObj.name : String(deptId),
    };
    setFormDepartmentAccessRows(updated);
  };

  const toggleRoleSelection = (roleId: number) => {
    if (formSelectedRoles.includes(roleId)) {
      setFormSelectedRoles(formSelectedRoles.filter((id) => id !== roleId));
    } else {
      setFormSelectedRoles([...formSelectedRoles, roleId]);
    }
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEmail || !formName) {
      showAlert('Email and Full Name are required.', 'error');
      return;
    }
    if (formDepartmentAccessRows.length === 0) {
      showAlert('Please assign at least one department access.', 'error');
      return;
    }
    setSaving(true);

    const deptIds: number[] = [];
    const deptNames: string[] = [];
    formDepartmentAccessRows.forEach((row) => {
      if (typeof row.departmentId === 'number') {
        deptIds.push(row.departmentId);
      }
      deptNames.push(row.departmentName);
    });

    try {
      const res = await api.post('/admin/employees', {
        name: formName,
        full_name: formName,
        email: formEmail,
        password: formPassword,
        is_active: formIsActive,
        phone: formPhone,
        designation: formDesignation,
        department: deptNames[0] || 'Operations',
        assigned_departments: deptNames,
        department_ids: deptIds,
        assigned_modules: formSelectedModules,
        assigned_role_ids: formSelectedRoles,
        status: formIsActive ? 'Active' : 'Inactive',
        skills: formSkills,
      });

      if (res.data?.success) {
        showAlert('New OP user account created successfully with department access!');
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
    if (formDepartmentAccessRows.length === 0) {
      showAlert('Please assign at least one department access.', 'error');
      return;
    }
    setSaving(true);

    const deptIds: number[] = [];
    const deptNames: string[] = [];
    formDepartmentAccessRows.forEach((row) => {
      if (typeof row.departmentId === 'number') {
        deptIds.push(row.departmentId);
      }
      deptNames.push(row.departmentName);
    });

    try {
      const payload: any = {
        name: formName,
        full_name: formName,
        phone: formPhone,
        designation: formDesignation,
        department: deptNames[0] || 'Operations',
        assigned_departments: deptNames,
        department_ids: deptIds,
        assigned_modules: formSelectedModules,
        assigned_role_ids: formSelectedRoles,
        is_active: formIsActive,
        status: formIsActive ? 'Active' : 'Inactive',
        skills: formSkills,
      };
      if (formPassword) payload.new_password = formPassword;

      const res = await api.put(`/admin/employees/${selectedEmp.id}`, payload);
      if (res.data?.success) {
        showAlert('Employee profile, credentials, and department accesses updated!');
        setShowEditModal(false);
        fetchData();
      }
    } catch (err: any) {
      showAlert(err.response?.data?.error || 'Failed to update employee.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEmployee = async () => {
    if (!deleteConfirmEmp) return;
    setSaving(true);
    try {
      const res = await api.delete(`/admin/employees/${deleteConfirmEmp.id}`);
      if (res.data?.success) {
        showAlert(`Employee ${deleteConfirmEmp.name} deleted successfully.`);
        setDeleteConfirmEmp(null);
        fetchData();
      }
    } catch (err: any) {
      showAlert(err.response?.data?.error || 'Failed to delete employee.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      (emp.name && emp.name.toLowerCase().includes(search.toLowerCase())) ||
      (emp.full_name && emp.full_name.toLowerCase().includes(search.toLowerCase())) ||
      (emp.email && emp.email.toLowerCase().includes(search.toLowerCase())) ||
      (emp.designation && emp.designation.toLowerCase().includes(search.toLowerCase())) ||
      (emp.department && emp.department.toLowerCase().includes(search.toLowerCase()));

    const matchesDept =
      selectedDeptFilter === 'ALL'
        ? true
        : emp.assigned_departments?.includes(selectedDeptFilter) ||
          emp.department_accesses?.some((da: any) => da.name === selectedDeptFilter) ||
          emp.department === selectedDeptFilter;

    return matchesSearch && matchesDept;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
              OP User Management (UAM)
            </span>
            <span className="text-xs text-[var(--text-muted)]">• Department Access & Login Creation</span>
          </div>
          <h2 className="text-2xl font-black text-[var(--text-primary)] tracking-tight">
            OP Users & Employee Logins
          </h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Create employee login credentials, assign multi-row department accesses, and configure role scopes.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="px-4 py-2.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white rounded-2xl text-xs font-bold shadow-md hover:shadow-lg transition flex items-center gap-2 cursor-pointer active:scale-95 shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add OP User / Employee</span>
        </button>
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

      {/* Department Quick Filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
          <Building2 className="w-3.5 h-3.5" /> Filter Dept:
        </span>
        <button
          onClick={() => setSelectedDeptFilter('ALL')}
          className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 cursor-pointer ${
            selectedDeptFilter === 'ALL'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'bg-[var(--card-bg)] text-[var(--text-secondary)] border border-[var(--card-border)] hover:bg-[var(--hover-bg)]'
          }`}
        >
          All Departments ({employees.length})
        </button>
        {allDepartments.map((dept) => {
          const count = employees.filter(
            (e) =>
              e.assigned_departments?.includes(dept.name) ||
              e.department_accesses?.some((da: any) => da.name === dept.name) ||
              e.department === dept.name
          ).length;
          return (
            <button
              key={dept.id || dept.name}
              onClick={() => setSelectedDeptFilter(dept.name)}
              className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 cursor-pointer flex items-center gap-1.5 ${
                selectedDeptFilter === dept.name
                  ? 'bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow-xs'
                  : 'bg-[var(--card-bg)] text-[var(--text-secondary)] border border-[var(--card-border)] hover:bg-[var(--hover-bg)]'
              }`}
            >
              <span>{dept.name}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  selectedDeptFilter === dept.name
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search Filter */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative max-w-md w-full">
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by full name, email, designation, or department..."
            className="w-full pl-10 pr-4 py-2.5 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl text-xs font-medium text-[var(--text-primary)] focus:outline-none focus:border-sky-500 shadow-2xs"
          />
        </div>
        <div className="text-xs font-bold text-[var(--text-muted)]">
          Showing {filteredEmployees.length} of {employees.length} OP Users
        </div>
      </div>

      {/* Employees Table */}
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl overflow-hidden shadow-xs transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--hover-bg)] border-b border-[var(--card-border)] text-[var(--text-muted)] uppercase tracking-wider font-bold text-[10px]">
              <tr>
                <th className="py-4 px-6">OP User / Employee</th>
                <th className="py-4 px-6">Email & Code</th>
                <th className="py-4 px-6">Department Access</th>
                <th className="py-4 px-6">Assigned Roles</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--card-border)]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[var(--text-muted)]">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-sky-500" />
                      <span>Loading OP users...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[var(--text-muted)]">
                    No OP users found matching filter or search criteria.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => {
                  const displayName = emp.full_name || emp.name;
                  const depts =
                    emp.department_accesses && emp.department_accesses.length > 0
                      ? emp.department_accesses.map((da: any) => da.name)
                      : emp.assigned_departments || (emp.department ? [emp.department] : []);

                  const assignedRolesList =
                    emp.assigned_roles && emp.assigned_roles.length > 0
                      ? emp.assigned_roles
                      : emp.assigned_role
                      ? [emp.assigned_role]
                      : [];

                  return (
                    <tr key={emp.id} className="hover:bg-[var(--hover-bg)] transition">
                      {/* Name & Designation */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-xs">
                            {displayName ? displayName[0].toUpperCase() : 'U'}
                          </div>
                          <div>
                            <div className="font-extrabold text-[var(--text-primary)] text-sm">{displayName}</div>
                            <div className="text-[11px] text-[var(--text-secondary)] font-semibold">
                              {emp.designation || 'Operations Staff'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Email & Code */}
                      <td className="py-4 px-6 space-y-0.5">
                        <div className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-sky-500" />
                          <span>{emp.email}</span>
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)] font-mono font-bold">
                          {emp.emp_code || `OPS-${emp.id}`}
                        </div>
                      </td>

                      {/* Department Access Badges */}
                      <td className="py-4 px-6">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {depts.map((d: string) => (
                            <span
                              key={d}
                              className="px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800"
                            >
                              {d}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Roles */}
                      <td className="py-4 px-6">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {assignedRolesList.length > 0 ? (
                            assignedRolesList.map((r: any) => (
                              <span
                                key={r.id || r.title}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                              >
                                <Shield className="w-3 h-3 text-purple-500" />
                                <span>{r.title}</span>
                              </span>
                            ))
                          ) : (
                            <span className="text-[var(--text-muted)] text-[11px] italic">General Scope</span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            emp.is_active || emp.status === 'Active'
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              emp.is_active || emp.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-400'
                            }`}
                          ></span>
                          <span>{emp.is_active || emp.status === 'Active' ? 'Active' : 'Inactive'}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(emp)}
                            className="p-2 text-[var(--text-secondary)] hover:text-sky-500 hover:bg-[var(--hover-bg)] rounded-xl transition cursor-pointer"
                            title="Edit OP User & Department Access"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmEmp(emp)}
                            className="p-2 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition cursor-pointer"
                            title="Delete Employee"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── ADD / EDIT MODAL (MATCHING DJANGO ADMIN "ADD OP USER" SCREENSHOTS 1, 2, 3) ─── */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-3 sm:p-6 overflow-hidden">
          <div className="relative w-full max-w-2xl bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--text-primary)] rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden my-auto animate-fadeIn">
            {/* Modal Header */}
            <div className="px-6 py-4.5 border-b border-[var(--card-border)] flex items-center justify-between shrink-0 bg-[var(--card-bg)]">
              <div>
                <h3 className="text-base sm:text-lg font-black text-[var(--text-primary)] flex items-center gap-2">
                  <span>{showAddModal ? 'Add OP User' : `Edit OP User: ${selectedEmp?.name}`}</span>
                </h3>
                <p className="text-[11px] sm:text-xs text-[var(--text-muted)]">
                  Configure employee email, login password, and multi-row department access scopes.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setShowEditModal(false);
                }}
                className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] rounded-xl cursor-pointer transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form
              onSubmit={showAddModal ? handleCreateEmployee : handleUpdateEmployee}
              className="flex flex-col flex-1 overflow-hidden"
            >
              <div className="px-6 py-5 overflow-y-auto space-y-4.5 flex-1 text-xs">
                {/* 1. Email */}
                <div>
                  <label className="block font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                    Email: *
                  </label>
                  <input
                    type="email"
                    required
                    disabled={showEditModal}
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="e.g. ashley.lobo@wisbees.com"
                    className="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl font-semibold text-[var(--text-primary)] focus:outline-none focus:border-sky-500 disabled:opacity-60"
                  />
                </div>

                {/* 2. Full Name */}
                <div>
                  <label className="block font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                    Full name: *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Ashley Lobo"
                    className="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl font-semibold text-[var(--text-primary)] focus:outline-none focus:border-sky-500"
                  />
                </div>

                {/* 3. Password Setup */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                      {showAddModal ? 'Initial Password: *' : 'Change Password (Optional):'}
                    </label>
                    <input
                      type="text"
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      placeholder={showAddModal ? 'employee123' : 'Leave empty to keep current'}
                      className="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl font-semibold text-[var(--text-primary)] focus:outline-none focus:border-sky-500 font-mono"
                    />
                  </div>

                  {/* 4. Is active Checkbox */}
                  <div className="flex items-center pt-6">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={formIsActive}
                        onChange={(e) => setFormIsActive(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                      />
                      <span className="font-bold text-[var(--text-primary)] text-xs">
                        Is active (Enables login access)
                      </span>
                    </label>
                  </div>
                </div>

                {/* 5. DEPARTMENT ACCESS INLINE (MATCHING DJANGO ADMIN SCREENSHOTS 1, 2, 3) */}
                <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                      <span>DEPARTMENT ACCESS</span>
                    </span>
                    <span className="text-[10px] font-bold text-[var(--text-muted)]">
                      {formDepartmentAccessRows.length} department(s) attached
                    </span>
                  </div>

                  <div className="space-y-2">
                    {formDepartmentAccessRows.map((row, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 p-2.5 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl"
                      >
                        <div className="flex-1">
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                            DEPARTMENT
                          </label>
                          <select
                            value={row.departmentId}
                            onChange={(e) => updateDepartmentAccessRow(idx, e.target.value)}
                            className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-lg font-bold text-xs text-[var(--text-primary)] focus:outline-none focus:border-sky-500"
                          >
                            {allDepartments.map((dept) => (
                              <option key={dept.id} value={dept.id}>
                                {dept.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="pt-4">
                          <button
                            type="button"
                            onClick={() => removeDepartmentAccessRow(idx)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition cursor-pointer"
                            title="Delete this Department Access"
                          >
                            <Trash className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={addDepartmentAccessRow}
                    className="mt-2 text-xs font-bold text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 flex items-center gap-1.5 cursor-pointer py-1"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Add another Department Access</span>
                  </button>
                </div>

                {/* Optional Extended Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                      Designation Title (Optional)
                    </label>
                    <input
                      type="text"
                      value={formDesignation}
                      onChange={(e) => setFormDesignation(e.target.value)}
                      placeholder="e.g. Digital Marketing Intern, Compliance Officer"
                      className="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl font-semibold text-[var(--text-primary)] focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                      Phone Number (Optional)
                    </label>
                    <input
                      type="text"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      placeholder="+91 9820011223"
                      className="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl font-semibold text-[var(--text-primary)] focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                {/* Operational Roles */}
                {roles.length > 0 && (
                  <div className="p-3.5 bg-purple-50/40 dark:bg-purple-950/20 rounded-2xl border border-purple-200 dark:border-purple-900/60 space-y-2">
                    <label className="font-extrabold uppercase tracking-wider text-purple-900 dark:text-purple-300 flex items-center gap-1.5 text-xs">
                      <Shield className="w-4 h-4 text-purple-600" />
                      <span>Operational Roles (Optional)</span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                      {roles.map((r) => {
                        const isSelected = formSelectedRoles.includes(r.id);
                        return (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => toggleRoleSelection(r.id)}
                            className={`p-2 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                              isSelected
                                ? 'bg-purple-600 text-white border-purple-600 font-bold'
                                : 'bg-[var(--card-bg)] text-[var(--text-primary)] border-[var(--card-border)] hover:bg-[var(--hover-bg)] font-medium'
                            }`}
                          >
                            <span className="text-xs truncate">{r.title}</span>
                            {isSelected && <CheckCircle2 className="w-3.5 h-3.5 shrink-0 ml-1" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-[var(--card-border)] bg-[var(--card-bg)] flex items-center justify-end gap-3 shrink-0">
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
                  className="px-5 py-2.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white rounded-xl font-bold shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50 text-xs"
                >
                  {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>{showAddModal ? 'Save & Create Login' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── DELETE MODAL ─── */}
      {deleteConfirmEmp && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--text-primary)] rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-fadeIn">
            <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-black text-[var(--text-primary)]">Delete OP User Account?</h4>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Are you sure you want to remove <span className="font-bold text-[var(--text-primary)]">{deleteConfirmEmp.name}</span> (<span className="font-mono font-bold text-sky-600">{deleteConfirmEmp.email}</span>)?
              </p>
            </div>
            <div className="p-3 bg-red-50/50 dark:bg-red-950/30 rounded-xl border border-red-200 dark:border-red-900/50 text-[11px] text-red-700 dark:text-red-300 font-medium">
              This will remove all associated department accesses and task assignments.
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmEmp(null)}
                className="px-4 py-2 rounded-xl border border-[var(--card-border)] text-[var(--text-secondary)] font-bold hover:bg-[var(--hover-bg)] transition cursor-pointer text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteEmployee}
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
