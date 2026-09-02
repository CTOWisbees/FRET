'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import Link from 'next/link';
import { 
  FileText, 
  Download, 
  Send, 
  CheckCircle2, 
  Info, 
  Mail, 
  X, 
  FileCheck, 
  ListOrdered,
  Calendar,
  Heading,
  Table,
  GraduationCap,
  Scale,
  PenTool,
  Edit3,
  ImageIcon
} from 'lucide-react';
import { api, getApiUrl } from '@/lib/api';

const DEFAULT_ROLES = [
  "IT Intern – Web & Automation Developer",
  "Equity Research Intern",
  "HR Intern",
  "Legal, Secretarial and Compliance Intern",
  "Digital Marketing Intern",
  "Finance Content Writer Intern",
  "Wealth Management Intern",
  "Research and Content Analyst Intern"
];

const PDF_CONTENTS = [
  { label: "Letterhead as full-page background", icon: "fa-image" },
  { label: "Date & Reference number", icon: "fa-calendar" },
  { label: "Subject line with role name", icon: "fa-heading" },
  { label: "Employee details table", icon: "fa-table-cells" },
  { label: "Role-specific responsibilities", icon: "fa-list-ul" },
  { label: "Eligibility requirements", icon: "fa-graduation-cap" },
  { label: "Terms & conditions", icon: "fa-scale-balanced" },
  { label: "HR name & digital signature", icon: "fa-pen-nib" },
  { label: "Acceptance signature block", icon: "fa-pen-to-square" },
];

