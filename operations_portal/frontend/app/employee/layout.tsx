'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { Navbar } from '@/components/Navbar';
import { api } from '@/lib/api';

export default function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);

    const savedTheme = localStorage.getItem('ops_theme');
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    }

    const token = localStorage.getItem('ops_token');
    const savedUser = localStorage.getItem('ops_user');

    if (!token) {
      router.push('/login');
      return;
    }

    if (savedUser) {
      try {
        const u = JSON.parse(savedUser);
        setUser(u);
      } catch (e) {}
    }

    const checkAuth = async () => {
      try {
        const res = await api.get('/auth/me');
        if (res.data?.authenticated && res.data.user) {
          setUser(res.data.user);
          localStorage.setItem('ops_user', JSON.stringify(res.data.user));
        } else {
          router.push('/login');
        }
      } catch (err) {
        if (!savedUser && !token) router.push('/login');
      }
    };

    checkAuth();

    // Listen for live user/avatar updates from ProfileManagement or other tabs
    const handleUserUpdate = (e: any) => {
      if (e?.detail) {
        setUser(e.detail);
      } else {
        const currentSaved = localStorage.getItem('ops_user');
        if (currentSaved) {
          try {
            setUser(JSON.parse(currentSaved));
          } catch (_) {}
        }
      }
    };

    window.addEventListener('ops_user_updated', handleUserUpdate);
    window.addEventListener('storage', handleUserUpdate);

    return () => {
      window.removeEventListener('ops_user_updated', handleUserUpdate);
      window.removeEventListener('storage', handleUserUpdate);
    };
  }, [router]);

  if (!mounted) {
    return (
      <div className="flex min-h-screen bg-[var(--bg-main)] text-[var(--text-primary)]">
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[var(--bg-main)] text-[var(--text-primary)] transition-colors">
      <Sidebar user={user} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      <div className="flex-1 flex flex-col min-w-0">
        <Navbar
          title="Employee Workspace"
          subtitle="My Assigned Operational Tasks & Role Scope"
          user={user}
          onMenuClick={() => setMobileOpen(true)}
        />

        <main className="flex-1 p-3 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
