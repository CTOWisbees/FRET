'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('ops_token');
    const userRaw = localStorage.getItem('ops_user');

    if (token && userRaw) {
      try {
        const u = JSON.parse(userRaw);
        if (u.role === 'admin') {
          router.push('/admin/dashboard');
          return;
        } else {
          router.push('/employee/dashboard');
          return;
        }
      } catch (e) {}
    }
    router.push('/login');
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-sky-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Loading Operations Portal...</p>
      </div>
    </div>
  );
}
