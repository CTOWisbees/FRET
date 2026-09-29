'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { Navbar } from '@/components/Navbar';
import { api } from '@/lib/api';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Initial theme check
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
        if (u.role !== 'admin') {
          router.push('/employee/dashboard');
          return;
        }
        setUser(u);
      } catch (e) {}
    }

    const checkAuth = async () => {
      try {
        const res = await api.get('/auth/me');
        if (res.data?.authenticated && res.data.user) {
          if (res.data.user.role !== 'admin') {
            router.push('/employee/dashboard');
            return;
          }
          setUser(res.data.user);
          localStorage.setItem('ops_user', JSON.stringify(res.data.user));
        } else {
          router.push('/login');
        }
      } catch (err) {
        if (!savedUser) router.push('/login');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  if (loading && !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-main)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Verifying Admin Access...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[var(--bg-main)] text-[var(--text-primary)] transition-colors">
      <Sidebar user={user} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      <div className="flex-1 flex flex-col min-w-0">
        <Navbar
          title="Operations Command Hub"
          subtitle="Enterprise Task Assignment & Role Scope Matrix"
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
