'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Building2,
  CheckSquare,
  Briefcase,
  UserCheck,
  Clock,
  LogOut,
  ExternalLink,
  Shield,
  X,
  Megaphone,
  BarChart2,
  FileSpreadsheet,
  Code2,
  TrendingUp,
  FileText,
  FolderKanban
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

  // Collect all assigned departments, department accesses, and role titles for the employee
  const assignedDepts: string[] = Array.isArray(user?.assigned_departments)
    ? user.assigned_departments
    : [];

  const deptAccesses: string[] = Array.isArray(user?.department_accesses)
    ? user.department_accesses.filter((d: any) => d.is_active !== false).map((d: any) => d.name)
    : [];

  const assignedRoles: any[] = Array.isArray(user?.assigned_roles) && user.assigned_roles.length > 0
    ? user.assigned_roles
    : (user?.assigned_role ? [user.assigned_role] : []);

  const roleDepts: string[] = assignedRoles.map((r: any) => r.department || '').filter(Boolean);
  const roleTitles: string[] = assignedRoles.map((r: any) => r.title || '').filter(Boolean);
  const primaryDept = user?.department || '';
  const designation = user?.designation || '';

  // All relevant department / role tokens combined for robust detection
  const allDeptTokens = [
    primaryDept,
    ...assignedDepts,
    ...deptAccesses,
    ...roleDepts,
    ...roleTitles,
    designation,
  ];

  // Helper to test whole word boundary matches (avoids substring false positives like "it" in "digital" or "investment")
  const matchesKeyword = (text: string, kw: string) => {
    if (!text || !kw) return false;
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|[^a-zA-Z0-9])${escaped}([^a-zA-Z0-9]|$)`, 'i');
    return regex.test(text.trim());
  };

  const hasScope = (...keywords: string[]) =>
    allDeptTokens.some((token) => keywords.some((kw) => matchesKeyword(token, kw)));

  // Detect specific work domains with strict word-boundary matching
  const isDigitalMarketing = hasScope('digital marketing', 'digital', 'marketing', 'seo', 'campaign', 'bulk email');
  const isEquityResearch = hasScope('ia - research', 'ia', 'research', 'equity', 'equity research', 'investment', 'analyst');
  const isIT = hasScope('it', 'information technology', 'software', 'developer', 'web developer', 'system admin');
  const isWBC = hasScope('wbc', 'consulting', 'client advisory');
  const isWealth = hasScope('wealth', 'wealth management', 'portfolio management');
  const isPublishing = hasScope('content publishing', 'publishing', 'editorial');

  // Other custom assigned departments that don't match standard keywords
  const standardScopeCheck = (name: string) =>
    matchesKeyword(name, 'digital') ||
    matchesKeyword(name, 'marketing') ||
    matchesKeyword(name, 'ia') ||
    matchesKeyword(name, 'research') ||
    matchesKeyword(name, 'equity') ||
    matchesKeyword(name, 'investment') ||
    matchesKeyword(name, 'it') ||
    matchesKeyword(name, 'developer') ||
    matchesKeyword(name, 'wbc') ||
    matchesKeyword(name, 'consulting') ||
    matchesKeyword(name, 'wealth') ||
    matchesKeyword(name, 'publishing') ||
    name.toLowerCase() === 'operations';

  const otherDepts = Array.from(new Set([...assignedDepts, ...deptAccesses])).filter(
    (deptName) => !standardScopeCheck(deptName)
  );

  const handleLogout = () => {
    localStorage.removeItem('ops_token');
    localStorage.removeItem('ops_user');
    router.push('/login');
  };

  const adminNav = [
    { name: 'Operations Overview', href: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Department Directory', href: '/admin/departments', icon: Building2 },
    { name: 'OP User Directory', href: '/admin/employees', icon: Users },
    { name: 'Work & Task Manager', href: '/admin/tasks', icon: CheckSquare },
  ];

  const employeeNav = [
    { name: 'My Dashboard', href: '/employee/dashboard', icon: LayoutDashboard },
    { name: 'My Assigned Work', href: '/employee/my-work', icon: Briefcase },
    { name: 'My Role & Scope', href: '/employee/my-role', icon: UserCheck },
    { name: 'Daily Work Logs', href: '/employee/work-logs', icon: Clock },
  ];

  const navItems = isAdmin ? adminNav : employeeNav;

  const djangoAdminUrl = typeof window !== 'undefined' && window.location.hostname === '127.0.0.1'
    ? 'http://127.0.0.1:8001/admin/'
    : 'http://localhost:8001/admin/';

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
        <div className="p-5 sm:p-6 overflow-y-auto flex-1">
          {/* Header with WisBees Official Logo */}
          <div className="flex items-center justify-between pb-5 border-b border-[var(--card-border)]">
            <Link href={isAdmin ? '/admin/dashboard' : '/employee/dashboard'} className="flex items-center gap-3">
              <div className="p-1.5 rounded-xl bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 shadow-xs">
                <img
                  src="/logo.png"
                  alt="WisBees Logo"
                  className="h-8 w-auto object-contain dark:drop-shadow-[0_0_1px_rgba(255,255,255,0.9)]"
                />
              </div>
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-[var(--accent)] block">
                  OP Portal
                </span>
                <span className="text-[10px] font-bold text-[var(--text-muted)] block">
                  Access & Management
                </span>
              </div>
            </Link>

            <button
              onClick={() => setMobileOpen(false)}
              className="lg:hidden p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="mt-6 space-y-1.5">
            <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              {isAdmin ? 'OP Administration Console' : 'My Workspace'}
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

            {/* ─── DYNAMIC EMPLOYEE ROLE WORK SECTIONS ─── */}
            {!isAdmin && (
              <>
                {/* 1. Digital Marketing Work */}
                {isDigitalMarketing && (
                  <div className="pt-4 mt-4 border-t border-[var(--card-border)]">
                    <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                      Digital Marketing Work
                    </div>
                    {(() => {
                      const dmHref = '/employee/digital-marketing-work';
                      const active = pathname === dmHref || (pathname.startsWith(`${dmHref}/`) && !pathname.includes('equity'));
                      return (
                        <Link
                          href={dmHref}
                          onClick={() => setMobileOpen(false)}
                          className={`flex items-center gap-3 px-3.5 py-3 rounded-2xl text-xs font-bold transition ${
                            active
                              ? 'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 font-extrabold shadow-2xs'
                              : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          <Megaphone className={`w-4 h-4 ${active ? 'text-violet-600' : 'text-[var(--text-muted)]'}`} />
                          <span>Work Hub</span>
                        </Link>
                      );
                    })()}
                  </div>
                )}

                {/* 2. Equity Research / IA - Research Work */}
                {isEquityResearch && (
                  <div className="pt-4 mt-4 border-t border-[var(--card-border)]">
                    <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      Equity Research Work
                    </div>
                    <div className="space-y-1">
                      {(() => {
                        const erHref = '/employee/equity-research-work';
                        const active = pathname === erHref;
                        return (
                          <Link
                            href={erHref}
                            onClick={() => setMobileOpen(false)}
                            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition ${
                              active
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-extrabold shadow-2xs'
                                : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]'
                            }`}
                          >
                            <BarChart2 className={`w-4 h-4 ${active ? 'text-emerald-600' : 'text-[var(--text-muted)]'}`} />
                            <span>Research Hub</span>
                          </Link>
                        );
                      })()}

                      {(() => {
                        const repHref = '/employee/equity-research-work/report';
                        const active = pathname === repHref;
                        return (
                          <Link
                            href={repHref}
                            onClick={() => setMobileOpen(false)}
                            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition ${
                              active
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-extrabold shadow-2xs'
                                : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]'
                            }`}
                          >
                            <FileSpreadsheet className={`w-4 h-4 ${active ? 'text-emerald-600' : 'text-[var(--text-muted)]'}`} />
                            <span>Report Engine</span>
                          </Link>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* 3. IT & Systems Work */}
                {isIT && (
                  <div className="pt-4 mt-4 border-t border-[var(--card-border)]">
                    <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                      IT & Systems Work
                    </div>
                    <Link
                      href="/employee/my-work"
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 px-3.5 py-3 rounded-2xl text-xs font-bold transition ${
                        pathname === '/employee/my-work' && !isDigitalMarketing && !isEquityResearch
                          ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 font-extrabold shadow-2xs'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <Code2 className="w-4 h-4 text-sky-500" />
                      <span>Task & Sprint Hub</span>
                    </Link>
                  </div>
                )}

                {/* 4. WBC Consulting Work */}
                {isWBC && (
                  <div className="pt-4 mt-4 border-t border-[var(--card-border)]">
                    <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                      WBC Consulting Work
                    </div>
                    <Link
                      href="/employee/my-work"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-3 px-3.5 py-3 rounded-2xl text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)] transition"
                    >
                      <Briefcase className="w-4 h-4 text-amber-500" />
                      <span>Client Advisory Hub</span>
                    </Link>
                  </div>
                )}

                {/* 5. Wealth Management Work */}
                {isWealth && !isEquityResearch && (
                  <div className="pt-4 mt-4 border-t border-[var(--card-border)]">
                    <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                      Wealth Management Work
                    </div>
                    <Link
                      href="/employee/my-work"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-3 px-3.5 py-3 rounded-2xl text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)] transition"
                    >
                      <TrendingUp className="w-4 h-4 text-teal-500" />
                      <span>Portfolio & Wealth Hub</span>
                    </Link>
                  </div>
                )}

                {/* 6. Content Publishing Work */}
                {isPublishing && (
                  <div className="pt-4 mt-4 border-t border-[var(--card-border)]">
                    <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      Content Publishing Work
                    </div>
                    <Link
                      href="/employee/my-work"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-3 px-3.5 py-3 rounded-2xl text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)] transition"
                    >
                      <FileText className="w-4 h-4 text-indigo-500" />
                      <span>Publishing Hub</span>
                    </Link>
                  </div>
                )}

                {/* 7. Other Custom Assigned Departments */}
                {otherDepts.map((deptName) => (
                  <div key={deptName} className="pt-4 mt-4 border-t border-[var(--card-border)]">
                    <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      {deptName} Work
                    </div>
                    <Link
                      href="/employee/my-work"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-3 px-3.5 py-3 rounded-2xl text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)] transition"
                    >
                      <FolderKanban className="w-4 h-4 text-[var(--accent)]" />
                      <span>Work Hub</span>
                    </Link>
                  </div>
                ))}
              </>
            )}

            {/* Direct Superadmin Django Admin Link */}
            {isAdmin && (
              <div className="pt-4 mt-4 border-t border-[var(--card-border)]">
                <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Superadmin Tools
                </div>
                <a
                  href={djangoAdminUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-[var(--hover-bg)] border border-dashed border-[var(--card-border)] transition"
                >
                  <div className="flex items-center gap-2.5">
                    <Shield className="w-4 h-4 text-sky-500" />
                    <span>Django Administration</span>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                </a>
              </div>
            )}
          </nav>
        </div>

        {/* User Card & Logout */}
        <div className="p-4 border-t border-[var(--card-border)] bg-[var(--bg-main)] shrink-0">
          <div className="flex items-center justify-between gap-3 p-2.5 rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] shadow-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                {user?.name ? user.name[0].toUpperCase() : 'U'}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-[var(--text-primary)] truncate">
                  {user?.full_name || user?.name || 'User'}
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
