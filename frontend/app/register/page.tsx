'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [designation, setDesignation] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('email', email);
      formData.append('designation', designation);
      formData.append('password', password);

      await api.post('/register', formData);
      router.push('/verify-otp');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-right)] p-8">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <img 
              src="/logo.png" 
              alt="WisBees Logo" 
              className="w-[180px] h-auto object-contain"
            />
          </div>
          <h2 className="text-2xl font-bold text-[var(--text-main)]">HR Admin Registration</h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">Create an HR account for your organization</p>
        </div>

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

          <div className="input-group">
            <input
              type="text"
              required
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              placeholder=" "
              className="input-field"
            />
            <label className="floating-label">Designation / Title</label>
          </div>

          <div className="input-group">
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder=" "
              className="input-field"
            />
            <label className="floating-label">Password</label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold rounded-xl shadow-md flex items-center justify-center space-x-2 transition"
          >
            <span>Create HR Account</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </form>

        <div className="text-center text-sm text-[var(--text-muted)]">
          Already have an account?{' '}
          <Link href="/login" className="text-[var(--primary)] font-bold hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
