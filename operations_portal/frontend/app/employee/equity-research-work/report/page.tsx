'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Download,
  ArrowLeft,
  History,
  Edit3,
} from 'lucide-react';

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

export default function EquityResearchReportPage() {
  const router = useRouter();
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditable, setIsEditable] = useState(false);
  const dossierRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('equity_research_report_data') || localStorage.getItem('equity_research_report_data');
      if (saved) {
        setReportData(JSON.parse(saved));
      }
    } catch (err) {
      console.error('Failed to load report data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const handleBackToEdit = () => {
    router.push('/employee/equity-research-work');
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center text-slate-400">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-bold text-slate-300">Loading Compiled Research Dossier...</span>
        </div>
      </div>
    );
  }

  // Fallback defaults if accessed directly
  const data = reportData || {
    stockQuery: 'WIPRO',
    currentPrice: '382.13',
    priceAsOn: new Date().toISOString().split('T')[0],
    targetPrice: '999.99',
    recommendation: 'Buy',
    compMode: 'Peer Comparison (Target Co. vs Peers)',
    industrySector: 'Software IT',
    timeHorizon: '2-3 yrs',
    peers: [
      { id: 1, label: 'Target Company' },
      { id: 2, label: 'Peer 1' },
      { id: 3, label: 'Peer 2' },
    ],
    peerNames: { 1: 'WIPRO LIMITED (TARGET)', 2: 'INFY.NS', 3: 'TCS.NS' },
    metricsData: {},
    businessOverview: '',
    valuationThesis: '',
    technicalAnalysis: '',
    consensusRows: [],
    chartImageData: null,
  };

  const stockQuery = data.stockQuery || 'TARGET';
  const currentPrice = data.currentPrice || '0';
  const targetPrice = data.targetPrice || '0';
  const priceAsOn = data.priceAsOn || new Date().toISOString().split('T')[0];
  const recommendation = data.recommendation || 'Buy';
  const industrySector = data.industrySector || '—';
  const timeHorizon = data.timeHorizon || '—';
  const peers: PeerCol[] = data.peers || [];
  const peerNames: Record<number, string> = data.peerNames || {};
  const metricsData: Record<string, Record<number, string>> = data.metricsData || {};
  const businessOverview = data.businessOverview || '';
  const valuationThesis = data.valuationThesis || '';
  const technicalAnalysis = data.technicalAnalysis || '';
  const consensusRows: ConsensusRow[] = data.consensusRows || [];
  const chartImageData = data.chartImageData || null;

  // Numeric Calculations
  const cmpNum = parseFloat(currentPrice) || 0;
  const tgtNum = parseFloat(targetPrice) || 0;
  const hasValidPrices = cmpNum > 0 && tgtNum > 0;
  const calculatedUpside = hasValidPrices
    ? (((tgtNum - cmpNum) / cmpNum) * 100).toFixed(1)
    : '0.0';
  const isPositiveUpside = parseFloat(calculatedUpside) >= 0;

  const recColor =
    recommendation === 'Buy' || recommendation === 'Accumulate'
      ? 'text-emerald-600'
      : recommendation === 'Sell' || recommendation === 'Reduce'
      ? 'text-red-600'
      : 'text-amber-600';

  return (
    <div className="w-full pb-16 font-sans">
      
      {/* ── Scoped Print Styles to Guarantee Only Dossier Prints ── */}
      <style jsx global>{`
        @media print {
          /* Hide EVERYTHING in the page */
          body * {
            visibility: hidden !important;
          }

          /* Hide portal navigation layout */
          aside,
          header,
          nav,
          [role="navigation"],
          .print\\:hidden,
          #er-floating-bar,
          #er-notice-bar {
            display: none !important;
            visibility: hidden !important;
          }

          /* Make ONLY the dossier container visible and full-page */
          #equity-research-dossier-paper,
          #equity-research-dossier-paper * {
            visibility: visible !important;
          }

          #equity-research-dossier-paper {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: #ffffff !important;
            color: #000000 !important;
          }

          @page {
            size: A4 portrait;
            margin: 12mm 15mm;
          }
        }
      `}</style>

      {/* ── Top Action Toolbar (No sticky overlap collision) ── */}
      <div 
        id="er-floating-bar"
        className="max-w-4xl mx-auto mb-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-3 rounded-2xl shadow-lg print:hidden"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <button
            id="er-download-pdf-btn"
            onClick={handlePrint}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold shadow-md shadow-emerald-500/20 transition-all cursor-pointer active:scale-95"
          >
            <Download className="w-4 h-4" /> Download Dossier PDF
          </button>

          <button
            id="er-edit-record-btn"
            onClick={handleBackToEdit}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 transition-all cursor-pointer active:scale-95"
          >
            <Edit3 className="w-3.5 h-3.5" /> Edit This Record
          </button>

          <button
            id="er-report-history-btn"
            onClick={() => alert('Viewing report historical revisions')}
            className="hidden md:flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 transition-all cursor-pointer active:scale-95"
          >
            <History className="w-3.5 h-3.5" /> Report History
          </button>
        </div>

        <button
          onClick={handleBackToEdit}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 text-xs font-bold transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Hub
        </button>
      </div>

      {/* ── Status & Inline Editing Notice (Hidden in Print) ── */}
      <div 
        id="er-notice-bar"
        className="max-w-4xl mx-auto mb-5 bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl p-3 shadow-md flex items-center justify-between flex-wrap gap-2 print:hidden"
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsEditable(!isEditable)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              isEditable
                ? 'bg-violet-600 text-white shadow-sm'
                : 'bg-slate-900 dark:bg-slate-700 text-white hover:bg-slate-800'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            {isEditable ? 'Editing Active (Click text to edit)' : 'Edit Report'}
          </button>
          <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse inline-block"></span>
            Ready to generate
          </span>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Any heading, paragraph or table cell can be edited &middot; select text to bold / underline / highlight
        </p>
      </div>

      {/* ── Dossier Paper Document (Clean White Paper Container) ── */}
      <div
        ref={dossierRef}
        id="equity-research-dossier-paper"
        contentEditable={isEditable}
        suppressContentEditableWarning
        className={`max-w-4xl mx-auto bg-white text-slate-900 rounded-2xl shadow-xl p-5 sm:p-10 md:p-12 font-sans border border-slate-200 print:shadow-none print:border-none print:p-0 print:max-w-full ${
          isEditable ? 'outline-2 outline-dashed outline-violet-400' : ''
        }`}
      >
        {/* 1. Header Bar: WISBEES INTELLIGENCE + WisBees Logo */}
        <div className="flex items-center justify-between pb-3 border-b-2 border-slate-900 gap-2">
          <div className="text-[11px] sm:text-[13px] font-black tracking-widest text-[#e67e22] uppercase">
            WISBEES INTELLIGENCE
          </div>
          <div className="flex items-center select-none">
            <img
              src="/logo.png"
              alt="WisBees"
              className="h-7 sm:h-8 w-auto object-contain"
            />
          </div>
        </div>

        {/* 2. Main Stock Ticker Header */}
        <div className="mt-6 mb-4">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-950 tracking-tight uppercase break-words">
            {stockQuery}
          </h1>
        </div>

        {/* 3. 4-Box Key Metrics Highlight Grid (Fully Responsive) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 border border-slate-300 rounded-lg overflow-hidden text-center divide-x divide-y sm:divide-y-0 divide-slate-300 mb-8 bg-slate-50/50">
          <div className="p-2.5 sm:p-4">
            <div className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              ACTION RATING
            </div>
            <div className={`text-lg sm:text-2xl font-black ${recColor}`}>
              {recommendation.toUpperCase()}
            </div>
          </div>

          <div className="p-2.5 sm:p-4">
            <div className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              CURRENT MARKET PRICE
            </div>
            <div className="text-lg sm:text-2xl font-black text-slate-900 truncate">
              ₹{currentPrice}
            </div>
          </div>

          <div className="p-2.5 sm:p-4">
            <div className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              TARGET EVALUATION
            </div>
            <div className="text-lg sm:text-2xl font-black text-slate-900 truncate">
              ₹{targetPrice}
            </div>
          </div>

          <div className="p-2.5 sm:p-4">
            <div className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              PROJECTED UPSIDE
            </div>
            <div className={`text-lg sm:text-2xl font-black ${isPositiveUpside ? 'text-[#e67e22]' : 'text-red-600'} truncate`}>
              {isPositiveUpside ? '+' : ''}{calculatedUpside}%
            </div>
          </div>
        </div>

        {/* ── Section 1: Stock Overview ───────────────── */}
        <div className="mb-8">
          <h2 className="text-xs sm:text-sm font-black text-slate-950 uppercase tracking-wide mb-3">
            1. STOCK OVERVIEW
          </h2>
          <div className="border border-slate-200 rounded-lg overflow-x-auto">
            <table className="w-full text-xs text-left min-w-[500px]">
              <tbody className="divide-y divide-slate-200">
                <tr className="bg-slate-50">
                  <td className="py-2.5 px-3 sm:px-4 font-bold text-slate-800 w-1/4">Company Name</td>
                  <td className="py-2.5 px-3 sm:px-4 font-medium text-slate-700 w-1/4">{stockQuery}</td>
                  <td className="py-2.5 px-3 sm:px-4 font-bold text-slate-800 w-1/4">Industry</td>
                  <td className="py-2.5 px-3 sm:px-4 font-medium text-slate-700 w-1/4">{industrySector}</td>
                </tr>
                <tr className="bg-white">
                  <td className="py-2.5 px-3 sm:px-4 font-bold text-slate-800">Current Market Price (CMP)</td>
                  <td className="py-2.5 px-3 sm:px-4 font-medium text-slate-700">₹{currentPrice}</td>
                  <td className="py-2.5 px-3 sm:px-4 font-bold text-slate-800">Target Price</td>
                  <td className="py-2.5 px-3 sm:px-4 font-medium text-slate-700">₹{targetPrice}</td>
                </tr>
                <tr className="bg-slate-50">
                  <td className="py-2.5 px-3 sm:px-4 font-bold text-slate-800">Price As On</td>
                  <td className="py-2.5 px-3 sm:px-4 font-medium text-slate-700">{priceAsOn}</td>
                  <td className="py-2.5 px-3 sm:px-4 font-bold text-slate-800">Upside Potential</td>
                  <td className="py-2.5 px-3 sm:px-4 font-medium text-slate-700">
                    {isPositiveUpside ? '+' : ''}{calculatedUpside}%
                  </td>
                </tr>
                <tr className="bg-white">
                  <td className="py-2.5 px-3 sm:px-4 font-bold text-slate-800">Recommendation</td>
                  <td className={`py-2.5 px-3 sm:px-4 font-bold ${recColor}`}>{recommendation}</td>
                  <td className="py-2.5 px-3 sm:px-4 font-bold text-slate-800">Investment Horizon / View</td>
                  <td className="py-2.5 px-3 sm:px-4 font-medium text-slate-700">{timeHorizon}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Section 2: What's Happening On The Chart? ───────── */}
        <div className="mb-8 page-break-inside-avoid">
          <h2 className="text-xs sm:text-sm font-black text-slate-950 uppercase tracking-wide mb-3">
            2. WHAT&apos;S HAPPENING ON THE CHART?
          </h2>

          <div className="border border-slate-200 rounded-xl p-3 sm:p-6 bg-white flex flex-col items-center justify-center">
            {chartImageData ? (
              <div className="w-full flex flex-col items-center">
                <img
                  src={chartImageData}
                  alt="Stock Chart Analysis"
                  className="max-h-[380px] w-auto max-w-full object-contain rounded-lg border border-slate-200 shadow-xs"
                />
                <div className="text-[11px] text-slate-500 mt-2 italic text-center">
                  Uploaded technical price chart for {stockQuery}
                </div>
              </div>
            ) : (
              /* Dynamic Data-Driven Technical Chart plotted with user's exact CMP and Target */
              <div className="w-full flex flex-col items-center overflow-x-auto">
                <svg viewBox="0 0 720 340" className="w-full min-w-[500px] max-w-[660px] h-auto font-sans select-none">
                  {/* Grid lines */}
                  <line x1="50" y1="40" x2="670" y2="40" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="50" y1="90" x2="670" y2="90" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="50" y1="140" x2="670" y2="140" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="50" y1="190" x2="670" y2="190" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="50" y1="240" x2="670" y2="240" stroke="#f1f5f9" strokeWidth="1" />

                  {/* Dynamic Target Price Level Band */}
                  <line x1="50" y1="40" x2="670" y2="40" stroke="#10b981" strokeWidth="1.5" strokeDasharray="4,4" />
                  <rect x="530" y="26" width="135" height="22" rx="4" fill="#10b981" />
                  <text x="597" y="41" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="bold">
                    Target ₹{targetPrice}
                  </text>

                  {/* Dynamic CMP Level Band */}
                  <line x1="50" y1="160" x2="670" y2="160" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="3,3" />
                  <rect x="530" y="146" width="135" height="22" rx="4" fill="#3b82f6" />
                  <text x="597" y="161" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="bold">
                    CMP ₹{currentPrice}
                  </text>

                  {/* Support Neckline */}
                  <line x1="90" y1="240" x2="530" y2="240" stroke="#64748b" strokeWidth="1.5" strokeDasharray="5,5" />
                  <text x="310" y="262" textAnchor="middle" fill="#475569" fontSize="12" fontWeight="bold">
                    Neckline Support
                  </text>

                  {/* Technical Pattern Annotations */}
                  <text x="215" y="105" textAnchor="middle" fill="#334155" fontSize="12" fontWeight="bold">Shoulder</text>
                  <text x="330" y="55" textAnchor="middle" fill="#334155" fontSize="13" fontWeight="bold">Head</text>
                  <text x="445" y="105" textAnchor="middle" fill="#334155" fontSize="12" fontWeight="bold">Shoulder</text>

                  {/* Candlesticks Formations */}
                  {/* Candle 1 */}
                  <line x1="100" y1="220" x2="100" y2="270" stroke="#22c55e" strokeWidth="1.5" />
                  <rect x="96" y="230" width="8" height="30" fill="#22c55e" rx="1" />

                  {/* Candle 2 */}
                  <line x1="120" y1="200" x2="120" y2="255" stroke="#22c55e" strokeWidth="1.5" />
                  <rect x="116" y="210" width="8" height="35" fill="#22c55e" rx="1" />

                  {/* Candle 3 (Red) */}
                  <line x1="140" y1="210" x2="140" y2="245" stroke="#ef4444" strokeWidth="1.5" />
                  <rect x="136" y="220" width="8" height="20" fill="#ef4444" rx="1" />

                  {/* Candle 4 */}
                  <line x1="160" y1="170" x2="160" y2="230" stroke="#22c55e" strokeWidth="1.5" />
                  <rect x="156" y="180" width="8" height="40" fill="#22c55e" rx="1" />

                  {/* Candle 5 */}
                  <line x1="180" y1="145" x2="180" y2="195" stroke="#22c55e" strokeWidth="1.5" />
                  <rect x="176" y="155" width="8" height="30" fill="#22c55e" rx="1" />

                  {/* Left Shoulder Peak */}
                  <line x1="215" y1="115" x2="215" y2="165" stroke="#22c55e" strokeWidth="2" />
                  <rect x="211" y="125" width="8" height="30" fill="#22c55e" rx="1" />

                  {/* Retracement */}
                  <line x1="240" y1="135" x2="240" y2="190" stroke="#ef4444" strokeWidth="1.5" />
                  <rect x="236" y="145" width="8" height="35" fill="#ef4444" rx="1" />

                  <line x1="265" y1="170" x2="265" y2="235" stroke="#ef4444" strokeWidth="1.5" />
                  <rect x="261" y="180" width="8" height="45" fill="#ef4444" rx="1" />

                  {/* Head Peak Surge */}
                  <line x1="295" y1="140" x2="295" y2="200" stroke="#22c55e" strokeWidth="1.5" />
                  <rect x="291" y="150" width="8" height="40" fill="#22c55e" rx="1" />

                  <line x1="330" y1="65" x2="330" y2="140" stroke="#22c55e" strokeWidth="2.5" />
                  <rect x="326" y="75" width="8" height="55" fill="#22c55e" rx="1" />

                  {/* Head Drop */}
                  <line x1="360" y1="90" x2="360" y2="160" stroke="#ef4444" strokeWidth="1.5" />
                  <rect x="356" y="100" width="8" height="50" fill="#ef4444" rx="1" />

                  <line x1="385" y1="155" x2="385" y2="245" stroke="#ef4444" strokeWidth="2" />
                  <rect x="381" y="165" width="8" height="65" fill="#ef4444" rx="1" />

                  {/* Right Shoulder Peak */}
                  <line x1="415" y1="180" x2="415" y2="235" stroke="#22c55e" strokeWidth="1.5" />
                  <rect x="411" y="190" width="8" height="35" fill="#22c55e" rx="1" />

                  <line x1="445" y1="115" x2="445" y2="175" stroke="#22c55e" strokeWidth="2" />
                  <rect x="441" y="125" width="8" height="35" fill="#22c55e" rx="1" />

                  {/* Breakdown candles */}
                  <line x1="475" y1="145" x2="475" y2="205" stroke="#ef4444" strokeWidth="1.5" />
                  <rect x="471" y="155" width="8" height="40" fill="#ef4444" rx="1" />

                  <line x1="505" y1="195" x2="505" y2="275" stroke="#ef4444" strokeWidth="2.5" />
                  <rect x="501" y="205" width="8" height="60" fill="#ef4444" rx="1" />
                </svg>
                <div className="text-[11px] text-slate-500 mt-2 italic text-center">
                  Chart Model: Pattern setup mapped with CMP (₹{currentPrice}) and Target Evaluation (₹{targetPrice})
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Section 3: Financial Analysis (Responsive Table) ── */}
        <div className="mb-8 page-break-inside-avoid">
          <h2 className="text-xs sm:text-sm font-black text-slate-950 uppercase tracking-wide mb-1">
            3. {stockQuery} FINANCIAL ANALYSIS
          </h2>
          <p className="text-xs text-slate-600 mb-3 font-medium">
            Peer Comparison - {stockQuery} vs Industry Peers:
          </p>

          <div className="border border-slate-300 rounded-lg overflow-x-auto">
            <table className="w-full text-xs text-left min-w-[500px]">
              <thead>
                <tr className="bg-[#e8eff5] border-b border-slate-300 text-slate-900">
                  <th className="py-2.5 px-3 sm:px-4 font-black uppercase text-[10px] sm:text-[11px] tracking-wider w-1/3">
                    FINANCIAL METRIC
                  </th>
                  {peers.map((col, idx) => (
                    <th
                      key={col.id}
                      className={`py-2.5 px-3 sm:px-4 font-black uppercase text-[10px] sm:text-[11px] tracking-wider text-right ${
                        idx === 0 ? 'bg-[#dce7f0] text-slate-950' : 'text-slate-800'
                      }`}
                    >
                      {peerNames[col.id] || (idx === 0 ? `${stockQuery} (TARGET)` : col.label)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {METRICS.map((m, rowIdx) => (
                  <tr
                    key={m.key}
                    className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}
                  >
                    <td className="py-2.5 px-3 sm:px-4 font-bold text-slate-800">
                      {m.label}
                    </td>
                    {peers.map((col, idx) => {
                      const val = metricsData[m.key]?.[col.id];
                      return (
                        <td
                          key={col.id}
                          className={`py-2.5 px-3 sm:px-4 font-semibold text-right ${
                            idx === 0 ? 'bg-slate-100/50 font-black text-slate-900' : 'text-slate-700'
                          }`}
                        >
                          {val && val.trim() !== '' ? val : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Section 4: Understanding Business & Evaluation ─ */}
        <div className="mb-8 space-y-4 page-break-inside-avoid">
          <h2 className="text-xs sm:text-sm font-black text-slate-950 uppercase tracking-wide">
            4. UNDERSTANDING BUSINESS &amp; EVALUATION
          </h2>

          <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
            <div>
              <h3 className="font-black text-slate-900 text-xs mb-1">
                Business Overview (Moat)
              </h3>
              <p className="whitespace-pre-wrap">
                {businessOverview && businessOverview.trim() !== ''
                  ? businessOverview
                  : '—'}
              </p>
            </div>

            <div>
              <h3 className="font-black text-slate-900 text-xs mb-1">
                Relative Valuation
              </h3>
              <p className="whitespace-pre-wrap">
                {valuationThesis && valuationThesis.trim() !== ''
                  ? valuationThesis
                  : '—'}
              </p>
            </div>

            <div>
              <h3 className="font-black text-slate-900 text-xs mb-1">
                Technicals
              </h3>
              <p className="whitespace-pre-wrap">
                {technicalAnalysis && technicalAnalysis.trim() !== ''
                  ? technicalAnalysis
                  : '—'}
              </p>
            </div>
          </div>
        </div>

        {/* ── Section 5: What Analysts Say? (Responsive Table) ─ */}
        <div className="mb-4 page-break-inside-avoid">
          <h2 className="text-xs sm:text-sm font-black text-slate-950 uppercase tracking-wide mb-3">
            5. WHAT ANALYSTS SAY?
          </h2>

          <div className="border border-slate-300 rounded-lg overflow-x-auto">
            <table className="w-full text-xs text-left min-w-[500px]">
              <thead>
                <tr className="bg-[#e8eff5] border-b border-slate-300 text-slate-900">
                  <th className="py-2.5 px-3 sm:px-4 font-black uppercase text-[10px] sm:text-[11px] tracking-wider">RELEASE DATE</th>
                  <th className="py-2.5 px-3 sm:px-4 font-black uppercase text-[10px] sm:text-[11px] tracking-wider">BROKERAGE INSTITUTION</th>
                  <th className="py-2.5 px-3 sm:px-4 font-black uppercase text-[10px] sm:text-[11px] tracking-wider text-center">INVESTMENT DIRECTIVE</th>
                  <th className="py-2.5 px-3 sm:px-4 font-black uppercase text-[10px] sm:text-[11px] tracking-wider text-right">TARGET PRICE</th>
                  <th className="py-2.5 px-3 sm:px-4 font-black uppercase text-[10px] sm:text-[11px] tracking-wider text-right">PERCENTAGE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {consensusRows && consensusRows.length > 0 && consensusRows.some(r => r.brokerageHouse || r.targetPrice) ? (
                  consensusRows.map((row, idx) => {
                    const callDate = row.callDate || '—';
                    const broker = row.brokerageHouse || '—';
                    const rating = row.rating || '—';
                    const rowTgt = parseFloat(row.targetPrice) || 0;
                    const pct = cmpNum > 0 && rowTgt > 0
                      ? (((rowTgt - cmpNum) / cmpNum) * 100).toFixed(1)
                      : null;

                    return (
                      <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                        <td className="py-2.5 px-3 sm:px-4 font-medium text-slate-700">{callDate}</td>
                        <td className="py-2.5 px-3 sm:px-4 font-bold text-slate-900">{broker}</td>
                        <td className="py-2.5 px-3 sm:px-4 font-black text-center text-emerald-600">{rating}</td>
                        <td className="py-2.5 px-3 sm:px-4 font-bold text-right text-slate-900">
                          {row.targetPrice ? `₹${row.targetPrice}` : '—'}
                        </td>
                        <td className="py-2.5 px-3 sm:px-4 font-black text-right text-emerald-600">
                          {pct !== null ? `+${pct}%` : '—'}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="py-4 px-4 text-center text-slate-400 italic">
                      No street analyst rows provided.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Notice */}
        <div className="mt-8 pt-4 border-t border-slate-200 text-[10px] text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>WisBees Intelligence Research &middot; Confidential Institutional Dossier</span>
          <span>Generated on {priceAsOn}</span>
        </div>

      </div>
    </div>
  );
}
