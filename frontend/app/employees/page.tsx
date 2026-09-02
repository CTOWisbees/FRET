'use client';

import React, { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import Link from 'next/link';
import { api, getApiUrl } from '@/lib/api';

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Selected Employee & Modals
  const [selectedEmp, setSelectedEmp] = useState<any>(null);

  // Delete Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');

  // Offer Letter Modal State
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [allRoles, setAllRoles] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState('');
  const [offerRoleTitle, setOfferRoleTitle] = useState('');
  const [offerFullText, setOfferFullText] = useState('');
  const [offerEmailBody, setOfferEmailBody] = useState('');

  // Experience Letter Modal State
  const [showExpModal, setShowExpModal] = useState(false);

  // Shared CC Email States
  const [ccJd, setCcJd] = useState(false);
  const [ccGouri, setCcGouri] = useState(false);
  const [ccCto, setCcCto] = useState(false);
  const [extraCcInput, setExtraCcInput] = useState('');

  // Send Confirmation Modal State
  const [showSendConfirmModal, setShowSendConfirmModal] = useState(false);
  const [sendType, setSendType] = useState<'offer' | 'experience'>('offer');

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/employees-list');
      const list = res.data || [];
      setEmployees(list);

      // Extract unique departments
      const depts: string[] = Array.from(new Set(list.map((e: any) => e.department).filter(Boolean))) as string[];
      setDepartments(depts);
    } catch (e) {
      console.error('Failed to fetch employees:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  // Filter employees
  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch = !search || 
      (emp.name && emp.name.toLowerCase().includes(search.toLowerCase())) || 
      (emp.email && emp.email.toLowerCase().includes(search.toLowerCase())) ||
      (emp.emp_id && emp.emp_id.toLowerCase().includes(search.toLowerCase()));

    const matchesDept = !deptFilter || emp.department === deptFilter;
    const matchesStatus = !statusFilter || emp.status === statusFilter;

    return matchesSearch && matchesDept && matchesStatus;
  });

  // Open Modals
  const openDeleteModal = (emp: any) => {
    setSelectedEmp(emp);
    setConfirmInput('');
    setShowDeleteModal(true);
  };

  const doDelete = async () => {
    if (!selectedEmp) return;
    if (selectedEmp.status === 'Active') {
      alert('Cannot delete an active employee. Change status to Inactive first!');
      setShowDeleteModal(false);
      return;
    }

    try {
      await api.post(`/employees/${selectedEmp.id}/delete`);
      alert('Employee deleted successfully');
      setShowDeleteModal(false);
      fetchEmployees();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Delete failed');
    }
  };

  const openOfferModal = async (emp: any) => {
    setSelectedEmp(emp);
    setSelectedRole('');
    setOfferRoleTitle('');
    setOfferFullText('');
    setOfferEmailBody('');
    setCcJd(false);
    setCcGouri(false);
    setCcCto(false);
    setExtraCcInput('');
    setShowOfferModal(true);

    try {
      const res = await api.get('/offer-letter/roles');
      if (res.data && res.data.roles) {
        setAllRoles(res.data.roles);
      }
    } catch (e) {
      console.error('Failed to fetch offer roles:', e);
    }
  };

  const handleRoleSelect = async (role: string) => {
    setSelectedRole(role);
    if (!role) return;
    try {
      const res = await api.get(`/offer-letter/draft?role=${encodeURIComponent(role)}&emp_id=${selectedEmp?.id || ''}`);
      if (res.data) {
        setOfferRoleTitle(res.data.role_title || role);
        setOfferFullText(res.data.full_text || '');
        setOfferEmailBody(res.data.email_body || '');
      }
    } catch (e) {
      console.error('Failed to load offer draft:', e);
    }
  };

  const saveOfferDraft = async () => {
    if (!selectedEmp || !selectedRole) return;
    try {
      await api.post('/offer-letter/draft/save', {
        emp_id: selectedEmp.id,
        role: selectedRole,
        role_title: offerRoleTitle,
        full_text: offerFullText,
        email_body: offerEmailBody,
      });
      alert('Draft saved successfully!');
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to save draft');
    }
  };

  const downloadOffer = () => {
    if (!selectedEmp) return;
    window.open(getApiUrl(`/generate-offer-letter?emp_id=${selectedEmp.id}`), '_blank');
  };

  const openExpModal = (emp: any) => {
    setSelectedEmp(emp);
    setCcJd(false);
    setCcGouri(false);
    setCcCto(false);
    setExtraCcInput('');
    setShowExpModal(true);
  };

  const downloadExperience = () => {
    if (!selectedEmp) return;
    window.open(getApiUrl(`/generate-experience-letter?emp_id=${selectedEmp.id}`), '_blank');
  };

  // CC Email List builder
  const buildCcEmails = () => {
    const ccList: string[] = [];
    if (ccJd) ccList.push('jd@wisbees.com');
    if (ccGouri) ccList.push('gouri.sankar@wisbees.com');
    if (ccCto) ccList.push('cto@wisbees.com');
    if (extraCcInput) {
      extraCcInput.split(',').map((e) => e.trim()).filter(Boolean).forEach((e) => ccList.push(e));
    }
    return ccList.join(',');
  };

  // Open Send Confirmation Modal
  const openSendConfirm = (type: 'offer' | 'experience') => {
    setSendType(type);
    setShowSendConfirmModal(true);
  };

  const confirmSendProceed = async () => {
    if (!selectedEmp) return;
    const cc_emails = buildCcEmails();

    try {
      if (sendType === 'offer') {
        const res = await api.post('/offer-letter/send', {
          emp_id: selectedEmp.id,
          role: selectedRole,
          role_title: offerRoleTitle,
          full_text: offerFullText,
          email_body: offerEmailBody,
          cc_emails: cc_emails,
        });
        if (res.data?.success) {
          alert(res.data.message || `Offer letter email sent successfully to ${selectedEmp.email}!`);
          setShowOfferModal(false);
        } else {
          alert(res.data?.message || 'Failed to send email.');
        }
      } else {
        const res = await api.post('/experience_letter/send', {
          id: selectedEmp.id,
          cc_emails: cc_emails,
        });
        if (res.data?.success) {
          alert(res.data.message || `Experience letter email sent successfully to ${selectedEmp.email}!`);
          setShowExpModal(false);
        } else {
          alert(res.data?.message || 'Failed to send email.');
        }
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Email dispatch failed. Please check email configuration.');
      if (sendType === 'offer') setShowOfferModal(false);
      else setShowExpModal(false);
    } finally {
      setShowSendConfirmModal(false);
      fetchEmployees();
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div className="flex min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header title="Employees" onMenuClick={() => setMobileOpen(true)} />

        <main className="p-4 sm:p-6 lg:p-8 flex-1 overflow-y-auto space-y-6 w-full max-w-full">
          {/* Page Header */}
          <div className="page-header">
            <div>
              <div className="page-title">Employee Directory</div>
              <div className="page-subtitle">
                {filteredEmployees.length} employee{filteredEmployees.length !== 1 ? 's' : ''}
              </div>
            </div>
            <Link href="/employees/add" className="btn btn-primary">
              <i className="fas fa-plus"></i> Add Employee
            </Link>
          </div>

          {/* Filters Card */}
          <div className="card" style={{ marginBottom: '20px', padding: '16px 20px' }}>
            <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-end">
              <div className="flex-1 min-w-[240px]">
                <label className="form-label">Search</label>
                <div style={{ position: 'relative' }}>
                  <i 
                    className="fas fa-search" 
                    style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', fontSize: '0.85rem' }}
                  ></i>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="form-control"
                    placeholder="Name, email or ID…"
                    style={{ paddingLeft: '34px', width: '100%' }}
                  />
                </div>
              </div>

              <div className="w-full sm:w-48 flex-shrink-0">
                <label className="form-label">Department</label>
                <select 
                  value={deptFilter} 
                  onChange={(e) => setDeptFilter(e.target.value)} 
                  className="form-control"
                  style={{ width: '100%' }}
                >
                  <option value="">All Departments</option>
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              <div className="w-full sm:w-36 flex-shrink-0">
                <label className="form-label">Status</label>
                <select 
                  value={statusFilter} 
                  onChange={(e) => setStatusFilter(e.target.value)} 
                  className="form-control"
                  style={{ width: '100%' }}
                >
                  <option value="">All Status</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button 
                  type="button" 
                  onClick={fetchEmployees} 
                  className="btn btn-primary" 
                  style={{ height: '42px', padding: '0 16px' }}
                >
                  <i className="fas fa-filter"></i> Filter
                </button>

                {(search || deptFilter || statusFilter) && (
                  <button
                    type="button"
                    onClick={() => { setSearch(''); setDeptFilter(''); setStatusFilter(''); }}
                    className="btn btn-secondary"
                    style={{ height: '42px', padding: '0 14px' }}
                  >
                    <i className="fas fa-times"></i> Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Table Card */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {filteredEmployees.length > 0 ? (
              <div className="table-wrapper">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr>
                      <th style={{ padding: '10px 12px' }}>Employee</th>
                      <th style={{ padding: '10px 10px' }}>ID</th>
                      <th style={{ padding: '10px 10px' }}>Department</th>
                      <th style={{ padding: '10px 10px' }}>Designation</th>
                      <th style={{ padding: '10px 10px' }}>Joining Date</th>
                      <th style={{ padding: '10px 10px' }}>Salary</th>
                      <th style={{ padding: '10px 10px' }}>Status</th>
                      <th style={{ padding: '10px 10px' }}>Documents</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.map((emp, index) => {
                      const hue = (index * 47 + 200) % 360;
                      const avatarBg = `linear-gradient(135deg, hsl(${hue}, 60%, 60%), hsl(${(hue + 40) % 360}, 70%, 50%))`;

                      return (
                        <tr 
                          key={emp.id} 
                          style={{ animation: 'slideUp 0.3s ease both', animationDelay: `${(index + 1) * 0.03}s` }}
                        >
                          <td style={{ padding: '8px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: avatarBg, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: '0.75rem', flexShrink: 0, color: '#fff' }}>
                                {emp.name ? emp.name[0].toUpperCase() : 'E'}
                              </div>
                              <div style={{ minWidth: 0, maxWidth: '160px' }}>
                                <div style={{ fontWeight: 600, fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={emp.name}>{emp.name}</div>
                                <div style={{ fontSize: '0.68rem', color: 'var(--text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={emp.email}>{emp.email || '—'}</div>
                                <span 
                                  className={`badge-pill ${emp.emp_type === 'Intern' ? 'badge-sent' : 'badge-active'}`}
                                  style={{ fontSize: '0.58rem', marginTop: '1px', padding: '1px 5px' }}
                                >
                                  {emp.emp_type || 'Normal'}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <code style={{ background: 'var(--bg3)', padding: '2px 5px', borderRadius: '5px', fontSize: '0.7rem', color: 'var(--accent)', fontWeight: 600 }}>
                              {emp.emp_id}
                            </code>
                          </td>
                          <td style={{ padding: '8px 10px', fontSize: '0.78rem' }}>{emp.department || '—'}</td>
                          <td style={{ padding: '8px 10px', fontSize: '0.78rem' }}>{emp.designation || '—'}</td>
                          <td style={{ padding: '8px 10px', fontSize: '0.76rem' }}>{formatDate(emp.joining_date)}</td>
                          <td style={{ padding: '8px 10px', fontWeight: 600, fontSize: '0.78rem' }}>
                            ₹{emp.salary ? Number(emp.salary).toLocaleString('en-IN') : '0'}
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <span className={`badge-pill ${emp.status === 'Active' ? 'badge-active' : 'badge-inactive'}`} style={{ fontSize: '0.68rem', padding: '3px 8px' }}>
                              <i className="fas fa-circle" style={{ fontSize: '0.4rem' }}></i> {emp.status || 'Active'}
                            </span>
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                              {emp.offer_sent ? (
                                <span className="badge-pill badge-sent" style={{ fontSize: '0.62rem', padding: '2px 5px' }}>
                                  <i className="fas fa-check"></i> Offer
                                </span>
                              ) : null}
                              {emp.nda_sent ? (
                                <span className="badge-pill badge-sent" style={{ fontSize: '0.62rem', padding: '2px 5px' }}>
                                  <i className="fas fa-check"></i> NDA
                                </span>
                              ) : null}
                              {!emp.offer_sent && !emp.nda_sent ? (
                                <span className="badge-pill badge-pending" style={{ fontSize: '0.62rem', padding: '2px 5px' }}>
                                  Pending
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', alignItems: 'center' }}>
                              <button 
                                className="btn btn-success btn-sm"
                                style={{ padding: '4px 7px', fontSize: '0.72rem' }}
                                onClick={() => openOfferModal(emp)}
                                title="Offer Letter"
                              >
                                <i className="fas fa-file-contract"></i> Offer
                              </button>
                              <Link 
                                href={`/employees/${emp.id}/edit`} 
                                className="btn btn-secondary btn-sm" 
                                style={{ padding: '4px 7px', fontSize: '0.72rem' }}
                                title="Edit"
                              >
                                <i className="fas fa-pen"></i>
                              </Link>
                              <button 
                                className="btn btn-danger btn-sm"
                                style={{ padding: '4px 7px', fontSize: '0.72rem' }}
                                onClick={() => openDeleteModal(emp)}
                                title="Delete"
                              >
                                <i className="fas fa-trash"></i>
                              </button>
                              <button 
                                className="btn btn-sm btn-primary"
                                style={{ padding: '4px 7px', fontSize: '0.72rem' }}
                                onClick={() => openExpModal(emp)}
                                title="Experience Letter"
                              >
                                <i className="fas fa-file-signature"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <i className="fas fa-users-slash"></i>
                <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '8px' }}>No employees found</div>
                <div style={{ fontSize: '0.85rem', marginBottom: '20px' }}>
                  {search || deptFilter || statusFilter ? 'Try adjusting your filters' : 'Get started by adding your first employee'}
                </div>
                <Link href="/employees/add" className="btn btn-primary">
                  <i className="fas fa-plus"></i> Add Employee
                </Link>
              </div>
            )}
          </div>

          {/* Delete Modal with CONFIRM input */}
          <div className={`modal-backdrop ${showDeleteModal ? 'open' : ''}`} id="deleteModal">
            <div className="modal">
              <div className="modal-title">
                <i className="fas fa-triangle-exclamation" style={{ color: 'var(--red)' }}></i> 
                Delete Employee
              </div>
              <p style={{ color: 'var(--text2)', fontSize: '0.9rem', marginBottom: '16px' }}>
                This action cannot be undone. Type <strong>CONFIRM</strong> to delete{' '}
                <strong id="deleteEmpName">{selectedEmp?.name}</strong>.
              </p>
              <input 
                type="text" 
                id="confirmInput" 
                className="form-control" 
                placeholder="Type CONFIRM"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
              />
              <div className="modal-actions">
                <button 
                  className="btn btn-secondary" 
                  onClick={() => setShowDeleteModal(false)}
                >
                  Cancel
                </button>
                <button 
                  className="btn btn-danger" 
                  id="confirmDeleteBtn" 
                  disabled={confirmInput !== 'CONFIRM'} 
                  onClick={doDelete}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>

          {/* Offer Letter Modal */}
          <div className={`modal-backdrop ${showOfferModal ? 'open' : ''}`} id="offerModal" style={{ zIndex: 210 }}>
            <div className="modal" style={{ maxWidth: '680px', width: '95%' }}>
              <div className="modal-title">
                <i className="fas fa-file-contract text-accent"></i> 
                Generate Offer Letter
              </div>

              <div className="form-group">
                <label className="form-label">Select Role</label>
                <select 
                  className="form-control" 
                  id="offerRoleSelect" 
                  value={selectedRole}
                  onChange={(e) => handleRoleSelect(e.target.value)}
                >
                  <option value="">— Select role —</option>
                  {allRoles.map((rk) => (
                    <option key={rk} value={rk}>{rk}</option>
                  ))}
                  <option value="__other__">Other / Custom Role</option>
                </select>
              </div>

              {selectedRole ? (
                <div id="offerPreviewArea" style={{ marginBottom: '10px' }}>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text3)', marginBottom: '10px' }}>
                    Edit before sending — Save persists your edits; Download/Send use whatever is currently in these fields.
                  </div>

                  <div className="form-group">
                    <label className="form-label">Role Title (appears in the letter)</label>
                    <input 
                      type="text" 
                      id="offerRoleTitle" 
                      className="form-control" 
                      placeholder="e.g. Custom role title"
                      value={offerRoleTitle}
                      onChange={(e) => setOfferRoleTitle(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Offer Letter Content{' '}
                      <small style={{ color: 'var(--text3)', fontWeight: 400 }}>
                        (the full letter body — edit freely; lines starting with "-" become bullet points)
                      </small>
                    </label>
                    <textarea 
                      id="offerFullText" 
                      className="form-control" 
                      rows={12}
                      style={{ fontSize: '0.82rem', lineHeight: 1.6, resize: 'vertical' }}
                      value={offerFullText}
                      onChange={(e) => setOfferFullText(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Email Body{' '}
                      <small style={{ color: 'var(--text3)', fontWeight: 400 }}>
                        (paragraphs separated by a blank line)
                      </small>
                    </label>
                    <textarea 
                      id="offerEmailBody" 
                      className="form-control" 
                      rows={5}
                      style={{ fontSize: '0.82rem', lineHeight: 1.6, resize: 'vertical' }}
                      value={offerEmailBody}
                      onChange={(e) => setOfferEmailBody(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '6px' }}>
                    <button 
                      className="btn btn-secondary" 
                      type="button" 
                      onClick={saveOfferDraft} 
                      id="saveOfferBtn"
                    >
                      <i className="fas fa-save"></i> Save
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="form-group" style={{ marginTop: '16px', marginBottom: '20px', textAlign: 'left' }}>
                <label className="form-label" style={{ fontWeight: 600, marginBottom: '6px', display: 'block' }}>
                  <i className="fas fa-copy text-accent"></i> CC Email Addresses (Optional)
                </label>
                <div id="offer_cc_group" style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 400, fontSize: '0.85rem' }}>
                    <input 
                      type="checkbox" 
                      checked={ccJd} 
                      onChange={(e) => setCcJd(e.target.checked)} 
                    /> jd@wisbees.com
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 400, fontSize: '0.85rem' }}>
                    <input 
                      type="checkbox" 
                      checked={ccGouri} 
                      onChange={(e) => setCcGouri(e.target.checked)} 
                    /> gouri.sankar@wisbees.com
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 400, fontSize: '0.85rem' }}>
                    <input 
                      type="checkbox" 
                      checked={ccCto} 
                      onChange={(e) => setCcCto(e.target.checked)} 
                    /> cto@wisbees.com
                  </label>
                </div>
                <input
                  type="text"
                  id="email_cc_input"
                  className="form-control"
                  placeholder="Add other emails, separated by a comma ( , )"
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', boxSizing: 'border-box' }}
                  value={extraCcInput}
                  onChange={(e) => setExtraCcInput(e.target.value)}
                />
                <small style={{ color: 'var(--text3)', display: 'block', marginTop: '4px', fontSize: '0.78rem' }}>
                  Tick the addresses above, and/or type any extra ones here
                </small>
              </div>

              <div className="modal-actions">
                <button 
                  className="btn btn-secondary" 
                  onClick={() => setShowOfferModal(false)}
                >
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={downloadOffer} id="downloadBtn">
                  <i className="fas fa-download"></i> Download PDF
                </button>
                <button 
                  className="btn btn-success" 
                  onClick={() => openSendConfirm('offer')} 
                  id="sendOfferBtn"
                >
                  <i className="fas fa-paper-plane"></i> Send Email
                </button>
              </div>
            </div>
          </div>

          {/* Experience Letter Modal */}
          <div className={`exp-modal ${showExpModal ? 'show' : ''}`} id="experienceModal">
            <div className="exp-modal-box">
              <div className="exp-modal-header">
                <h3>Experience Letter</h3>
                <span className="exp-close" onClick={() => setShowExpModal(false)}>
                  &times;
                </span>
              </div>

              <div className="exp-modal-body">
                <p><b>Name:</b> <span id="expName">{selectedEmp?.name}</span></p>
                <p><b>Designation:</b> <span id="expDesignation">{selectedEmp?.designation || '—'}</span></p>
                <p><b>Department:</b> <span id="expDepartment">{selectedEmp?.department || '—'}</span></p>
                <p><b>Type:</b> <span id="expType">{selectedEmp?.emp_type || 'Normal'}</span></p>
                <p><b>Joining:</b> <span id="expJoining">{formatDate(selectedEmp?.joining_date)}</span></p>
                <p><b>End:</b> <span id="expEnd">{selectedEmp?.end_date ? formatDate(selectedEmp.end_date) : 'Present'}</span></p>

                <div className="form-group" style={{ marginTop: '16px', textAlign: 'left' }}>
                  <label className="form-label" style={{ fontWeight: 600, marginBottom: '6px', display: 'block' }}>
                    <i className="fas fa-copy text-accent"></i> CC Email Addresses (Optional)
                  </label>
                  <div id="exp_cc_group" style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 400, fontSize: '0.85rem' }}>
                      <input 
                        type="checkbox" 
                        checked={ccJd} 
                        onChange={(e) => setCcJd(e.target.checked)} 
                      /> jd@wisbees.com
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 400, fontSize: '0.85rem' }}>
                      <input 
                        type="checkbox" 
                        checked={ccGouri} 
                        onChange={(e) => setCcGouri(e.target.checked)} 
                      /> gouri.sankar@wisbees.com
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 400, fontSize: '0.85rem' }}>
                      <input 
                        type="checkbox" 
                        checked={ccCto} 
                        onChange={(e) => setCcCto(e.target.checked)} 
                      /> cto@wisbees.com
                    </label>
                  </div>
                  <input
                    type="text"
                    id="exp_email_cc_input"
                    className="form-control"
                    placeholder="Add other emails, separated by a comma ( , )"
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', boxSizing: 'border-box' }}
                    value={extraCcInput}
                    onChange={(e) => setExtraCcInput(e.target.value)}
                  />
                  <small style={{ color: 'var(--text3)', display: 'block', marginTop: '4px', fontSize: '0.78rem' }}>
                    Tick the addresses above, and/or type any extra ones here
                  </small>
                </div>
              </div>

              <div className="exp-modal-footer">
                <button 
                  className="btn btn-secondary"
                  onClick={() => setShowExpModal(false)}
                >
                  Close
                </button>
                <button 
                  className="btn btn-primary"
                  onClick={downloadExperience}
                >
                  <i className="fas fa-download"></i> Download PDF
                </button>
                <button 
                  className="btn btn-success" 
                  id="sendExperienceBtn"
                  onClick={() => openSendConfirm('experience')}
                >
                  <i className="fas fa-paper-plane"></i> Send Email
                </button>
              </div>
            </div>
          </div>

          {/* Send Confirmation Modal */}
          <div className={`modal-backdrop ${showSendConfirmModal ? 'open' : ''}`} id="sendConfirmModal" style={{ zIndex: 10000 }}>
            <div className="modal" style={{ maxWidth: '420px', width: '95%' }}>
              <div className="modal-title">
                <i className="fas fa-paper-plane text-accent"></i>
                Confirm Send
              </div>
              <p style={{ color: 'var(--text2)', fontSize: '0.9rem', marginBottom: '14px' }}>
                Do you want to proceed sending this email?
              </p>
              <div style={{ background: 'var(--bg3)', borderRadius: '8px', padding: '12px 14px', fontSize: '0.85rem', lineHeight: 1.9 }}>
                <div><b>Name:</b> {selectedEmp?.name}</div>
                <div><b>Email:</b> {selectedEmp?.email || 'N/A'}</div>
                <div><b>Role / Type:</b> {selectedEmp?.designation || selectedEmp?.emp_type}</div>
                <div><b>Date:</b> {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
              </div>
              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={() => setShowSendConfirmModal(false)}>
                  Cancel
                </button>
                <button className="btn btn-success" id="confirmSendBtn" onClick={confirmSendProceed}>
                  <i className="fas fa-check"></i> Yes, Send
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
