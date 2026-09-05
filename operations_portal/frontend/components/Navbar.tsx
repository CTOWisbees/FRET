'use client';

import React from 'react';
import { Menu, Shield, User, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { AttendanceTimerWidget } from './AttendanceTimerWidget';

interface NavbarProps {
  title: string;
  subtitle?: string;
  user: any;
  onMenuClick: () => void;
}

export function Navbar({ title, subtitle, user, onMenuClick }: NavbarProps) {
  const isAdmin = user?.role === 'admin';
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 bg-[var(--header-bg)] backdrop-blur-md border-b border-[var(--card-border)] px-3 sm:px-6 py-2.5 sm:py-3.5 z-30 flex items-center justify-between transition-colors">
      
      {/* Left Area: Mobile Menu Drawer + Brand / Page Title */}
      <div className="flex items-center gap-2 sm:gap-3.5 min-w-0">
        <button
          onClick={onMenuClick}
          aria-label="Open Navigation Menu"
          className="lg:hidden p-1.5 sm:p-2 text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] rounded-xl transition cursor-pointer shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Mobile Mini Logo */}
        <div className="lg:hidden flex items-center shrink-0">
          <img
            src="/logo.png"
            alt="WisBees Logo"
            className="h-6 w-auto object-contain dark:drop-shadow-[0_0_1px_rgba(255,255,255,0.9)]"
          />
        </div>

        <div className="min-w-0">
          <h1 className="text-sm sm:text-base lg:text-lg font-black text-[var(--text-primary)] tracking-tight truncate max-w-[130px] xs:max-w-[180px] sm:max-w-none">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[10px] sm:text-[11px] font-medium text-[var(--text-secondary)] hidden md:block truncate">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Right Area: Shift Timer + Theme Toggle + Role + Profile */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* Live Attendance Shift Timer Widget */}
        {!isAdmin && (
          <AttendanceTimerWidget compact={true} />
        )}

        {/* Dark / Light Mode Toggle Button */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="p-1.5 sm:px-3 sm:py-2 rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-95"
        >
          {theme === 'dark' ? (
            <>
              <Sun className="w-4 h-4 text-amber-400 animate-fadeIn" />
              <span className="text-xs font-bold hidden lg:inline">Light</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-indigo-600 animate-fadeIn" />
              <span className="text-xs font-bold hidden lg:inline">Dark</span>
            </>
          )}
        </button>

        {/* Role Pill (Visible on Desktop / Tablet) */}
        <div className={`hidden md:flex px-2.5 py-1 rounded-full text-xs font-bold items-center gap-1.5 border shadow-2xs ${
          isAdmin
            ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
            : 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800'
        }`}>
          {isAdmin ? <Shield className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
          <span className="capitalize">{isAdmin ? 'Operations Admin' : 'Assigned Employee'}</span>
        </div>

        {/* User Initials Avatar Bubble */}
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-tr from-sky-600 to-indigo-600 text-white flex items-center justify-center text-[10px] sm:text-xs font-black shadow-xs shrink-0">
          {user?.name ? user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2) : 'OP'}
        </div>
      </div>

    </header>
  );
}
