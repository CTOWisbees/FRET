'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Shield,
  User,
  Lock,
  Mail,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw,
  Sun,
  Moon,
  Zap
} from 'lucide-react';
import { api } from '@/lib/api';
import { useTheme } from '@/lib/theme';
import { OperationsAnimation } from '@/components/operations-animation/OperationsAnimation';

export default function LoginPage() {
  const [role, setRole] = useState<'admin' | 'employee'>('employee');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await api.post('/auth/login', {
        email,
        password,
        role,
      });

      if (res.data?.success && res.data.token) {
        localStorage.setItem('ops_token', res.data.token);
        localStorage.setItem('ops_user', JSON.stringify(res.data.user));

        if (res.data.user?.role === 'admin') {
          router.push('/admin/dashboard');
        } else {
          router.push('/employee/dashboard');
        }
      } else {
        setErrorMsg(res.data?.error || 'Login failed. Please check your credentials.');
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Unable to connect to Operations server.');
    } finally {
      setLoading(false);
    }
  };

  const fillQuickCredentials = (targetRole: 'admin' | 'employee') => {
    setRole(targetRole);
    if (targetRole === 'admin') {
      setEmail('admin@operations.wisbees.com');
      setPassword('admin123');
    } else {
      setEmail('chhayakanta@wisbees.com');
      setPassword('employee123');
    }
    setErrorMsg(null);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-primary)] transition-colors duration-300 relative flex items-center justify-center p-3 sm:p-6 lg:p-8 overflow-x-hidden">
      
      {/* Background Subtle Grid and Glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-sky-500/10 dark:bg-sky-500/15 rounded-full blur-3xl animate-pulse-glow" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-500/10 dark:bg-emerald-500/15 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(#94a3b8_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] bg-[size:32px_32px] opacity-30 pointer-events-none" />
      </div>

      {/* Top Floating Theme Switcher Button */}
      <div className="fixed top-4 right-4 sm:top-6 sm:right-6 z-50">
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white/90 dark:bg-slate-800/90 hover:bg-white dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 shadow-lg backdrop-blur-md transition cursor-pointer active:scale-95"
        >
          {theme === 'dark' ? (
            <>
              <Sun className="w-4 h-4 text-amber-400 animate-fadeIn" />
              <span className="text-xs font-bold">Light Mode</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-indigo-600 animate-fadeIn" />
              <span className="text-xs font-bold">Dark Mode</span>
            </>
          )}
        </button>
      </div>

      {/* Main Container: 2-Column Split Layout */}
      <div className="relative z-10 w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch my-auto">
        
        {/* Left Column: Continuous 2D Animated Operations Management Scene */}
        <div className="lg:col-span-7 flex flex-col justify-between rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xl overflow-hidden relative min-h-[600px]">
          <OperationsAnimation />
        </div>

        {/* Right Column: Company Login Console */}
        <div className="lg:col-span-5 flex flex-col justify-center">
          <div className="w-full bg-white dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 lg:p-9 shadow-2xl transition-colors relative">
            
            {/* WisBees Brand Logo & Header */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center p-2.5 rounded-2xl bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 shadow-md mb-3 backdrop-blur-md">
                <img
                  src="/logo.png"
                  alt="WisBees Logo"
                  className="h-9 w-auto object-contain dark:drop-shadow-[0_0_1px_rgba(255,255,255,0.9)] dark:brightness-110"
                />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Operations Management
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                Enterprise Work Assignment, Role Matrix & Deliverables
              </p>
            </div>

            {/* Role Tabs */}
            <div className="grid grid-cols-2 p-1.5 bg-slate-100 dark:bg-slate-800/90 rounded-2xl mb-6 border border-slate-200 dark:border-slate-700/80">
              <button
                type="button"
                onClick={() => {
                  setRole('employee');
                  setErrorMsg(null);
                }}
                className={`py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  role === 'employee'
                    ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-300 shadow-sm font-extrabold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <User className="w-4 h-4" />
                <span>Employee Portal</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setRole('admin');
                  setErrorMsg(null);
                }}
                className={`py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  role === 'admin'
                    ? 'bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-sm font-extrabold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Shield className="w-4 h-4" />
                <span>Operations Admin</span>
              </button>
            </div>

            {/* Error Banner */}
            {errorMsg && (
              <div className="mb-5 p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 rounded-2xl text-xs font-semibold flex items-center gap-2 animate-fadeIn">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  {role === 'admin' ? 'Admin Email Address' : 'Employee Email'}
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={role === 'admin' ? 'admin@operations.wisbees.com' : 'chhayakanta@wisbees.com'}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3.5 rounded-xl text-white text-xs font-extrabold shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-98 ${
                  role === 'admin'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-purple-500/25'
                    : 'bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 shadow-sky-500/25'
                }`}
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Signing In...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to {role === 'admin' ? 'Operations Admin' : 'Employee Portal'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Quick Demo Fillers */}
            <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 text-center mb-3 flex items-center justify-center gap-1.5">
                <Zap className="w-3 h-3 text-amber-500" />
                <span>1-Click Demo Login</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => fillQuickCredentials('employee')}
                  className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                    role === 'employee' && email.includes('chhayakanta')
                      ? 'bg-sky-50 dark:bg-sky-950/50 border-sky-400 dark:border-sky-600 text-sky-900 dark:text-sky-200 shadow-xs'
                      : 'bg-slate-50 hover:bg-sky-50/50 dark:bg-slate-800/60 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="min-w-0 pr-1">
                    <div className="font-extrabold text-xs truncate">Chhayakanta M.</div>
                    <div className="text-[10px] text-sky-600 dark:text-sky-400 font-medium">Employee / Intern</div>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={() => fillQuickCredentials('admin')}
                  className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                    role === 'admin' && email.includes('admin')
                      ? 'bg-purple-50 dark:bg-purple-950/50 border-purple-400 dark:border-purple-600 text-purple-900 dark:text-purple-200 shadow-xs'
                      : 'bg-slate-50 hover:bg-purple-50/50 dark:bg-slate-800/60 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="min-w-0 pr-1">
                    <div className="font-extrabold text-xs truncate">Operations Head</div>
                    <div className="text-[10px] text-purple-600 dark:text-purple-400 font-medium">Admin Account</div>
                  </div>
                  <Shield className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                </button>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
