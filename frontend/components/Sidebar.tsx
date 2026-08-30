'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  BarChart3, Users, UserPlus, CalendarCheck, CalendarMinus, 
  Megaphone, Settings, User, LogOut, Briefcase, X
} from 'lucide-react';
import { api } from '@/lib/api';

export default function Sidebar({ 
  user, 
  mobileOpen, 
  setMobileOpen 
}: { 
  user?: any; 
  mobileOpen?: boolean; 
  setMobileOpen?: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [internalOpen, setInternalOpen] = React.useState(false);

  const isHr = user?.role === 'hr' || (!user?.emp_type && user?.role !== 'employee');
  const isCurrentlyOpen = mobileOpen !== undefined ? mobileOpen : internalOpen;

  React.useEffect(() => {
    const handleToggle = () => {
      if (setMobileOpen) {
        setMobileOpen(true);
      }
      setInternalOpen((prev) => !prev);
    };
    window.addEventListener('toggle-sidebar', handleToggle);
    return () => window.removeEventListener('toggle-sidebar', handleToggle);
  }, [setMobileOpen]);

  const handleLogout = async () => {
    try {
      if (isHr) {
        await api.get('/logout');
      } else {
        await api.get('/employee-logout');
      }
    } catch (e) {
      console.error(e);
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem('fret_token');
      localStorage.removeItem('fret_user');
    }
    window.location.replace('/login');
  };

  const closeMobile = () => {
    if (setMobileOpen) setMobileOpen(false);
    setInternalOpen(false);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isCurrentlyOpen && (
        <div 
          onClick={closeMobile}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
        />
      )}

      <aside className={`
        fixed top-0 bottom-0 left-0 z-50 w-[260px] bg-[var(--sidebar)] border-r border-[var(--border)] flex flex-col justify-between h-screen transition-transform duration-300
        lg:translate-x-0 lg:sticky lg:z-40
        ${isCurrentlyOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div>
          {/* Sidebar Header with Logo & Close Button for Mobile */}
          <div className="p-6 border-b border-[var(--border)] flex items-center justify-between">
            <img 
              src="/logo.png" 
              alt="WisBees Logo" 
              className="w-[180px] h-auto object-contain sidebar-company-logo" 
            />
            {setMobileOpen && (
              <button 
                onClick={closeMobile}
                className="lg:hidden p-1 text-[var(--text3)] hover:text-[var(--text)] rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Navigation Sections */}
          <nav className="p-3 space-y-4 overflow-y-auto max-h-[calc(100vh-180px)] text-[0.85rem]">
            {isHr ? (
              <>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text3)] mb-1.5 px-3">Overview</div>
                  <Link
                    href="/dashboard"
                    onClick={closeMobile}
                    className={`flex items-center space-x-3 px-3 py-2 rounded-xl font-medium transition ${
                      pathname === '/dashboard'
                        ? 'bg-[var(--accent)] text-white font-semibold shadow-sm'
                        : 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--text)]'
                    }`}
                  >
                    <BarChart3 className="w-4 h-4" />
                    <span>Dashboard</span>
                  </Link>
                </div>

                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text3)] mb-1.5 px-3">People</div>
                  <div className="space-y-0.5">
                    <Link
                      href="/employees"
                      onClick={closeMobile}
                      className={`flex items-center space-x-3 px-3 py-2 rounded-xl font-medium transition ${
                        pathname === '/employees'
                          ? 'bg-[var(--accent)] text-white font-semibold shadow-sm'
                          : 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--text)]'
                      }`}
                    >
                      <Users className="w-4 h-4" />
                      <span>Employees</span>
                    </Link>

                    <Link
                      href="/employees/add"
                      onClick={closeMobile}
                      className={`flex items-center space-x-3 px-3 py-2 rounded-xl font-medium transition ${
                        pathname === '/employees/add'
                          ? 'bg-[var(--accent)] text-white font-semibold shadow-sm'
                          : 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--text)]'
                      }`}
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Add Employee</span>
                    </Link>

                    <Link
                      href="/attendance-management"
                      onClick={closeMobile}
                      className={`flex items-center space-x-3 px-3 py-2 rounded-xl font-medium transition ${
                        pathname === '/attendance-management'
                          ? 'bg-[var(--accent)] text-white font-semibold shadow-sm'
                          : 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--text)]'
                      }`}
                    >
                      <CalendarCheck className="w-4 h-4" />
                      <span>Attendance</span>
                    </Link>

                    <Link
                      href="/leave-management"
                      onClick={closeMobile}
                      className={`flex items-center space-x-3 px-3 py-2 rounded-xl font-medium transition ${
                        pathname === '/leave-management'
                          ? 'bg-[var(--accent)] text-white font-semibold shadow-sm'
                          : 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--text)]'
                      }`}
                    >
                      <CalendarMinus className="w-4 h-4" />
                      <span>Leave Management</span>
                    </Link>
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text3)] mb-1.5 px-3">Communication</div>
                  <Link
                    href="/announcements"
                    onClick={closeMobile}
                    className={`flex items-center space-x-3 px-3 py-2 rounded-xl font-medium transition ${
                      pathname === '/announcements'
                        ? 'bg-[var(--accent)] text-white font-semibold shadow-sm'
                        : 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--text)]'
                    }`}
                  >
                    <Megaphone className="w-4 h-4" />
                    <span>Announcements</span>
                  </Link>
                </div>

                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text3)] mb-1.5 px-3">System</div>
                  <div className="space-y-0.5">
                    <Link
                      href="/settings"
                      onClick={closeMobile}
                      className={`flex items-center space-x-3 px-3 py-2 rounded-xl font-medium transition ${
                        pathname === '/settings'
                          ? 'bg-[var(--accent)] text-white font-semibold shadow-sm'
                          : 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--text)]'
                      }`}
                    >
                      <Settings className="w-4 h-4" />
                      <span>Settings</span>
                    </Link>

                    <Link
                      href="/profile"
                      onClick={closeMobile}
                      className={`flex items-center space-x-3 px-3 py-2 rounded-xl font-medium transition ${
                        pathname === '/profile'
                          ? 'bg-[var(--accent)] text-white font-semibold shadow-sm'
                          : 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--text)]'
                      }`}
                    >
                      <User className="w-4 h-4" />
                      <span>My Profile</span>
                    </Link>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text3)] mb-1.5 px-3">Overview</div>
                  <Link
                    href="/employee-dashboard"
                    onClick={closeMobile}
                    className={`flex items-center space-x-3 px-3 py-2 rounded-xl font-medium transition ${
                      pathname === '/employee-dashboard'
                        ? 'bg-[var(--accent)] text-white font-semibold shadow-sm'
                        : 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--text)]'
                    }`}
                  >
                    <BarChart3 className="w-4 h-4" />
                    <span>Dashboard</span>
                  </Link>
                </div>

                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text3)] mb-1.5 px-3">My Work</div>
                  <div className="space-y-0.5">
                    <Link
                      href="/attendance"
                      onClick={closeMobile}
                      className={`flex items-center space-x-3 px-3 py-2 rounded-xl font-medium transition ${
                        pathname === '/attendance'
                          ? 'bg-[var(--accent)] text-white font-semibold shadow-sm'
                          : 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--text)]'
                      }`}
                    >
                      <CalendarCheck className="w-4 h-4" />
                      <span>Attendance</span>
                    </Link>

                    <Link
                      href="/work"
                      onClick={closeMobile}
                      className={`flex items-center space-x-3 px-3 py-2 rounded-xl font-medium transition ${
                        pathname === '/work'
                          ? 'bg-[var(--accent)] text-white font-semibold shadow-sm'
                          : 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--text)]'
                      }`}
                    >
                      <Briefcase className="w-4 h-4" />
                      <span>Work</span>
                    </Link>

                    <Link
                      href="/apply-leave"
                      onClick={closeMobile}
                      className={`flex items-center space-x-3 px-3 py-2 rounded-xl font-medium transition ${
                        pathname === '/apply-leave'
                          ? 'bg-[var(--accent)] text-white font-semibold shadow-sm'
                          : 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--text)]'
                      }`}
                    >
                      <CalendarMinus className="w-4 h-4" />
                      <span>Leave Requests</span>
                    </Link>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text3)] mb-1.5 px-3">Communication</div>
                  <Link
                    href="/announcements"
                    onClick={closeMobile}
                    className={`flex items-center space-x-3 px-3 py-2 rounded-xl font-medium transition ${
                      pathname === '/announcements'
                        ? 'bg-[var(--accent)] text-white font-semibold shadow-sm'
                        : 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--text)]'
                    }`}
                  >
                    <Megaphone className="w-4 h-4" />
                    <span>Announcements</span>
                  </Link>
                </div>

                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text3)] mb-1.5 px-3">My Account</div>
                  <Link
                    href="/profile"
                    onClick={closeMobile}
                    className={`flex items-center space-x-3 px-3 py-2 rounded-xl font-medium transition ${
                      pathname === '/profile'
                        ? 'bg-[var(--accent)] text-white font-semibold shadow-sm'
                        : 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--text)]'
                    }`}
                  >
                    <User className="w-4 h-4" />
                    <span>Profile</span>
                  </Link>
                </div>
              </>
            )}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-[var(--border)] bg-[var(--surface2)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 overflow-hidden">
              <div className="w-9 h-9 rounded-full bg-[var(--accent)] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                {user?.name ? user.name[0].toUpperCase() : 'H'}
              </div>
              <div className="truncate">
                <p className="text-xs font-bold text-[var(--text)] truncate">{user?.name || (isHr ? 'HR Admin' : 'Employee')}</p>
                <p className="text-[11px] text-[var(--text3)] truncate">{user?.designation || (isHr ? 'HR Manager' : 'Team Member')}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Logout"
              className="p-2 text-[var(--text3)] hover:text-red-500 rounded-lg transition flex-shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
