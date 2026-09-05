'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  ShieldCheck,
  Briefcase,
  UserCheck,
  Clock,
  LogOut,
  X
} from 'lucide-react';

interface SidebarProps {
  user: any;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export function Sidebar({ user, mobileOpen, setMobileOpen }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isAdmin = user?.role === 'admin';

  const handleLogout = () => {
    localStorage.removeItem('ops_token');
    localStorage.removeItem('ops_user');
    router.push('/login');
  };

  const adminNav = [
    { name: 'Operations Overview', href: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Employee Directory', href: '/admin/employees', icon: Users },
    { name: 'Work & Task Manager', href: '/admin/tasks', icon: CheckSquare },
    { name: 'Role & Access Matrix', href: '/admin/roles', icon: ShieldCheck },
  ];

  const employeeNav = [
    { name: 'My Dashboard', href: '/employee/dashboard', icon: LayoutDashboard },
    { name: 'My Assigned Work', href: '/employee/my-work', icon: Briefcase },
    { name: 'My Role & Scope', href: '/employee/my-role', icon: UserCheck },
    { name: 'Daily Work Logs', href: '/employee/work-logs', icon: Clock },
  ];

  const navItems = isAdmin ? adminNav : employeeNav;

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen w-72 bg-[var(--card-bg)] border-r border-[var(--card-border)] z-50 flex flex-col justify-between transition-all duration-300 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-5 sm:p-6">
          {/* Header with WisBees Official Logo */}
          <div className="flex items-center justify-between pb-5 border-b border-[var(--card-border)]">
            <Link href={isAdmin ? '/admin/dashboard' : '/employee/dashboard'} className="flex items-center gap-3">
              {/* WisBees Logo Image */}
              <div className="p-1.5 rounded-xl bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 shadow-xs">
                <img
                  src="/logo.png"
                  alt="WisBees Logo"
                  className="h-8 w-auto object-contain dark:drop-shadow-[0_0_1px_rgba(255,255,255,0.9)]"
                />
              </div>
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-[var(--accent)] block">
                  Operations
                </span>
                <span className="text-[10px] font-bold text-[var(--text-muted)] block">
                  Management Portal
                </span>
              </div>
            </Link>

            <button
              onClick={() => setMobileOpen(false)}
              className="lg:hidden p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="mt-6 space-y-1.5">
            <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              {isAdmin ? 'Administration Console' : 'My Workspace'}
            </div>

            {navItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-3 rounded-2xl text-xs font-bold transition ${
                    active
                      ? 'bg-[var(--accent-light)] text-[var(--accent)] font-extrabold shadow-2xs'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${active ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Card & Logout */}
        <div className="p-4 border-t border-[var(--card-border)] bg-[var(--bg-main)]">
          <div className="flex items-center justify-between gap-3 p-2.5 rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] shadow-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                {user?.name ? user.name[0].toUpperCase() : 'U'}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-[var(--text-primary)] truncate">
                  {user?.name || 'User'}
                </div>
                <div className="text-[10px] font-medium text-[var(--text-muted)] truncate">
                  {user?.designation || (isAdmin ? 'Operations Admin' : 'Team Member')}
                </div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-2 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
