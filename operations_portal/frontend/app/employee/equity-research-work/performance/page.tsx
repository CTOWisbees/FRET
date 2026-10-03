'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Plus,
  Search,
  Filter,
  Calendar,
  DollarSign,
  Award,
  CheckCircle2,
  AlertCircle,
  Clock,
  Briefcase,
  User,
  ChevronRight,
  FileBarChart2,
  Trash2,
  Edit3,
  X,
  Calculator,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Layers,
  ChevronDown
} from 'lucide-react';
import { api, getOpsBaseUrl } from '@/lib/api';

// ─── Interfaces ───────────────────────────────────────────────────
interface Recommendation {
  id: number;
  symbol: string;
  company_name: string;
  sector: string;
  client_name: string;
  recommendation_type: string;
  recommendation_date: string;
  recommended_price: number;
  target_price: number;
  stop_loss: number | null;
  time_horizon: string;
  current_price: number;
  last_price_update: string | null;
  status: string;
  exit_price: number | null;
  exit_date: string | null;
  notes: string;
  gain_abs: number;
  return_pct: number;
  target_diff: number;
  target_progress_pct: number;
  holding_days: number;
  holding_months: number;
  cagr_pct: number;
}

interface SummaryStats {
  total_recommendations: number;
  active_count: number;
  target_hit_count: number;
  avg_return_pct: number;
  win_rate_pct: number;
  avg_holding_days: number;
  avg_holding_months: number;
  best_call: { symbol: string; company_name: string; return_pct: number; gain_abs: number } | null;
  worst_call: { symbol: string; company_name: string; return_pct: number } | null;
}

