'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck, ArrowRight, AlertCircle, CheckCircle2, RotateCw, Mail } from 'lucide-react';
import { api } from '@/lib/api';

export default function VerifyOtpPage() {
  const [otp, setOtp] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedEmail = sessionStorage.getItem('pending_hr_email');
      if (savedEmail) {
        setEmail(savedEmail);
      }
    }
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const payload = {
        otp: otp.trim(),
        email: email.trim(),
      };
      const res = await api.post('/verify-otp', payload);

      if (res.data?.success) {
        if (res.data.token) {
          localStorage.setItem('fret_token', res.data.token);
        }
        if (res.data.user) {
          localStorage.setItem('fret_user', JSON.stringify(res.data.user));
        }
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('pending_hr_email');
        }
        setSuccessMsg(res.data.message || 'Verification successful! Redirecting to dashboard...');
        setTimeout(() => {
          router.push(res.data.redirect || '/dashboard');
        }, 800);
      } else {
        setErrorMsg(res.data?.message || 'Invalid OTP code.');
      }
    } catch (err: any) {
      console.error('OTP verification error:', err);
      setErrorMsg(err.response?.data?.message || err.message || 'Invalid OTP code. Please check and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || resending) return;
    setErrorMsg('');
    setSuccessMsg('');
    setResending(true);

    try {
      const res = await api.post('/resend-otp', { email: email.trim() });
      if (res.data?.success) {
        setSuccessMsg(res.data.message || 'A new verification passkey was dispatched to your email.');
        setCountdown(60);
      } else {
        setErrorMsg(res.data?.message || 'Failed to resend passkey.');
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to resend passkey. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-right)] p-4 sm:p-8 font-sans">
      <div className="w-full max-w-md space-y-6 bg-[var(--bg-left)] p-8 rounded-2xl border border-[var(--border-color)] shadow-xl">
        <div className="text-center">
          <div className="flex justify-center mb-3">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-[var(--primary)] border border-emerald-200 dark:border-emerald-800/40">
              <ShieldCheck className="w-8 h-8" />
            </div>
          </div>
          <h2 className="text-2xl font-extrabold text-[var(--text-main)] font-['Plus_Jakarta_Sans']">
            Verify Email OTP
          </h2>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">
            {email ? (
              <span>
                Enter the 6-digit code sent to <strong className="text-[var(--text-main)]">{email}</strong>
              </span>
            ) : (
              'Enter the 6-digit administrative passkey code sent to your email'
            )}
          </p>
        </div>

        {/* ERROR / SUCCESS ALERTS */}
        {errorMsg && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 rounded-xl flex items-start space-x-2 text-xs sm:text-sm text-red-600 dark:text-red-400">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 rounded-xl flex items-start space-x-2 text-xs sm:text-sm text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!email && (
            <div className="input-group">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder=" "
                className="input-field"
              />
              <label className="floating-label">Corporate Email</label>
            </div>
          )}

          <div className="input-group">
            <input
              type="text"
              required
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              placeholder=" "
              className="input-field text-center font-mono text-2xl tracking-[0.4em] font-bold"
              autoFocus
            />
            <label className="floating-label text-center w-full left-0">6-Digit Passkey OTP</label>
          </div>

          <button
            type="submit"
            disabled={loading || otp.length < 6}
            className="w-full py-3.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold rounded-xl shadow-md flex items-center justify-center space-x-2 transition disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <span>Verify & Complete Registration</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="flex items-center justify-between pt-2 text-xs sm:text-sm text-[var(--text-muted)]">
          <button
            type="button"
            onClick={handleResend}
            disabled={countdown > 0 || resending}
            className="inline-flex items-center space-x-1.5 text-[var(--primary)] font-semibold hover:underline disabled:opacity-50 disabled:no-underline"
          >
            <RotateCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
            <span>{countdown > 0 ? `Resend in ${countdown}s` : 'Resend Code'}</span>
          </button>

          <Link href="/register" className="text-[var(--text-muted)] hover:text-[var(--text-main)] transition font-medium">
            &larr; Change Email
          </Link>
        </div>

        <div className="text-center text-xs text-[var(--text-muted)] pt-3 border-t border-[var(--border-color)]">
          Already verified?{' '}
          <Link href="/login" className="text-[var(--primary)] font-bold hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
