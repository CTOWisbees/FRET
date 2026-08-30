'use client';

import React, { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Filter, Download, Database, CheckCircle2, Clock, Search } from 'lucide-react';

export default function AttendanceManagementPage() {
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [search, setSearch] = useState('');

  const attendanceRecords = [
    {
      date: '18-Aug-2026',
      emp_id: 'INT0024',
      name: 'Hitesh Shinde',
      check_in: '11:56 AM',
      check_out: '04:19 PM',
      status: 'Present',
    },
    {
      date: '16-Jul-2026',
      emp_id: 'INT0016',
      name: 'Surya Prakash Das',
      check_in: '04:42 PM',
      check_out: '--',
      status: 'Present',
    },
  ];

  const handleExport = () => {
    window.location.href = `http://localhost:5000/attendance/export?from=${fromDate}&to=${toDate}`;
  };

  const filtered = attendanceRecords.filter((rec) => {
    return !search || 
      rec.name.toLowerCase().includes(search.toLowerCase()) || 
      rec.emp_id.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="flex min-h-screen bg-[var(--bg)] text-[var(--text)] font-sans">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <Header title="Attendance Management" />

        <main className="p-8 flex-1 overflow-y-auto space-y-6">
          {/* Top Filter Form Card */}
          <div className="stat-card p-6 space-y-4 rounded-xl border border-[var(--border)]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text3)] mb-1">Employee</label>
                <select
                  value={employeeFilter}
                  onChange={(e) => setEmployeeFilter(e.target.value)}
                  className="form-control text-sm"
                >
                  <option value="">All Employees</option>
                  <option value="Hitesh Shinde">Hitesh Shinde</option>
                  <option value="Surya Prakash Das">Surya Prakash Das</option>
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
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text3)] mb-1">To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="form-control text-sm max-w-md"
              />
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                className="px-5 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent2)] text-white font-bold rounded-xl shadow-md transition flex items-center space-x-2 text-sm"
              >
                <Filter className="w-4 h-4" />
                <span>Filter</span>
              </button>
              <button
                type="button"
                onClick={handleExport}
                className="px-5 py-2.5 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 hover:bg-emerald-500/20 font-bold rounded-xl transition flex items-center space-x-2 text-sm"
              >
                <Download className="w-4 h-4" />
                <span>Export Excel</span>
              </button>
            </div>
          </div>

          {/* 3 Stat Cards Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="stat-card p-6 flex items-center justify-between">
              <div>
                <div className="stat-label">TOTAL RECORDS</div>
                <div className="stat-value text-[var(--text)]">2</div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <Database className="w-6 h-6" />
              </div>
            </div>

            <div className="stat-card p-6 flex items-center justify-between">
              <div>
                <div className="stat-label">PRESENT TODAY</div>
                <div className="stat-value text-[var(--text)]">2</div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>

            <div className="stat-card p-6 flex items-center justify-between">
              <div>
                <div className="stat-label">LATE ENTRIES</div>
                <div className="stat-value text-[var(--text)]">0</div>
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
                <p className="text-xs text-[var(--text3)]">Daily employee attendance tracking</p>
              </div>

              <div className="relative w-full md:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text3)]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search employee..."
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
                    <th className="py-3.5 px-4">CHECK IN</th>
                    <th className="py-3.5 px-4">CHECK OUT</th>
                    <th className="py-3.5 px-4">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] text-sm">
                  {filtered.map((rec, i) => (
                    <tr key={i} className="hover:bg-[var(--hover)] transition">
                      <td className="py-4 px-4 text-xs font-medium text-[var(--text)]">{rec.date}</td>
                      <td className="py-4 px-4 font-mono text-xs font-bold text-[var(--text2)]">{rec.emp_id}</td>
                      <td className="py-4 px-4 font-semibold text-xs text-[var(--text)]">{rec.name}</td>
                      <td className="py-4 px-4 font-mono text-xs font-medium text-[var(--text2)]">{rec.check_in}</td>
                      <td className="py-4 px-4 font-mono text-xs font-medium text-[var(--text2)]">{rec.check_out}</td>
                      <td className="py-4 px-4">
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                          {rec.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
