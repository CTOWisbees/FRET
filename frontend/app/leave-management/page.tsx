'use client';

import React, { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { CheckCircle, XCircle } from 'lucide-react';

export default function LeaveManagementPage() {
  const [leaveRequests, setLeaveRequests] = useState([
    {
      id: 1,
      employee: 'Hitesh Shinde',
      leave_type: 'Casual Leave',
      from_date: '2026-08-19',
      to_date: '2026-08-20',
      status: 'Rejected',
    },
    {
      id: 2,
      employee: 'Jeffery Nelson',
      leave_type: 'Casual Leave',
      from_date: '2026-08-14',
      to_date: '2026-08-17',
      status: 'Approved',
    },
  ]);

  return (
    <div className="flex min-h-screen bg-[var(--bg)] text-[var(--text)] font-sans">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <Header title="Leave Management" />

        <main className="p-8 flex-1 overflow-y-auto space-y-6">
          <div className="stat-card p-6 rounded-xl border border-[var(--border)] space-y-4">
            <h3 className="font-bold text-lg text-[var(--text)] font-['Plus_Jakarta_Sans'] border-b border-[var(--border)] pb-3">
              Leave Requests
            </h3>

            <div className="table-wrapper">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[var(--bg3)] border-b border-[var(--border)] text-[11px] font-bold uppercase tracking-wider text-[var(--text3)]">
                    <th className="py-3.5 px-4">EMPLOYEE</th>
                    <th className="py-3.5 px-4">LEAVE TYPE</th>
                    <th className="py-3.5 px-4">FROM</th>
                    <th className="py-3.5 px-4">TO</th>
                    <th className="py-3.5 px-4">STATUS</th>
                    <th className="py-3.5 px-4">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] text-sm">
                  {leaveRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-[var(--hover)] transition">
                      <td className="py-4 px-4 font-semibold text-xs text-[var(--text)]">{req.employee}</td>
                      <td className="py-4 px-4 text-xs text-[var(--text3)]">{req.leave_type}</td>
                      <td className="py-4 px-4 text-xs font-mono text-[var(--text2)]">{req.from_date}</td>
                      <td className="py-4 px-4 text-xs font-mono text-[var(--text2)]">{req.to_date}</td>
                      <td className="py-4 px-4 text-xs font-bold">
                        {req.status === 'Approved' ? (
                          <span className="text-emerald-600">Approved</span>
                        ) : req.status === 'Rejected' ? (
                          <span className="text-red-500">Rejected</span>
                        ) : (
                          <span className="text-amber-500">Pending</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-xs font-medium text-[var(--text3)]">
                        —
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
