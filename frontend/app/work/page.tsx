'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Info } from 'lucide-react';
import { api } from '@/lib/api';

export default function WorkPage() {
  const [employee, setEmployee] = useState<any>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('fret_user');
      if (savedUser) setEmployee(JSON.parse(savedUser));
    } catch (e) {}

    const fetchEmployee = async () => {
      try {
        const res = await api.get('/api/employee/me');
        if (res.data?.authenticated) {
          setEmployee(res.data);
          localStorage.setItem('fret_user', JSON.stringify(res.data));
        } else {
          const dashRes = await api.get('/api/employee-dashboard');
          if (dashRes.data?.employee) {
            setEmployee(dashRes.data.employee);
            localStorage.setItem('fret_user', JSON.stringify(dashRes.data.employee));
          }
        }
      } catch (err) {
        console.error('Failed to load employee details:', err);
      }
    };
    fetchEmployee();
  }, []);

  return (
    <div className="flex min-h-screen bg-[var(--bg)] text-[var(--text)] font-sans antialiased">
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
          title="Employee Portal" 
          onMenuClick={() => setMobileOpen(prev => !prev)} 
        />

        <main className="p-4 sm:p-8 flex-1 overflow-y-auto space-y-6 max-w-7xl mx-auto w-full">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text)] tracking-tight font-['Plus_Jakarta_Sans']">
              Work Hub
            </h1>

            <div className="px-4 py-1.5 rounded-full bg-[#EEF2FF] text-[#4F46E5] border border-[#C7D2FE] text-xs font-bold w-fit shadow-2xs">
              Designation: {employee?.designation || 'IT Intern – Web & Automation Developer'}
            </div>
          </div>

          <hr className="border-t border-[var(--border)] my-4" />

          {/* Centered Coming Soon Fallback Card */}
          <div className="max-w-[580px] mx-auto mt-12 p-8 sm:p-12 bg-[var(--surface)] border border-dashed border-[var(--border)] rounded-2xl shadow-sm text-center">
            {/* Hourglass Icon */}
            <div className="flex justify-center mb-4">
              <span className="text-5xl select-none animate-pulse">⏳</span>
            </div>

            {/* Title */}
            <h3 className="text-xl sm:text-2xl font-extrabold text-[var(--text)] font-['Plus_Jakarta_Sans'] mb-2">
              Coming Soon!
            </h3>

            {/* Subtext */}
            <p className="text-xs sm:text-sm text-[var(--text3)] max-w-md mx-auto mb-6 leading-relaxed">
              Your department&apos;s workspace utility nodes are currently undergoing engineering configurations.
            </p>

            {/* Info Callout Badge with Clean Crisp Light-Mode Colors */}
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] text-[#1D4ED8] text-xs font-bold mx-auto shadow-2xs">
              <Info className="w-4 h-4 flex-shrink-0 text-[#2563EB]" />
              <span>Please coordinate with your authority for functional items.</span>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
