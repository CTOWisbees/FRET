'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';

export default function VerifyOtpPage() {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('otp', otp);
      await api.post('/verify-otp', formData);
      alert('Verification successful!');
      router.push('/dashboard');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Invalid OTP code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-right)] p-8">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <ShieldCheck className="w-12 h-12 text-[var(--primary)] mx-auto mb-3" />
          <h2 className="text-2xl font-bold text-[var(--text-main)]">Verify OTP Code</h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">Enter the verification code sent to your email</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="input-group">
            <input
              type="text"
              required
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder=" "
              className="input-field text-center font-mono text-xl tracking-widest"
            />
            <label className="floating-label">6-Digit OTP</label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold rounded-xl shadow-md flex items-center justify-center space-x-2 transition"
          >
            <span>Verify & Continue</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
