'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Mail, ArrowRight, ArrowLeft, CheckCircle2, AlertCircle, ShieldAlert } from 'lucide-react';
import { api } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [devResetLink, setDevResetLink] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const res = await api.post('/forgot-password', { email: email.trim() });
      if (res.data?.success) {
        setSubmitted(true);
        setSuccessMsg(res.data.message || 'Password reset link has been dispatched to your email.');
        if (res.data.reset_link) {
          setDevResetLink(res.data.reset_link);
        }
      } else {
        setErrorMsg(res.data?.message || 'Unable to process reset request. Please check your email address.');
      }
    } catch (err: any) {
      console.error('Forgot password error:', err);
      setErrorMsg(err.response?.data?.message || err.message || 'Unable to send reset instructions. Please check your email and try again.');
    } finally {
      setLoading(false);
    }
  };

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
            Forgot Password?
          </h2>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">
            Enter your registered email address and we'll send you a secure password reset link.
          </p>
        </div>

        {/* ERROR ALERT */}
        {errorMsg && (
          <div className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 rounded-xl flex items-start space-x-2 text-xs sm:text-sm text-red-600 dark:text-red-400 animate-fadeIn">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* SUCCESS CONFIRMATION STATE */}
        {submitted ? (
          <div className="space-y-5 animate-fadeIn">
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 rounded-xl text-center space-y-2">
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                Reset Link Dispatched
              </h3>
              <p className="text-xs text-emerald-700 dark:text-emerald-400 leading-relaxed">
                {successMsg}
              </p>
              <p className="text-[11px] text-[var(--text-muted)] pt-1">
                Please check your inbox (and Spam/Junk folder). The link will expire in 1 hour.
              </p>
            </div>

            {/* Direct Link Preview for Dev / Beta Testing */}
            {devResetLink && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 rounded-xl space-y-1.5 text-xs text-blue-700 dark:text-blue-300">
                <span className="font-bold flex items-center space-x-1">
                  <span>Direct Reset Link (Local Testing):</span>
                </span>
                <a 
                  href={devResetLink} 
                  className="block underline break-all text-[11px] font-mono text-blue-600 dark:text-blue-400 hover:text-blue-800"
                >
                  {devResetLink}
                </a>
              </div>
            )}

            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => { setSubmitted(false); setErrorMsg(''); }}
                className="flex-1 py-3 text-xs sm:text-sm font-semibold rounded-xl border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition"
              >
                Send to another email
              </button>
              <Link
                href="/login"
                className="flex-1 py-3 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs sm:text-sm font-bold rounded-xl shadow flex items-center justify-center space-x-1.5 transition text-center"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Sign In</span>
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="input-group">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder=" "
                className="input-field"
              />
              <label className="floating-label">Registered Corporate / Personal Email</label>
            </div>

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full py-3.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold rounded-xl shadow-md flex items-center justify-center space-x-2 transition disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>Send Reset Link</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="text-center pt-2">
              <Link 
                href="/login" 
                className="inline-flex items-center space-x-1.5 text-xs sm:text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--primary)] transition"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Sign In</span>
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
