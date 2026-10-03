'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw,
  Sun,
  Moon,
  Sparkles
} from 'lucide-react';
import { api } from '@/lib/api';
import { useTheme } from '@/lib/theme';
import WisBeesLogo from '@/components/WisBeesLogo';

const INSPIRATIONAL_QUOTES = [
  {
    text: "Excellence is never an accident. It is always the result of high intention, sincere effort, and intelligent execution.",
    author: "Aristotle",
  },
  {
    text: "Price is what you pay. Value is what you get.",
    author: "Warren Buffett",
  },
  {
    text: "Risk comes from not knowing what you're doing. Research and diligence are our greatest moat.",
    author: "Benjamin Graham",
  },
  {
    text: "The compounding of daily excellence and rigorous execution creates unstoppable momentum.",
    author: "WisBees Philosophy",
  },
  {
    text: "Speed, clarity, and consistency transform strategy into market-leading results.",
    author: "Operational Principle",
  }
];

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [quoteIndex, setQuoteIndex] = useState(0);

  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  // Rotate quotes smoothly every 5.5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % INSPIRATIONAL_QUOTES.length);
    }, 5500);
    return () => clearInterval(timer);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await api.post('/auth/login', {
        email: email.trim(),
        password,
      });

      if (res.data?.success && res.data.token) {
        localStorage.setItem('ops_token', res.data.token);
        localStorage.setItem('ops_user', JSON.stringify(res.data.user));

        if (res.data.redirect_url) {
          router.push(res.data.redirect_url);
        } else if (res.data.user?.role === 'admin' || res.data.user?.is_superadmin) {
          router.push('/admin/dashboard');
        } else {
          router.push('/employee/dashboard');
        }
      } else {
        setErrorMsg(res.data?.error || 'Invalid email or password.');
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Invalid email or password. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const currentQuote = INSPIRATIONAL_QUOTES[quoteIndex];

  return (
    <div className="min-h-screen bg-[#F1F5F9] dark:bg-[#06080D] text-slate-900 dark:text-slate-100 transition-colors duration-300 relative flex items-center justify-center p-4 sm:p-6 lg:p-8 overflow-x-hidden">
      
      {/* Background Subtle Highlights & Glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-sky-500/10 dark:bg-sky-500/10 rounded-full blur-3xl animate-pulse-glow" />
        <div
          className="absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-500/10 dark:bg-emerald-500/10 rounded-full blur-3xl animate-pulse-glow"
          style={{ animationDelay: '2s' }}
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(#94a3b8_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] bg-[size:32px_32px] opacity-20 pointer-events-none" />
      </div>

      {/* Top Floating Theme Switcher Button */}
      <div className="fixed top-4 right-4 sm:top-6 sm:right-6 z-50">
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white/90 dark:bg-[#0B0E17]/90 hover:bg-white dark:hover:bg-[#121726] text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-[#1E2538] shadow-lg backdrop-blur-md transition cursor-pointer active:scale-95"
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

      {/* Main Container: Centered Single User Login Console */}
      <div className="relative z-10 w-full max-w-md my-auto">
        <div className="w-full bg-white dark:bg-[#0C0F1A]/95 backdrop-blur-2xl border border-slate-200 dark:border-[#181E2E] rounded-3xl p-6 sm:p-8 lg:p-9 shadow-2xl transition-colors relative">
          
          {/* WisBees Brand Logo & Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-slate-50 dark:bg-[#06080D] border border-slate-200 dark:border-[#181E2E] shadow-sm mb-3.5 backdrop-blur-md">
              <WisBeesLogo imgClassName="h-9 w-auto object-contain" />
            </div>
            
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Operations Management
            </h1>

            {/* Dynamic Quote transitioning automatically */}
            <div className="mt-2.5 px-2 min-h-[52px] flex flex-col items-center justify-center">
              <p
                key={`text-${quoteIndex}`}
                className="text-[12px] italic text-slate-600 dark:text-slate-300 font-medium leading-relaxed max-w-sm mx-auto animate-fadeIn"
              >
                "{currentQuote.text}"
              </p>
              <span
                key={`author-${quoteIndex}`}
                className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-1 animate-fadeIn"
              >
                — {currentQuote.author}
              </span>
            </div>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="mb-5 p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 rounded-2xl text-xs font-semibold flex items-center gap-2 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Unified Single Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                Work Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@wisbees.com"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-[#070912] border border-slate-200 dark:border-[#1C2337] rounded-xl text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 transition"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-semibold text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300 transition"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-3 bg-slate-50 dark:bg-[#070912] border border-slate-200 dark:border-[#1C2337] rounded-xl text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 transition"
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
              className="w-full py-3.5 rounded-xl text-white text-xs font-extrabold shadow-lg bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 shadow-sky-500/25 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-98 mt-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Operations Portal</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}
