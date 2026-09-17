'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck, ArrowRight, AlertCircle, CheckCircle2, Eye, EyeOff, ChevronDown } from 'lucide-react';
import { api } from '@/lib/api';

const DEFAULT_HR_DESIGNATIONS = [
  'HR Manager',
  'Senior HR Manager',
  'HR Executive',
  'HR Generalist',
  'HR Director',
  'Head of HR',
  'Talent Acquisition Specialist',
  'HR Business Partner',
  'People Operations Lead',
  'HR Coordinator',
  'Chief People Officer',
  'HR Assistant',
];

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [designationList, setDesignationList] = useState<string[]>(DEFAULT_HR_DESIGNATIONS);
  const [designation, setDesignation] = useState('HR Manager');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const router = useRouter();

  useEffect(() => {
    api.get('/api/master-data')
      .then((res) => {
        if (res.data?.roles && Array.isArray(res.data.roles) && res.data.roles.length > 0) {
          const combined = Array.from(new Set([...DEFAULT_HR_DESIGNATIONS, ...res.data.roles]));
          setDesignationList(combined);
        }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const payload = {
        role: 'hr',
        name: name.trim(),
        email: email.trim(),
        designation: designation.trim() || 'HR Manager',
        password,
        phone: phone.trim()
      };

      const res = await api.post('/register', payload);

      if (res.data?.success) {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('pending_hr_email', email.trim());
        }
        setSuccessMsg(res.data.message || 'Verification passkey generated. Redirecting to verification...');
        setTimeout(() => {
          router.push('/verify-otp');
        }, 800);
      } else {
        setErrorMsg(res.data?.message || 'Registration failed. Please check your details.');
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      setErrorMsg(err.response?.data?.message || err.message || 'Registration failed. Please check your information and try again.');
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
            HR Admin Registration
          </h2>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">
            Create an administrative HR account for your organization
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
          <div className="input-group">
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder=" "
              className="input-field"
            />
            <label className="floating-label">Full Name</label>
          </div>

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

          {/* Designation Dropdown */}
          <div className="space-y-1">
            <label className="block text-[0.72rem] font-bold uppercase tracking-wider text-[var(--text-muted)] px-1">
              Official Designation / Role *
            </label>
            <div className="relative">
              <select
                required
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className="input-field w-full cursor-pointer bg-[var(--input-bg)] text-[var(--text-main)] appearance-none pr-10 text-sm font-medium"
                style={{ paddingTop: '0.85rem', paddingBottom: '0.85rem' }}
              >
                {designationList.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-[var(--text-muted)]">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>

          <div className="input-group">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder=" "
              className="input-field"
            />
            <label className="floating-label">Phone Number (Optional)</label>
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
            <label className="floating-label">Password (Min. 6 chars)</label>
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)] p-1"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold rounded-xl shadow-md flex items-center justify-center space-x-2 transition disabled:opacity-50 mt-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <span>Create HR Account</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="pt-2 text-center text-xs text-[var(--text-muted)] border-t border-[var(--border-color)]">
          <p className="mb-2">
            Are you an employee or intern? Employee accounts are created and managed by HR Administrators.
          </p>
          Already have an account?{' '}
          <Link href="/login" className="text-[var(--primary)] font-bold hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}


