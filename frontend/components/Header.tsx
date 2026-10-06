'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Sun, 
  Moon, 
  Menu, 
  Bell, 
  Clock, 
  AlertTriangle, 
  Calendar, 
  FileText, 
  CheckCircle2, 
  RefreshCw, 
  X,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { api } from '@/lib/api';
import Link from 'next/link';

interface TenureNotification {
  id: number;
  emp_id: string;
  name: string;
  email: string;
  gender: string;
  department: string;
  designation: string;
  emp_type: string;
  joining_date: string | null;
  end_date: string | null;
  days_left: number;
  status_label: string;
  urgency: 'critical' | 'warning' | 'info';
  category: 'today' | 'soon' | 'ended';
  status: string;
}

export default function Header({ 
  title = 'Dashboard',
  subtitle,
  onMenuClick,
  setMobileOpen,
}: { 
  title?: string;
  subtitle?: string;
  onMenuClick?: () => void;
  setMobileOpen?: React.Dispatch<React.SetStateAction<boolean>> | ((open: boolean) => void);
}) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  
  // Notification states
  const [notifications, setNotifications] = useState<TenureNotification[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [urgentCount, setUrgentCount] = useState<number>(0);
  const [endingSoonCount, setEndingSoonCount] = useState<number>(0);
  const [endedCount, setEndedCount] = useState<number>(0);
  const [isNotifOpen, setIsNotifOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'all' | 'soon' | 'ended'>('all');
  const [loadingNotifs, setLoadingNotifs] = useState<boolean>(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const currentTheme = (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 
      (localStorage.getItem('theme') as 'light' | 'dark') || 
      'light';
    setTheme(currentTheme);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  const handleMenu = () => {
    if (setMobileOpen) {
      setMobileOpen(true);
    } else if (onMenuClick) {
      onMenuClick();
    } else {
      window.dispatchEvent(new Event('toggle-sidebar'));
    }
  };

  // Fetch tenure notifications
  const fetchNotifications = async () => {
    try {
      setLoadingNotifs(true);
      const res = await api.get('/api/notifications/tenure');
      if (res.data && res.data.success) {
        setNotifications(res.data.notifications || []);
        setTotalCount(res.data.count || 0);
        setUrgentCount(res.data.urgent_count || 0);
        setEndingSoonCount((res.data.ending_today_count || 0) + (res.data.ending_soon_count || 0));
        setEndedCount(res.data.ended_count || 0);
      }
    } catch (err) {
      console.warn('Failed to load tenure notifications:', err);
    } finally {
      setLoadingNotifs(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Poll every 2 minutes for updates
    const interval = setInterval(fetchNotifications, 120000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    if (isNotifOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isNotifOpen]);

  const filteredNotifs = notifications.filter((n) => {
    if (activeTab === 'soon') return n.category === 'soon' || n.category === 'today';
    if (activeTab === 'ended') return n.category === 'ended';
    return true;
  });

  const formatDateDisplay = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <header className="h-16 border-b border-[var(--border)] bg-[var(--header-bg)] backdrop-blur-md px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 transition-colors duration-200">
      <div className="flex items-center space-x-3">
        <button
          type="button"
          onClick={handleMenu}
          className="lg:hidden p-2 rounded-xl border border-[var(--border)] bg-[var(--bg2)] text-[var(--text2)] hover:bg-[var(--hover)] transition flex items-center justify-center cursor-pointer"
          title="Toggle Navigation Menu"
        >
          <Menu className="w-5 h-5 text-[var(--accent)]" />
        </button>
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-[var(--text)] tracking-tight font-['Plus_Jakarta_Sans']">{title}</h1>
          {subtitle && <p className="text-xs text-[var(--text2)] -mt-0.5">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center space-x-2.5 sm:space-x-3 relative" ref={dropdownRef}>
        {/* Tenure Notification Bell */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className={`relative p-2.5 rounded-xl border transition flex items-center justify-center cursor-pointer ${
              isNotifOpen 
                ? 'bg-[var(--hover)] border-[var(--accent)] text-[var(--accent)]' 
                : 'border-[var(--border)] bg-[var(--bg2)] text-[var(--text2)] hover:bg-[var(--hover)] hover:text-[var(--text)]'
            }`}
            title="Internship & Tenure Expiry Alerts"
          >
            <Bell className={`w-4 h-4 ${urgentCount > 0 ? 'text-amber-500 animate-wiggle' : ''}`} />
            {totalCount > 0 && (
              <span className={`absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full text-white ${
                urgentCount > 0 
                  ? 'bg-rose-500 animate-pulse ring-2 ring-rose-500/30' 
                  : 'bg-emerald-500'
              }`}>
                {totalCount > 99 ? '99+' : totalCount}
              </span>
            )}
          </button>

          {/* Notification Popover Dropdown */}
          {isNotifOpen && (
            <div className="absolute right-0 mt-2 w-[340px] sm:w-[410px] bg-[var(--bg2)] border border-[var(--border)] rounded-2xl shadow-2xl z-50 overflow-hidden text-[var(--text)] animate-in fade-in slide-in-from-top-2 duration-200">
              {/* Dropdown Header */}
              <div className="p-3.5 sm:p-4 border-b border-[var(--border)] bg-[var(--bg3)] flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)]">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[var(--text)] leading-tight">Tenure & Internship Alerts</h3>
                    <p className="text-[11px] text-[var(--text2)]">Completion dates & certificate generation</p>
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  <button 
                    onClick={fetchNotifications}
                    className="p-1.5 rounded-lg text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--hover)] transition"
                    title="Refresh Alerts"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingNotifs ? 'animate-spin text-[var(--accent)]' : ''}`} />
                  </button>
                  <button 
                    onClick={() => setIsNotifOpen(false)}
                    className="p-1.5 rounded-lg text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--hover)] transition"
                    title="Close"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex border-b border-[var(--border)] px-3 pt-2 bg-[var(--bg2)] gap-1">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg transition border-b-2 ${
                    activeTab === 'all'
                      ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--hover)]/40'
                      : 'border-transparent text-[var(--text2)] hover:text-[var(--text)]'
                  }`}
                >
                  All ({totalCount})
                </button>
                <button
                  onClick={() => setActiveTab('soon')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg transition border-b-2 ${
                    activeTab === 'soon'
                      ? 'border-amber-500 text-amber-500 bg-amber-500/10'
                      : 'border-transparent text-[var(--text2)] hover:text-[var(--text)]'
                  }`}
                >
                  Ending Soon ({endingSoonCount})
                </button>
                <button
                  onClick={() => setActiveTab('ended')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg transition border-b-2 ${
                    activeTab === 'ended'
                      ? 'border-rose-500 text-rose-500 bg-rose-500/10'
                      : 'border-transparent text-[var(--text2)] hover:text-[var(--text)]'
                  }`}
                >
                  Ended ({endedCount})
                </button>
              </div>

              {/* Notifications List */}
              <div className="max-h-[360px] overflow-y-auto divide-y divide-[var(--border)]">
                {filteredNotifs.length === 0 ? (
                  <div className="p-8 text-center">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500/70 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-[var(--text)]">No Tenure Alerts</p>
                    <p className="text-xs text-[var(--text2)] mt-1">All intern and employee tenures are on schedule.</p>
                  </div>
                ) : (
                  filteredNotifs.map((n) => {
                    const isToday = n.category === 'today';
                    const isCritical = n.urgency === 'critical';
                    const isEnded = n.category === 'ended';

                    return (
                      <div 
                        key={n.id} 
                        className={`p-3.5 sm:p-4 hover:bg-[var(--hover)]/60 transition flex flex-col gap-2.5 ${
                          isToday ? 'bg-rose-500/5' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center space-x-2.5">
                            <div className="w-8 h-8 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] font-bold text-xs flex items-center justify-center flex-shrink-0">
                              {n.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-xs sm:text-sm text-[var(--text)] leading-tight">{n.name}</span>
                                <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                                  n.emp_type === 'Intern' 
                                    ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/20' 
                                    : 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                                }`}>
                                  {n.emp_type}
                                </span>
                              </div>
                              <p className="text-[11px] text-[var(--text2)] leading-snug mt-0.5">
                                {n.designation} &bull; {n.department}
                              </p>
                            </div>
                          </div>

                          {/* Status Badge */}
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full flex-shrink-0 flex items-center gap-1 ${
                            isToday 
                              ? 'bg-rose-500 text-white animate-pulse' 
                              : isCritical 
                                ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30' 
                                : isEnded 
                                  ? 'bg-slate-500/15 text-slate-500 dark:text-slate-400 border border-slate-500/20' 
                                  : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                          }`}>
                            <Clock className="w-2.5 h-2.5" />
                            {n.status_label}
                          </span>
                        </div>

                        {/* Tenure Date Range & Action Buttons */}
                        <div className="flex items-center justify-between text-[11px] text-[var(--text3)] pt-1 border-t border-[var(--border)]/50">
                          <div className="flex items-center gap-1 text-[var(--text2)]">
                            <Calendar className="w-3 h-3 text-[var(--accent)]" />
                            <span>Ends: <strong>{formatDateDisplay(n.end_date)}</strong></span>
                          </div>

                          <Link
                            href={`/employees?openExp=${n.id}`}
                            onClick={() => setIsNotifOpen(false)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-[var(--accent)] bg-[var(--accent)]/10 hover:bg-[var(--accent)] hover:text-white rounded-lg transition"
                          >
                            <FileText className="w-3 h-3" />
                            <span>Experience Letter</span>
                            <ChevronRight className="w-3 h-3" />
                          </Link>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Dropdown Footer */}
              <div className="p-2.5 bg-[var(--bg3)] border-t border-[var(--border)] text-center">
                <Link
                  href="/employees"
                  onClick={() => setIsNotifOpen(false)}
                  className="text-xs font-semibold text-[var(--accent)] hover:underline inline-flex items-center gap-1"
                >
                  <span>View All in Employees Directory</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Theme Toggle Button */}
        <button
          type="button"
          onClick={toggleTheme}
          className="p-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg2)] text-[var(--text2)] hover:bg-[var(--hover)] transition flex items-center justify-center cursor-pointer"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-[var(--text2)]" />
          )}
        </button>
      </div>
    </header>
  );
}

