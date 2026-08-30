'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import {
  Megaphone, Plus, List, History, Send, UserCircle2,
  Calendar, Trash2, X, AlertCircle, CheckCircle2
} from 'lucide-react';
import { api } from '@/lib/api';

export default function AnnouncementsPage() {
  const [isHr, setIsHr] = useState<boolean | null>(null);
  const [user, setUser] = useState<any>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Employee data
  const [announcements, setAnnouncements] = useState<any[]>([]);

  // HR data
  const [activeAnnouncements, setActiveAnnouncements] = useState<any[]>([]);
  const [historyAnnouncements, setHistoryAnnouncements] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [audience, setAudience] = useState('Everyone');
  const [priority, setPriority] = useState('Normal');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Fetch announcements data based on role
  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const res = await api.get('/announcements');
      if (res.data) {
        setIsHr(res.data.is_hr ?? false);
        if (res.data.is_hr) {
          setActiveAnnouncements(res.data.active_announcements || []);
          setHistoryAnnouncements(res.data.history_announcements || []);
        } else {
          setAnnouncements(res.data.announcements || []);
          if (res.data.employee) {
            setUser(res.data.employee);
          }
        }
      }
    } catch (e) {
      console.error('Failed to load announcements:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  // HR: Publish announcement
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !message) return;
    setSubmitting(true);

    try {
      await api.post('/announcements', {
        title,
        audience,
        priority,
        message,
      });
      setShowModal(false);
      setTitle('');
      setMessage('');
      await fetchAnnouncements();
    } catch (e) {
      console.error('Failed to post announcement:', e);
    } finally {
      setSubmitting(false);
    }
  };

  // HR: Delete announcement
  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this announcement?')) return;
    try {
      await api.post(`/announcements/delete/${id}`);
      await fetchAnnouncements();
    } catch (e) {
      console.error('Failed to delete announcement:', e);
    }
  };

  return (
    <div className="flex min-h-screen bg-[var(--bg)] text-[var(--text)] font-sans antialiased">
      <Sidebar 
        user={user ? {
          name: user.name || 'Employee',
          designation: user.designation || 'Staff',
          emp_type: user.emp_type || 'Normal'
        } : undefined}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header 
          title="Company Announcements" 
          onMenuClick={() => setMobileOpen(prev => !prev)} 
        />

        <main className="p-4 sm:p-8 flex-1 overflow-y-auto space-y-6 max-w-7xl mx-auto w-full">
          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* 1. EMPLOYEE ANNOUNCEMENT VIEW (Matches real FRET screenshot)     */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {!isHr ? (
            <div className="space-y-6">
              {/* Top Banner Card */}
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] text-[#6366F1] flex items-center justify-center flex-shrink-0">
                    <Megaphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-extrabold text-[var(--text)] tracking-tight font-['Plus_Jakarta_Sans']">
                      Company Announcements
                    </h2>
                    <p className="text-xs sm:text-sm text-[var(--text3)] mt-0.5">
                      Stay updated with the latest notices from HR.
                    </p>
                  </div>
                </div>

                <div className="px-3.5 py-1 rounded-full bg-[#EEF2FF] dark:bg-indigo-950/40 text-[#6366F1] border border-[#6366F1]/20 text-xs font-bold w-fit self-start sm:self-center">
                  {announcements.length} Active
                </div>
              </div>

              {/* Announcements List or Empty State */}
              {announcements.length > 0 ? (
                <div className="space-y-4">
                  {announcements.map((ann) => (
                    <div 
                      key={ann.id}
                      className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-sm space-y-3 hover:border-[#6366F1]/40 transition"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
                        <h3 className="font-bold text-base text-[var(--text)] font-['Plus_Jakarta_Sans']">
                          {ann.title}
                        </h3>

                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            ann.priority === 'Urgent'
                              ? 'bg-[#FEE2E2] text-[#DC2626]'
                              : ann.priority === 'Important'
                              ? 'bg-[#FEF3C7] text-[#D97706]'
                              : 'bg-[#DBEAFE] text-[#2563EB]'
                          }`}>
                            {ann.priority || 'Normal'}
                          </span>

                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E2E8F0] dark:bg-[#1E293B] text-[#475569] dark:text-[#94A3B8]">
                            {ann.audience || 'Everyone'}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs sm:text-sm text-[var(--text2)] leading-relaxed">
                        {ann.message}
                      </p>

                      <div className="flex items-center justify-between text-xs text-[var(--text3)] pt-2 border-t border-[var(--border)]">
                        <div className="flex items-center space-x-1.5 font-medium">
                          <UserCircle2 className="w-4 h-4 text-[#6366F1]" />
                          <span>{ann.posted_by || 'HR Team'}</span>
                        </div>

                        <div className="flex items-center space-x-1.5">
                          <Calendar className="w-4 h-4 text-[var(--text3)]" />
                          <span>{ann.created_at || 'Recent'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Empty State Card exactly matching the user's screenshot */
                <div className="bg-[var(--surface)] border border-dashed border-[var(--border)] rounded-2xl py-20 px-8 text-center shadow-sm space-y-2">
                  <div className="w-14 h-14 rounded-full bg-[#EEF2FF] text-[#A5B4FC] flex items-center justify-center mx-auto mb-4">
                    <Megaphone className="w-7 h-7" />
                  </div>
                  <h3 className="font-bold text-base sm:text-lg text-[var(--text)] font-['Plus_Jakarta_Sans']">
                    No Announcements
                  </h3>
                  <p className="text-xs sm:text-sm text-[var(--text3)]">
                    There are currently no announcements.
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* ═══════════════════════════════════════════════════════════════ */
            /* 2. HR ADMIN ANNOUNCEMENTS MANAGEMENT VIEW                      */
            /* ═══════════════════════════════════════════════════════════════ */
            <div className="space-y-6">
              {/* HR Top Page Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-extrabold text-[var(--text)] tracking-tight font-['Plus_Jakarta_Sans'] flex items-center gap-2">
                    <Megaphone className="w-6 h-6 text-[#6366F1]" /> Company Announcements
                  </h1>
                  <p className="text-[var(--text3)] text-sm mt-1">Publish and manage announcements for all employees and interns.</p>
                </div>

                <button
                  onClick={() => setShowModal(true)}
                  className="px-5 py-2.5 bg-[#6366F1] hover:bg-[#4F46E5] text-white font-bold rounded-xl shadow-sm transition flex items-center space-x-2 text-sm active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Announcement</span>
                </button>
              </div>

              {/* Active Announcements */}
              <div className="bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border)] shadow-sm space-y-4">
                <h3 className="font-bold text-sm text-[var(--text)] border-b border-[var(--border)] pb-3 flex items-center justify-between">
                  <div className="flex items-center">
                    <List className="w-4 h-4 mr-2 text-[#6366F1]" />
                    <span>Active Announcements</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#EEF2FF] text-[#6366F1]">
                    {activeAnnouncements.length} Active
                  </span>
                </h3>

                {activeAnnouncements.length > 0 ? (
                  <div className="space-y-3">
                    {activeAnnouncements.map((ann) => (
                      <div key={ann.id} className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg)] flex items-start justify-between gap-4">
                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#DBEAFE] text-[#2563EB]">
                              {ann.priority}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#E2E8F0] dark:bg-[#1E293B] text-[#475569]">
                              {ann.audience}
                            </span>
                            <span className="text-xs text-[var(--text3)]">• {ann.created_at}</span>
                          </div>
                          <h4 className="font-bold text-sm text-[var(--text)]">{ann.title}</h4>
                          <p className="text-xs text-[var(--text2)]">{ann.message}</p>
                        </div>

                        <button
                          onClick={() => handleDelete(ann.id)}
                          className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition"
                          title="Delete Announcement"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <Megaphone className="w-12 h-12 text-[#6366F1]/30 mx-auto mb-3" />
                    <h4 className="font-bold text-base text-[var(--text)]">No Active Announcements</h4>
                    <p className="text-xs text-[var(--text3)] mt-1">Create an announcement to notify employees and interns.</p>
                  </div>
                )}
              </div>

              {/* Announcement History */}
              <div className="bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border)] shadow-sm space-y-4">
                <h3 className="font-bold text-sm text-[var(--text)] border-b border-[var(--border)] pb-3 flex items-center">
                  <History className="w-4 h-4 mr-2 text-[var(--text3)]" /> Announcement History
                </h3>

                {historyAnnouncements.length > 0 ? (
                  <div className="space-y-3">
                    {historyAnnouncements.map((ann) => (
                      <div key={ann.id} className="p-4 bg-[var(--bg)] rounded-xl border border-[var(--border)] space-y-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-sm text-[var(--text)]">{ann.title}</h4>
                          <span className="text-[11px] text-[var(--text3)]">{ann.created_at}</span>
                        </div>
                        <p className="text-xs text-[var(--text3)]">{ann.posted_by} • <span className="text-amber-500 font-semibold">Expired</span></p>
                        <p className="text-xs text-[var(--text2)] pt-1">{ann.message}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--text3)] text-center py-4">No past announcements history.</p>
                )}
              </div>

              {/* HR Modal: New Announcement */}
              {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                  <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-fadeIn">
                    <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                      <h3 className="font-bold text-base text-[var(--text)] flex items-center gap-2">
                        <Megaphone className="w-4 h-4 text-[#6366F1]" /> New Announcement
                      </h3>
                      <button onClick={() => setShowModal(false)} className="text-[var(--text3)] hover:text-[var(--text)]">
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-[var(--text3)] mb-1 uppercase">Title</label>
                        <input
                          type="text"
                          required
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="e.g. Office Relocation Update"
                          className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm focus:outline-none focus:border-[#6366F1]"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-[var(--text3)] mb-1 uppercase">Audience</label>
                          <select
                            value={audience}
                            onChange={(e) => setAudience(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm focus:outline-none focus:border-[#6366F1]"
                          >
                            <option value="Everyone">Everyone</option>
                            <option value="Interns">Interns</option>
                            <option value="Employees">Employees</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-[var(--text3)] mb-1 uppercase">Priority</label>
                          <select
                            value={priority}
                            onChange={(e) => setPriority(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm focus:outline-none focus:border-[#6366F1]"
                          >
                            <option value="Normal">Normal</option>
                            <option value="Important">Important</option>
                            <option value="Urgent">Urgent</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[var(--text3)] mb-1 uppercase">Message</label>
                        <textarea
                          rows={4}
                          required
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          placeholder="Write the announcement details..."
                          className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm focus:outline-none focus:border-[#6366F1]"
                        />
                      </div>

                      <div className="flex justify-end gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowModal(false)}
                          className="px-4 py-2 text-xs font-bold text-[var(--text3)] hover:text-[var(--text)] rounded-xl"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={submitting}
                          className="px-5 py-2.5 bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-bold rounded-xl shadow-sm transition disabled:opacity-50"
                        >
                          {submitting ? 'Publishing...' : 'Publish Announcement'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
