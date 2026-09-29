'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen,
  HelpCircle,
  Send,
  ChevronDown,
  ExternalLink,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Megaphone,
  RefreshCw,
} from 'lucide-react';
import { api, getOpsBaseUrl } from '@/lib/api';

interface GhostPost {
  id: string;
  title: string;
  url: string;
  feature_image: string | null;
  excerpt: string | null;
  custom_excerpt: string | null;
  published_at: string;
}




function ArticleCard({ post }: { post: GhostPost }) {
  const blurb = post.custom_excerpt || post.excerpt || '';
  return (
    <a
      href={post.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-4 p-3 rounded-xl hover:bg-[var(--hover-bg)] transition-colors group cursor-pointer"
    >
      <div className="shrink-0 w-[84px] h-[60px] rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 border border-[var(--card-border)]">
        {post.feature_image ? (
          <img
            src={post.feature_image}
            alt={post.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-slate-400" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-[13px] font-bold text-[var(--text-primary)] leading-snug group-hover:text-[var(--accent)] transition-colors line-clamp-2">
            {post.title}
          </h4>
          <ExternalLink className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        {blurb && (
          <p className="mt-1 text-[11px] text-[var(--text-muted)] leading-relaxed line-clamp-2">
            {blurb}
          </p>
        )}
      </div>
    </a>
  );
}

function ArticleSkeleton() {
  return (
    <div className="flex gap-4 p-3 animate-pulse">
      <div className="w-[84px] h-[60px] bg-slate-200 dark:bg-slate-700 rounded-lg shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-full" />
        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
      </div>
    </div>
  );
}

export default function DigitalMarketingWorkPage() {
  const [user, setUser] = useState<any>(null);

  const [latestPosts, setLatestPosts] = useState<GhostPost[]>([]);
  const [latestLoading, setLatestLoading] = useState(true);
  const [latestShowAll, setLatestShowAll] = useState(false);
  const LATEST_PREVIEW = 3;

  const [whPosts, setWhPosts] = useState<GhostPost[]>([]);
  const [whLoading, setWhLoading] = useState(true);
  const [whShowAll, setWhShowAll] = useState(false);
  const WH_PREVIEW = 3;

  const [allPosts, setAllPosts] = useState<GhostPost[]>([]);
  const [selectedPost, setSelectedPost] = useState<GhostPost | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [openingMessage, setOpeningMessage] = useState('');
  const [readersFile, setReadersFile] = useState<File | null>(null);
  const [blasting, setBlasting] = useState(false);
  const [blastResult, setBlastResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('ops_user');
    if (saved) { try { setUser(JSON.parse(saved)); } catch {} }
  }, []);

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        setLatestLoading(true);
        const res = await api.get('/dm/ghost-posts?section=latest&limit=10');
        const posts: GhostPost[] = res.data?.posts || [];
        setLatestPosts(posts);
        setAllPosts(prev => {
          const ids = prev.map(p => p.id);
          return [...prev, ...posts.filter(p => !ids.includes(p.id))];
        });
      } catch { setLatestPosts([]); } finally { setLatestLoading(false); }
    };
    fetchPosts();
  }, []);

  useEffect(() => {
    const fetchWh = async () => {
      try {
        setWhLoading(true);
        const res = await api.get('/dm/ghost-posts?section=wealthhelp&limit=10');
        const posts: GhostPost[] = res.data?.posts || [];
        setWhPosts(posts);
        setAllPosts(prev => {
          const ids = prev.map(p => p.id);
          return [...prev, ...posts.filter(p => !ids.includes(p.id))];
        });
      } catch { setWhPosts([]); } finally { setWhLoading(false); }
    };
    fetchWh();
  }, []);

  useEffect(() => {
    if (!selectedPost && allPosts.length > 0) setSelectedPost(allPosts[0]);
  }, [allPosts, selectedPost]);

  const handleBlast = async () => {
    if (!selectedPost || !readersFile) return;
    setBlasting(true);
    setBlastResult(null);
    try {
      const fd = new FormData();
      fd.append('post_url', selectedPost.url);
      fd.append('post_title', selectedPost.title);
      fd.append('subject', emailSubject);
      fd.append('opening_message', openingMessage);
      fd.append('readers_db', readersFile);
      const token = localStorage.getItem('ops_token');
      const baseUrl = getOpsBaseUrl().replace(/\/$/, '');
      const res = await fetch(`${baseUrl}/dm/newsletter-blast`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-User-Auth': token || '',
        },
        body: fd,
      });
      const data = await res.json();
      setBlastResult(data);
    } catch (err: any) {
      setBlastResult({ error: err.message || 'Network error' });
    } finally { setBlasting(false); }
  };

  const visibleLatest = latestShowAll ? latestPosts : latestPosts.slice(0, LATEST_PREVIEW);
  const visibleWh = whShowAll ? whPosts : whPosts.slice(0, WH_PREVIEW);

  return (
    <div className="space-y-6 max-w-3xl mx-auto animate-fadeIn pb-16">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-[var(--text-primary)] tracking-tight">Work Hub</h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Digital Marketing workspace</p>
        </div>
        {user?.designation && (
          <span className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800 shrink-0">
            Designation: {user.designation}
          </span>
        )}
      </div>

      {/* Latest Articles */}
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden shadow-xs">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-[var(--card-border)]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <span className="text-sm font-black text-[var(--text-primary)]">Latest Articles</span>
          </div>
          <a href="https://www.wisbees.com" target="_blank" rel="noopener noreferrer"
            className="text-[11px] font-semibold text-[var(--accent)] hover:underline flex items-center gap-1">
            View all on WisBees <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <div className="p-3 divide-y divide-[var(--card-border)]">
          {latestLoading ? (<><ArticleSkeleton /><ArticleSkeleton /><ArticleSkeleton /></>) :
            latestPosts.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-xs text-[var(--text-muted)]">Could not load articles. Check Ghost API configuration.</p>
                <button onClick={() => window.location.reload()} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--accent)] hover:underline">
                  <RefreshCw className="w-3.5 h-3.5" /> Retry
                </button>
              </div>
            ) : visibleLatest.map(post => <ArticleCard key={post.id} post={post} />)}
        </div>
        {!latestLoading && latestPosts.length > LATEST_PREVIEW && (
          <div className="pb-4 text-center">
            <button onClick={() => setLatestShowAll(v => !v)} className="text-[12px] font-semibold text-[var(--accent)] hover:underline">
              {latestShowAll ? 'Show less' : 'Show more'}
            </button>
          </div>
        )}
      </div>

      {/* Wealth Help */}
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden shadow-xs">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-[var(--card-border)]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 flex items-center justify-center">
              <HelpCircle className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            </div>
            <span className="text-sm font-black text-[var(--text-primary)]">Wealth Help</span>
          </div>
          <a href="https://www.wisbees.com/tag/wealth-help/" target="_blank" rel="noopener noreferrer"
            className="text-[11px] font-semibold text-[var(--accent)] hover:underline flex items-center gap-1">
            View all on WisBees <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <div className="p-3 divide-y divide-[var(--card-border)]">
          {whLoading ? (<><ArticleSkeleton /><ArticleSkeleton /><ArticleSkeleton /></>) :
            whPosts.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-xs text-[var(--text-muted)]">Could not load Wealth Help articles. Check Ghost API configuration.</p>
              </div>
            ) : visibleWh.map(post => <ArticleCard key={post.id} post={post} />)}
        </div>
        {!whLoading && whPosts.length > WH_PREVIEW && (
          <div className="pb-4 text-center">
            <button onClick={() => setWhShowAll(v => !v)} className="text-[12px] font-semibold text-[var(--accent)] hover:underline">
              {whShowAll ? 'Show less' : 'Show more'}
            </button>
          </div>
        )}
      </div>

      {/* Newsletter Emailing Module */}
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden shadow-xs">
        <div className="flex items-center gap-2 px-5 pt-5 pb-3 border-b border-[var(--card-border)]">
          <div className="w-7 h-7 rounded-lg bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 flex items-center justify-center">
            <Megaphone className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          </div>
          <span className="text-sm font-black text-[var(--text-primary)]">Newsletter Emailing Module</span>
        </div>

        <div className="p-5 space-y-5">
          {/* Step 1 */}
          <div className="space-y-2">
            <label className="block text-[12px] font-bold text-[var(--text-primary)]">
              1. Select Post to Send <span className="font-normal text-[var(--text-muted)]">(Newsletter or Wealth Help, from Ghost)</span>
            </label>
            <div className="relative">
              <button type="button" id="dm-post-selector" onClick={() => setDropdownOpen(v => !v)}
                className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] text-left text-[12px] font-semibold text-[var(--text-primary)] hover:border-[var(--accent)] transition-colors">
                <span className="truncate">
                  {selectedPost ? selectedPost.title : (latestLoading || whLoading ? 'Loading posts…' : 'Select a post…')}
                </span>
                <ChevronDown className={`w-4 h-4 text-[var(--text-muted)] shrink-0 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {dropdownOpen && (
                <div className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl shadow-xl">
                  {allPosts.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-[var(--text-muted)] italic">No posts available</div>
                  ) : allPosts.map(post => (
                    <button key={post.id} type="button" onClick={() => { setSelectedPost(post); setDropdownOpen(false); }}
                      className={`w-full text-left px-4 py-3 text-[12px] font-medium hover:bg-[var(--hover-bg)] transition-colors border-b border-[var(--card-border)] last:border-b-0 ${selectedPost?.id === post.id ? 'text-[var(--accent)] font-bold bg-[var(--accent-light)]' : 'text-[var(--text-primary)]'}`}>
                      <span className="line-clamp-2">{post.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Step 2 */}
          <div className="space-y-2">
            <label htmlFor="dm-email-subject" className="block text-[12px] font-bold text-[var(--text-primary)]">
              2. Email Subject Line <span className="font-normal text-[var(--text-muted)]">(optional — defaults to post title)</span>
            </label>
            <input id="dm-email-subject" type="text" value={emailSubject} onChange={e => setEmailSubject(e.target.value)}
              placeholder="Leave blank to use the post title…"
              className="w-full px-4 py-3 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition-colors" />
          </div>

          {/* Step 3 */}
          <div className="space-y-2">
            <label htmlFor="dm-opening-msg" className="block text-[12px] font-bold text-[var(--text-primary)]">
              3. Opening Message <span className="font-normal text-[var(--text-muted)]">(shown at the top of the email, in place of the greeting)</span>
            </label>
            <textarea id="dm-opening-msg" rows={4} value={openingMessage} onChange={e => setOpeningMessage(e.target.value)}
              placeholder="Write whatever you'd like readers to see first…"
              className="w-full px-4 py-3 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition-colors resize-y" />
          </div>

          {/* Step 4 */}
          <div className="space-y-2">
            <label htmlFor="dm-readers-file" className="block text-[12px] font-bold text-[var(--text-primary)]">
              4. Select Readers Database <span className="font-normal text-[var(--text-muted)]">(.xlsx, .xls)</span>
            </label>
            <div className="flex items-center gap-3 p-3 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)]">
              <label htmlFor="dm-readers-file" className="cursor-pointer px-4 py-2 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-[11px] font-bold text-[var(--text-primary)] hover:bg-[var(--hover-bg)] transition-colors select-none">
                Choose File
              </label>
              <span className="text-[12px] text-[var(--text-muted)] flex-1 truncate">
                {readersFile ? readersFile.name : 'No file chosen'}
              </span>
              {readersFile && (
                <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                </div>
              )}
              <input ref={fileInputRef} id="dm-readers-file" type="file" accept=".csv,.xlsx,.xls"
                onChange={e => { setReadersFile(e.target.files?.[0] || null); setBlastResult(null); }}
                className="hidden" />
            </div>
          </div>

          {/* Result */}
          {blastResult && (
            <div className={`flex items-start gap-3 p-4 rounded-xl border text-[12px] font-semibold ${blastResult.error ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300' : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'}`}>
              {blastResult.error ? <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" /> : <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />}
              <div className="space-y-1">
                {blastResult.error ? <p>{blastResult.error}</p> :
                  blastResult.mode === 'simulation' ? (
                    <>
                      <p className="font-bold">Simulation Mode</p>
                      <p>{blastResult.message}</p>
                      <p className="text-[11px] opacity-75 font-normal">Configure <code>SMTP_USER</code> &amp; <code>SMTP_PASS</code> env vars on the backend to send real emails.</p>
                    </>
                  ) : (
                    <>
                      <p className="font-bold">Newsletter blasted! {blastResult.sent} sent{blastResult.failed > 0 ? `, ${blastResult.failed} failed` : ''}</p>
                      <p className="text-[11px] font-normal opacity-75">Subject: <em>{blastResult.subject}</em> · Total: {blastResult.total_recipients}</p>
                    </>
                  )}
              </div>
            </div>
          )}

          {/* Blast Button */}
          <button id="dm-blast-btn" type="button" onClick={handleBlast}
            disabled={blasting || !selectedPost || !readersFile}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl text-sm font-extrabold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-violet-500/25 transition-all duration-200 active:scale-[0.98]">
            {blasting ? (<><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>) : (<><Send className="w-4 h-4" /> Blast Bulk Newsletter</>)}
          </button>
        </div>
      </div>
    </div>
  );
}
