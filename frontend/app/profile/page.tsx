'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import {
  User, Mail, Phone, Briefcase, Calendar, Shield,
  CreditCard, Droplet, Camera, Key, Check, AlertCircle,
  FileSignature, Upload, RefreshCw, X, Printer, Download, FileText
} from 'lucide-react';
import { api, getApiUrl } from '@/lib/api';
import JsBarcode from 'jsbarcode';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [isHr, setIsHr] = useState<boolean | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const router = useRouter();

  // Employee Profile State
  const [employee, setEmployee] = useState<any>(null);
  const [selectedBloodGroup, setSelectedBloodGroup] = useState<string>('');
  const [savingBloodGroup, setSavingBloodGroup] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showIdCardModal, setShowIdCardModal] = useState(false);
  const [downloadingImage, setDownloadingImage] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [ndaSignature, setNdaSignature] = useState('');
  const [ndaAgreed, setNdaAgreed] = useState(false);
  const [ndaFile, setNdaFile] = useState<File | null>(null);
  const [ndaFileDragOver, setNdaFileDragOver] = useState(false);
  const [isReuploadingNda, setIsReuploadingNda] = useState(false);
  const [submittingNda, setSubmittingNda] = useState(false);
  const [ndaSubmitted, setNdaSubmitted] = useState<boolean | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ndaFileInputRef = useRef<HTMLInputElement>(null);
  const modalCardRef = useRef<HTMLDivElement>(null);
  const modalBarcodeRef = useRef<SVGSVGElement>(null);

  // HR Profile State
  const [hrUser, setHrUser] = useState<any>(null);
  const [hrName, setHrName] = useState('');
  const [hrPhone, setHrPhone] = useState('');
  const [hrDesignation, setHrDesignation] = useState('');
  const [hrNewPassword, setHrNewPassword] = useState('');
  const [hrConfirmPassword, setHrConfirmPassword] = useState('');
  const [sigFile, setSigFile] = useState<File | null>(null);
  const [sigPreview, setSigPreview] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [savingHr, setSavingHr] = useState(false);

  // Preload cached user from storage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('fret_user');
      if (saved) {
        const u = JSON.parse(saved);
        if (u.role === 'employee' || u.emp_type) {
          setIsHr(false);
          setEmployee(u);
          if (u.blood_group) setSelectedBloodGroup(u.blood_group);
        } else if (u.role === 'hr') {
          setIsHr(true);
          setHrUser(u);
          setHrName(u.name || '');
          setHrPhone(u.phone || '');
          setHrDesignation(u.designation || 'HR Manager');
        }
      }
    } catch (e) {}
  }, []);

  // Fetch current user profile
  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await api.get('/profile');
      if (res.data) {
        setIsHr(res.data.is_hr ?? false);
        if (res.data.is_hr) {
          setHrUser(res.data.user);
          setHrName(res.data.user?.name || '');
          setHrPhone(res.data.user?.phone || '');
          setHrDesignation(res.data.user?.designation || 'HR Manager');
        } else {
          setEmployee(res.data.employee);
          if (res.data.employee?.blood_group) {
            setSelectedBloodGroup(res.data.employee.blood_group);
          }
          if (res.data.employee) {
            localStorage.setItem('fret_user', JSON.stringify(res.data.employee));
          }
        }
      }
    } catch (e: any) {
      console.error('Failed to load profile:', e);
      try {
        const empRes = await api.get('/api/employee/me');
        if (empRes.data?.authenticated) {
          setIsHr(false);
          setEmployee(empRes.data);
          if (empRes.data?.blood_group) {
            setSelectedBloodGroup(empRes.data.blood_group);
          }
          localStorage.setItem('fret_user', JSON.stringify(empRes.data));
        }
      } catch (err) {
        console.error('Auth check error:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  // Code128 Barcode Renderer for ID Card Modal
  useEffect(() => {
    if (showIdCardModal && modalBarcodeRef.current && employee) {
      const renderBarcode = () => {
        try {
          const barcodeVal = employee.emp_id || `WB${1000 + (employee.id || 1)}`;
          JsBarcode(modalBarcodeRef.current, barcodeVal, {
            format: 'CODE128',
            displayValue: false,
            lineColor: '#000000',
            width: 1.5,
            height: 38,
            margin: 0,
          });
        } catch (e) {
          console.error('Barcode error:', e);
        }
      };

      renderBarcode();
      const t = setTimeout(renderBarcode, 50);
      return () => clearTimeout(t);
    }
  }, [showIdCardModal, employee]);

  const showAlert = (text: string, type: 'success' | 'error' = 'success') => {
    setAlertMsg({ type, text });
    setTimeout(() => setAlertMsg(null), 4000);
  };

  // Employee: Save Blood Group
  const handleSaveBloodGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBloodGroup) {
      showAlert('Please select a valid blood group.', 'error');
      return;
    }
    setSavingBloodGroup(true);
    try {
      const res = await api.post('/profile/update', {
        blood_group: selectedBloodGroup
      });
      if (res.data?.success) {
        showAlert('Blood group updated successfully!');
        if (employee) {
          const updated = { ...employee, blood_group: selectedBloodGroup };
          setEmployee(updated);
          localStorage.setItem('fret_user', JSON.stringify(updated));
        }
      }
    } catch (err: any) {
      console.error(err);
      showAlert(err.response?.data?.message || 'Failed to update blood group.', 'error');
    } finally {
      setSavingBloodGroup(false);
    }
  };

  // Employee: Upload Profile Picture
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);

    try {
      const formData = new FormData();
      formData.append('profile_pic', file);

      const res = await api.post('/profile/update', formData);
      if (res.data?.success) {
        showAlert('Profile photo updated successfully!');
        await fetchProfile();
      }
    } catch (err: any) {
      console.error(err);
      showAlert('Failed to upload profile photo.', 'error');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Employee: Submit NDA (with signed document upload)
  const handleSubmitNda = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ndaAgreed) {
      showAlert('Please check the box to confirm you agree with the NDA terms.', 'error');
      return;
    }
    const sig = ndaSignature.trim() || employee?.name || 'Employee Signature';
    setSubmittingNda(true);
    try {
      const formData = new FormData();
      formData.append('signature_name', sig);
      formData.append('agreed', 'true');
      if (ndaFile) {
        formData.append('nda_file', ndaFile);
      }

      const res = await api.post('/api/nda/submit', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data?.success) {
        showAlert('Non-Disclosure Agreement (NDA) successfully submitted, signed, and uploaded!');
        setNdaSubmitted(true);
        setIsReuploadingNda(false);
        if (employee) {
          const updated = {
            ...employee,
            nda_submitted: true,
            nda_signature: sig,
            nda_submitted_at: res.data.nda_submitted_at || new Date().toLocaleDateString('en-GB'),
            nda_doc_name: res.data.nda_doc_name || ndaFile?.name || employee.nda_doc_name,
            has_nda_doc: Boolean(res.data.has_nda_doc || ndaFile)
          };
          setEmployee(updated);
          localStorage.setItem('fret_user', JSON.stringify(updated));
        }
        await fetchProfile();
      } else {
        showAlert(res.data?.message || 'Failed to submit NDA.', 'error');
      }
    } catch (err: any) {
      console.error('NDA submit error:', err);
      showAlert(err.response?.data?.message || 'Failed to submit NDA agreement.', 'error');
    } finally {
      setSubmittingNda(false);
    }
  };

  // HR: Save Profile
  const handleHrSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hrNewPassword && hrNewPassword !== hrConfirmPassword) {
      showAlert('Passwords do not match!', 'error');
      return;
    }
    setSavingHr(true);
    try {
      const formData = new FormData();
      formData.append('name', hrName);
      formData.append('phone', hrPhone);
      formData.append('designation', hrDesignation);
      if (hrNewPassword) formData.append('new_password', hrNewPassword);
      if (sigFile) formData.append('signature', sigFile);

      await api.post('/profile', formData);
      showAlert('HR profile updated successfully!');
      setHrNewPassword('');
      setHrConfirmPassword('');
      await fetchProfile();
    } catch (e: any) {
      console.error(e);
      showAlert('Failed to save HR profile.', 'error');
    } finally {
      setSavingHr(false);
    }
  };

  const handlePrintIdCard = async () => {
    const cardElement = modalCardRef.current;
    if (!cardElement) {
      window.print();
      return;
    }

    try {
      const canvas = await html2canvas(cardElement, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
      });
      const imgData = canvas.toDataURL('image/png');

      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (!doc) {
        window.print();
        return;
      }

      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>ID Card - ${employee?.name || 'Employee'}</title>
            <style>
              @page {
                size: A4 portrait;
                margin: 20mm;
              }
              body {
                margin: 0;
                padding: 0;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-height: 80vh;
                background: #ffffff;
              }
              .card-container {
                display: flex;
                justify-content: center;
                align-items: center;
                padding: 20px;
              }
              img {
                max-width: 320px;
                height: auto;
                display: block;
              }
            </style>
          </head>
          <body>
            <div class="card-container">
              <img src="${imgData}" />
            </div>
          </body>
        </html>
      `);
      doc.close();

      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 2000);
      }, 400);
    } catch (e) {
      console.error('Print error:', e);
      window.print();
    }
  };

  const handleDownloadImage = async () => {
    if (!modalCardRef.current) return;
    setDownloadingImage(true);
    try {
      const canvas = await html2canvas(modalCardRef.current, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
      });
      const imageURL = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = imageURL;
      const empName = (employee?.name || 'employee').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      link.download = `${empName}_id_card.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showAlert('ID Card image downloaded successfully!');
    } catch (err) {
      console.error('Download image error:', err);
      showAlert('Failed to generate ID Card image.', 'error');
    } finally {
      setDownloadingImage(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!modalCardRef.current) return;
    setDownloadingPdf(true);
    try {
      const canvas = await html2canvas(modalCardRef.current, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
      });
      const imgData = canvas.toDataURL('image/png');
      
      // Calculate aspect ratio for ID card PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [85.6, 125], // standard wallet badge dimensions
      });

      pdf.addImage(imgData, 'PNG', 0, 0, 85.6, 125);
      const empName = (employee?.name || 'employee').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      pdf.save(`${empName}_id_card.pdf`);
      showAlert('ID Card PDF downloaded successfully!');
    } catch (err) {
      console.error('Download PDF error:', err);
      showAlert('Failed to generate ID Card PDF.', 'error');
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[var(--bg)] text-[var(--text)] font-sans antialiased">
      <Sidebar 
        user={isHr ? hrUser : employee}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header 
          title="My Profile" 
          onMenuClick={() => setMobileOpen(prev => !prev)} 
        />

        <main className="p-4 sm:p-8 flex-1 overflow-y-auto space-y-6 max-w-7xl mx-auto w-full">
          {/* Flash Alert Banner */}
          {alertMsg && (
            <div className={`flex items-center space-x-2 px-4 py-3 rounded-xl text-sm font-medium animate-fadeIn ${
              alertMsg.type === 'success'
                ? 'bg-[#E6FDF4] border border-[#A7F3D0] text-emerald-800'
                : 'bg-[#FEE2E2] border border-[#FECACA] text-[#DC2626]'
            }`}>
              {alertMsg.type === 'success' ? <Check className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
              <span>{alertMsg.text}</span>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* 1. EMPLOYEE PROFILE VIEW (Matches real FRET screenshot)          */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {!isHr ? (
            <div className="space-y-6">
              {/* Top Profile Card */}
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row items-center sm:items-start gap-6">
                {/* Avatar Display with Change Photo Button */}
                <div className="flex flex-col items-center gap-3">
                  <div className="relative">
                    {employee?.avatar_url || employee?.has_photo ? (
                      <img 
                        src={employee?.avatar_url || `/employee/${employee?.id}/avatar`}
                        alt={employee?.name || 'Profile'} 
                        className="w-28 h-28 sm:w-32 sm:h-32 rounded-full object-cover border-4 border-[var(--surface)] shadow-md"
                      />
                    ) : (
                      <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-[#4F46E5] to-[#6366F1] text-white flex items-center justify-center font-bold text-4xl border-4 border-[var(--surface)] shadow-md select-none">
                        {employee?.name ? employee.name[0].toUpperCase() : 'U'}
                      </div>
                    )}

                    {uploadingPhoto && (
                      <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                        <RefreshCw className="w-6 h-6 text-white animate-spin" />
                      </div>
                    )}
                  </div>

                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handlePhotoUpload} 
                    accept="image/*" 
                    className="hidden" 
                  />

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingPhoto}
                    className="px-3.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--hover)] text-xs font-semibold text-[var(--text2)] shadow-xs transition flex items-center gap-1.5"
                  >
                    <Camera className="w-3.5 h-3.5 text-[#6366F1]" />
                    <span>Change Photo</span>
                  </button>
                </div>

                {/* Profile Meta & Actions */}
                <div className="text-center sm:text-left space-y-2 flex-1">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text)] tracking-tight font-['Plus_Jakarta_Sans']">
                    {employee?.name || 'Employee'}
                  </h1>

                  <p className="text-xs sm:text-sm font-medium text-[var(--text3)]">
                    {employee?.designation || 'Staff Member'} • {employee?.department || 'General'}
                  </p>

                  <div className="pt-1 flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                    <span className="inline-flex items-center px-3.5 py-1 rounded-full text-xs font-bold bg-[#EEF2FF] text-[#4F46E5] border border-[#C7D2FE] shadow-2xs capitalize">
                      {employee?.emp_type || 'Normal'}
                    </span>
                    {Boolean(employee?.is_manager) && (
                      <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-300 shadow-2xs">
                        <Shield className="w-3.5 h-3.5 text-amber-500" />
                        <span>Manager — {employee?.managed_department || employee?.department || 'Department'}</span>
                      </span>
                    )}
                    {Boolean(employee?.is_superadmin) && (
                      <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-300 shadow-2xs">
                        <span>SuperAdmin</span>
                      </span>
                    )}
                  </div>

                  <div className="pt-3">
                    <button
                      onClick={() => setShowIdCardModal(true)}
                      className="px-4 py-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-xl font-bold text-xs shadow-sm transition flex items-center gap-2 mx-auto sm:mx-0 active:scale-95 cursor-pointer"
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>View ID Card</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 2-Column Grid: Personal Info & Blood Group */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Personal Information (8 cols) */}
                <div className="lg:col-span-8 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-sm space-y-4">
                  <div className="flex items-center space-x-2 font-bold text-sm text-[var(--text)] border-b border-[var(--border)] pb-3">
                    <User className="w-4 h-4 text-[#4F46E5]" />
                    <span>Personal Information</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-1">
                    <div>
                      <div className="text-xs text-[var(--text3)] font-semibold uppercase tracking-wider">Email</div>
                      <div className="text-sm font-bold text-[var(--text)] mt-1 break-all">
                        {employee?.email || 'Not Available'}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-[var(--text3)] font-semibold uppercase tracking-wider">Phone</div>
                      <div className="text-sm font-bold text-[var(--text)] mt-1">
                        {employee?.phone ? (employee.phone.startsWith('+') ? employee.phone : `+91 ${employee.phone}`) : 'Not Available'}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-[var(--text3)] font-semibold uppercase tracking-wider">Employee ID</div>
                      <div className="text-sm font-bold text-[var(--text)] mt-1">
                        {employee?.emp_id || (employee?.id ? `INT${String(employee.id).padStart(4, '0')}` : 'N/A')}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-[var(--text3)] font-semibold uppercase tracking-wider">Status</div>
                      <div className="mt-1">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]">
                          {employee?.status || 'Active'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Blood Group Self-Service Card (4 cols) */}
                <div className="lg:col-span-4 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-sm space-y-4 flex flex-col justify-between">
                  <div className="flex items-center space-x-2 font-bold text-sm text-[var(--text)] border-b border-[var(--border)] pb-3">
                    <Droplet className="w-4 h-4 text-rose-500" />
                    <span>Blood Group</span>
                  </div>

                  <form onSubmit={handleSaveBloodGroup} className="space-y-4 my-auto py-2">
                    <div className="flex items-center gap-3">
                      <select
                        value={selectedBloodGroup}
                        onChange={(e) => setSelectedBloodGroup(e.target.value)}
                        className="flex-1 px-3.5 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm font-bold focus:outline-none focus:border-[#4F46E5]"
                      >
                        <option value="">Select</option>
                        <option value="A+">A+</option>
                        <option value="A-">A-</option>
                        <option value="B+">B+</option>
                        <option value="B-">B-</option>
                        <option value="AB+">AB+</option>
                        <option value="AB-">AB-</option>
                        <option value="O+">O+</option>
                        <option value="O-">O-</option>
                      </select>

                      <button
                        type="submit"
                        disabled={savingBloodGroup}
                        className="px-5 py-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-bold rounded-xl shadow-sm transition disabled:opacity-50 active:scale-95 cursor-pointer"
                      >
                        {savingBloodGroup ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                    <p className="text-[11px] text-[var(--text3)] font-medium">
                      Your blood group is displayed on your official company ID Card.
                    </p>
                  </form>
                </div>
              </div>

              {/* Employment Details Card */}
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center space-x-2 font-bold text-sm text-[var(--text)] border-b border-[var(--border)] pb-3">
                  <Briefcase className="w-4 h-4 text-[#4F46E5]" />
                  <span>Employment & Organization Details</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 pt-1">
                  <div>
                    <div className="text-xs text-[var(--text3)] font-semibold uppercase tracking-wider">Department</div>
                    <div className="text-sm font-bold text-[var(--text)] mt-1">
                      {employee?.department || '-'}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-[var(--text3)] font-semibold uppercase tracking-wider">Designation</div>
                    <div className="text-sm font-bold text-[var(--text)] mt-1">
                      {employee?.designation || '-'}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-[var(--text3)] font-semibold uppercase tracking-wider">Joining Date</div>
                    <div className="text-sm font-bold text-[var(--text)] mt-1">
                      {employee?.joining_date || '-'}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-[var(--text3)] font-semibold uppercase tracking-wider">Employment Type</div>
                    <div className="text-sm font-bold text-[var(--text)] mt-1 capitalize">
                      {employee?.emp_type || 'Normal'}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-[var(--text3)] font-semibold uppercase tracking-wider">Manager Role</div>
                    <div className="text-sm font-bold mt-1">
                      {employee?.is_manager ? (
                        <span className="text-amber-600 font-extrabold flex items-center gap-1">
                          <span>Yes (Managing {employee?.managed_department || employee?.department || 'Department'})</span>
                        </span>
                      ) : (
                        <span className="text-[var(--text3)] font-medium">Individual Contributor</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-[var(--text3)] font-semibold uppercase tracking-wider">Reporting Manager</div>
                    <div className="text-sm font-bold text-[var(--text)] mt-1">
                      {employee?.reporting_manager_name ? (
                        <span>
                          {employee.reporting_manager_name}
                          {employee.reporting_manager_designation ? ` (${employee.reporting_manager_designation})` : ''}
                        </span>
                      ) : (
                        <span className="text-[var(--text3)] font-medium">Department Manager / HR Admin</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Security Card */}
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center space-x-2 font-bold text-sm text-[var(--text)] border-b border-[var(--border)] pb-3">
                  <Shield className="w-4 h-4 text-[#4F46E5]" />
                  <span>Security</span>
                </div>

                <div>
                  <Link
                    href="/change-password"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-bold rounded-xl shadow-sm transition active:scale-95"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>Change Password</span>
                  </Link>
                </div>
              </div>

              {/* NDA Submission Section (Pending Submission OR Re-uploading) */}
              {((!employee?.nda_submitted && ndaSubmitted !== true) || isReuploadingNda) ? (
                <div className="bg-gradient-to-br from-[var(--surface)] to-[var(--surface2)] border-2 border-indigo-500/30 rounded-2xl p-6 sm:p-7 shadow-lg space-y-5 animate-fadeIn relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none"></div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-[#4F46E5] flex items-center justify-center font-bold">
                        <FileSignature className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-extrabold text-[var(--text)] font-['Plus_Jakarta_Sans']">
                          Non-Disclosure Agreement (NDA) Submission & Upload
                        </h3>
                        <p className="text-xs text-[var(--text3)]">
                          Action Required: Complete your digital signature and upload your signed NDA document
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isReuploadingNda && (
                        <button
                          type="button"
                          onClick={() => setIsReuploadingNda(false)}
                          className="px-3 py-1 text-xs font-semibold text-[var(--text3)] hover:text-[var(--text)] rounded-lg hover:bg-[var(--surface2)] transition"
                        >
                          Cancel
                        </button>
                      )}
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20 self-start sm:self-auto">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Pending Submission</span>
                      </span>
                    </div>
                  </div>

                  {/* Summary Terms Box */}
                  <div className="p-4 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text2)] space-y-2.5 max-h-40 overflow-y-auto leading-relaxed">
                    <div className="font-bold text-[var(--text)] text-xs uppercase tracking-wider">
                      NDA Agreement Terms Summary — TimeArrow Pvt. Ltd. (WisBees)
                    </div>
                    <p>
                      1. <strong>Confidentiality & Non-Disclosure:</strong> You agree to maintain strict confidentiality regarding all proprietary software, algorithms, client databases, research insights, and internal operations.
                    </p>
                    <p>
                      2. <strong>Intellectual Property:</strong> All software codebases, data models, and documentation created during your engagement are the sole property of the organization.
                    </p>
                    <p>
                      3. <strong>Data Security:</strong> No proprietary assets or code may be transferred or disclosed to external unauthorized parties or personal repositories.
                    </p>
                    <p>
                      4. <strong>Legal Validity:</strong> This electronic confirmation constitutes a legally binding agreement under the Information Technology Act.
                    </p>
                  </div>

                  {/* Form */}
                  <form onSubmit={handleSubmitNda} className="space-y-4 pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Full Legal Name */}
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text3)] mb-1.5">
                          Full Legal Name (Electronic Signature) *
                        </label>
                        <input
                          type="text"
                          required
                          value={ndaSignature}
                          onChange={(e) => setNdaSignature(e.target.value)}
                          placeholder={employee?.name || 'Enter your full legal name'}
                          className="w-full px-4 py-3 bg-[var(--input-bg)] border border-[var(--border)] rounded-xl text-sm font-semibold text-[var(--text)] focus:outline-none focus:border-[#4F46E5] transition"
                        />
                      </div>

                      {/* File Upload Box */}
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text3)] mb-1.5">
                          Upload Signed NDA Document (PDF / Image) *
                        </label>

                        <input
                          type="file"
                          ref={ndaFileInputRef}
                          onChange={(e) => {
                            if (e.target.files?.[0]) setNdaFile(e.target.files[0]);
                          }}
                          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                          className="hidden"
                        />

                        {ndaFile ? (
                          <div className="flex items-center justify-between p-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200">
                            <div className="flex items-center space-x-2.5 min-w-0">
                              <FileText className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs font-bold truncate">{ndaFile.name}</p>
                                <p className="text-[10px] text-emerald-700 dark:text-emerald-400">
                                  {(ndaFile.size / 1024).toFixed(1)} KB · Ready to upload
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setNdaFile(null);
                                if (ndaFileInputRef.current) ndaFileInputRef.current.value = '';
                              }}
                              className="p-1 rounded-lg hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 transition"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() => ndaFileInputRef.current?.click()}
                            onDragOver={(e) => { e.preventDefault(); setNdaFileDragOver(true); }}
                            onDragLeave={() => setNdaFileDragOver(false)}
                            onDrop={(e) => {
                              e.preventDefault();
                              setNdaFileDragOver(false);
                              if (e.dataTransfer.files?.[0]) setNdaFile(e.dataTransfer.files[0]);
                            }}
                            className={`border-2 border-dashed rounded-xl p-3 text-center cursor-pointer transition flex flex-col items-center justify-center gap-1 ${
                              ndaFileDragOver 
                                ? 'border-[#4F46E5] bg-indigo-50/50 dark:bg-indigo-950/30' 
                                : 'border-[var(--border)] hover:border-[#4F46E5] bg-[var(--input-bg)]'
                            }`}
                          >
                            <Upload className="w-4 h-4 text-[#4F46E5]" />
                            <span className="text-xs font-bold text-[var(--text)]">
                              Click or Drag & Drop Signed NDA Document
                            </span>
                            <span className="text-[10px] text-[var(--text3)]">
                              Supports PDF, JPG, PNG, DOCX (Max 15MB)
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <label className="flex items-start gap-3 cursor-pointer select-none pt-1">
                      <input
                        type="checkbox"
                        checked={ndaAgreed}
                        onChange={(e) => setNdaAgreed(e.target.checked)}
                        className="mt-1 w-4 h-4 rounded text-[#4F46E5] focus:ring-[#4F46E5] cursor-pointer"
                      />
                      <span className="text-xs text-[var(--text2)] leading-relaxed font-medium">
                        I hereby confirm that I have read, understood, electronically signed, and uploaded the valid signed copy of the Non-Disclosure Agreement (NDA).
                      </span>
                    </label>

                    <div className="pt-2 flex flex-wrap items-center gap-3">
                      <button
                        type="submit"
                        disabled={submittingNda || !ndaAgreed}
                        className="px-6 py-3 bg-[#4F46E5] hover:bg-[#4338CA] text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-2 disabled:opacity-50 active:scale-95 cursor-pointer"
                      >
                        {submittingNda ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Uploading & Submitting NDA...</span>
                          </>
                        ) : (
                          <>
                            <FileSignature className="w-4 h-4" />
                            <span>Upload & Submit NDA Agreement</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                /* NDA Completed & Verified State */
                <div className="bg-[var(--surface)] border border-emerald-500/30 rounded-2xl p-6 shadow-sm space-y-4 animate-fadeIn">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                        <Check className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-extrabold text-[var(--text)] font-['Plus_Jakarta_Sans']">
                          Non-Disclosure Agreement (NDA) — Completed & Verified
                        </h3>
                        <p className="text-xs text-[var(--text3)]">
                          Your signed NDA has been recorded for legal and organizational compliance
                        </p>
                      </div>
                    </div>

                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                      <Check className="w-3.5 h-3.5" />
                      <span>Compliant</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                    <div>
                      <div className="text-xs text-[var(--text3)] font-semibold uppercase tracking-wider">
                        Electronic Signature
                      </div>
                      <div className="text-sm font-bold text-[var(--text)] mt-1">
                        {employee?.nda_signature || employee?.name || 'Verified Signature'}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-[var(--text3)] font-semibold uppercase tracking-wider">
                        Submitted On
                      </div>
                      <div className="text-sm font-bold text-[var(--text)] mt-1">
                        {employee?.nda_submitted_at || 'Recorded'}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-[var(--text3)] font-semibold uppercase tracking-wider">
                        Uploaded Document
                      </div>
                      <div className="text-sm font-bold text-[var(--text)] mt-1 truncate">
                        {employee?.nda_doc_name || 'Signed_NDA_Document.pdf'}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 flex flex-wrap items-center gap-3">
                    <a
                      href={getApiUrl('/api/nda/download')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-xl font-bold text-xs shadow-sm transition flex items-center gap-2 active:scale-95 cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download / View Signed NDA</span>
                    </a>

                    <button
                      type="button"
                      onClick={() => {
                        setIsReuploadingNda(true);
                        setNdaFile(null);
                        setNdaAgreed(false);
                      }}
                      className="px-4 py-2 bg-[var(--surface)] hover:bg-[var(--surface2)] border border-[var(--border)] text-[var(--text)] rounded-xl font-bold text-xs transition flex items-center gap-1.5 active:scale-95"
                    >
                      <Upload className="w-4 h-4 text-[#4F46E5]" />
                      <span>Re-upload Signed Document</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ═══════════════════════════════════════════════════════════════ */
            /* 2. HR ADMIN PROFILE VIEW                                       */
            /* ═══════════════════════════════════════════════════════════════ */
            <div className="max-w-3xl mx-auto space-y-6">
              <form onSubmit={handleHrSave} className="space-y-6">
                {/* 1. Identity Card */}
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
                  {/* Avatar & User Header */}
                  <div className="flex items-center gap-5 pb-5 border-b border-[var(--border)]">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--accent2)] flex items-center justify-center text-white font-extrabold text-2xl shadow-md flex-shrink-0 select-none">
                      {hrName ? hrName[0].toUpperCase() : (hrUser?.name ? hrUser.name[0].toUpperCase() : 'H')}
                    </div>
                    <div>
                      <div className="text-xl font-extrabold text-[var(--text)] tracking-tight font-['Plus_Jakarta_Sans']">
                        {hrName || hrUser?.name || 'HR Administrator'}
                      </div>
                      <div className="text-xs sm:text-sm text-[var(--text3)] font-medium mt-0.5">
                        {hrDesignation || hrUser?.designation || 'HR Manager'} · {hrUser?.email || 'hr@wisbees.com'}
                      </div>
                      <div className="text-[11px] text-[var(--text3)] mt-1">
                        Member since {hrUser?.created_at || 'August 2024'}
                      </div>
                    </div>
                  </div>

                  {/* Identity Form Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text3)] mb-2">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={hrName}
                        onChange={(e) => setHrName(e.target.value)}
                        placeholder="e.g. Hr test"
                        className="w-full px-4 py-3 bg-[var(--input-bg)] border border-[var(--border)] rounded-xl text-sm font-medium text-[var(--text)] focus:outline-none focus:border-[var(--primary)] transition"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text3)] mb-2">
                        Phone
                      </label>
                      <input
                        type="tel"
                        value={hrPhone}
                        onChange={(e) => setHrPhone(e.target.value)}
                        placeholder="e.g. +91 9876543210"
                        className="w-full px-4 py-3 bg-[var(--input-bg)] border border-[var(--border)] rounded-xl text-sm font-medium text-[var(--text)] focus:outline-none focus:border-[var(--primary)] transition"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text3)] mb-2">
                        Official Designation
                      </label>
                      <select
                        value={hrDesignation}
                        onChange={(e) => setHrDesignation(e.target.value)}
                        className="w-full px-4 py-3 bg-[var(--input-bg)] border border-[var(--border)] rounded-xl text-sm font-medium text-[var(--text)] focus:outline-none focus:border-[var(--primary)] transition"
                      >
                        <option value="HR Manager">HR Manager</option>
                        <option value="Senior HR Manager">Senior HR Manager</option>
                        <option value="HR Executive">HR Executive</option>
                        <option value="HR Generalist">HR Generalist</option>
                        <option value="HR Director">HR Director</option>
                        <option value="Head of HR">Head of HR</option>
                        <option value="Talent Acquisition Specialist">Talent Acquisition Specialist</option>
                        <option value="HR Business Partner">HR Business Partner</option>
                        <option value="People Operations Lead">People Operations Lead</option>
                        <option value="HR Coordinator">HR Coordinator</option>
                        <option value="Chief People Officer">Chief People Officer</option>
                        <option value="HR Assistant">HR Assistant</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 2. Digital Signature Card */}
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 sm:p-8 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-base text-[var(--text)] font-['Plus_Jakarta_Sans']">
                      <FileSignature className="w-4 h-4 text-[var(--accent)]" />
                      <span>Digital Signature</span>
                    </div>
                    {hrUser?.has_signature || sigFile ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                        <Check className="w-3 h-3" /> Uploaded
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                        Missing
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text3)]">
                    This signature is automatically embedded at the bottom of every offer letter and official document you generate.
                  </p>

                  {/* Existing Signature Preview */}
                  {hrUser?.has_signature && !sigPreview && (
                    <div className="p-4 bg-white border border-[var(--border)] rounded-xl text-center max-w-sm mx-auto shadow-xs">
                      <img
                        src={getApiUrl(hrUser.signature_url || `/signature/${hrUser.id}`)}
                        alt="Current HR signature"
                        className="max-h-20 max-w-[260px] mx-auto object-contain"
                      />
                    </div>
                  )}

                  {/* Signature Upload Dropzone */}
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragOver(false);
                      const f = e.dataTransfer.files?.[0];
                      if (f) {
                        setSigFile(f);
                        setSigPreview(URL.createObjectURL(f));
                      }
                    }}
                    className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition relative ${
                      isDragOver
                        ? 'border-[var(--accent)] bg-[var(--accent)]/5'
                        : 'border-[var(--border)] hover:border-[var(--accent)] bg-[var(--input-bg)]'
                    }`}
                  >
                    <input
                      type="file"
                      id="hr_signature_file"
                      accept="image/png,image/jpeg"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setSigFile(file);
                          setSigPreview(URL.createObjectURL(file));
                        }
                      }}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />

                    {sigPreview ? (
                      <div className="space-y-2">
                        <img
                          src={sigPreview}
                          alt="New Signature Preview"
                          className="max-h-20 max-w-[240px] mx-auto object-contain bg-white p-2 rounded-lg border border-[var(--border)]"
                        />
                        <div className="text-xs font-semibold text-emerald-600">
                          {sigFile?.name} ready to save
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="text-2xl select-none">✍️</div>
                        <div className="text-sm font-semibold text-[var(--text2)]">
                          {hrUser?.has_signature ? 'Replace signature' : 'Upload your signature'}
                        </div>
                        <div className="text-[11px] text-[var(--text3)]">
                          PNG with transparent background · Max 2MB
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. Password Card */}
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 sm:p-8 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 font-bold text-base text-[var(--text)] font-['Plus_Jakarta_Sans']">
                    <Key className="w-4 h-4 text-[var(--accent)]" />
                    <span>Change Password</span>
                  </div>
                  <p className="text-xs text-[var(--text3)]">
                    Leave blank to keep your current password unchanged.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text3)] mb-2">
                        New Password
                      </label>
                      <input
                        type="password"
                        value={hrNewPassword}
                        onChange={(e) => setHrNewPassword(e.target.value)}
                        placeholder="Min. 8 characters"
                        className="w-full px-4 py-3 bg-[var(--input-bg)] border border-[var(--border)] rounded-xl text-sm font-medium text-[var(--text)] focus:outline-none focus:border-[var(--primary)] transition"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text3)] mb-2">
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        value={hrConfirmPassword}
                        onChange={(e) => setHrConfirmPassword(e.target.value)}
                        placeholder="Repeat password"
                        className="w-full px-4 py-3 bg-[var(--input-bg)] border border-[var(--border)] rounded-xl text-sm font-medium text-[var(--text)] focus:outline-none focus:border-[var(--primary)] transition"
                      />
                    </div>
                  </div>
                </div>

                {/* 4. Action Buttons */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <Link
                    href="/dashboard"
                    className="px-5 py-3 rounded-xl border border-[var(--border)] text-xs font-bold text-[var(--text2)] hover:bg-[var(--hover)] transition"
                  >
                    Cancel
                  </Link>

                  <button
                    type="submit"
                    disabled={savingHr}
                    className="px-6 py-3 bg-[var(--accent)] hover:bg-[var(--accent2)] text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-2 disabled:opacity-50 active:scale-95 cursor-pointer"
                  >
                    {savingHr ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Save Profile Changes</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* ID CARD MODAL (Matches real FRET ID Card screenshot)           */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {showIdCardModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-6 relative animate-fadeIn">
                {/* Modal Top Actions */}
                <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] no-print">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handlePrintIdCard}
                      className="px-3.5 py-2 bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5 active:scale-95 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print ID Card</span>
                    </button>

                    <button
                      onClick={handleDownloadImage}
                      disabled={downloadingImage}
                      className="px-3.5 py-2 bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      {downloadingImage ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                      <span>Download Image</span>
                    </button>

                    <button
                      onClick={handleDownloadPdf}
                      disabled={downloadingPdf}
                      className="px-3.5 py-2 bg-[#0E9F6E] hover:bg-[#0A7A54] text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      {downloadingPdf ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <FileText className="w-3.5 h-3.5" />
                      )}
                      <span>Download PDF</span>
                    </button>
                  </div>

                  <button
                    onClick={() => setShowIdCardModal(false)}
                    className="p-1.5 text-[var(--text3)] hover:text-[var(--text)] rounded-xl"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* THE ID CARD (Matches Screenshot 2) */}
                <div id="idCardPrintArea" className="flex justify-center py-2">
                  <div className="p-2.5 bg-white border-8 border-[#E2E8F0] rounded-[36px] shadow-2xl inline-block">
                    <div 
                      ref={modalCardRef}
                      id="idCard"
                      className="w-[320px] sm:w-[330px] bg-white text-[#0F172A] rounded-[26px] overflow-hidden flex flex-col items-center text-center font-sans"
                    >
                      {/* Top Grey Header with WisBees Logo & Tagline */}
                      <div className="w-full bg-[#F1F3F5] pt-5 pb-9 px-4 rounded-b-[14px] flex flex-col items-center justify-center">
                        <img 
                          src="/logo.png" 
                          alt="WisBees Logo" 
                          className="h-10 object-contain mx-auto" 
                        />
                        <div className="text-[12px] font-bold text-[#000000] tracking-wide mt-1">
                          Creating an impact
                        </div>
                      </div>

                      {/* Profile Photo Overlapping Header with Custom Orange Border */}
                      <div className="-mt-8 z-10 flex justify-center">
                        {employee?.avatar_url || employee?.has_photo ? (
                          <img 
                            src={employee?.avatar_url?.startsWith('data:') ? employee.avatar_url : getApiUrl(employee.avatar_url || `/employee/${employee.id}/avatar`)}
                            alt=""
                            crossOrigin="anonymous"
                            onError={(e) => {
                              // If image fails, replace with initial avatar badge
                              const parent = e.currentTarget.parentElement;
                              if (parent) {
                                e.currentTarget.style.display = 'none';
                                const fallback = document.createElement('div');
                                fallback.className = "w-28 h-28 rounded-full bg-gradient-to-br from-[#4F46E5] to-[#6366F1] text-white flex items-center justify-center font-extrabold text-4xl border-[4px] border-[#F28500] shadow-md mx-auto select-none";
                                fallback.innerText = employee?.name ? employee.name[0].toUpperCase() : 'C';
                                parent.appendChild(fallback);
                              }
                            }}
                            className="w-28 h-28 rounded-full object-cover border-[4px] border-[#F28500] shadow-md bg-white mx-auto"
                          />
                        ) : (
                          <div className="w-28 h-28 rounded-full bg-gradient-to-br from-[#4F46E5] to-[#6366F1] text-white flex items-center justify-center font-extrabold text-4xl border-[4px] border-[#F28500] shadow-md mx-auto select-none">
                            {employee?.name ? employee.name[0].toUpperCase() : 'C'}
                          </div>
                        )}
                      </div>

                      {/* Card Body Content */}
                      <div className="w-full px-5 pt-3 pb-5 space-y-2.5 flex flex-col items-center">
                        <h2 className="text-lg font-black tracking-wide uppercase text-[#000000] font-['Montserrat',sans-serif]">
                          {employee?.name || 'EMPLOYEE'}
                        </h2>

                        {/* Bright Orange Designation Pill */}
                        <div className="w-full px-4 py-2 bg-[#F28500] text-white rounded-2xl shadow-xs">
                          <div className="text-xs font-bold leading-tight">
                            {employee?.designation || 'Staff Member'}
                          </div>
                        </div>

                        {/* Blood Group */}
                        <div className="text-sm font-bold text-[#000000]">
                          {selectedBloodGroup || employee?.blood_group || '-'}
                        </div>

                        {/* Contact Details */}
                        <div className="text-xs text-[#000000] space-y-0.5 font-normal leading-relaxed text-left w-full px-2">
                          <div>
                            <span className="font-bold">E-mail:</span> {employee?.email || 'N/A'}
                          </div>
                          <div>
                            <span className="font-bold">Phone:</span> {employee?.phone ? (employee.phone.startsWith('+') ? employee.phone : `+91 ${employee.phone}`) : 'N/A'}
                          </div>
                        </div>

                        {/* Real Code128 Barcode */}
                        <div className="pt-2 flex flex-col items-center justify-center w-full">
                          <svg 
                            ref={modalBarcodeRef}
                            className="max-w-[200px] h-[38px]"
                          ></svg>
                          <div className="text-[9px] text-[#4A5568] font-medium tracking-wider mt-0.5">
                            https://www.wisbees.com/
                          </div>
                        </div>

                        {/* Bottom Most Organization Footer */}
                        <div className="font-extrabold text-xs text-[#000000] font-['Montserrat',sans-serif] tracking-wide pt-1">
                          Timearrow Pvt. Ltd
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
