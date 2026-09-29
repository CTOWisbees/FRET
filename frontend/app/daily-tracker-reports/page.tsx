'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { 
  BarChart3, FileSpreadsheet, Download, Calendar, 
  Building2, User, Star, Clock, CheckCircle2, 
  Filter, Printer, Shield, ArrowLeft, History
} from 'lucide-react';
import Link from 'next/link';
import { api, getApiUrl } from '@/lib/api';

export default function DailyTrackerReportsPage() {
  const [user, setUser] = useState<any>(null);
  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [employeeId, setEmployeeId] = useState<string>('');
  const [department, setDepartment] = useState<string>('');
  
  const [activeTab, setActiveTab] = useState<'detailed' | 'audit'>('detailed');
  const [records, setRecords] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  
  const [totalHours, setTotalHours] = useState(0);
  const [totalTasks, setTotalTasks] = useState(0);
  const [totalAchievements, setTotalAchievements] = useState(0);
  const [majorTasksCount, setMajorTasksCount] = useState(0);
  const [minorTasksCount, setMinorTasksCount] = useState(0);

  const [loading, setLoading] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const stored = localStorage.getItem('fret_user');
      if (stored) setUser(JSON.parse(stored));

      const res = await api.get(`/api/daily-tracker/export?from_date=${fromDate}&to_date=${toDate}&employee_id=${employeeId}&department=${department}&format=json`);
      if (res.data) {
        setRecords(res.data.records || []);
        setTotalHours(res.data.total_hours || 0);
        setTotalTasks(res.data.total_tasks || 0);
        setTotalAchievements(res.data.total_achievements || 0);
        setMajorTasksCount(res.data.major_tasks_count || 0);
        setMinorTasksCount(res.data.minor_tasks_count || 0);
      }

      // Fetch employees list
      const empRes = await api.get('/api/employees-list');
      if (empRes.data) {
        setEmployees(empRes.data.employees || []);
        const depts = Array.from(new Set((empRes.data.employees || []).map((e: any) => e.department).filter(Boolean))) as string[];
        setDepartments(depts);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await api.get('/api/daily-tracker/audit-log');
      if (res.data?.logs) {
        setAuditLogs(res.data.logs);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [fromDate, toDate, employeeId, department]);

  useEffect(() => {
    if (activeTab === 'audit') {
      fetchAuditLogs();
    }
  }, [activeTab]);

  return (
    <div className="flex min-h-screen bg-[var(--bg)] text-[var(--text)] font-sans">
      <Sidebar 
        user={user}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header 
          title="Daily Tracker — Reports & Analytics" 
          onMenuClick={() => setMobileOpen(prev => !prev)}
        />

        <main className="p-4 sm:p-8 flex-1 overflow-y-auto space-y-6 max-w-7xl mx-auto w-full">
          
          {/* FILTER & EXPORT BAR */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center space-x-1.5 bg-[var(--bg3)] border border-[var(--border)] px-2.5 py-1.5 rounded-lg">
                <span className="text-[10px] font-bold text-[var(--text3)] uppercase">From</span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-[var(--text)] outline-none cursor-pointer"
                />
              </div>

              <div className="flex items-center space-x-1.5 bg-[var(--bg3)] border border-[var(--border)] px-2.5 py-1.5 rounded-lg">
                <span className="text-[10px] font-bold text-[var(--text3)] uppercase">To</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-[var(--text)] outline-none cursor-pointer"
                />
              </div>

              <select
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="bg-[var(--bg3)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text)] outline-none cursor-pointer"
              >
                <option value="">All Team Members</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.name} ({emp.emp_id || 'EMP' + emp.id})</option>
                ))}
              </select>

              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="bg-[var(--bg3)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text)] outline-none cursor-pointer"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <a
                href={getApiUrl(`/api/daily-tracker/export?from_date=${fromDate}&to_date=${toDate}&employee_id=${employeeId}&department=${department}&format=xlsx`)}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--bg3)] hover:bg-[var(--bg)] text-[var(--text)] border border-[var(--border)] flex items-center gap-1.5 transition"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Export Excel</span>
              </a>

              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--bg3)] hover:bg-[var(--bg)] text-[var(--text)] border border-[var(--border)] flex items-center gap-1.5 transition"
              >
                <Printer className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span>Print PDF</span>
              </button>
            </div>
          </div>

          {/* KPI CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 flex items-center space-x-3.5 shadow-sm">
              <div className="w-11 h-11 rounded-xl bg-indigo-500/10 text-[var(--accent)] flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-extrabold text-[var(--text)] font-['Plus_Jakarta_Sans']">{Number(totalHours).toFixed(1)}h</div>
                <div className="text-[11px] font-semibold text-[var(--text3)] uppercase">Total Hours</div>
              </div>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 flex items-center space-x-3.5 shadow-sm">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-extrabold text-[var(--text)] font-['Plus_Jakarta_Sans']">{totalTasks}</div>
                <div className="text-[11px] font-semibold text-[var(--text3)] uppercase">Tasks Logged</div>
              </div>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 flex items-center space-x-3.5 shadow-sm">
              <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <Star className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-extrabold text-[var(--text)] font-['Plus_Jakarta_Sans']">{totalAchievements}</div>
                <div className="text-[11px] font-semibold text-[var(--text3)] uppercase">Achievements</div>
              </div>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 flex items-center space-x-3.5 shadow-sm">
              <div className="w-11 h-11 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-extrabold text-[var(--text)] font-['Plus_Jakarta_Sans']">{majorTasksCount} / {minorTasksCount}</div>
                <div className="text-[11px] font-semibold text-[var(--text3)] uppercase">Major vs Minor</div>
              </div>
            </div>
          </div>

          {/* TAB BUTTONS */}
          <div className="flex space-x-2 border-b border-[var(--border)] pb-2">
            <button
              type="button"
              onClick={() => setActiveTab('detailed')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-2 ${
                activeTab === 'detailed' 
                  ? 'bg-[var(--accent)] text-white shadow-sm' 
                  : 'bg-transparent text-[var(--text2)] hover:bg-[var(--surface)]'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Detailed Work Log Report</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('audit')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-2 ${
                activeTab === 'audit' 
                  ? 'bg-[var(--accent)] text-white shadow-sm' 
                  : 'bg-transparent text-[var(--text2)] hover:bg-[var(--surface)]'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>Audit Trail History</span>
            </button>
          </div>

          {/* TAB CONTENT: DETAILED */}
          {activeTab === 'detailed' && (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[var(--bg3)] text-[var(--text3)] uppercase tracking-wider text-[11px] font-bold border-b border-[var(--border)]">
                      <th className="p-3.5">Date</th>
                      <th className="p-3.5">Employee</th>
                      <th className="p-3.5">Department</th>
                      <th className="p-3.5">Day Status</th>
                      <th className="p-3.5">Task Description</th>
                      <th className="p-3.5">Type</th>
                      <th className="p-3.5 text-center">Hours</th>
                      <th className="p-3.5 text-center">Achievement</th>
                      <th className="p-3.5">Remarks</th>
                      <th className="p-3.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {records.length > 0 ? (
                      records.map((r, i) => (
                        <tr key={i} className="hover:bg-[var(--bg3)]/50 transition">
                          <td className="p-3 whitespace-nowrap font-medium text-[var(--text2)]">{r.Date}</td>
                          <td className="p-3">
                            <div className="font-bold text-[var(--text)]">{r['Employee Name']}</div>
                            <div className="text-[10px] text-[var(--text3)]">{r['Employee ID']}</div>
                          </td>
                          <td className="p-3 text-[var(--text2)]">{r.Department || '--'}</td>
                          <td className="p-3 font-medium text-[var(--text)]">{r['Day Status']}</td>
                          <td className="p-3 max-w-xs text-[var(--text)] font-medium">{r['Task Worked On']}</td>
                          <td className="p-3">
                            <span className="bg-indigo-500/10 text-[var(--accent)] px-2 py-0.5 rounded text-[10px] font-bold">
                              {r['Task Type']}
                            </span>
                          </td>
                          <td className="p-3 text-center font-bold text-[var(--accent)]">{r['Hours Worked']}h</td>
                          <td className="p-3 text-center">
                            {r.Achievement === '★ Yes' ? (
                              <span className="text-amber-500 font-bold">★ Yes</span>
                            ) : (
                              <span className="text-[var(--text3)]">No</span>
                            )}
                          </td>
                          <td className="p-3 text-[var(--text2)] max-w-xs">{r['Remarks / Blockers'] || '--'}</td>
                          <td className="p-3">
                            <span className="bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full text-[10px] font-bold">
                              {r['Tracker Status']}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={10} className="p-8 text-center text-[var(--text3)]">
                          No work activity records found for this period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB CONTENT: AUDIT LOG */}
          {activeTab === 'audit' && (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[var(--bg3)] text-[var(--text3)] uppercase tracking-wider text-[11px] font-bold border-b border-[var(--border)]">
                      <th className="p-3.5">Timestamp</th>
                      <th className="p-3.5">Tracker Date</th>
                      <th className="p-3.5">Action</th>
                      <th className="p-3.5">Performed By</th>
                      <th className="p-3.5">Role</th>
                      <th className="p-3.5">Details / Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {auditLogs.length > 0 ? (
                      auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-[var(--bg3)]/50 transition">
                          <td className="p-3 font-semibold text-[var(--text2)] whitespace-nowrap">{log.timestamp}</td>
                          <td className="p-3 whitespace-nowrap">{log.date}</td>
                          <td className="p-3">
                            <span className="bg-indigo-500/10 text-[var(--accent)] px-2 py-0.5 rounded text-[10px] font-bold">
                              {log.action}
                            </span>
                          </td>
                          <td className="p-3 font-bold text-[var(--text)]">{log.performed_by}</td>
                          <td className="p-3 text-[var(--text3)]">{log.role}</td>
                          <td className="p-3 text-[var(--text2)]">{log.details}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-[var(--text3)]">
                          No audit log records found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
