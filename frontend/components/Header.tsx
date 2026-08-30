'use client';

import React, { useState, useEffect } from 'react';
import { Sun, Moon, Menu } from 'lucide-react';

export default function Header({ 
  title = 'Dashboard',
  onMenuClick
}: { 
  title?: string;
  onMenuClick?: () => void;
}) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

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
    if (onMenuClick) {
      onMenuClick();
    } else {
      window.dispatchEvent(new Event('toggle-sidebar'));
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
        <h1 className="text-lg sm:text-xl font-bold text-[var(--text)] tracking-tight font-['Plus_Jakarta_Sans']">{title}</h1>
      </div>

      <div className="flex items-center space-x-3">
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