export default function StockPerformanceTrackerPage() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshingPrices, setRefreshingPrices] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // ── Filters & Controls ──
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showCalculator, setShowCalculator] = useState(false);

  // ── Add / Edit Modal State ──
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    symbol: '',
    company_name: '',
    sector: '',
    client_name: '',
    recommendation_type: 'Buy',
    recommendation_date: new Date().toISOString().split('T')[0],
    recommended_price: '',
    target_price: '',
    stop_loss: '',
    time_horizon: '3 Months',
    notes: '',
    status: 'Active',
  });
  const [modalStockQuery, setModalStockQuery] = useState('');
  const [modalSuggestions, setModalSuggestions] = useState<any[]>([]);
  const [fetchingModalStock, setFetchingModalStock] = useState(false);
  const [savingForm, setSavingForm] = useState(false);

  // ── Standalone Calculator State ──
  const [calcSymbol, setCalcSymbol] = useState('');
  const [calcBuyPrice, setCalcBuyPrice] = useState('');
  const [calcBuyDate, setCalcBuyDate] = useState(
    new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [calcEvalDate, setCalcEvalDate] = useState(new Date().toISOString().split('T')[0]);
  const [calcTargetPrice, setCalcTargetPrice] = useState('');
  const [calcResult, setCalcResult] = useState<any>(null);
  const [calcLoading, setCalcLoading] = useState(false);

  // ── Fetch Recommendations & Performance ──
  const fetchPerformanceData = async (dateOverride?: string) => {
    try {
      setLoading(true);
      const evalDate = dateOverride || asOfDate;
      const baseUrl = getOpsBaseUrl().replace(/\/$/, '');
      const token = localStorage.getItem('ops_token');

      let url = `${baseUrl}/ia/recommendations?as_of_date=${evalDate}`;
      if (statusFilter !== 'all') url += `&status=${statusFilter}`;
      if (typeFilter !== 'all') url += `&type=${typeFilter}`;
      if (searchQuery.trim()) url += `&search=${encodeURIComponent(searchQuery.trim())}`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-User-Auth': token || '',
        },
      });

      const data = await res.json();
      if (data.success) {
        setRecommendations(data.recommendations || []);
        setSummary(data.summary || null);
      }
    } catch (err) {
      console.error('Failed to load stock recommendations performance:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPerformanceData();
  }, [asOfDate, statusFilter, typeFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPerformanceData();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ── Sync Live Market Prices ──
  const handleSyncLivePrices = async () => {
    try {
      setRefreshingPrices(true);
      const baseUrl = getOpsBaseUrl().replace(/\/$/, '');
      const token = localStorage.getItem('ops_token');

      const res = await fetch(`${baseUrl}/ia/recommendations/refresh-prices`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-User-Auth': token || '',
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json();
      if (data.success) {
        setToastMessage(data.message || 'Live prices updated successfully!');
        fetchPerformanceData();
      } else {
        setToastMessage(data.error || 'Failed to update prices');
      }
      setTimeout(() => setToastMessage(''), 4000);
    } catch (err) {
      setToastMessage('Error connecting to live market prices');
      setTimeout(() => setToastMessage(''), 4000);
    } finally {
      setRefreshingPrices(false);
    }
  };

  // ── Standalone Calculator Trigger ──
  const handleRunCalculation = async () => {
    if (!calcSymbol.trim()) {
      setToastMessage('Please enter a stock ticker (e.g. TCS.NS or WABAG.NS)');
      setTimeout(() => setToastMessage(''), 3000);
      return;
    }
    try {
      setCalcLoading(true);
      const baseUrl = getOpsBaseUrl().replace(/\/$/, '');
      const url = `${baseUrl}/ia/recommendations/calculate?symbol=${encodeURIComponent(
        calcSymbol.trim()
      )}&buy_price=${calcBuyPrice || ''}&buy_date=${calcBuyDate}&eval_date=${calcEvalDate}&target_price=${
        calcTargetPrice || ''
      }`;

      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setCalcResult(data.calculation);
      } else {
        setToastMessage(data.error || 'Calculation failed');
        setTimeout(() => setToastMessage(''), 3000);
      }
    } catch (err) {
      setToastMessage('Error running calculation');
      setTimeout(() => setToastMessage(''), 3000);
    } finally {
      setCalcLoading(false);
    }
  };

  // ── Modal Autocomplete Search ──
  useEffect(() => {
    if (!modalStockQuery.trim() || modalStockQuery.length < 2) {
      setModalSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setFetchingModalStock(true);
        const baseUrl = getOpsBaseUrl().replace(/\/$/, '');
        const res = await fetch(`${baseUrl}/ia/search-stocks?query=${encodeURIComponent(modalStockQuery)}`);
        const data = await res.json();
        setModalSuggestions(data.results || []);
      } catch {
        setModalSuggestions([]);
      } finally {
        setFetchingModalStock(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [modalStockQuery]);

  const selectStockForModal = async (stock: any) => {
    setModalSuggestions([]);
    setModalStockQuery(stock.symbol);
    setFormData(prev => ({
      ...prev,
      symbol: stock.symbol,
      company_name: stock.name || stock.symbol.replace('.NS', ''),
      sector: stock.sector || 'Equities',
    }));

    // Auto fetch live current price to prefill recommended price
    try {
      const baseUrl = getOpsBaseUrl().replace(/\/$/, '');
      const token = localStorage.getItem('ops_token');
      const res = await fetch(`${baseUrl}/ia/fetch-stock-data?query=${encodeURIComponent(stock.symbol)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.currentPrice) {
        const cp = parseFloat(data.currentPrice);
        setFormData(prev => ({
          ...prev,
          recommended_price: String(cp),
          target_price: prev.target_price || String(roundTo2(cp * 1.25)),
          stop_loss: prev.stop_loss || String(roundTo2(cp * 0.9)),
        }));
      }
    } catch (e) {}
  };

  const handleOpenAddModal = () => {
    setEditingId(null);
    setModalStockQuery('');
    setFormData({
      symbol: '',
      company_name: '',
      sector: '',
      client_name: '',
      recommendation_type: 'Buy',
      recommendation_date: new Date().toISOString().split('T')[0],
      recommended_price: '',
      target_price: '',
      stop_loss: '',
      time_horizon: '3 Months',
      notes: '',
      status: 'Active',
    });
    setShowModal(true);
  };

  const handleOpenEditModal = (rec: Recommendation) => {
    setEditingId(rec.id);
    setModalStockQuery(rec.symbol);
    setFormData({
      symbol: rec.symbol,
      company_name: rec.company_name,
      sector: rec.sector,
      client_name: rec.client_name,
      recommendation_type: rec.recommendation_type,
      recommendation_date: rec.recommendation_date,
      recommended_price: String(rec.recommended_price),
      target_price: String(rec.target_price),
      stop_loss: rec.stop_loss ? String(rec.stop_loss) : '',
      time_horizon: rec.time_horizon,
      notes: rec.notes,
      status: rec.status,
    });
    setShowModal(true);
  };

  const handleSaveRecommendation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.symbol.trim() || !formData.recommended_price) {
      setToastMessage('Please fill stock symbol and buying price.');
      setTimeout(() => setToastMessage(''), 3000);
      return;
    }

    try {
      setSavingForm(true);
      const baseUrl = getOpsBaseUrl().replace(/\/$/, '');
      const token = localStorage.getItem('ops_token');

      const url = editingId
        ? `${baseUrl}/ia/recommendations/${editingId}/update`
        : `${baseUrl}/ia/recommendations/create`;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-User-Auth': token || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (data.success) {
        setShowModal(false);
        setToastMessage(data.message || 'Saved successfully!');
        fetchPerformanceData();
      } else {
        setToastMessage(data.error || 'Failed to save');
      }
      setTimeout(() => setToastMessage(''), 3500);
    } catch (err) {
      setToastMessage('Error saving recommendation');
      setTimeout(() => setToastMessage(''), 3500);
    } finally {
      setSavingForm(false);
    }
  };

  const handleDeleteRecommendation = async (id: number, sym: string) => {
    if (!confirm(`Are you sure you want to delete recommendation for ${sym}?`)) return;
    try {
      const baseUrl = getOpsBaseUrl().replace(/\/$/, '');
      const token = localStorage.getItem('ops_token');
      const res = await fetch(`${baseUrl}/ia/recommendations/${id}/delete`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-User-Auth': token || '',
        },
      });
      const data = await res.json();
      if (data.success) {
        setToastMessage(`Deleted recommendation for ${sym}`);
        fetchPerformanceData();
      }
      setTimeout(() => setToastMessage(''), 3000);
    } catch {
      setToastMessage('Failed to delete');
    }
  };

  const roundTo2 = (num: number) => Math.round(num * 100) / 100;

  // Preset Date handlers
  const handleDatePreset = (daysAgo: number) => {
    const target = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    const dStr = target.toISOString().split('T')[0];
    setAsOfDate(dStr);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fadeIn pb-24 text-slate-800 dark:text-slate-100">
      {/* ── Toast Alert ── */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700 animate-bounce text-xs font-semibold">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── Top Workspace Navigation Tabs ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-2 bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
          <Link
            href="/employee/equity-research-work/performance"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm border border-emerald-500/20"
          >
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <span>Stock Returns & Performance Tracker</span>
            <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/80 text-[10px] text-emerald-700 dark:text-emerald-300 font-extrabold">
              LIVE
            </span>
          </Link>
          <Link
            href="/employee/equity-research-work"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-700/60 transition"
          >
            <FileBarChart2 className="w-4 h-4" />
            <span>Research Dossier Compiler</span>
          </Link>
          <Link
            href="/employee/equity-research-work/report"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-700/60 transition"
          >
            <span>Dossier Preview Report</span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCalculator(!showCalculator)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800/60 rounded-xl hover:bg-violet-100 transition cursor-pointer"
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>{showCalculator ? 'Hide Calculator' : 'Quick Returns Calculator'}</span>
          </button>
          <button
            type="button"
            onClick={handleSyncLivePrices}
            disabled={refreshingPrices}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-600 transition disabled:opacity-50 cursor-pointer shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-500 ${refreshingPrices ? 'animate-spin' : ''}`} />
            <span>{refreshingPrices ? 'Syncing...' : 'Sync Live Prices'}</span>
          </button>
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl shadow-md shadow-emerald-500/20 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Log Recommendation</span>
          </button>
        </div>
      </div>

      {/* ── Standalone Live Instant Calculator (Collapsible) ── */}
      {showCalculator && (
        <div className="bg-gradient-to-br from-violet-900/10 via-slate-900/5 to-emerald-900/10 dark:from-slate-800/80 dark:to-slate-900 border border-violet-200 dark:border-violet-800/50 rounded-3xl p-6 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-violet-600 text-white shadow-md shadow-violet-500/30">
                <Calculator className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black tracking-tight">Instant Performance & Holding Returns Calculator</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Simulate stock buying price on any past date vs current or custom target date.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowCalculator(false)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Stock Ticker</label>
              <input
                type="text"
                value={calcSymbol}
                onChange={e => setCalcSymbol(e.target.value.toUpperCase())}
                placeholder="e.g. TCS.NS or WABAG"
                className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Buying Price (₹)</label>
              <input
                type="number"
                step="any"
                value={calcBuyPrice}
                onChange={e => setCalcBuyPrice(e.target.value)}
                placeholder="e.g. 1500"
                className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Recommendation Date</label>
              <input
                type="date"
                value={calcBuyDate}
                onChange={e => setCalcBuyDate(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Evaluation Date</label>
              <input
                type="date"
                value={calcEvalDate}
                onChange={e => setCalcEvalDate(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Target Price (Optional ₹)</label>
              <div className="flex gap-2 mt-1">
                <input
                  type="number"
                  step="any"
                  value={calcTargetPrice}
                  onChange={e => setCalcTargetPrice(e.target.value)}
                  placeholder="e.g. 1950"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
                />
                <button
                  type="button"
                  onClick={handleRunCalculation}
                  disabled={calcLoading}
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-bold transition shrink-0 cursor-pointer shadow-md"
                >
                  {calcLoading ? '...' : 'Compute'}
                </button>
              </div>
            </div>
          </div>

          {/* Calculator Output Display */}
          {calcResult && (
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700/80 shadow-inner grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 animate-fadeIn">
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Price as of Date</div>
                <div className="text-sm font-extrabold mt-0.5">₹{calcResult.current_price}</div>
                <div className="text-[10px] text-slate-500">Buy: ₹{calcResult.buy_price}</div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Absolute Gain/Loss</div>
                <div
                  className={`text-sm font-extrabold mt-0.5 ${
                    calcResult.gain_abs >= 0 ? 'text-emerald-500' : 'text-red-500'
                  }`}
                >
                  {calcResult.gain_abs >= 0 ? '+' : ''}₹{calcResult.gain_abs}
                </div>
                <div className="text-[10px] text-slate-500">Per share</div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Total Return %</div>
                <div
                  className={`text-base font-black mt-0.5 flex items-center gap-1 ${
                    calcResult.return_pct >= 0 ? 'text-emerald-500' : 'text-red-500'
                  }`}
                >
                  {calcResult.return_pct >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  <span>{calcResult.return_pct > 0 ? `+${calcResult.return_pct}` : calcResult.return_pct}%</span>
                </div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Holding Period</div>
                <div className="text-sm font-extrabold mt-0.5">{calcResult.holding_months} Months</div>
                <div className="text-[10px] text-slate-500">{calcResult.holding_days} Days elapsed</div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Target Progress</div>
                <div className="text-sm font-extrabold text-violet-500 mt-0.5">{calcResult.target_progress_pct}%</div>
                <div className="text-[10px] text-slate-500">Target: ₹{calcResult.target_price}</div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Annualized (CAGR)</div>
                <div className="text-sm font-extrabold text-blue-500 mt-0.5">{calcResult.cagr_pct}%</div>
                <div className="text-[10px] text-slate-500">Annual basis</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Historical Performance Controller & Date Filter ── */}
      <div className="bg-white dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900 dark:text-white">Calculate Performance As On Date:</div>
            <div className="text-[11px] text-slate-500">
              Evaluates portfolio returns, holding duration, and market prices as on selected date.
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={asOfDate}
            onChange={e => setAsOfDate(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
          <div className="flex items-center gap-1 border-l border-slate-200 dark:border-slate-700 pl-2">
            <button
              onClick={() => setAsOfDate(new Date().toISOString().split('T')[0])}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition ${
                asOfDate === new Date().toISOString().split('T')[0]
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              Today (Live)
            </button>
            <button
              onClick={() => handleDatePreset(30)}
              className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition"
            >
              1M Ago
            </button>
            <button
              onClick={() => handleDatePreset(60)}
              className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition"
            >
              2M Ago
            </button>
            <button
              onClick={() => handleDatePreset(90)}
              className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition"
            >
              3M Ago
            </button>
          </div>
        </div>
      </div>

      {/* ── Summary KPI Dashboard Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {/* Card 1: Average Return Generated */}
        <div className="bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent bg-white dark:bg-slate-800/80 border border-emerald-200 dark:border-emerald-800/60 rounded-3xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Avg Portfolio Return
            </span>
            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`text-2xl sm:text-3xl font-black ${
                (summary?.avg_return_pct || 0) >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {(summary?.avg_return_pct || 0) > 0 ? `+${summary?.avg_return_pct}` : summary?.avg_return_pct || '0.0'}%
            </span>
            <span className="text-[11px] text-slate-400 font-semibold">as of {asOfDate}</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            Win Rate: <strong className="text-emerald-600 dark:text-emerald-400">{summary?.win_rate_pct || 0}%</strong>{' '}
            profitable calls
          </div>
        </div>

        {/* Card 2: Total & Active Tracked */}
        <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-3xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              Recommendations Tracked
            </span>
            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              {summary?.total_recommendations || 0}
            </span>
            <span className="text-[11px] text-slate-400">Stocks</span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
            <span className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold">
              {summary?.active_count || 0} Active
            </span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-bold">
              {summary?.target_hit_count || 0} Target Hit
            </span>
          </div>
        </div>

        {/* Card 3: Avg Holding Duration */}
        <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-3xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              Avg Holding Period
            </span>
            <div className="p-2 rounded-xl bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              {summary?.avg_holding_months || 0}
            </span>
            <span className="text-xs text-slate-400 font-bold">Months</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            Average <strong>{summary?.avg_holding_days || 0} days</strong> from buying date
          </div>
        </div>

        {/* Card 4: Top Performer Call */}
        <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-3xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Best Performing Call
            </span>
            <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400">
              <Award className="w-4 h-4" />
            </div>
          </div>
          {summary?.best_call ? (
            <div className="mt-2">
              <div className="flex items-center justify-between">
                <span className="text-base font-black truncate">{summary.best_call.symbol}</span>
                <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                  +{summary.best_call.return_pct}%
                </span>
              </div>
              <div className="text-[11px] text-slate-400 truncate mt-0.5">{summary.best_call.company_name}</div>
            </div>
          ) : (
            <div className="mt-3 text-xs text-slate-400 font-semibold">No recommendations yet</div>
          )}
        </div>
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm">
        <div className="flex-1 min-w-[240px] relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by stock symbol, company, or client..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold">
            <Filter className="w-3.5 h-3.5" /> Status:
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-xs font-semibold focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Target Hit">Target Hit</option>
            <option value="Stop Loss Hit">Stop Loss Hit</option>
            <option value="Closed">Closed</option>
          </select>

          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold ml-2">Type:</div>
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-xs font-semibold focus:outline-none"
          >
            <option value="all">All Types</option>
            <option value="Buy">Buy</option>
            <option value="Strong Buy">Strong Buy</option>
            <option value="Accumulate">Accumulate</option>
            <option value="Hold">Hold</option>
            <option value="Sell">Sell</option>
          </select>
        </div>
      </div>

      {/* ── Recommendations Table & Card View ── */}
      <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-3xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Tracked Client Recommendations</h3>
            <p className="text-[11px] text-slate-400">
              Live calculation of profit/loss from recommendation date to {asOfDate}
            </p>
          </div>
          <div className="text-xs font-bold text-slate-500">
            Showing <span className="text-emerald-600 dark:text-emerald-400">{recommendations.length}</span> calls
          </div>
        </div>

        {loading ? (
          <div className="p-16 text-center text-slate-400 text-xs font-bold animate-pulse flex flex-col items-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-emerald-500" />
            <span>Calculating stock returns & price history...</span>
          </div>
        ) : recommendations.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 mx-auto flex items-center justify-center mb-3">
              <TrendingUp className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">No stock recommendations found</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Start logging your buy calls for clients to automatically calculate and track their multi-month returns.
            </p>
            <button
              onClick={handleOpenAddModal}
              className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-md cursor-pointer"
            >
              + Add First Recommendation
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 uppercase tracking-wider text-[10px] font-black border-b border-slate-200 dark:border-slate-700">
                  <th className="px-4 py-3">Stock & Sector</th>
                  <th className="px-4 py-3">Client / Portfolio</th>
                  <th className="px-4 py-3 text-center">Type</th>
                  <th className="px-4 py-3 text-right">Recommended Date & Buy Price</th>
                  <th className="px-4 py-3 text-right">Price as of {asOfDate}</th>
                  <th className="px-4 py-3 text-right">Gain / Share (₹)</th>
                  <th className="px-4 py-3 text-center">Return %</th>
                  <th className="px-4 py-3 text-center">Holding Period</th>
                  <th className="px-4 py-3">Target & Progress</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium">
                {recommendations.map(rec => {
                  const isPos = rec.return_pct >= 0;
                  return (
                    <tr
                      key={rec.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-750 transition-colors"
                    >
                      {/* Stock & Sector */}
                      <td className="px-4 py-3.5">
                        <div className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>{rec.symbol}</span>
                          {rec.status === 'Target Hit' && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[140px]">
                          {rec.company_name} • <span className="text-slate-500">{rec.sector}</span>
                        </div>
                      </td>

                      {/* Client / Portfolio */}
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-700 dark:text-slate-200">
                          {rec.client_name || <span className="text-slate-400 italic">General / All Clients</span>}
                        </div>
                        <div className="text-[10px] text-slate-400">{rec.time_horizon} horizon</div>
                      </td>

                      {/* Recommendation Type */}
                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                            rec.recommendation_type === 'Buy' || rec.recommendation_type === 'Strong Buy'
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                              : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300'
                          }`}
                        >
                          {rec.recommendation_type}
                        </span>
                      </td>

                      {/* Recommended Price */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="font-bold text-slate-900 dark:text-white">₹{rec.recommended_price}</div>
                        <div className="text-[10px] text-slate-400">{rec.recommendation_date}</div>
                      </td>

                      {/* Current Evaluated Price */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="font-extrabold text-slate-900 dark:text-white">₹{rec.current_price}</div>
                        <div className="text-[9px] text-slate-400">
                          {asOfDate === new Date().toISOString().split('T')[0] ? 'Live Market' : 'Historical close'}
                        </div>
                      </td>

                      {/* Absolute Gain */}
                      <td className="px-4 py-3.5 text-right font-bold">
                        <span className={isPos ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}>
                          {isPos ? '+' : ''}₹{rec.gain_abs}
                        </span>
                      </td>

                      {/* Return % */}
                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={`inline-flex items-center gap-0.5 px-2.5 py-1 rounded-xl text-xs font-black shadow-xs ${
                            isPos
                              ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                              : 'bg-red-50 dark:bg-red-950/80 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800'
                          }`}
                        >
                          {isPos ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                          {isPos ? `+${rec.return_pct}` : rec.return_pct}%
                        </span>
                        {rec.cagr_pct !== 0 && (
                          <div className="text-[9px] text-slate-400 mt-0.5">{rec.cagr_pct}% CAGR</div>
                        )}
                      </td>

                      {/* Holding Period */}
                      <td className="px-4 py-3.5 text-center">
                        <div className="font-bold text-slate-800 dark:text-slate-200">{rec.holding_months} mo</div>
                        <div className="text-[10px] text-slate-400">{rec.holding_days} days</div>
                      </td>

                      {/* Target & Progress */}
                      <td className="px-4 py-3.5 min-w-[130px]">
                        <div className="flex items-center justify-between text-[10px] font-bold">
                          <span>Target: ₹{rec.target_price}</span>
                          <span className="text-violet-600 dark:text-violet-400">{rec.target_progress_pct}%</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full mt-1 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              rec.target_progress_pct >= 100
                                ? 'bg-emerald-500'
                                : rec.target_progress_pct >= 50
                                ? 'bg-violet-500'
                                : 'bg-blue-400'
                            }`}
                            style={{ width: `${Math.min(Math.max(rec.target_progress_pct, 0), 100)}%` }}
                          />
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                            rec.status === 'Target Hit'
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                              : rec.status === 'Active'
                              ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {rec.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleOpenEditModal(rec)}
                            className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-lg transition"
                            title="Edit Recommendation"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteRecommendation(rec.id, rec.symbol)}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-slate-700 rounded-lg transition"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Add / Edit Recommendation Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl max-w-xl w-full p-6 shadow-2xl animate-scaleUp overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-600 text-white shadow-md">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black">
                    {editingId ? 'Edit Stock Recommendation' : 'Log Client Stock Recommendation'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Track price performance and percentage returns automatically over time.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRecommendation} className="space-y-4 text-xs">
              {/* Stock Search & Autocomplete */}
              <div className="relative">
                <label className="font-bold text-slate-500 uppercase tracking-wide text-[10px]">
                  Stock Symbol / Ticker *
                </label>
                <input
                  type="text"
                  required
                  value={formData.symbol}
                  onChange={e => {
                    const val = e.target.value.toUpperCase();
                    setFormData(prev => ({ ...prev, symbol: val }));
                    setModalStockQuery(val);
                  }}
                  placeholder="e.g. TCS.NS, WABAG.NS, INFY"
                  className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold"
                />

                {/* Suggestions drop */}
                {modalSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                    {modalSuggestions.map(s => (
                      <div
                        key={s.symbol}
                        onClick={() => selectStockForModal(s)}
                        className="px-3 py-2 hover:bg-emerald-50 dark:hover:bg-slate-700 cursor-pointer flex items-center justify-between"
                      >
                        <div>
                          <div className="font-extrabold">{s.symbol}</div>
                          <div className="text-[10px] text-slate-400">{s.name}</div>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-900 font-bold">
                          {s.sector}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-500 uppercase tracking-wide text-[10px]">Company Name</label>
                  <input
                    type="text"
                    value={formData.company_name}
                    onChange={e => setFormData(prev => ({ ...prev, company_name: e.target.value }))}
                    placeholder="e.g. Tata Consultancy Services"
                    className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-500 uppercase tracking-wide text-[10px]">Industry Sector</label>
                  <input
                    type="text"
                    value={formData.sector}
                    onChange={e => setFormData(prev => ({ ...prev, sector: e.target.value }))}
                    placeholder="e.g. Technology, Infrastructure"
                    className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-500 uppercase tracking-wide text-[10px]">
                    Client / Portfolio Name
                  </label>
                  <input
                    type="text"
                    value={formData.client_name}
                    onChange={e => setFormData(prev => ({ ...prev, client_name: e.target.value }))}
                    placeholder="e.g. Rajesh Sharma HNI / Wealth Client"
                    className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-500 uppercase tracking-wide text-[10px]">
                    Recommendation Type
                  </label>
                  <select
                    value={formData.recommendation_type}
                    onChange={e => setFormData(prev => ({ ...prev, recommendation_type: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold"
                  >
                    <option value="Buy">Buy</option>
                    <option value="Strong Buy">Strong Buy</option>
                    <option value="Accumulate">Accumulate</option>
                    <option value="Hold">Hold</option>
                    <option value="Sell">Sell</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-500 uppercase tracking-wide text-[10px]">
                    Recommended Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.recommendation_date}
                    onChange={e => setFormData(prev => ({ ...prev, recommendation_date: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-500 uppercase tracking-wide text-[10px]">
                    Buying Price (₹) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formData.recommended_price}
                    onChange={e => setFormData(prev => ({ ...prev, recommended_price: e.target.value }))}
                    placeholder="1500.00"
                    className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-500 uppercase tracking-wide text-[10px]">Target Price (₹)</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.target_price}
                    onChange={e => setFormData(prev => ({ ...prev, target_price: e.target.value }))}
                    placeholder="1850.00"
                    className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-500 uppercase tracking-wide text-[10px]">Stop Loss (₹)</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.stop_loss}
                    onChange={e => setFormData(prev => ({ ...prev, stop_loss: e.target.value }))}
                    placeholder="1380.00"
                    className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-red-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-500 uppercase tracking-wide text-[10px]">Time Horizon</label>
                  <input
                    type="text"
                    value={formData.time_horizon}
                    onChange={e => setFormData(prev => ({ ...prev, time_horizon: e.target.value }))}
                    placeholder="e.g. 1 - 3 Months"
                    className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-500 uppercase tracking-wide text-[10px]">Status</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold"
                  >
                    <option value="Active">Active</option>
                    <option value="Target Hit">Target Hit</option>
                    <option value="Stop Loss Hit">Stop Loss Hit</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-500 uppercase tracking-wide text-[10px]">
                  Investment Rationale & Notes
                </label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="e.g. Breakout on 200 EMA with 3x volume, order book growth..."
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs resize-y"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingForm}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold shadow-md shadow-emerald-500/20 transition disabled:opacity-50 cursor-pointer"
                >
                  {savingForm ? 'Saving...' : editingId ? 'Update Call' : 'Save Recommendation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
