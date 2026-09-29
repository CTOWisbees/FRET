'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, Eye, EyeOff, ArrowRight, ArrowLeft, CheckCircle2, AlertCircle, KeyRound, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const token = searchParams.get('token') || '';
  const email = searchParams.get('email') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [completed, setCompleted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!token || !email) {
      setErrorMsg('Missing or invalid reset token. Please request a new password reset link.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please ensure both fields are identical.');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        token,
        email,
        password,
        confirm_password: confirmPassword
      };

      const res = await api.post('/reset-password', payload);

      if (res.data?.success) {
        setCompleted(true);
        setSuccessMsg(res.data.message || 'Password successfully reset! Redirecting to sign in...');
        setTimeout(() => {
          router.push('/login');
        }, 1500);
      } else {
        setErrorMsg(res.data?.message || 'Failed to update password. Please request a new reset link.');
      }
    } catch (err: any) {
      console.error('Password reset error:', err);
      setErrorMsg(err.response?.data?.message || err.message || 'Unable to reset password. The link may have expired or is invalid.');
    } finally {
      setLoading(false);
    }
  };

  if (!token || !email) {
    return (
      <div className="space-y-5 text-center">
        <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 rounded-xl space-y-2">
          <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/50 rounded-full flex items-center justify-center text-amber-600 dark:text-amber-400 mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h3 className="text-sm font-bold text-amber-800 dark:text-amber-300">
            Invalid or Missing Reset Link
          </h3>
          <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
            No valid security token was detected in your URL. Please make sure you clicked the exact link sent to your email.
          </p>
        </div>

        <div className="pt-2 flex flex-col gap-2">
          <Link
            href="/forgot-password"
            className="w-full py-3.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs sm:text-sm font-bold rounded-xl shadow flex items-center justify-center space-x-1.5 transition text-center"
          >
            <span>Request New Reset Link</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/login"
            className="w-full py-2.5 text-xs sm:text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text-main)] transition"
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ERROR ALERT */}
      {errorMsg && (
        <div className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 rounded-xl flex items-start space-x-2 text-xs sm:text-sm text-red-600 dark:text-red-400 animate-fadeIn">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* SUCCESS CONFIRMATION */}
      {completed ? (
        <div className="p-5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 rounded-xl text-center space-y-3 animate-fadeIn">
          <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-emerald-800 dark:text-emerald-300">
            Password Updated!
          </h3>
          <p className="text-xs sm:text-sm text-emerald-700 dark:text-emerald-400">
            {successMsg}
          </p>
          <div className="pt-2">
            <Link
              href="/login"
              className="inline-flex items-center space-x-1.5 px-6 py-2.5 bg-[var(--primary)] text-white text-xs sm:text-sm font-bold rounded-xl shadow hover:bg-[var(--primary-hover)] transition"
            >
              <span>Sign In Now</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-xs text-[var(--text-muted)] bg-[var(--bg-right)] p-3 rounded-xl border border-[var(--border-color)]">
            Resetting password for: <strong className="text-[var(--text-main)]">{email}</strong>
          </div>

          <div className="input-group">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder=" "
              className="input-field"
            />
            <label className="floating-label">New Password (Min. 6 chars)</label>
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)] p-1"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <div className="input-group">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder=" "
              className="input-field"
            />
            <label className="floating-label">Confirm New Password</label>
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)] p-1"
            >
              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {password && confirmPassword && password !== confirmPassword && (
            <p className="text-[11px] text-red-500 font-medium px-1">
              Passwords do not match.
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !password || !confirmPassword || password !== confirmPassword}
            className="w-full py-3.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold rounded-xl shadow-md flex items-center justify-center space-x-2 transition disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <span>Update Password</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-right)] p-4 sm:p-8 font-sans">
      <div className="w-full max-w-md space-y-6 bg-[var(--bg-left)] p-8 rounded-2xl border border-[var(--border-color)] shadow-xl">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <img 
              src="/logo.png" 
              alt="WisBees Logo" 
              className="w-[180px] h-auto object-contain" 
            />
          </div>
          <h2 className="text-2xl font-extrabold text-[var(--text-main)] font-['Plus_Jakarta_Sans']">
            Set New Password
          </h2>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">
            Choose a secure password for your FRET account
          </p>
        </div>

        <Suspense fallback={
          <div className="py-12 flex justify-center">
            <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin"></div>
          </div>
        }>
          <ResetPasswordForm />
        </Suspense>

        <div className="text-center pt-2">
          <Link 
            href="/login" 
            className="inline-flex items-center space-x-1.5 text-xs sm:text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--primary)] transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Sign In</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
