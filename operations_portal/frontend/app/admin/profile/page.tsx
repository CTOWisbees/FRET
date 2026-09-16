'use client';

import React from 'react';
import { ProfileManagement } from '@/components/ProfileManagement';

export default function AdminProfilePage() {
  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--card-border)] pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[var(--text-primary)] tracking-tight">
            Administrator Account & Profile
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Manage your admin email credentials, system password, and operational details.
          </p>
        </div>
      </div>

      <ProfileManagement />
    </div>
  );
}
