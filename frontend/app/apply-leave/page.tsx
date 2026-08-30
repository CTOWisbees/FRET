'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Calendar, Send, CheckCircle2, AlertCircle, ArrowLeft, Clock } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function ApplyLeavePage() {
  const [employee, setEmployee] = useState<any>(null);
  const [leaveHistory, setLeaveHistory] = useState<any[]>([]);
  const [leaveType, setLeaveType] = useState('Casual Leave');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();

  const loadData = async () => {
    try {
      const res = await api.get('/apply-leave');
      if (res.data?.leave_history) {
        setLeaveHistory(res.data.leave_history);
      }
      const meRes = await api.get('/api/employee/me');
      if (meRes.data?.authenticated) {
        setEmployee(meRes.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setSubmitting(true);

    try {
      const res = await api.post('/apply-leave', {
        leave_type: leaveType,
        from_date: fromDate,
        to_date: toDate,
        reason: reason
      });

      if (res.data?.success) {
        setMessage({ type: 'success', text: 'Leave application submitted successfully!' });
        setReason('');
        setFromDate('');
        setToDate('');
        await loadData();
      } else {
        setMessage({ type: 'error', text: res.data?.message || 'Failed to submit leave request.' });
      }
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to submit leave request.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[var(--bg)] text-[var(--text)] font-sans">
      <Sidebar 
        user={{
          name: employee?.name || 'Employee',
          designation: employee?.designation || 'Staff',
          emp_type: employee?.emp_type || 'Normal'
        }}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header 
          title="Apply for Leave" 
          onMenuClick={() => setMobileOpen(prev => !prev)}
        />

        <main className="p-4 sm:p-8 flex-1 overflow-y-auto space-y-6 max-w-4xl mx-auto w-full">
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <Link href="/employee-dashboard" className="text-xs font-bold text-[var(--accent)] hover:underline flex items-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Dashboard</span>
              </Link>
            </div>
            <h1 className="text-2xl font-extrabold text-[var(--text)] tracking-tight font-['Plus_Jakarta_Sans']">
              Apply for Time-Off
            </h1>
            <p className="text-[var(--text3)] text-sm mt-0.5">Submit a leave request for HR review and approval</p>
          </div>

          {message && (
            <div className={`p-4 rounded-xl border flex items-center gap-3 text-sm font-medium ${
              message.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
            }`}>
              {message.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 sm:p-7 shadow-sm space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text3)] mb-2">
                Leave Type *
              </label>
              <select
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value)}
                className="w-full px-4 py-3 bg-[var(--input-bg)] border border-[var(--border)] rounded-xl text-sm font-medium text-[var(--text)] focus:outline-none focus:border-[var(--primary)] transition"
              >
                <option value="Casual Leave">Casual Leave (General Time-off)</option>
                <option value="Medical Leave">Medical / Sick Leave</option>
                <option value="Unpaid Leave">Unpaid Leave</option>
                <option value="Privilege Leave">Privilege Leave</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text3)] mb-2">
                  From Date *
                </label>
                <input
                  type="date"
                  required
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full px-4 py-3 bg-[var(--input-bg)] border border-[var(--border)] rounded-xl text-sm font-medium text-[var(--text)] focus:outline-none focus:border-[var(--primary)] transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text3)] mb-2">
                  To Date *
                </label>
                <input
                  type="date"
                  required
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full px-4 py-3 bg-[var(--input-bg)] border border-[var(--border)] rounded-xl text-sm font-medium text-[var(--text)] focus:outline-none focus:border-[var(--primary)] transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text3)] mb-2">
                Reason for Leave *
              </label>
              <textarea
                required
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Please describe the reason for your time-off request..."
                className="w-full px-4 py-3 bg-[var(--input-bg)] border border-[var(--border)] rounded-xl text-sm font-medium text-[var(--text)] focus:outline-none focus:border-[var(--primary)] transition resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-3.5 bg-[var(--accent)] hover:bg-[var(--accent2)] text-white font-bold rounded-xl shadow-md transition flex items-center justify-center space-x-2 text-sm disabled:opacity-50 active:scale-[0.98]"
            >
              <Send className="w-4 h-4" />
              <span>{submitting ? 'Submitting...' : 'Submit Leave Request'}</span>
            </button>
          </form>

          {/* History */}
          {leaveHistory.length > 0 && (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="font-bold text-[var(--text)] text-base font-['Plus_Jakarta_Sans']">
                My Submitted Requests
              </h3>
              <div className="table-wrapper overflow-x-auto rounded-xl border border-[var(--border)]">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[var(--bg)] border-b border-[var(--border)]">
                    <tr>
                      <th className="py-3 px-4 text-xs font-bold uppercase text-[var(--text3)]">Type</th>
                      <th className="py-3 px-4 text-xs font-bold uppercase text-[var(--text3)]">From</th>
                      <th className="py-3 px-4 text-xs font-bold uppercase text-[var(--text3)]">To</th>
                      <th className="py-3 px-4 text-xs font-bold uppercase text-[var(--text3)]">Duration</th>
                      <th className="py-3 px-4 text-xs font-bold uppercase text-[var(--text3)]">Applied</th>
                      <th className="py-3 px-4 text-xs font-bold uppercase text-[var(--text3)] text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)] bg-[var(--surface)]">
                    {leaveHistory.map((lr: any) => (
                      <tr key={lr.id} className="hover:bg-[var(--hover)] transition">
                        <td className="py-3 px-4 font-bold text-[var(--text)]">{lr.leave_type}</td>
                        <td className="py-3 px-4 text-xs font-mono text-[var(--text2)]">{lr.from_date}</td>
                        <td className="py-3 px-4 text-xs font-mono text-[var(--text2)]">{lr.to_date}</td>
                        <td className="py-3 px-4 text-xs font-bold text-[var(--text)]">{lr.days} Days</td>
                        <td className="py-3 px-4 text-xs font-mono text-[var(--text3)]">{lr.applied_on}</td>
                        <td className="py-3 px-4 text-right">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                            lr.status === 'Approved'
                              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                              : lr.status === 'Pending'
                              ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                          }`}>
                            {lr.status}
                          </span>
                        </td>
                      </tr>
                    ))}
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
