'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Filter, Download, Database, CheckCircle2, Clock, Search, RefreshCw } from 'lucide-react';
import { api, getApiUrl } from '@/lib/api';

export default function AttendanceManagementPage() {
  const [records, setRecords] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [stats, setStats] = useState({
    total_records: 0,
    present_today: 0,
    late_entries: 0,
  });

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/attendance-management', {
        params: {
          employee_id: employeeFilter || undefined,
          from_date: fromDate || undefined,
          to_date: toDate || undefined,
        },
      });
      if (res.data) {
        setRecords(res.data.records || []);
        if (res.data.employees) {
          setEmployees(res.data.employees);
        }
        if (res.data.stats) {
          setStats(res.data.stats);
        }
      }
    } catch (e) {
      console.error('Failed to fetch attendance:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, []);

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAttendance();
  };

  const handleReset = () => {
    setEmployeeFilter('');
    setFromDate('');
    setToDate('');
    setSearch('');
    setTimeout(() => {
      fetchAttendance();
    }, 0);
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    if (employeeFilter) params.set('employee_id', employeeFilter);
    if (fromDate) params.set('from', fromDate);
    if (toDate) params.set('to', toDate);
    if (search) params.set('search', search);
    const qs = params.toString() ? `?${params.toString()}` : '';
    window.location.href = getApiUrl(`/attendance/export${qs}`);
  };

  const filtered = records.filter((rec) => {
    return !search || 
      (rec.name && rec.name.toLowerCase().includes(search.toLowerCase())) || 
      (rec.emp_id && rec.emp_id.toLowerCase().includes(search.toLowerCase())) ||
      (rec.department && rec.department.toLowerCase().includes(search.toLowerCase()));
  });

  return (
    <div className="flex min-h-screen bg-[var(--bg)] text-[var(--text)] font-sans">
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header title="Attendance Management" onMenuClick={() => setMobileOpen(true)} />

        <main className="p-4 sm:p-6 lg:p-8 flex-1 overflow-y-auto space-y-6">
          {/* Top Filter Form Card */}
          <form onSubmit={handleFilter} className="stat-card p-6 space-y-4 rounded-xl border border-[var(--border)]">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text3)] mb-1">Employee / Intern</label>
                <select
                  value={employeeFilter}
                  onChange={(e) => setEmployeeFilter(e.target.value)}
                  className="form-control text-sm"
                >
                  <option value="">All Employees & Interns</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.emp_id}) — {emp.emp_type === 'Intern' ? 'Intern' : 'Employee'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text3)] mb-1">From Date</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="form-control text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text3)] mb-1">To Date</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="form-control text-sm"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="submit"
                className="px-5 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent2)] text-white font-bold rounded-xl shadow-md transition flex items-center space-x-2 text-sm"
              >
                <Filter className="w-4 h-4" />
                <span>Filter</span>
              </button>

              {(employeeFilter || fromDate || toDate) && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2.5 bg-[var(--surface2)] hover:bg-[var(--hover)] border border-[var(--border)] font-semibold rounded-xl transition flex items-center space-x-1.5 text-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleExport}
                className="px-5 py-2.5 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 hover:bg-emerald-500/20 font-bold rounded-xl transition flex items-center space-x-2 text-sm"
              >
                <Download className="w-4 h-4" />
                <span>Export Excel</span>
              </button>
            </div>
          </form>

          {/* 3 Stat Cards Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="stat-card p-6 flex items-center justify-between">
              <div>
                <div className="stat-label">TOTAL RECORDS</div>
                <div className="stat-value text-[var(--text)]">{stats.total_records}</div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <Database className="w-6 h-6" />
              </div>
            </div>

            <div className="stat-card p-6 flex items-center justify-between">
              <div>
                <div className="stat-label">PRESENT TODAY</div>
                <div className="stat-value text-[var(--text)]">{stats.present_today}</div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>

            <div className="stat-card p-6 flex items-center justify-between">
              <div>
                <div className="stat-label">LATE ENTRIES</div>
                <div className="stat-value text-[var(--text)]">{stats.late_entries}</div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center">
                <Clock className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Attendance Records Table */}
          <div className="stat-card p-6 rounded-xl border border-[var(--border)] space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
              <div>
                <h3 className="font-bold text-lg text-[var(--text)] font-['Plus_Jakarta_Sans']">
                  Attendance Records
                </h3>
                <p className="text-xs text-[var(--text3)]">Daily employee & intern attendance tracking</p>
              </div>

              <div className="relative w-full md:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text3)]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search employee or intern..."
                  className="form-control pl-9 text-xs"
                />
              </div>
            </div>

            <div className="table-wrapper">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[var(--bg3)] border-b border-[var(--border)] text-[11px] font-bold uppercase tracking-wider text-[var(--text3)]">
                    <th className="py-3.5 px-4">DATE</th>
                    <th className="py-3.5 px-4">EMPLOYEE ID</th>
                    <th className="py-3.5 px-4">NAME</th>
                    <th className="py-3.5 px-4">TYPE</th>
                    <th className="py-3.5 px-4">DEPARTMENT</th>
                    <th className="py-3.5 px-4">CHECK IN</th>
                    <th className="py-3.5 px-4">CHECK OUT</th>
                    <th className="py-3.5 px-4">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] text-sm">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-xs text-[var(--text3)]">
                        Loading attendance records...
                      </td>
                    </tr>
                  ) : filtered.length > 0 ? (
                    filtered.map((rec) => (
                      <tr key={rec.id} className="hover:bg-[var(--hover)] transition">
                        <td className="py-4 px-4 text-xs font-medium text-[var(--text)]">{rec.date}</td>
                        <td className="py-4 px-4 font-mono text-xs font-bold text-[var(--text2)]">{rec.emp_id}</td>
                        <td className="py-4 px-4 font-semibold text-xs text-[var(--text)]">{rec.name}</td>
                        <td className="py-4 px-4 text-xs">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            rec.emp_type === 'Intern'
                              ? 'bg-purple-500/10 text-purple-600 border border-purple-500/20'
                              : 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                          }`}>
                            {rec.emp_type || 'Normal'}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-xs text-[var(--text3)]">{rec.department || '—'}</td>
                        <td className="py-4 px-4 font-mono text-xs font-medium text-[var(--text2)]">{rec.check_in}</td>
                        <td className="py-4 px-4 font-mono text-xs font-medium text-[var(--text2)]">{rec.check_out}</td>
                        <td className="py-4 px-4">
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            rec.status === 'Present'
                              ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                              : rec.status === 'Late'
                              ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                              : 'bg-red-500/10 text-red-600 border border-red-500/20'
                          }`}>
                            {rec.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-xs text-[var(--text3)]">
                        No attendance records found for the selected criteria.
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

