'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  Mail,
  Phone,
  Lock,
  Shield,
  Briefcase,
  Building2,
  Calendar,
  Save,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  KeyRound,
  BadgeCheck,
  RefreshCw,
  Camera,
  Upload,
  Trash2,
  Image as ImageIcon
} from 'lucide-react';
import { api } from '@/lib/api';

interface ProfileManagementProps {
  initialUser?: any;
}

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80',
];

export function ProfileManagement({ initialUser }: ProfileManagementProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState<any>(initialUser || null);
  const [loading, setLoading] = useState(!initialUser);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [designation, setDesignation] = useState('');
  const [skills, setSkills] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  // Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await api.get('/auth/profile');
      if (res.data?.success && res.data?.user) {
        populateForm(res.data.user);
      } else {
        const local = localStorage.getItem('ops_user');
        if (local) {
          populateForm(JSON.parse(local));
        }
      }
    } catch (err) {
      const local = localStorage.getItem('ops_user');
      if (local) {
        populateForm(JSON.parse(local));
      }
    } finally {
      setLoading(false);
    }
  };

  const populateForm = (userData: any) => {
    setUser(userData);
    setFullName(userData.full_name || userData.name || '');
    setEmail(userData.email || '');
    setPhone(userData.phone || '');
    setDesignation(userData.designation || '');
    setSkills(userData.skills || '');
    setAvatarUrl(userData.avatar_url || '');
  };

  // Handle local image file upload & convert to Base64
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Selected image size exceeds 5MB limit. Please choose a smaller image.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setAvatarUrl(base64String);
      setErrorMsg(null);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setAvatarUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (newPassword) {
      if (!currentPassword) {
        setErrorMsg('Please enter your current password to set a new password.');
        return;
      }
      if (newPassword.length < 6) {
        setErrorMsg('New password must be at least 6 characters long.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setErrorMsg('New password and confirm password do not match.');
        return;
      }
    }

    setSaving(true);

    try {
      const payload: any = {
        full_name: fullName,
        phone,
        skills,
        avatar_url: avatarUrl,
      };

      if (isAdmin) {
        payload.email = email;
        payload.designation = designation;
      }

      if (newPassword) {
        payload.current_password = currentPassword;
        payload.new_password = newPassword;
        payload.confirm_password = confirmPassword;
      }

      const res = await api.post('/auth/profile', payload);

      if (res.data?.success) {
        const updatedUser = res.data.user;
        setUser(updatedUser);
        localStorage.setItem('ops_user', JSON.stringify(updatedUser));
        setSuccessMsg(res.data.message || 'Profile updated successfully!');
        
        // Reset password fields
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');

        // Notify other components of profile update
        window.dispatchEvent(new Event('storage'));
      } else {
        setErrorMsg(res.data?.error || 'Failed to update profile.');
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'An error occurred while saving your profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 min-h-[400px]">
        <div className="w-10 h-10 border-4 border-sky-600 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Loading Profile Data...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      
      {/* Hidden File Input for Avatar Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageUpload}
        accept="image/png, image/jpeg, image/jpg, image/webp"
        className="hidden"
      />

      {/* Profile Header Banner */}
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl p-6 sm:p-8 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-sky-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4 sm:gap-6">
            
            {/* Avatar Preview with Click-to-Upload Camera Badge */}
            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()} title="Click to upload profile photo">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={fullName || 'Avatar'}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl object-cover shadow-lg border-2 border-sky-500/30 group-hover:opacity-80 transition"
                />
              ) : (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white flex items-center justify-center text-2xl sm:text-3xl font-black shadow-lg group-hover:opacity-90 transition">
                  {user?.name ? user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : 'U'}
                </div>
              )}

              {/* Hover Overlay Camera */}
              <div className="absolute inset-0 bg-black/40 rounded-3xl opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-[10px] font-bold transition">
                <Camera className="w-5 h-5 mb-0.5" />
                <span>Change</span>
              </div>

              {/* Role Badge Indicator */}
              <div className="absolute -bottom-1 -right-1 p-1.5 bg-white dark:bg-slate-800 rounded-xl shadow border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                {isAdmin ? <Shield className="w-4 h-4 text-purple-600" /> : <BadgeCheck className="w-4 h-4 text-sky-600" />}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black text-[var(--text-primary)]">
                  {user?.full_name || user?.name || 'User Profile'}
                </h2>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider border ${
                  isAdmin
                    ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                    : 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800'
                }`}>
                  {isAdmin ? 'Operations Administrator' : (user?.role || 'Employee')}
                </span>
              </div>

              <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1 font-medium flex items-center gap-2">
                <span>{user?.email}</span>
                <span>•</span>
                <span className="font-mono text-[11px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md font-bold">
                  {user?.emp_code || `OPS-${user?.id || 1}`}
                </span>
              </p>

              <div className="flex items-center gap-4 mt-3 text-xs text-[var(--text-muted)] flex-wrap">
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  {user?.department || 'Operations'}
                </span>
                {user?.joining_date && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    Joined {user?.joining_date}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="shrink-0 flex sm:flex-col items-end gap-2 w-full sm:w-auto">
            <span className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
              user?.status === 'Active'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
            }`}>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {user?.status || 'Active'} Account
            </span>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 rounded-2xl text-xs font-semibold flex items-center gap-2.5 animate-fadeIn">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-300 rounded-2xl text-xs font-semibold flex items-center gap-2.5 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Profile Edit Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Section 1: Profile Photo Customization */}
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl p-6 sm:p-8 shadow-sm space-y-5">
          <div className="border-b border-[var(--card-border)] pb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-[var(--text-primary)] flex items-center gap-2">
                <Camera className="w-4 h-4 text-sky-500" />
                <span>Profile Photo & Avatar</span>
              </h3>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Upload a custom picture from your device or select from curated avatars.
              </p>
            </div>
            {avatarUrl && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                className="text-xs font-bold text-red-500 hover:text-red-700 flex items-center gap-1 cursor-pointer transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove Photo</span>
              </button>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {/* Upload from Computer Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-3 rounded-2xl border-2 border-dashed border-sky-400/50 hover:border-sky-500 bg-sky-50/50 dark:bg-sky-950/20 text-sky-700 dark:text-sky-300 text-xs font-bold flex items-center gap-2.5 transition cursor-pointer hover:shadow-xs"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Photo from Device (JPG / PNG)</span>
            </button>

            <span className="text-xs text-slate-400 font-bold hidden sm:inline">OR Select Preset:</span>

            {/* Quick Avatar Presets */}
            <div className="flex items-center gap-2.5 flex-wrap">
              {AVATAR_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setAvatarUrl(preset)}
                  className={`w-10 h-10 rounded-2xl overflow-hidden border-2 transition cursor-pointer hover:scale-105 ${
                    avatarUrl === preset
                      ? 'border-sky-500 ring-2 ring-sky-500/30 shadow-md'
                      : 'border-slate-200 dark:border-slate-700 opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={preset} alt={`Preset ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Section 2: General Details */}
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="border-b border-[var(--card-border)] pb-4">
            <h3 className="text-base font-black text-[var(--text-primary)] flex items-center gap-2">
              <User className="w-4 h-4 text-sky-500" />
              <span>Personal & Account Details</span>
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Update your personal information and contact preferences.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            
            {/* Full Name */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Chhayakanta Maharana"
                  className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-main)] border border-[var(--card-border)] rounded-xl text-xs font-medium text-[var(--text-primary)] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 transition"
                />
              </div>
            </div>

            {/* Email Address */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  Registered Email Address
                </label>
                {!isAdmin && (
                  <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-slate-400" />
                    Locked (Employee)
                  </span>
                )}
              </div>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  disabled={!isAdmin}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@wisbees.com"
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-xs font-medium border transition ${
                    isAdmin
                      ? 'bg-[var(--bg-main)] border-[var(--card-border)] text-[var(--text-primary)] focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500'
                      : 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed select-none'
                  }`}
                />
              </div>
              {!isAdmin && (
                <p className="text-[10px] text-slate-400 mt-1">
                  Employee email accounts are managed by Operations Admin.
                </p>
              )}
            </div>

            {/* Phone Number */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                Phone Number
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +91 98765 43210"
                  className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-main)] border border-[var(--card-border)] rounded-xl text-xs font-medium text-[var(--text-primary)] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 transition"
                />
              </div>
            </div>

            {/* Designation */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                Job Designation / Title
              </label>
              <div className="relative">
                <Briefcase className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="e.g. Operations Executive / Intern"
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-xs font-medium border transition ${
                    isAdmin
                      ? 'bg-[var(--bg-main)] border-[var(--card-border)] text-[var(--text-primary)] focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500'
                      : 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed select-none'
                  }`}
                />
              </div>
            </div>

            {/* Skills & Expertise */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                Key Skills & Domains
              </label>
              <input
                type="text"
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                placeholder="e.g. Equity Research, Content Writing, Digital Marketing, Python, Excel"
                className="w-full px-4 py-2.5 bg-[var(--bg-main)] border border-[var(--card-border)] rounded-xl text-xs font-medium text-[var(--text-primary)] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 transition"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Comma-separated tags representing your core specialties.
              </p>
            </div>

          </div>
        </div>

        {/* Section 3: Security & Password Change */}
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="border-b border-[var(--card-border)] pb-4">
            <h3 className="text-base font-black text-[var(--text-primary)] flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-purple-500" />
              <span>Security & Password Update</span>
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Leave password fields empty if you do not wish to change your password.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            
            {/* Current Password */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                Current Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showCurrentPass ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-[var(--bg-main)] border border-[var(--card-border)] rounded-xl text-xs font-medium text-[var(--text-primary)] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPass(!showCurrentPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                New Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showNewPass ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="w-full pl-10 pr-10 py-2.5 bg-[var(--bg-main)] border border-[var(--card-border)] rounded-xl text-xs font-medium text-[var(--text-primary)] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPass(!showNewPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showConfirmPass ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className="w-full pl-10 pr-10 py-2.5 bg-[var(--bg-main)] border border-[var(--card-border)] rounded-xl text-xs font-medium text-[var(--text-primary)] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPass(!showConfirmPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={fetchProfile}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] text-xs font-bold transition cursor-pointer"
          >
            Reset Changes
          </button>

          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white text-xs font-extrabold shadow-lg shadow-sky-500/20 transition flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Saving Profile...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Profile Changes</span>
              </>
            )}
          </button>
        </div>

      </form>

    </div>
  );
}
