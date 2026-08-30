'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import Link from 'next/link';
import { Building, Mail, Paperclip, Save, Upload, CheckCircle2, Info, Lock, ExternalLink, Image as ImageIcon, FileText, FileCheck } from 'lucide-react';
import { api } from '@/lib/api';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'company' | 'email' | 'documents'>('company');
  const [mobileOpen, setMobileOpen] = useState(false);

  // Company State
  const [companyName, setCompanyName] = useState('Timearrow Pvt Ltd(Wisbees)');
  const [address, setAddress] = useState('Mumbai, Maharashtra 400001');
  const [email, setEmail] = useState('info@wisbees.com');
  const [phone, setPhone] = useState('+91 7977073233');
  const [hasLetterhead, setHasLetterhead] = useState(true);
  const [hasNda, setHasNda] = useState(true);
  const [ndaFilename, setNdaFilename] = useState('WisBees_NDA.pdf');

  // Microsoft Graph Email State
  const [senderEmail, setSenderEmail] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');

  // Status & Loading
  const [loading, setLoading] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  const fetchSettings = async () => {
    try {
      const res = await api.get('/settings', {
        headers: { Accept: 'application/json' }
      });
      if (res.data) {
        if (res.data.config) {
          setSenderEmail(res.data.config.sender_email || '');
          setTenantId(res.data.config.tenant_id || '');
          setClientId(res.data.config.client_id || '');
        }
        if (res.data.company) {
          setCompanyName(res.data.company.company_name || 'Timearrow Pvt Ltd(Wisbees)');
          setAddress(res.data.company.company_address || 'Mumbai, Maharashtra 400001');
          setEmail(res.data.company.company_email || 'info@wisbees.com');
          setPhone(res.data.company.company_phone || '+91 7977073233');
          setHasLetterhead(Boolean(res.data.company.has_letterhead));
          setHasNda(Boolean(res.data.company.has_nda));
          if (res.data.company.nda_filename) {
            setNdaFilename(res.data.company.nda_filename);
          }
        }
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('company_name', companyName);
      formData.append('company_address', address);
      formData.append('company_email', email);
      formData.append('company_phone', phone);

      await api.post('/settings/company', formData);
      setSaveSuccessMsg('Company settings saved successfully!');
      setTimeout(() => setSaveSuccessMsg(''), 4000);
      fetchSettings();
    } catch (e: any) {
      console.error(e);
      alert(e.response?.data?.message || 'Failed to save company settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        sender_email: senderEmail.trim(),
        tenant_id: tenantId.trim(),
        client_id: clientId.trim(),
        client_secret: clientSecret.trim(),
      };

      await api.post('/settings/email', payload);
      setSaveSuccessMsg('Microsoft Graph API settings saved successfully!');
      setClientSecret('');
      setTimeout(() => setSaveSuccessMsg(''), 4000);
      fetchSettings();
    } catch (e: any) {
      console.error(e);
      alert(e.response?.data?.message || 'Failed to save email settings');
    } finally {
      setLoading(false);
    }
  };

  const handleLetterheadUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('letterhead_file', file);
      await api.post('/settings/company', formData);
      alert('Letterhead uploaded successfully!');
      fetchSettings();
    } catch (err: any) {
      console.error(err);
      alert('Failed to upload letterhead');
    } finally {
      setLoading(false);
    }
  };

  const handleNdaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('nda_file', file);
      await api.post('/settings/company', formData);
      alert('NDA Document uploaded successfully!');
      fetchSettings();
    } catch (err: any) {
      console.error(err);
      alert('Failed to upload NDA document');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[var(--bg)] text-[var(--text)] font-sans">
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header title="Settings" onMenuClick={() => setMobileOpen(true)} />

        <main className="p-4 sm:p-8 flex-1 overflow-y-auto space-y-6 max-w-5xl w-full">
          {/* Page Header */}
          <div>
            <h1 className="text-2xl font-extrabold text-[var(--text)] tracking-tight font-['Plus_Jakarta_Sans']">
              Settings
            </h1>
            <p className="text-[var(--text3)] text-sm mt-1">
              Configure company info, letterhead, email & documents
            </p>
          </div>

          {/* Flash message */}
          {saveSuccessMsg && (
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 rounded-xl text-xs font-semibold flex items-center space-x-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{saveSuccessMsg}</span>
            </div>
          )}

          {/* Segmented Tab Bar */}
          <div className="tab-bar inline-flex bg-[var(--toggle-bg)] p-1 rounded-xl border border-[var(--border)] gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('company')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === 'company'
                  ? 'bg-[var(--toggle-active)] text-[var(--text)] shadow-sm'
                  : 'text-[var(--text3)] hover:text-[var(--text)]'
              }`}
            >
              <span className="text-sm">🏢</span>
              <span>Company</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('email')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === 'email'
                  ? 'bg-[var(--toggle-active)] text-[var(--text)] shadow-sm'
                  : 'text-[var(--text3)] hover:text-[var(--text)]'
              }`}
            >
              <span className="text-sm">📧</span>
              <span>Email</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('documents')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === 'documents'
                  ? 'bg-[var(--toggle-active)] text-[var(--text)] shadow-sm'
                  : 'text-[var(--text3)] hover:text-[var(--text)]'
              }`}
            >
              <span className="text-sm">📎</span>
              <span>Documents</span>
            </button>
          </div>

          {/* ────────── 1. COMPANY TAB ────────── */}
          {activeTab === 'company' && (
            <div className="space-y-6">
              {/* Card 1: Company Details */}
              <form onSubmit={handleSaveCompany} className="stat-card p-6 space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
                <div className="font-bold text-sm text-[var(--text)] border-b border-[var(--border)] pb-3 flex items-center gap-2">
                  <Building className="w-4 h-4 text-[var(--accent)]" /> 
                  <span>Company Details</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text3)] mb-1">Company Name</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="form-control text-sm w-full"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text3)] mb-1">Registered Address</label>
                  <textarea
                    rows={3}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="form-control text-sm w-full"
                    style={{ resize: 'vertical' }}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text3)] mb-1">Company Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="form-control text-sm w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text3)] mb-1">Company Phone</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="form-control text-sm w-full"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-primary text-xs sm:text-sm font-semibold flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Company Settings</span>
                  </button>
                </div>
              </form>

              {/* Card 2: Company Letterhead */}
              <div className="stat-card p-6 space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
                <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                  <div className="font-bold text-sm text-[var(--text)] flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-[var(--accent)]" /> 
                    <span>Company Letterhead</span>
                    <span className="hidden sm:inline-block text-xs text-[var(--text3)] font-normal ml-2">
                      Used as background on every offer letter PDF
                    </span>
                  </div>
                </div>

                {/* Status banner */}
                {hasLetterhead ? (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 rounded-xl text-xs font-semibold flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span>Letterhead uploaded and active. <strong>All offer letter PDFs</strong> will use this as the background.</span>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded-xl text-xs font-semibold flex items-center space-x-2">
                    <Info className="w-4 h-4 flex-shrink-0" />
                    <span>No letterhead uploaded yet. Please upload one below to ensure PDF background generation works.</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-[var(--text3)] mb-2 uppercase tracking-wider">CURRENT LETTERHEAD</label>
                  <div className="w-44 h-60 sm:w-48 sm:h-64 border border-[var(--border)] rounded-xl p-2 bg-white shadow-md flex items-center justify-center overflow-hidden">
                    <img 
                      src="/letterhead.png" 
                      onError={(e) => (e.currentTarget.src = 'http://localhost:8000/static/letterhead.png')} 
                      alt="Company Letterhead Preview" 
                      className="w-full h-full object-contain rounded-lg" 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text3)] mb-2">
                    {hasLetterhead ? 'Replace Letterhead' : 'Upload Letterhead'}
                  </label>
                  <label className="block p-8 border-2 border-dashed border-[var(--border)] rounded-xl text-center bg-[var(--surface2)] cursor-pointer hover:border-[var(--accent)] transition">
                    <Upload className="w-9 h-9 text-[var(--accent)] mx-auto mb-2" />
                    <div className="font-bold text-sm text-[var(--text)]">Click or drag to upload letterhead</div>
                    <div className="text-xs text-[var(--text3)] mt-1">
                      PNG, JPG — A4 size recommended (2480 × 3508 px) · Max 5MB<br />
                      Upload once — reused for all future offer letters automatically
                    </div>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleLetterheadUpload} 
                    />
                  </label>
                </div>

                <div className="p-3 bg-[var(--bg3)] rounded-xl text-xs text-[var(--text3)] flex items-center gap-2">
                  <Info className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  <span>Tip: Use a PNG with transparent content area so the text sits cleanly on top. The letterhead will be stretched to fill the full A4 page.</span>
                </div>
              </div>
            </div>
          )}

          {/* ────────── 2. EMAIL TAB (IMAGE 1) ────────── */}
          {activeTab === 'email' && (
            <div className="stat-card p-6 sm:p-8 space-y-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
              {/* Section Header */}
              <div className="font-bold text-base text-[var(--text)] flex items-center gap-2 border-b border-[var(--border)] pb-4">
                <i className="fab fa-microsoft text-[#10b981] text-lg"></i>
                <span>Microsoft Graph API Email Configuration</span>
              </div>

              {/* Info Banner */}
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 text-blue-900 dark:text-blue-200 rounded-xl text-xs sm:text-sm flex items-start gap-2.5 leading-relaxed">
                <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  Requires an App Registration in the <strong className="font-bold text-[var(--text)]">Microsoft Entra Admin Center</strong> (formerly Azure AD).<br />
                  Ensure the app registration has the application-level permission <strong className="font-bold text-[var(--text)]">Mail.Send</strong> granted and consented by an admin.
                </div>
              </div>

              {/* Form Grid (2x2) */}
              <form onSubmit={handleSaveEmail} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-[var(--text)] mb-1.5">
                      Sender Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={senderEmail}
                      onChange={(e) => setSenderEmail(e.target.value)}
                      placeholder="info@wisbees.com"
                      className="form-control text-sm w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[var(--text)] mb-1.5">
                      Directory (Tenant) ID *
                    </label>
                    <input
                      type="text"
                      required
                      value={tenantId}
                      onChange={(e) => setTenantId(e.target.value)}
                      placeholder="9f42dafb-dad2-467b-a1bc-b32ce17e5c06"
                      className="form-control text-sm w-full font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[var(--text)] mb-1.5">
                      Application (Client) ID *
                    </label>
                    <input
                      type="text"
                      required
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      placeholder="5f0c2110-bf29-492c-8102-970e4065b002"
                      className="form-control text-sm w-full font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[var(--text)] mb-1.5">
                      Client Secret *
                    </label>
                    <input
                      type="password"
                      value={clientSecret}
                      onChange={(e) => setClientSecret(e.target.value)}
                      placeholder="Leave blank to keep existing / Enter new secret value"
                      className="form-control text-sm w-full"
                    />
                  </div>
                </div>

                {/* Save Button bottom right */}
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-primary px-5 py-2.5 text-sm font-semibold flex items-center gap-2 shadow-md"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Save Microsoft Config</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ────────── 3. DOCUMENTS TAB (IMAGE 2) ────────── */}
          {activeTab === 'documents' && (
            <div className="stat-card p-6 sm:p-8 space-y-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
              {/* Section Header */}
              <div className="font-bold text-base text-[var(--text)] flex items-center gap-2 border-b border-[var(--border)] pb-4">
                <i className="fas fa-folder-open text-[#10b981] text-lg"></i>
                <span>Document Storage</span>
              </div>

              {/* Document Storage Cards Grid */}
              <div className="space-y-4">
                {/* 1. Company Letterhead Card */}
                <div className="bg-[var(--surface2)] border border-[var(--border)] rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4 transition hover:border-[var(--accent)]/30">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center flex-shrink-0 text-xl">
                      <ImageIcon className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-sm sm:text-base text-[var(--text)]">Company Letterhead</div>
                      <div className="text-xs text-[var(--text3)] truncate">Background image for all offer letter PDFs</div>
                      <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5 mt-1">
                        <i className="fas fa-circle text-[0.45rem]"></i>
                        <span>Uploaded & active</span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('company')}
                    className="btn btn-secondary btn-sm flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold"
                  >
                    <i className="fas fa-arrow-up-from-bracket text-xs"></i>
                    <span>Manage</span>
                  </button>
                </div>

                {/* 2. NDA Document Card */}
                <div className="bg-[var(--surface2)] border border-[var(--border)] rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4 transition hover:border-[var(--accent)]/30">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center flex-shrink-0 text-xl font-bold">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-sm sm:text-base text-[var(--text)]">NDA Document</div>
                      <div className="text-xs text-[var(--text3)] truncate">Non-Disclosure Agreement — emailed with offer</div>
                      <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5 mt-1">
                        <i className="fas fa-circle text-[0.45rem]"></i>
                        <span>Uploaded & ready to send</span>
                      </div>
                    </div>
                  </div>
                  <label className="btn btn-secondary btn-sm flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold cursor-pointer">
                    <i className="fas fa-arrow-up-from-bracket text-xs"></i>
                    <span>Replace</span>
                    <input 
                      type="file" 
                      accept=".pdf" 
                      className="hidden" 
                      onChange={handleNdaUpload} 
                    />
                  </label>
                </div>

                {/* 3. Offer Letter PDFs Card */}
                <div className="bg-[var(--surface2)] border border-[var(--border)] rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4 transition hover:border-[var(--accent)]/30">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center flex-shrink-0 text-xl">
                      <FileCheck className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-sm sm:text-base text-[var(--text)]">Offer Letter PDFs</div>
                      <div className="text-xs text-[var(--text3)] truncate">Generated on-demand · 7 role categories · letterhead + signature</div>
                      <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5 mt-1">
                        <i className="fas fa-circle text-[0.45rem]"></i>
                        <span>Dynamic generation active</span>
                      </div>
                    </div>
                  </div>
                  <Link
                    href="/offer-letter"
                    className="btn btn-secondary btn-sm flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Generate</span>
                  </Link>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
