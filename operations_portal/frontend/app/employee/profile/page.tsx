'use client';

import React from 'react';
import { ProfileManagement } from '@/components/ProfileManagement';

export default function EmployeeProfilePage() {
  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--card-border)] pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[var(--text-primary)] tracking-tight">
            My Employee Profile & Security
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Update your personal profile information, contact number, skills, and portal password.
          </p>
        </div>
      </div>

      <ProfileManagement />
    </div>
  );
}
