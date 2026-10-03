'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import {
  Target,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  Edit2,
  Trash2,
  Sparkles,
  Users,
  User,
  ShieldCheck,
  Crown,
  Percent,
  RefreshCw,
  X,
  Search,
  Filter,
  Check
} from 'lucide-react';
import { api } from '@/lib/api';

export default function KraPage() {
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [targetEmployee, setTargetEmployee] = useState<any>(null);

  // KRAs Data
  const [kras, setKras] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({
    total_kras: 0,
    total_weightage: 100,
    completed_count: 0,
    in_progress_count: 0
  });

  // Team View (for Managers, SuperAdmins, HR)
  const [activeTab, setActiveTab] = useState<'my' | 'team'>('my');
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [teamKras, setTeamKras] = useState<any[]>([]);
  const [selectedTeamMemberId, setSelectedTeamMemberId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Add / Edit Modal
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingKraId, setEditingKraId] = useState<number | null>(null);
  const [formEmpId, setFormEmpId] = useState<number | ''>('');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formKpis, setFormKpis] = useState('');
  const [formWeightage, setFormWeightage] = useState<number>(25);
  const [formTimeline, setFormTimeline] = useState('Quarterly');
  const [formStatus, setFormStatus] = useState('Active');
  const [savingKra, setSavingKra] = useState(false);

  // Alert Banner
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showAlert = (text: string, type: 'success' | 'error' = 'success') => {
    setAlertMsg({ type, text });
    setTimeout(() => setAlertMsg(null), 4000);
  };

  // Preload cached user
  useEffect(() => {
    try {
      const saved = localStorage.getItem('fret_user');
      if (saved) {
        const u = JSON.parse(saved);
        setCurrentUser(u);
      }
    } catch (e) {}

    // Check URL parameters for tab
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('view') === 'team') {
        setActiveTab('team');
      }
    }
  }, []);

  const fetchKras = async (empIdOverride?: number) => {
    setLoading(true);
    try {
      let url = '/api/kra';
      if (empIdOverride) {
        url += `?employee_id=${empIdOverride}`;
      }
      const res = await api.get(url);
      if (res.data) {
        setKras(res.data.kras || []);
        if (res.data.summary) {
          setSummary(res.data.summary);
        }
        if (res.data.employee) {
          setTargetEmployee(res.data.employee);
        }
        if (res.data.team_members) {
          setTeamMembers(res.data.team_members);
        }
        if (res.data.team_kras) {
          setTeamKras(res.data.team_kras);
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch KRAs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKras(selectedTeamMemberId || undefined);
  }, [selectedTeamMemberId]);

  const canManageTeam = Boolean(
    currentUser?.role === 'hr' || 
    currentUser?.is_manager || 
    currentUser?.is_superadmin ||
    (typeof window !== 'undefined' && localStorage.getItem('fret_token')?.startsWith('hr:'))
  );

  const openAddModal = (empId?: number) => {
    setModalMode('add');
    setEditingKraId(null);
    setFormEmpId(empId || targetEmployee?.id || currentUser?.id || '');
    setFormTitle('');
    setFormDescription('');
    setFormKpis('');
    setFormWeightage(25);
    setFormTimeline('Quarterly');
    setFormStatus('Active');
    setShowModal(true);
  };

  const openEditModal = (item: any) => {
    setModalMode('edit');
    setEditingKraId(item.id);
    setFormEmpId(item.employee_id);
    setFormTitle(item.title || '');
    setFormDescription(item.description || '');
    setFormKpis(item.kpi_metrics || '');
    setFormWeightage(item.weightage || 25);
    setFormTimeline(item.target_timeline || 'Quarterly');
    setFormStatus(item.status || 'Active');
    setShowModal(true);
  };

  const handleSaveKra = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      showAlert('KRA Title is required.', 'error');
      return;
    }

    setSavingKra(true);
    try {
      const payload: any = {
        title: formTitle.trim(),
        description: formDescription.trim(),
        kpi_metrics: formKpis.trim(),
        weightage: formWeightage,
        target_timeline: formTimeline,
        status: formStatus,
      };

      if (modalMode === 'edit' && editingKraId) {
        payload.id = editingKraId;
      }
      if (formEmpId) {
        payload.employee_id = formEmpId;
      }

      const res = await api.post('/api/kra/save', payload);
      if (res.data?.success) {
        showAlert(res.data.message || 'KRA saved successfully!');
        setShowModal(false);
        await fetchKras(selectedTeamMemberId || undefined);
      } else {
        showAlert(res.data?.message || 'Failed to save KRA.', 'error');
      }
    } catch (err: any) {
      console.error(err);
      showAlert(err.response?.data?.message || 'Failed to save KRA.', 'error');
    } finally {
      setSavingKra(false);
    }
  };

  const handleDeleteKra = async (id: number, title: string) => {
    if (!confirm(`Are you sure you want to delete KRA: "${title}"?`)) return;
    try {
      const res = await api.post(`/api/kra/${id}/delete`);
      if (res.data?.success) {
        showAlert('KRA deleted successfully.');
        await fetchKras(selectedTeamMemberId || undefined);
      }
    } catch (err: any) {
      showAlert('Failed to delete KRA.', 'error');
    }
  };

  const handleStatusChange = async (id: number, newStatus: string) => {
    try {
      const res = await api.post(`/api/kra/${id}/status`, { status: newStatus });
      if (res.data?.success) {
        showAlert(`KRA status updated to ${newStatus}`);
        setKras(prev => prev.map(k => k.id === id ? { ...k, status: newStatus } : k));
        setTeamKras(prev => prev.map(k => k.id === id ? { ...k, status: newStatus } : k));
      }
    } catch (err) {
      showAlert('Failed to update KRA status', 'error');
    }
  };

  // Filtered lists
  const displayedKras = (activeTab === 'team' && !selectedTeamMemberId ? teamKras : kras).filter(k => {
    const matchesSearch = !searchQuery || 
      k.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      k.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (k.employee_name && k.employee_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (k.department && k.department.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus = !statusFilter || k.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex min-h-screen bg-[var(--bg)] text-[var(--text)] font-sans antialiased">
      <Sidebar 
        user={currentUser ? {
          name: currentUser.name || 'Team Member',
          designation: currentUser.designation || 'Staff',
          emp_type: currentUser.emp_type || 'Normal',
          is_manager: currentUser.is_manager,
          managed_department: currentUser.managed_department,
          is_superadmin: currentUser.is_superadmin,
          role: currentUser.role || 'employee'
        } : undefined}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header 
          title="Key Responsibility Areas (KRA)" 
          onMenuClick={() => setMobileOpen(prev => !prev)} 
        />

        <main className="p-4 sm:p-6 lg:p-8 flex-1 overflow-y-auto space-y-6 max-w-7xl mx-auto w-full">
          {/* Top Banner Alert */}
          {alertMsg && (
            <div className={`flex items-center space-x-2 px-4 py-3 rounded-xl text-sm font-medium animate-fadeIn ${
              alertMsg.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600'
                : 'bg-rose-500/10 border border-rose-500/20 text-rose-600'
            }`}>
              {alertMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              <span>{alertMsg.text}</span>
            </div>
          )}

          {/* Header & Role Info */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-sm">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black text-[var(--text)] tracking-tight font-['Plus_Jakarta_Sans']">
                  Key Responsibility Area (KRA)
                </h1>
                {currentUser?.is_superadmin && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-purple-500/10 text-purple-600 border border-purple-500/20">
                    <Crown className="w-3 h-3" /> SuperAdmin
                  </span>
                )}
                {currentUser?.is_manager && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                    <ShieldCheck className="w-3 h-3" /> {currentUser?.managed_department || 'Dept'} Manager
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-[var(--text3)] font-medium">
                Defined performance milestones, core scope of work, and weighted deliverable objectives
              </p>
            </div>

            <div className="flex items-center gap-2.5 self-start md:self-auto">
              <button
                onClick={() => fetchKras(selectedTeamMemberId || undefined)}
                className="px-3.5 py-2 rounded-xl border border-[var(--border)] hover:bg-[var(--hover)] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </button>

              <button
                onClick={() => openAddModal()}
                className="px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent2)] text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5 active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add KRA Item</span>
              </button>
            </div>
          </div>

          {/* 4 Summary Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-xs font-bold uppercase text-[var(--text3)] tracking-wider">Total KRA Focus</div>
                <div className="text-2xl font-black text-[var(--text)] mt-1">{summary.total_kras || kras.length}</div>
              </div>
              <div className="w-11 h-11 rounded-xl bg-[#4F46E5]/10 text-[#4F46E5] flex items-center justify-center">
                <Target className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-xs font-bold uppercase text-[var(--text3)] tracking-wider">Total Weightage</div>
                <div className="text-2xl font-black text-indigo-600 mt-1">{summary.total_weightage || 100}%</div>
              </div>
              <div className="w-11 h-11 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
                <Percent className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-xs font-bold uppercase text-[var(--text3)] tracking-wider">Completed / Achieved</div>
                <div className="text-2xl font-black text-emerald-600 mt-1">{summary.completed_count}</div>
              </div>
              <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-xs font-bold uppercase text-[var(--text3)] tracking-wider">Active Execution</div>
                <div className="text-2xl font-black text-amber-500 mt-1">{summary.in_progress_count}</div>
              </div>
              <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Tab Selection for Leads/Managers */}
          {canManageTeam && (
            <div className="flex items-center gap-3 border-b border-[var(--border)] pb-2">
              <button
                onClick={() => {
                  setActiveTab('my');
                  setSelectedTeamMemberId(null);
                }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer ${
                  activeTab === 'my' && !selectedTeamMemberId
                    ? 'bg-[var(--accent)] text-white shadow-sm'
                    : 'text-[var(--text2)] hover:bg-[var(--surface2)]'
                }`}
              >
                <User className="w-4 h-4" />
                <span>My KRAs</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('team');
                  setSelectedTeamMemberId(null);
                }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer ${
                  activeTab === 'team'
                    ? 'bg-[var(--accent)] text-white shadow-sm'
                    : 'text-[var(--text2)] hover:bg-[var(--surface2)]'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>
                  {currentUser?.is_superadmin || currentUser?.role === 'hr' 
                    ? 'Organization KRAs & Team' 
                    : `Department Team KRAs (${currentUser?.managed_department || 'Team'})`}
                </span>
              </button>
            </div>
          )}

          {/* Team Member Selector if in Team Mode */}
          {activeTab === 'team' && teamMembers.length > 0 && (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 shadow-sm space-y-3">
              <div className="text-xs font-bold uppercase text-[var(--text3)] tracking-wider">
                Filter by Team Member ({teamMembers.length} Members)
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setSelectedTeamMemberId(null)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    selectedTeamMemberId === null
                      ? 'bg-[var(--accent)] text-white'
                      : 'border border-[var(--border)] bg-[var(--surface2)] text-[var(--text2)] hover:bg-[var(--hover)]'
                  }`}
                >
                  All Team Members ({teamKras.length} KRAs)
                </button>
                {teamMembers.map((tm) => (
                  <button
                    key={tm.id}
                    onClick={() => setSelectedTeamMemberId(tm.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                      selectedTeamMemberId === tm.id
                        ? 'bg-[var(--accent)] text-white'
                        : 'border border-[var(--border)] bg-[var(--surface2)] text-[var(--text2)] hover:bg-[var(--hover)]'
                    }`}
                  >
                    <span>{tm.name}</span>
                    <span className="opacity-70 text-[10px]">({tm.kras_count})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search & Filter Bar */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text3)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search KRA title, responsibility, KPI..."
                className="w-full pl-10 pr-4 py-2 bg-[var(--input-bg)] border border-[var(--border)] rounded-xl text-xs font-medium text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-[var(--text3)]" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3.5 py-2 bg-[var(--input-bg)] border border-[var(--border)] rounded-xl text-xs font-semibold text-[var(--text)] focus:outline-none"
              >
                <option value="">All Statuses</option>
                <option value="Active">Active</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Needs Review">Needs Review</option>
              </select>
            </div>
          </div>

          {/* KRA Items List */}
          {displayedKras.length === 0 ? (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-3xl p-12 text-center space-y-4 shadow-sm">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 text-indigo-600 mx-auto flex items-center justify-center">
                <Target className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-[var(--text)]">No KRA Items Found</h3>
                <p className="text-xs text-[var(--text3)] max-w-md mx-auto">
                  {searchQuery || statusFilter 
                    ? 'No KRAs match your search filters.' 
                    : 'Click "Add KRA Item" above to create custom performance goals and responsibilities.'}
                </p>
              </div>
              <button
                onClick={() => openAddModal()}
                className="px-5 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent2)] text-white text-xs font-bold rounded-xl shadow-sm transition"
              >
                Add First KRA
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {displayedKras.map((kra) => (
                <div
                  key={kra.id}
                  className="bg-[var(--surface)] border border-[var(--border)] hover:border-indigo-500/40 rounded-2xl p-6 shadow-sm hover:shadow-md transition space-y-4 flex flex-col justify-between group"
                >
                  <div className="space-y-3">
                    {/* Card Top: Badges & Actions */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-[#EEF2FF] text-[#4F46E5] border border-[#C7D2FE]">
                          {kra.weightage}% Weightage
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--surface2)] text-[var(--text3)] border border-[var(--border)]">
                          {kra.target_timeline}
                        </span>
                        {kra.employee_name && activeTab === 'team' && (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/10 text-purple-600 border border-purple-500/20">
                            {kra.employee_name} ({kra.department || 'Dept'})
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 opacity-90 sm:opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={() => openEditModal(kra)}
                          title="Edit KRA"
                          className="p-1.5 text-[var(--text3)] hover:text-[#4F46E5] rounded-lg hover:bg-[var(--surface2)] transition"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteKra(kra.id, kra.title)}
                          title="Delete KRA"
                          className="p-1.5 text-[var(--text3)] hover:text-rose-600 rounded-lg hover:bg-[var(--surface2)] transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Title */}
                    <h3 className="text-base font-extrabold text-[var(--text)] tracking-tight font-['Plus_Jakarta_Sans'] leading-snug">
                      {kra.title}
                    </h3>

                    {/* Description */}
                    {kra.description && (
                      <p className="text-xs text-[var(--text2)] leading-relaxed font-normal">
                        {kra.description}
                      </p>
                    )}

                    {/* KPIs Box */}
                    {kra.kpi_metrics && (
                      <div className="p-3.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] space-y-1">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text3)] flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                          <span>Key Metrics & Performance Targets</span>
                        </div>
                        <p className="text-xs text-[var(--text)] font-medium leading-relaxed">
                          {kra.kpi_metrics}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Card Bottom: Status & Meta */}
                  <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between gap-3">
                    <div className="text-[11px] text-[var(--text3)] font-medium">
                      Assigned by: <strong className="text-[var(--text2)]">{kra.assigned_by}</strong>
                    </div>

                    {/* Interactive Status Selector */}
                    <select
                      value={kra.status}
                      onChange={(e) => handleStatusChange(kra.id, e.target.value)}
                      className={`text-xs font-bold px-3 py-1 rounded-xl border focus:outline-none cursor-pointer ${
                        kra.status === 'Completed'
                          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                          : kra.status === 'In Progress'
                          ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                          : kra.status === 'Needs Review'
                          ? 'bg-purple-500/10 text-purple-600 border-purple-500/20'
                          : 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20'
                      }`}
                    >
                      <option value="Active">Active</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                      <option value="Needs Review">Needs Review</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ADD / EDIT MODAL */}
          {showModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl space-y-5 animate-fadeIn relative">
                <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-[#4F46E5] flex items-center justify-center font-bold">
                      <Target className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-[var(--text)] font-['Plus_Jakarta_Sans']">
                        {modalMode === 'add' ? 'Create Key Responsibility Area' : 'Edit KRA Objective'}
                      </h3>
                      <p className="text-xs text-[var(--text3)]">Configure milestone targets, KPIs, and weightage</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowModal(false)}
                    className="p-1.5 text-[var(--text3)] hover:text-[var(--text)] rounded-xl"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveKra} className="space-y-4">
                  {/* Assignee if Lead/Manager */}
                  {canManageTeam && teamMembers.length > 0 && modalMode === 'add' && (
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text3)] mb-1.5">
                        Assign To Team Member *
                      </label>
                      <select
                        value={formEmpId}
                        onChange={(e) => setFormEmpId(Number(e.target.value))}
                        className="w-full px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--border)] rounded-xl text-sm font-semibold text-[var(--text)] focus:outline-none"
                      >
                        <option value={currentUser?.id || ''}>{currentUser?.name || 'Myself'} (Current User)</option>
                        {teamMembers.map((tm) => (
                          <option key={tm.id} value={tm.id}>
                            {tm.name} — {tm.designation || tm.department || 'Team Member'}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text3)] mb-1.5">
                      KRA Title *
                    </label>
                    <input
                      type="text"
                      required
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="e.g. Core System Architecture & High-Performance APIs"
                      className="w-full px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--border)] rounded-xl text-sm font-semibold text-[var(--text)] focus:outline-none focus:border-[#4F46E5]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text3)] mb-1.5">
                      Responsibilities & Operational Scope
                    </label>
                    <textarea
                      rows={3}
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="Describe the key responsibilities, deliverables, and expectations for this area..."
                      className="w-full px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--border)] rounded-xl text-sm font-medium text-[var(--text)] focus:outline-none focus:border-[#4F46E5] resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text3)] mb-1.5">
                      KPIs & Measurable Metrics
                    </label>
                    <textarea
                      rows={2}
                      value={formKpis}
                      onChange={(e) => setFormKpis(e.target.value)}
                      placeholder="e.g. 99.9% uptime, < 200ms API latency, zero regression bugs..."
                      className="w-full px-4 py-2.5 bg-[var(--input-bg)] border border-[var(--border)] rounded-xl text-sm font-medium text-[var(--text)] focus:outline-none focus:border-[#4F46E5] resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text3)] mb-1.5">
                        Weightage (%)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={formWeightage}
                        onChange={(e) => setFormWeightage(Number(e.target.value))}
                        className="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border border-[var(--border)] rounded-xl text-sm font-bold text-[var(--text)] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text3)] mb-1.5">
                        Timeline
                      </label>
                      <select
                        value={formTimeline}
                        onChange={(e) => setFormTimeline(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border border-[var(--border)] rounded-xl text-sm font-semibold text-[var(--text)] focus:outline-none"
                      >
                        <option value="Quarterly">Quarterly</option>
                        <option value="Monthly">Monthly</option>
                        <option value="Ongoing">Ongoing</option>
                        <option value="Annual">Annual</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text3)] mb-1.5">
                        Status
                      </label>
                      <select
                        value={formStatus}
                        onChange={(e) => setFormStatus(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-[var(--input-bg)] border border-[var(--border)] rounded-xl text-sm font-semibold text-[var(--text)] focus:outline-none"
                      >
                        <option value="Active">Active</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                        <option value="Needs Review">Needs Review</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--border)]">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="px-4 py-2.5 rounded-xl border border-[var(--border)] text-xs font-bold text-[var(--text2)] hover:bg-[var(--hover)] transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingKra}
                      className="px-6 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent2)] text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5 disabled:opacity-50 active:scale-95"
                    >
                      {savingKra ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Save KRA</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