export default function OfferLetterPage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [roles, setRoles] = useState<string[]>(DEFAULT_ROLES);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  
  // HR & Company status
  const [hrUser, setHrUser] = useState<any>({ name: 'Hr test', designation: 'HR Manager', has_signature: true });
  const [hasLetterhead, setHasLetterhead] = useState(true);
  const [loading, setLoading] = useState(false);

  // Email Sender Modal State
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [modalEmpId, setModalEmpId] = useState('');
  const [modalRole, setModalRole] = useState('');
  const [offerRoleTitle, setOfferRoleTitle] = useState('');
  const [offerFullText, setOfferFullText] = useState('');
  const [offerEmailBody, setOfferEmailBody] = useState('');
  const [ccJd, setCcJd] = useState(false);
  const [ccGouri, setCcGouri] = useState(false);
  const [ccCto, setCcCto] = useState(false);
  const [extraCcInput, setExtraCcInput] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [empRes, rolesRes, settingsRes, profileRes] = await Promise.allSettled([
          api.get('/api/employees-list'),
          api.get('/offer-letter/roles'),
          api.get('/settings', { headers: { Accept: 'application/json' } }),
          api.get('/profile', { headers: { Accept: 'application/json' } }),
        ]);

        if (empRes.status === 'fulfilled' && empRes.value.data) {
          setEmployees(empRes.value.data);
        }
        if (rolesRes.status === 'fulfilled' && rolesRes.value.data?.roles) {
          setRoles(rolesRes.value.data.roles);
        }
        if (settingsRes.status === 'fulfilled' && settingsRes.value.data?.company) {
          setHasLetterhead(Boolean(settingsRes.value.data.company.has_letterhead));
        }
        if (profileRes.status === 'fulfilled' && profileRes.value.data?.user) {
          setHrUser(profileRes.value.data.user);
        }
      } catch (e) {
        console.error('Error fetching offer letter data:', e);
      }
    };
    fetchData();
  }, []);

  const handleGeneratePdf = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpId) {
      alert('Please select an employee');
      return;
    }
    if (!selectedRole) {
      alert('Please select an internship role');
      return;
    }

    const url = getApiUrl(`/generate-offer-letter?emp_id=${selectedEmpId}&role_key=${encodeURIComponent(selectedRole)}`);
    window.open(url, '_blank');
  };

  const openEmailSender = async () => {
    setModalEmpId(selectedEmpId || (employees[0]?.id ? String(employees[0].id) : ''));
    const initialRole = selectedRole || roles[0] || '';
    setModalRole(initialRole);
    setShowEmailModal(true);

    if (initialRole) {
      await loadDraftForModal(selectedEmpId || employees[0]?.id, initialRole);
    }
  };

  const loadDraftForModal = async (empId: any, role: string) => {
    if (!role) return;
    try {
      const res = await api.get(`/offer-letter/draft?role=${encodeURIComponent(role)}&emp_id=${empId || ''}`);
      if (res.data) {
        setOfferRoleTitle(res.data.role_title || role);
        setOfferFullText(res.data.full_text || '');
        setOfferEmailBody(res.data.email_body || '');
      }
    } catch (e) {
      console.error('Failed to load offer draft:', e);
    }
  };

  const handleModalRoleChange = async (newRole: string) => {
    setModalRole(newRole);
    await loadDraftForModal(modalEmpId, newRole);
  };

  const handleSendEmail = async () => {
    if (!modalEmpId) {
      alert('Please select an employee');
      return;
    }
    setSendingEmail(true);
    try {
      const ccList: string[] = [];
      if (ccJd) ccList.push('jd@wisbees.com');
      if (ccGouri) ccList.push('gouri@wisbees.com');
      if (ccCto) ccList.push('cto@wisbees.com');
      if (extraCcInput.trim()) {
        extraCcInput.split(',').forEach(s => {
          const trimmed = s.trim();
          if (trimmed) ccList.push(trimmed);
        });
      }

      const payload = {
        emp_id: modalEmpId,
        type: 'offer',
        role_key: modalRole,
        role_title: offerRoleTitle,
        full_text: offerFullText,
        email_body: offerEmailBody,
        cc_emails: ccList,
      };

      const res = await api.post('/send-email', payload);
      if (res.data?.success) {
        alert('Offer letter and NDA email dispatched successfully via Microsoft Graph API!');
        setShowEmailModal(false);
      } else {
        alert(res.data?.message || 'Failed to send email');
      }
    } catch (e: any) {
      console.error(e);
      alert(e.response?.data?.message || 'Error sending email');
    } finally {
      setSendingEmail(false);
    }
  };

  const selectedEmp = employees.find(e => String(e.id) === String(selectedEmpId));

  return (
    <div className="flex min-h-screen bg-[var(--bg)] text-[var(--text)] font-sans">
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header title="Offer Letters" onMenuClick={() => setMobileOpen(true)} />

        <main className="p-4 sm:p-8 flex-1 overflow-y-auto space-y-6 max-w-5xl w-full">
          {/* Page Header */}
          <div>
            <h1 className="text-2xl font-extrabold text-[var(--text)] tracking-tight font-['Plus_Jakarta_Sans']">
              Generate Offer Letter
            </h1>
            <p className="text-[var(--text3)] text-sm mt-1">
              PDF with letterhead background · signature auto-applied · role-specific content
            </p>
          </div>

          {/* 2-Column Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            
            {/* ────────── LEFT COLUMN: Generate PDF Letter Card ────────── */}
            <div className="stat-card p-6 sm:p-8 space-y-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
              <div>
                <div className="font-bold text-base text-[var(--text)] flex items-center gap-2">
                  <i className="fas fa-file-pdf text-[#10b981] text-lg"></i>
                  <span>Generate PDF Letter</span>
                </div>
                <p className="text-xs text-[var(--text3)] mt-1 leading-relaxed">
                  Select employee and role — PDF downloads instantly with your letterhead & signature.
                </p>
              </div>

              {/* Letterhead Status Banner */}
              {hasLetterhead ? (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 rounded-xl text-xs font-semibold flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>Letterhead ready — will appear as background on every page.</span>
                </div>
              ) : (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded-xl text-xs font-semibold flex items-center space-x-2">
                  <Info className="w-4 h-4 flex-shrink-0" />
                  <span>
                    No letterhead uploaded yet.{' '}
                    <Link href="/settings" className="underline font-bold text-amber-700 dark:text-amber-300">
                      Upload in Settings →
                    </Link>
                  </span>
                </div>
              )}

              {/* PDF Generation Form */}
              <form onSubmit={handleGeneratePdf} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[var(--text)] mb-1.5">
                    Select Employee *
                  </label>
                  <select
                    required
                    value={selectedEmpId}
                    onChange={(e) => setSelectedEmpId(e.target.value)}
                    className="form-control text-sm w-full"
                  >
                    <option value="">— Choose an employee —</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} {emp.emp_id ? `· ${emp.emp_id}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text)] mb-1.5">
                    Internship Role / Category *
                  </label>
                  <select
                    required
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="form-control text-sm w-full"
                  >
                    <option value="">— Select role —</option>
                    {roles.map((role) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>

                {/* SIGNED BY Box */}
                <div className="bg-[var(--surface2)] border border-[var(--border)] rounded-xl p-3.5 space-y-2">
                  <div className="text-[0.7rem] font-bold text-[var(--text3)] uppercase tracking-wider">
                    SIGNED BY
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#0e9f6e] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                        {hrUser?.name ? hrUser.name[0].toUpperCase() : 'H'}
                      </div>
                      <div>
                        <div className="font-bold text-xs sm:text-sm text-[var(--text)] leading-tight">
                          {hrUser?.name || 'Hr test'}
                        </div>
                        <div className="text-[0.7rem] text-[var(--text3)]">
                          {hrUser?.designation || 'HR Manager'}
                        </div>
                      </div>
                    </div>
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-[0.7rem] font-semibold flex-shrink-0">
                      <i className="fas fa-leaf text-[0.6rem]"></i>
                      <span>Sig ready</span>
                    </div>
                  </div>
                </div>

                {/* Big Green Generate Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-[#0e9f6e] hover:bg-[#057a55] text-white font-bold text-sm rounded-xl shadow-md flex items-center justify-center gap-2 transition"
                >
                  <i className="fas fa-file-pdf"></i>
                  <span>Generate & Download PDF</span>
                </button>
              </form>
            </div>

            {/* ────────── RIGHT COLUMN: Roles, PDF Contents, Email Documents ────────── */}
            <div className="space-y-5">
              
              {/* Card 1: Available Roles */}
              <div className="stat-card p-5 sm:p-6 space-y-3.5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
                <div className="font-bold text-sm text-[var(--text)] flex items-center gap-2 border-b border-[var(--border)] pb-3">
                  <i className="fas fa-list-check text-[#10b981]"></i>
                  <span>Available Roles</span>
                </div>
                <div className="space-y-1.5">
                  {roles.map((rk, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedRole(rk)}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition cursor-pointer ${
                        selectedRole === rk 
                          ? 'bg-[var(--primary)]/10 text-[var(--primary)] font-bold border border-[var(--primary)]/20' 
                          : 'bg-[var(--surface2)] text-[var(--text)] hover:bg-[var(--hover)]'
                      }`}
                    >
                      <i className="fas fa-circle text-[#10b981] text-[0.4rem]"></i>
                      <span className="truncate">{rk}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Card 2: PDF Contents */}
              <div className="stat-card p-5 sm:p-6 space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
                <div className="font-bold text-sm text-[var(--text)] flex items-center gap-2 border-b border-[var(--border)] pb-3">
                  <i className="fas fa-circle-info text-[#10b981]"></i>
                  <span>PDF Contents</span>
                </div>
                <div className="space-y-2">
                  {PDF_CONTENTS.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2.5 text-xs text-[var(--text2)]">
                      <i className={`fas ${item.icon} text-emerald-500 w-4 text-center text-xs flex-shrink-0`}></i>
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Card 3: Email Documents */}
              <div className="stat-card p-5 sm:p-6 space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
                <div className="font-bold text-sm text-[var(--text)] flex items-center gap-2 border-b border-[var(--border)] pb-3">
                  <i className="fas fa-paper-plane text-[#10b981]"></i>
                  <span>Email Documents</span>
                </div>
                <p className="text-xs text-[var(--text3)] leading-relaxed">
                  Send offer letter + NDA directly to the employee's inbox.
                </p>
                <button
                  type="button"
                  onClick={openEmailSender}
                  className="btn btn-secondary w-full py-2.5 flex items-center justify-center gap-2 text-xs font-semibold"
                >
                  <i className="fas fa-envelope"></i>
                  <span>Open Email Sender</span>
                </button>
              </div>

            </div>
          </div>
        </main>
      </div>

      {/* ────────── EMAIL SENDER MODAL ────────── */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="font-bold text-base text-[var(--text)] flex items-center gap-2">
                <i className="fas fa-envelope-open-text text-[#10b981]"></i>
                <span>Send Offer Letter & NDA via Email</span>
              </div>
              <button
                type="button"
                onClick={() => setShowEmailModal(false)}
                className="p-1 rounded-lg text-[var(--text3)] hover:text-[var(--text)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[var(--text)] mb-1">Select Candidate *</label>
                  <select
                    value={modalEmpId}
                    onChange={(e) => {
                      setModalEmpId(e.target.value);
                      loadDraftForModal(e.target.value, modalRole);
                    }}
                    className="form-control text-sm w-full"
                  >
                    <option value="">— Select Candidate —</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.email || 'No email'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text)] mb-1">Role / Profile *</label>
                  <select
                    value={modalRole}
                    onChange={(e) => handleModalRoleChange(e.target.value)}
                    className="form-control text-sm w-full"
                  >
                    {roles.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text)] mb-1">Role Title in Letter</label>
                <input
                  type="text"
                  value={offerRoleTitle}
                  onChange={(e) => setOfferRoleTitle(e.target.value)}
                  className="form-control text-sm w-full"
                  placeholder="e.g. IT Intern"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text)] mb-1">Email Body</label>
                <textarea
                  rows={4}
                  value={offerEmailBody}
                  onChange={(e) => setOfferEmailBody(e.target.value)}
                  className="form-control text-xs w-full font-mono"
                  placeholder="Dear candidate..."
                />
              </div>

              {/* CC Recipients */}
              <div className="p-3 bg-[var(--surface2)] rounded-xl border border-[var(--border)] space-y-2">
                <div className="text-xs font-bold text-[var(--text)]">CC Recipients</div>
                <div className="flex flex-wrap gap-4 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={ccJd} onChange={e => setCcJd(e.target.checked)} className="rounded" />
                    <span>jd@wisbees.com</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={ccGouri} onChange={e => setCcGouri(e.target.checked)} className="rounded" />
                    <span>gouri@wisbees.com</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={ccCto} onChange={e => setCcCto(e.target.checked)} className="rounded" />
                    <span>cto@wisbees.com</span>
                  </label>
                </div>
                <input
                  type="text"
                  value={extraCcInput}
                  onChange={e => setExtraCcInput(e.target.value)}
                  placeholder="Additional CC emails (comma separated)"
                  className="form-control text-xs w-full mt-2"
                />
              </div>

              {/* Attached documents info */}
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 rounded-xl text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>
                  <strong>Attachments:</strong> Auto-generated Offer Letter PDF & WisBees NDA will be attached automatically.
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setShowEmailModal(false)}
                className="btn btn-secondary text-xs px-4 py-2"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={sendingEmail}
                onClick={handleSendEmail}
                className="btn btn-primary text-xs px-5 py-2 flex items-center gap-2"
              >
                {sendingEmail ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Dispatch Email via Microsoft Graph</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
