'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  TrendingUp,
  RefreshCw,
  History,
  Zap,
  Plus,
  Trash2,
  FileBarChart2,
  ChevronDown,
  X,
  FileText,
  Search,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { api, getOpsBaseUrl } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────
interface PeerCol {
  id: number;
  label: string;
}

interface MetricRow {
  key: string;
  label: string;
}

interface ConsensusRow {
  id: number;
  callDate: string;
  brokerageHouse: string;
  rating: string;
  targetPrice: string;
}

const METRICS: MetricRow[] = [
  { key: 'market_cap', label: 'Market Cap (Cr)' },
  { key: 'pe_ratio',   label: 'P/E Ratio' },
  { key: 'roe',        label: 'ROE (%)' },
  { key: 'roce',       label: 'ROCE (%)' },
  { key: 'opm',        label: 'OPM (%)' },
  { key: 'ev_ebitda',  label: 'EV / EBITDA' },
];

const COMPARISON_MODES = [
  'Peer Comparison (Target Co. vs Peers)',
  'Historical Analysis (Target Co. Multi-Year)',
  'Sector Benchmark Analysis',
  'DCF Intrinsic Value Model',
];

const RECOMMENDATIONS = ['Buy', 'Hold', 'Sell', 'Accumulate', 'Reduce'];

