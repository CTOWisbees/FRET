'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck, UserCheck, Lock, Mail, ArrowRight, AlertCircle, Eye, EyeOff, Sun, Moon } from 'lucide-react';
import { api } from '@/lib/api';

export default function LoginPage() {
  const [loginType, setLoginType] = useState<'hr' | 'employee'>('hr');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const savedTheme = (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload = {
        email: email.trim(),
        password: password,
        login_type: loginType
      };

      const res = await api.post('/login', payload, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (res.data?.token) {
        localStorage.setItem('fret_token', res.data.token);
      }
      if (res.data?.user) {
        localStorage.setItem('fret_user', JSON.stringify(res.data.user));
      }

      const targetUrl = (res.data && res.data.redirect) 
        ? res.data.redirect 
        : (loginType === 'hr' ? '/dashboard' : '/employee-dashboard');
        
      window.location.replace(targetUrl);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Invalid login credentials. Please check your email & password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-[var(--bg-right)] text-[var(--text-main)] overflow-hidden font-sans">
      {/* LEFT PANE - BRANDING & HERO */}
      <div className="hidden lg:flex flex-1 flex-col justify-between p-16 relative bg-[var(--bg-left)] border-r border-[var(--border-color)] overflow-hidden">
        {/* Background Visual Effects */}
        <div className="dot-grid"></div>
        <div className="orb-1"></div>
        <div className="orb-2"></div>

        {/* Brand Header - Wisbees Logo Image */}
        <div className="relative z-10 mb-auto">
          <img 
            src="/logo.png" 
            alt="WisBees Logo" 
            className={`w-[250px] h-auto object-contain transition-all ${theme === 'dark' ? 'brightness-0 invert' : ''}`}
          />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 max-w-[500px] mb-auto py-8">
          <h1 className="font-extrabold text-[3.5rem] tracking-[-1.5px] leading-[1.05] mb-5 text-[var(--text-main)] font-['Plus_Jakarta_Sans']">
            FRET<br />
            <span className="text-[var(--primary)]">Management System.</span>
          </h1>
          <p className="text-[1.15rem] leading-[1.6] text-[var(--text-muted)] max-w-[440px]">
            FRET brings offers, onboarding, attendance, and analytics into one clean workspace.
          </p>
        </div>

        {/* Footer Copyright */}
        <div className="relative z-10 text-[0.85rem] text-[var(--text-muted)] font-medium mt-auto">
          © 2026 FRET Intelligence. All rights reserved.
        </div>
      </div>

      {/* RIGHT PANE - AUTHENTICATION FORM */}
      <div className="w-full lg:flex-none lg:w-[520px] xl:w-[560px] flex flex-col justify-center p-8 sm:p-14 relative bg-[var(--bg-right)]">
        {/* Floating Theme Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle Theme"
          className="absolute top-8 right-8 w-10 h-10 rounded-full border border-[var(--border-color)] text-[var(--text-muted)] hover:bg-[var(--toggle-bg)] hover:text-[var(--text-main)] flex items-center justify-center transition z-50"
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5 text-slate-700" />}
        </button>

        <div className="w-full max-w-md mx-auto space-y-6">
          {/* Mobile WisBees Brand Header */}
          <div className="lg:hidden flex flex-col items-start space-y-2 mb-2">
            <img 
              src="/logo.png" 
              alt="WisBees Logo" 
              className={`w-[170px] sm:w-[200px] h-auto object-contain transition-all ${theme === 'dark' ? 'brightness-0 invert' : ''}`}
            />
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] text-xs font-semibold">
              <span>FRET Management System</span>
            </div>
          </div>

          {/* Auth Header */}
          <div>
            <h2 className="text-[1.75rem] font-bold text-[var(--text-main)] tracking-[-0.5px] font-['Plus_Jakarta_Sans']">
              Welcome Back
            </h2>
            <p className="text-[0.95rem] text-[var(--text-muted)] mt-1">
              Sign in to your intelligent workspace
            </p>
          </div>

          {/* Flash Error Alert */}
          {error && (
            <div className="p-4 bg-[var(--error-bg)] border border-red-500/20 rounded-xl flex items-start space-x-3 text-[var(--error-text)] text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Segmented Toggle Slider */}
          <div className="bg-[var(--toggle-bg)] p-1 rounded-[14px] flex items-center border border-[var(--border-color)] relative">
            <button
              type="button"
              onClick={() => setLoginType('hr')}
              className={`flex-1 py-3 rounded-[10px] text-xs font-bold uppercase tracking-[0.5px] transition-all z-10 flex items-center justify-center space-x-2 ${
                loginType === 'hr'
                  ? 'bg-[var(--toggle-active)] text-[var(--text-main)] shadow-sm border border-[var(--border-color)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              <span>HR ADMIN</span>
            </button>
            <button
              type="button"
              onClick={() => setLoginType('employee')}
              className={`flex-1 py-3 rounded-[10px] text-xs font-bold uppercase tracking-[0.5px] transition-all z-10 flex items-center justify-center space-x-2 ${
                loginType === 'employee'
                  ? 'bg-[var(--toggle-active)] text-[var(--text-main)] shadow-sm border border-[var(--border-color)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              <span>EMPLOYEE</span>
            </button>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="input-group">
              <input
                type="email"
                id="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder=" "
                className="input-field"
              />
              <label htmlFor="email" className="floating-label">Corporate Email</label>
            </div>

            <div className="input-group">
              <input
                type={showPassword ? 'text' : 'password'}
                id="pwField"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder=" "
                className="input-field"
              />
              <label htmlFor="pwField" className="floating-label">Password</label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)] p-1"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            <div className="flex items-center justify-between text-sm px-1">
              <label className="flex items-center space-x-2 text-[var(--text-muted)] cursor-pointer font-medium">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="rounded border-[var(--border-color)] bg-[var(--input-bg)] text-[var(--primary)] focus:ring-[var(--primary)]"
                />
                <span>Keep me signed in</span>
              </label>
              <a href="#" className="text-[var(--primary)] font-semibold hover:underline">
                Forgot password?
              </a>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold text-[1.05rem] rounded-xl shadow-md flex items-center justify-center space-x-2 transition mt-4 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          {loginType === 'hr' && (
            <div className="text-center pt-4 text-sm text-[var(--text-muted)] font-medium">
              New HR member?{' '}
              <Link href="/register" className="text-[var(--primary)] font-bold hover:underline">
                Create an account
              </Link>
            </div>
          )}

          {/* Mobile Footer Copyright */}
          <div className="lg:hidden text-center text-xs text-[var(--text-muted)] font-medium pt-2">
            © 2026 FRET Intelligence. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  );
}
