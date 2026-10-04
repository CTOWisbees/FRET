'use client';

import React from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { ClipboardCheck, ExternalLink, ShieldCheck, Sparkles } from 'lucide-react';
import Link from 'next/link';

export default function DailyTrackerManagerRedirectPage() {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const opsPortalUrl = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3001/employee/tracker-review'
    : 'https://ops.wisbees.com/employee/tracker-review';

  return (
    <div className="flex h-screen bg-[var(--background)] text-[var(--text)] overflow-hidden">
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header 
          title="Daily Work Tracker Manager" 
          subtitle="Moved to Operations Portal" 
          setMobileOpen={setMobileOpen} 
        />

        <main className="flex-1 overflow-y-auto p-4 md:p-8 flex items-center justify-center">
          <div className="max-w-xl w-full bg-[var(--surface)] border border-[var(--border)] rounded-3xl p-8 shadow-xl text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 mx-auto flex items-center justify-center">
              <ClipboardCheck className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <span className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs font-black uppercase tracking-wider">
                Manager Workspace
              </span>
              <h2 className="text-2xl font-black text-[var(--text)]">
                Team Tracker Review is in Operations Portal
              </h2>
              <p className="text-sm text-[var(--text3)] leading-relaxed">
                Department Managers and Operations Leads can review team submissions, assign ratings, provide feedback, and resolve unlock requests in the <strong>Operations Portal</strong>.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Link
                href="/dashboard"
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-[var(--border)] text-xs font-bold text-[var(--text2)] hover:bg-[var(--surface2)] transition"
              >
                Back to HRMS Dashboard
              </Link>
              <a
                href={opsPortalUrl}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black transition flex items-center justify-center gap-2 shadow-lg shadow-purple-600/20 active:scale-95"
              >
                <span>Open in Operations Portal</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