// ─── Card wrapper ─────────────────────────────────────────────
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 ${className}`}>
      {children}
    </div>
  );
}

// ─── Field label ─────────────────────────────────────────────
function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">{children}</div>;
}

// ─── Input classes ────────────────────────────────────────────
const inputCls =
  'w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/60 text-[13px] text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-violet-400 transition-colors';

// ─── Main Page ────────────────────────────────────────────────
export default function EquityResearchWorkPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  // ── Stock search & autocomplete ──
  const [stockQuery, setStockQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [fetchingSuggestions, setFetchingSuggestions] = useState(false);
  const [successToast, setSuccessToast] = useState('');
  const [currentPrice, setCurrentPrice] = useState('');
  const [priceAsOn, setPriceAsOn] = useState(new Date().toISOString().split('T')[0]);
  const [targetPrice, setTargetPrice] = useState('');
  const [fetchingPrice, setFetchingPrice] = useState(false);
  const [fetchError, setFetchError] = useState('');

  // ── Comparison & Recommendation ──
  const [compMode, setCompMode] = useState(COMPARISON_MODES[0]);
  const [recommendation, setRecommendation] = useState('Buy');

  // ── Peer columns (max 6) ──
  const [peers, setPeers] = useState<PeerCol[]>([
    { id: 1, label: 'Target Company' },
    { id: 2, label: 'Peer 1' },
    { id: 3, label: 'Peer 2' },
  ]);
  const [peerNames, setPeerNames] = useState<Record<number, string>>({
    1: 'WIPRO LIMITED (TARGET)',
    2: 'INFY.NS',
    3: 'TCS.NS',
  });

  // ── Metadata ──
  const [industrySector, setIndustrySector] = useState('');
  const [timeHorizon, setTimeHorizon] = useState('');
  const [chartFile, setChartFile] = useState<File | null>(null);
  const chartInputRef = useRef<HTMLInputElement>(null);

  // ── Metrics table data  (metricKey -> colId -> value) ──
  const [metricsData, setMetricsData] = useState<Record<string, Record<number, string>>>({});

  // ── Analyst notes ──
  const [businessOverview, setBusinessOverview] = useState('');
  const [valuationThesis, setValuationThesis] = useState('');
  const [technicalAnalysis, setTechnicalAnalysis] = useState('');

  // ── Street Coverage ──
  const [consensusRows, setConsensusRows] = useState<ConsensusRow[]>([
    { id: 1, callDate: '11/08/2026', brokerageHouse: 'GeoJit', rating: 'Buy', targetPrice: '900' },
  ]);

  const [compiling, setCompiling] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem('ops_user');
    if (savedUser) {
      try { setUser(JSON.parse(savedUser)); } catch {}
    }

    // Load existing report form cache if available
    try {
      const cached = sessionStorage.getItem('equity_research_report_data') || localStorage.getItem('equity_research_report_data');
      if (cached) {
        const d = JSON.parse(cached);
        if (d.stockQuery) setStockQuery(d.stockQuery);
        if (d.currentPrice) setCurrentPrice(d.currentPrice);
        if (d.priceAsOn) setPriceAsOn(d.priceAsOn);
        if (d.targetPrice) setTargetPrice(d.targetPrice);
        if (d.recommendation) setRecommendation(d.recommendation);
        if (d.compMode) setCompMode(d.compMode);
        if (d.industrySector) setIndustrySector(d.industrySector);
        if (d.timeHorizon) setTimeHorizon(d.timeHorizon);
        if (d.peers && Array.isArray(d.peers) && d.peers.length > 0) setPeers(d.peers);
        if (d.peerNames) setPeerNames(d.peerNames);
        if (d.metricsData) setMetricsData(d.metricsData);
        if (d.businessOverview) setBusinessOverview(d.businessOverview);
        if (d.valuationThesis) setValuationThesis(d.valuationThesis);
        if (d.technicalAnalysis) setTechnicalAnalysis(d.technicalAnalysis);
        if (d.consensusRows && Array.isArray(d.consensusRows) && d.consensusRows.length > 0) {
          setConsensusRows(d.consensusRows);
        }
      }
    } catch (err) {
      console.error('Failed to load cached form data:', err);
    }
  }, []);

  // ── Autocomplete search ──
  useEffect(() => {
    if (!stockQuery.trim() || stockQuery.length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setFetchingSuggestions(true);
        const baseUrl = getOpsBaseUrl().replace(/\/$/, '');
        const res = await fetch(`${baseUrl}/ia/search-stocks?query=${encodeURIComponent(stockQuery)}`);
        const data = await res.json();
        setSuggestions(data.results || []);
      } catch {
        setSuggestions([]);
      } finally {
        setFetchingSuggestions(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [stockQuery]);

  // ── Fetch live stock fundamentals & AI intelligence ──
  const handleFetchStockData = async (queryOverride?: string) => {
    const q = (queryOverride || stockQuery).trim();
    if (!q) return;
    setFetchingPrice(true);
    setFetchError('');
    setShowSuggestions(false);
    try {
      const baseUrl = getOpsBaseUrl().replace(/\/$/, '');
      const token = localStorage.getItem('ops_token');
      const res = await fetch(`${baseUrl}/ia/fetch-stock-data?query=${encodeURIComponent(q)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-User-Auth': token || '',
        },
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to fetch stock data');
      }

      if (data.stockQuery) setStockQuery(data.stockQuery);
      if (data.currentPrice) setCurrentPrice(data.currentPrice);
      if (data.priceAsOn) setPriceAsOn(data.priceAsOn);
      if (data.targetPrice) setTargetPrice(data.targetPrice);
      if (data.recommendation) setRecommendation(data.recommendation);
      if (data.compMode) setCompMode(data.compMode);
      if (data.industrySector) setIndustrySector(data.industrySector);
      if (data.timeHorizon) setTimeHorizon(data.timeHorizon);
      if (data.peers && Array.isArray(data.peers)) setPeers(data.peers);
      if (data.peerNames) setPeerNames(data.peerNames);
      if (data.metricsData) setMetricsData(data.metricsData);
      if (data.businessOverview) setBusinessOverview(data.businessOverview);
      if (data.valuationThesis) setValuationThesis(data.valuationThesis);
      if (data.technicalAnalysis) setTechnicalAnalysis(data.technicalAnalysis);
      if (data.consensusRows && Array.isArray(data.consensusRows)) setConsensusRows(data.consensusRows);

      setSuccessToast(`Auto-filled live fundamentals for ${data.companyName || q}!`);
      setTimeout(() => setSuccessToast(''), 4000);
    } catch (err: any) {
      setFetchError(err.message || 'Could not fetch stock data. Enter manually.');
    } finally {
      setFetchingPrice(false);
    }
  };

  // ── Peers ──
  const addPeer = () => {
    if (peers.length >= 6) return;
    const nextId = Date.now();
    const nextNum = peers.length;
    setPeers(p => [...p, { id: nextId, label: `Peer ${nextNum}` }]);
  };

  const removePeer = (id: number) => {
    if (peers.length <= 2) return;
    setPeers(p => p.filter(c => c.id !== id));
    setPeerNames(prev => { const n = { ...prev }; delete n[id]; return n; });
    setMetricsData(prev => {
      const n = { ...prev };
      Object.keys(n).forEach(k => { delete n[k][id]; });
      return n;
    });
  };

  const setMetric = (metricKey: string, colId: number, value: string) => {
    setMetricsData(prev => ({
      ...prev,
      [metricKey]: { ...(prev[metricKey] || {}), [colId]: value },
    }));
  };

  // ── Consensus rows ──
  const addConsensusRow = () => {
    setConsensusRows(r => [...r, { id: Date.now(), callDate: '', brokerageHouse: '', rating: 'Buy', targetPrice: '' }]);
  };
  const removeConsensusRow = (id: number) => {
    if (consensusRows.length <= 1) return;
    setConsensusRows(r => r.filter(row => row.id !== id));
  };
  const updateConsensusRow = (id: number, field: keyof ConsensusRow, value: string) => {
    setConsensusRows(r => r.map(row => row.id === id ? { ...row, [field]: value } : row));
  };

  // ── Compile & Open Report in Dedicated Page ──
  const handleCompile = () => {
    setCompiling(true);

    const proceed = (chartImageData: string | null) => {
      const payload = {
        stockQuery: stockQuery.trim() || 'WIPRO.NS',
        currentPrice: currentPrice || '500',
        priceAsOn: priceAsOn || new Date().toISOString().split('T')[0],
        targetPrice: targetPrice || '999.99',
        recommendation,
        compMode,
        industrySector: industrySector || 'Software IT',
        timeHorizon: timeHorizon || '2-3 yrs',
        peers,
        peerNames,
        metricsData,
        businessOverview,
        valuationThesis,
        technicalAnalysis,
        consensusRows,
        chartImageData,
      };

      try {
        sessionStorage.setItem('equity_research_report_data', JSON.stringify(payload));
        localStorage.setItem('equity_research_report_data', JSON.stringify(payload));
      } catch (err) {
        console.error('Storage error:', err);
      }

      router.push('/employee/equity-research-work/report');
    };

    if (chartFile) {
      const reader = new FileReader();
      reader.onload = () => {
        proceed(reader.result as string);
      };
      reader.onerror = () => {
        proceed(null);
      };
      reader.readAsDataURL(chartFile);
    } else {
      proceed(null);
    }
  };

  const recColor = recommendation === 'Buy' || recommendation === 'Accumulate'
    ? 'text-emerald-700 dark:text-emerald-400 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30'
    : recommendation === 'Sell' || recommendation === 'Reduce'
    ? 'text-red-700 dark:text-red-400 border-red-300 bg-red-50 dark:bg-red-950/30'
    : 'text-amber-700 dark:text-amber-400 border-amber-300 bg-amber-50 dark:bg-amber-950/30';

  return (
    <div className="space-y-5 max-w-4xl mx-auto animate-fadeIn pb-16">

      {/* ── Page Header ─────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-[var(--text-primary)] tracking-tight">Work Hub</h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Equity Research compiler workspace</p>
        </div>
        {user?.designation && (
          <span className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800 shrink-0">
            Designation: {user.designation}
          </span>
        )}
      </div>

      {/* ── Engine Card ──────────────────────────────────── */}
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden shadow-xs">

        {/* Engine header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--card-border)] flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            </div>
            <span className="text-sm font-black text-[var(--text-primary)]">Institutional Stock Research Compiler Engine</span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              type="button"
              onClick={() => router.push('/employee/equity-research-work/report')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--card-border)] text-[11px] font-bold text-[var(--text-muted)] hover:bg-[var(--hover-bg)] transition-colors"
            >
              <FileText className="w-3.5 h-3.5" /> View Current Report
            </button>
            <span className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-[11px] font-bold text-amber-700 dark:text-amber-400">
              <Zap className="w-3 h-3" /> Auto-Fill Enabled
            </span>
          </div>
        </div>

        <div className="p-5 space-y-4">

          {/* Success Toast */}
          {successToast && (
            <div className="flex items-center gap-2 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-[12px] font-bold animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{successToast}</span>
            </div>
          )}

          {/* ── 1. Stock Search Row ───────────────────────── */}
          <Card>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              {/* Search */}
              <div className="sm:col-span-1 relative">
                <FieldLabel>Search Target Stock</FieldLabel>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      id="er-stock-query"
                      type="text"
                      value={stockQuery}
                      onChange={e => {
                        setStockQuery(e.target.value);
                        setShowSuggestions(true);
                      }}
                      onFocus={() => setShowSuggestions(true)}
                      onKeyDown={e => e.key === 'Enter' && handleFetchStockData()}
                      placeholder="e.g. WIPRO, TCS, INFY"
                      className={inputCls}
                    />
                  </div>
                  <button
                    type="button"
                    id="er-fetch-price"
                    onClick={() => handleFetchStockData()}
                    disabled={fetchingPrice || !stockQuery.trim()}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white text-[12px] font-bold transition-all shadow-md shadow-violet-500/20 shrink-0 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${fetchingPrice ? 'animate-spin' : ''}`} />
                    {fetchingPrice ? 'Fetching…' : 'Fetch'}
                  </button>
                </div>

                {/* Autocomplete Dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute left-0 right-0 z-50 mt-1 max-h-56 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl divide-y divide-slate-100 dark:divide-slate-700/60">
                    {suggestions.map((s, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setStockQuery(s.symbol);
                          setShowSuggestions(false);
                          handleFetchStockData(s.symbol);
                        }}
                        className="w-full text-left px-3.5 py-2.5 hover:bg-violet-50 dark:hover:bg-violet-950/30 transition-colors flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <span className="font-bold text-slate-900 dark:text-slate-100">{s.name}</span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 ml-1.5">({s.symbol})</span>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 shrink-0 font-medium">
                          {s.sector}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {fetchError && <p className="mt-1 text-[10px] text-red-500 font-semibold">{fetchError}</p>}
              </div>

              {/* Current Price */}
              <div>
                <FieldLabel>Current Price (₹)</FieldLabel>
                <input
                  id="er-current-price"
                  type="text"
                  value={currentPrice}
                  onChange={e => setCurrentPrice(e.target.value)}
                  placeholder="e.g. 500"
                  className={inputCls}
                />
              </div>

              {/* Price As On */}
              <div>
                <FieldLabel>Price As On</FieldLabel>
                <input
                  id="er-price-date"
                  type="date"
                  value={priceAsOn}
                  onChange={e => setPriceAsOn(e.target.value)}
                  className={inputCls}
                />
              </div>

              {/* Target Price */}
              <div>
                <FieldLabel>Target Price (₹)</FieldLabel>
                <input
                  id="er-target-price"
                  type="text"
                  value={targetPrice}
                  onChange={e => setTargetPrice(e.target.value)}
                  placeholder="e.g. 999.99"
                  className={inputCls}
                />
              </div>
            </div>
          </Card>

          {/* ── 2. Comparison Mode & Recommendation ─────── */}
          <Card>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel>Comparison Mode</FieldLabel>
                <div className="relative">
                  <select
                    id="er-comp-mode"
                    value={compMode}
                    onChange={e => setCompMode(e.target.value)}
                    className={`${inputCls} appearance-none pr-8`}
                  >
                    {COMPARISON_MODES.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <FieldLabel>Recommendation</FieldLabel>
                <div className="relative">
                  <select
                    id="er-recommendation"
                    value={recommendation}
                    onChange={e => setRecommendation(e.target.value)}
                    className={`${inputCls} appearance-none pr-8 font-bold border-2 ${recColor}`}
                  >
                    {RECOMMENDATIONS.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none opacity-60" />
                </div>
              </div>
            </div>
          </Card>

          {/* ── 3. Peer Comparison Identifiers ───────────── */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <FieldLabel>Peer Comparison Identifiers</FieldLabel>
              {peers.length < 6 && (
                <button
                  type="button"
                  id="er-add-peer"
                  onClick={addPeer}
                  className="flex items-center gap-1 text-[11px] font-bold text-violet-600 hover:text-violet-500 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Peer Column (Max 6)
                </button>
              )}
            </div>
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(peers.length, 3)}, 1fr)` }}>
              {peers.map((col, idx) => (
                <div key={col.id} className="relative">
                  <div className="text-[10px] font-bold text-slate-400 mb-1">{col.label}</div>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={peerNames[col.id] || ''}
                      onChange={e => setPeerNames(prev => ({ ...prev, [col.id]: e.target.value }))}
                      placeholder={idx === 0 ? 'Target Co. Name (e.g. WIPRO)' : `Peer ${idx} Name (e.g. INFY)`}
                      className={inputCls}
                    />
                    {idx > 1 && (
                      <button
                        type="button"
                        onClick={() => removePeer(col.id)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors shrink-0 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* ── 4. Industry / Time / Chart ───────────────── */}
          <Card>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <FieldLabel>Industry Sector</FieldLabel>
                <input
                  id="er-industry"
                  type="text"
                  value={industrySector}
                  onChange={e => setIndustrySector(e.target.value)}
                  placeholder="e.g. Software IT"
                  className={inputCls}
                />
              </div>
              <div>
                <FieldLabel>Time Horizon</FieldLabel>
                <input
                  id="er-time-horizon"
                  type="text"
                  value={timeHorizon}
                  onChange={e => setTimeHorizon(e.target.value)}
                  placeholder="e.g. 2-3 yrs"
                  className={inputCls}
                />
              </div>
              <div>
                <FieldLabel>Upload Chart</FieldLabel>
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/60">
                  <label
                    htmlFor="er-chart-file"
                    className="cursor-pointer px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors select-none shrink-0"
                  >
                    Choose File
                  </label>
                  <span className="text-[11px] text-slate-400 truncate">
                    {chartFile ? chartFile.name : 'No file chosen'}
                  </span>
                  <input
                    ref={chartInputRef}
                    id="er-chart-file"
                    type="file"
                    accept="image/*,.pdf"
                    onChange={e => setChartFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* ── 5. Metrics Table ─────────────────────────── */}
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[560px] text-[12px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                  <th className="px-4 py-3 text-left font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[10px] w-40">
                    Metric Dimension
                  </th>
                  {peers.map((col, idx) => (
                    <th key={col.id} className="px-4 py-3 text-center font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[10px]">
                      {peerNames[col.id] || (idx === 0 ? 'Target Company' : col.label)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {METRICS.map(m => (
                  <tr key={m.key} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-bold text-slate-700 dark:text-slate-300 text-[12px]">
                      {m.label}
                    </td>
                    {peers.map((col, idx) => (
                      <td key={col.id} className="px-3 py-2">
                        <input
                          type="text"
                          value={metricsData[m.key]?.[col.id] || ''}
                          onChange={e => setMetric(m.key, col.id, e.target.value)}
                          placeholder={`Enter ${m.label.split(' ')[0]}...`}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/40 text-[12px] text-slate-700 dark:text-slate-300 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400 text-center transition-colors"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* ── 6. Analyst Narrative ─────────────────────── */}
          <Card>
            <div className="space-y-4">
              <div>
                <FieldLabel>Business Overview (Moat)</FieldLabel>
                <textarea
                  id="er-business-overview"
                  rows={3}
                  value={businessOverview}
                  onChange={e => setBusinessOverview(e.target.value)}
                  placeholder="e.g. business will grow through digital IT and cloud expansion..."
                  className={`${inputCls} resize-y`}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Relative Valuation Thesis</FieldLabel>
                  <textarea
                    id="er-valuation-thesis"
                    rows={3}
                    value={valuationThesis}
                    onChange={e => setValuationThesis(e.target.value)}
                    placeholder="e.g. more scope than peer companies..."
                    className={`${inputCls} resize-y`}
                  />
                </div>
                <div>
                  <FieldLabel>Technical Chart Analysis</FieldLabel>
                  <textarea
                    id="er-tech-analysis"
                    rows={3}
                    value={technicalAnalysis}
                    onChange={e => setTechnicalAnalysis(e.target.value)}
                    placeholder="e.g. Gap between buy and hold with pattern breakout..."
                    className={`${inputCls} resize-y`}
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* ── 7. Street Coverage Consensus ─────────────── */}
          <Card className="p-0 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-700">
              <span className="text-[12px] font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                Street Coverage Consensus Analytics
              </span>
              <button
                type="button"
                id="er-add-consensus-row"
                onClick={addConsensusRow}
                className="flex items-center gap-1 text-[11px] font-bold text-violet-600 hover:text-violet-500 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Row
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[580px] text-[12px]">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                    {['Call Date', 'Brokerage House', 'Rating Recommendation', 'Target Price (₹)', ''].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {consensusRows.map(row => (
                    <tr key={row.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-3 py-2">
                        <input type="text" value={row.callDate} onChange={e => updateConsensusRow(row.id, 'callDate', e.target.value)}
                          placeholder="e.g. 11/08/2026" className={inputCls} />
                      </td>
                      <td className="px-3 py-2">
                        <input type="text" value={row.brokerageHouse} onChange={e => updateConsensusRow(row.id, 'brokerageHouse', e.target.value)}
                          placeholder="e.g. GeoJit" className={inputCls} />
                      </td>
                      <td className="px-3 py-2">
                        <input type="text" value={row.rating} onChange={e => updateConsensusRow(row.id, 'rating', e.target.value)}
                          placeholder="e.g. Buy" className={inputCls} />
                      </td>
                      <td className="px-3 py-2">
                        <input type="text" value={row.targetPrice} onChange={e => updateConsensusRow(row.id, 'targetPrice', e.target.value)}
                          placeholder="e.g. 900" className={inputCls} />
                      </td>
                      <td className="px-3 py-2">
                        <button type="button" onClick={() => removeConsensusRow(row.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* ── Compile Button ────────────────────────────── */}
          <button
            id="er-compile-btn"
            type="button"
            onClick={handleCompile}
            disabled={compiling}
            className="w-full flex items-center justify-center gap-2.5 py-4 rounded-xl text-sm font-extrabold text-white
              bg-gradient-to-r from-violet-600 via-indigo-600 to-violet-700
              hover:from-violet-500 hover:to-indigo-500
              shadow-lg shadow-violet-500/25
              transition-all duration-200 active:scale-[0.98] cursor-pointer"
          >
            <FileBarChart2 className="w-5 h-5" />
            {compiling ? 'Compiling Dossier Report…' : 'Compile Standard Research Report'}
          </button>

        </div>
      </div>
    </div>
  );
}
