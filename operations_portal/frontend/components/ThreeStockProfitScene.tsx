'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  TrendingUp,
  DollarSign,
  Zap,
  ArrowUpRight,
  Sparkles,
  Activity,
  Flame,
  BarChart2,
  Clock,
  Layers,
  ArrowDownRight
} from 'lucide-react';
import { useTheme } from '@/lib/theme';

interface CandleData {
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
  isGreen: boolean;
}

// Authentic market sequence modeled after real financial market breakout
const BASE_CANDLES: { open: number; close: number; high: number; low: number; vol: number }[] = [
  { open: 82, close: 95, high: 99, low: 78, vol: 65 },
  { open: 95, close: 104, high: 108, low: 90, vol: 80 },
  { open: 104, close: 88, high: 106, low: 84, vol: 45 },
  { open: 88, close: 76, high: 92, low: 72, vol: 50 },
  { open: 76, close: 85, high: 90, low: 70, vol: 55 },
  { open: 85, close: 72, high: 88, low: 68, vol: 40 },
  { open: 72, close: 64, high: 76, low: 60, vol: 60 },
  { open: 64, close: 58, high: 68, low: 52, vol: 70 }, // Accumulation bottom
  { open: 58, close: 62, high: 66, low: 50, vol: 85 }, // Entry / Buy Pivot
  { open: 62, close: 78, high: 82, low: 58, vol: 95 }, // Reversal Surge
  { open: 78, close: 94, high: 98, low: 74, vol: 110 },
  { open: 94, close: 86, high: 96, low: 82, vol: 55 }, // Pullback
  { open: 86, close: 78, high: 90, low: 74, vol: 48 },
  { open: 78, close: 72, high: 82, low: 66, vol: 42 },
  { open: 72, close: 68, high: 75, low: 62, vol: 35 },
  { open: 68, close: 74, high: 78, low: 65, vol: 60 },
  { open: 74, close: 88, high: 92, low: 70, vol: 85 }, // Higher Low bounce
  { open: 88, close: 82, high: 90, low: 78, vol: 50 },
  { open: 82, close: 76, high: 85, low: 70, vol: 45 },
  { open: 76, close: 70, high: 80, low: 64, vol: 55 },
  { open: 70, close: 96, high: 102, low: 68, vol: 120 }, // Breakout Ignition
  { open: 96, close: 108, high: 114, low: 92, vol: 140 },
  { open: 108, close: 102, high: 112, low: 98, vol: 75 },
  { open: 102, close: 118, high: 124, low: 99, vol: 135 },
  { open: 118, close: 112, high: 122, low: 106, vol: 80 },
  { open: 112, close: 126, high: 130, low: 108, vol: 110 },
  { open: 126, close: 148, high: 154, low: 122, vol: 165 }, // Major Bull Run
  { open: 148, close: 162, high: 168, low: 142, vol: 180 },
  { open: 162, close: 152, high: 165, low: 148, vol: 90 },
  { open: 152, close: 178, high: 184, low: 148, vol: 195 },
  { open: 178, close: 196, high: 204, low: 172, vol: 220 }, // Skyrocket to Profit Peak
  { open: 196, close: 215, high: 220, low: 190, vol: 240 },
  { open: 215, close: 208, high: 218, low: 200, vol: 130 },
  { open: 208, close: 232, high: 238, low: 204, vol: 260 },
  { open: 232, close: 258, high: 265, low: 228, vol: 290 },
  { open: 258, close: 284.5, high: 292, low: 252, vol: 320 }, // Peak Target Realized!
];

export function ThreeStockProfitScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [currentRoi, setCurrentRoi] = useState(0);
  const [currentValuation, setCurrentValuation] = useState(10000);
  const [stockPrice, setStockPrice] = useState(58.0);
  const [phaseText, setPhaseText] = useState('1. CAPITAL INVESTED ($10,000)');
  const [phaseColor, setPhaseColor] = useState('text-sky-600 dark:text-sky-400');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let startTime = performance.now();

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = parent.clientWidth * dpr;
      canvas.height = parent.clientHeight * dpr;
      canvas.style.width = `${parent.clientWidth}px`;
      canvas.style.height = `${parent.clientHeight}px`;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener('resize', resize);

    // Continuous 60 FPS Render Loop
    const render = (time: number) => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const w = parent.clientWidth;
      const h = parent.clientHeight;

      const elapsed = (time - startTime) / 1000;
      const loopDuration = 8.5; // 8.5s continuous video loop
      const progress = (elapsed % loopDuration) / loopDuration;

      // Theme Colors
      const bg = isDark ? '#070b14' : '#ffffff';
      const gridColor = isDark ? 'rgba(30, 41, 59, 0.45)' : 'rgba(226, 232, 240, 0.7)';
      const greenColor = isDark ? '#22c55e' : '#16a34a';
      const redColor = isDark ? '#ef4444' : '#dc2626';
      const wickColor = isDark ? '#64748b' : '#94a3b8';
      const volumeBarColor = isDark ? 'rgba(51, 65, 85, 0.4)' : 'rgba(203, 213, 225, 0.55)';
      const volumeActiveColor = isDark ? 'rgba(34, 197, 94, 0.35)' : 'rgba(22, 163, 74, 0.25)';
      const emaColor = isDark ? '#00f0ff' : '#0284c7';
      const textColor = isDark ? '#94a3b8' : '#64748b';

      // Clear Canvas
      ctx.clearRect(0, 0, w, h);

      // Chart Padding
      const paddingLeft = 35;
      const paddingRight = 60;
      const paddingTop = 90;
      const paddingBottom = 75;
      const chartW = w - paddingLeft - paddingRight;
      const chartH = h - paddingTop - paddingBottom;
      const volumeAreaH = chartH * 0.28;

      // Min and Max price bounds
      const minPrice = 45;
      const maxPrice = 305;
      const priceRange = maxPrice - minPrice;

      const getY = (price: number) => {
        const norm = (price - minPrice) / priceRange;
        return paddingTop + chartH * (1 - norm);
      };

      // Draw Background Grid Lines
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);

      // Horizontal Grid & Price Labels
      const gridSteps = [50, 100, 150, 200, 250, 300];
      gridSteps.forEach((p) => {
        const y = getY(p);
        ctx.beginPath();
        ctx.moveTo(paddingLeft, y);
        ctx.lineTo(w - paddingRight, y);
        ctx.stroke();

        ctx.fillStyle = textColor;
        ctx.font = '10px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`$${p}.00`, w - paddingRight + 8, y + 3);
      });
      ctx.setLineDash([]);

      // Number of candles to reveal based on loop progress
      const totalCandles = BASE_CANDLES.length;
      const visibleCandlesCount = Math.max(3, Math.min(totalCandles, Math.floor(progress * totalCandles * 1.05) + 1));
      const candleWidth = Math.max(5, (chartW / totalCandles) * 0.65);
      const candleSpacing = chartW / totalCandles;

      // Draw Volume Histogram at bottom
      const maxVol = 350;
      for (let i = 0; i < totalCandles; i++) {
        const c = BASE_CANDLES[i];
        const isVisible = i < visibleCandlesCount;
        const x = paddingLeft + i * candleSpacing + candleSpacing / 2;
        const barH = (c.vol / maxVol) * volumeAreaH * (isVisible ? 1 : 0.4);
        const y = paddingTop + chartH - barH;

        ctx.fillStyle = isVisible && c.close >= c.open ? volumeActiveColor : volumeBarColor;
        ctx.fillRect(x - candleWidth / 2, y, candleWidth, barH);
      }

      // Draw Moving Average Curve (EMA-20 / Trendline)
      ctx.beginPath();
      let emaPoints: { x: number; y: number }[] = [];
      for (let i = 0; i < visibleCandlesCount; i++) {
        const c = BASE_CANDLES[i];
        const x = paddingLeft + i * candleSpacing + candleSpacing / 2;
        // Exponential moving average approximation
        const avgPrice = (c.open + c.close + c.high + c.low) / 4;
        const y = getY(avgPrice);
        emaPoints.push({ x, y });

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          const prev = emaPoints[i - 1];
          const cx = (prev.x + x) / 2;
          const cy = (prev.y + y) / 2;
          ctx.quadraticCurveTo(prev.x, prev.y, cx, cy);
        }
      }
      ctx.strokeStyle = emaColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw Candlesticks (Exact shape from reference image)
      for (let i = 0; i < visibleCandlesCount; i++) {
        const c = BASE_CANDLES[i];
        const isGreen = c.close >= c.open;
        const x = paddingLeft + i * candleSpacing + candleSpacing / 2;

        const openY = getY(c.open);
        const closeY = getY(c.close);
        const highY = getY(c.high);
        const lowY = getY(c.low);

        const candleTop = Math.min(openY, closeY);
        const candleHeight = Math.max(3, Math.abs(closeY - openY));

        const color = isGreen ? greenColor : redColor;

        // 1. Thin Center Wick (High to Low)
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(x, highY);
        ctx.lineTo(x, lowY);
        ctx.stroke();

        // 2. Solid Rectangular Body (Open to Close)
        ctx.fillStyle = color;
        ctx.fillRect(x - candleWidth / 2, candleTop, candleWidth, candleHeight);

        // Highlight Active / Latest Candle
        if (i === visibleCandlesCount - 1) {
          ctx.strokeStyle = isDark ? '#ffffff' : '#0f172a';
          ctx.lineWidth = 1;
          ctx.strokeRect(x - candleWidth / 2 - 1, candleTop - 1, candleWidth + 2, candleHeight + 2);

          // Horizontal Live Price Line
          ctx.strokeStyle = color;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(x, closeY);
          ctx.lineTo(w - paddingRight, closeY);
          ctx.stroke();
          ctx.setLineDash([]);

          // Price Tag Badge on Axis
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.roundRect(w - paddingRight + 4, closeY - 9, 52, 18, 4);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`$${c.close.toFixed(1)}`, w - paddingRight + 30, closeY + 3);
        }
      }

      // Draw Buy Marker at Entry point
      if (visibleCandlesCount >= 9) {
        const buyCandle = BASE_CANDLES[8];
        const buyX = paddingLeft + 8 * candleSpacing + candleSpacing / 2;
        const buyY = getY(buyCandle.low) + 18;

        ctx.fillStyle = isDark ? '#38bdf8' : '#0284c7';
        ctx.beginPath();
        ctx.moveTo(buyX, buyY - 8);
        ctx.lineTo(buyX - 6, buyY + 4);
        ctx.lineTo(buyX + 6, buyY + 4);
        ctx.closePath();
        ctx.fill();

        ctx.font = 'bold 9px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('BUY $58.00', buyX, buyY + 15);
      }

      // Draw Peak Target Marker
      if (visibleCandlesCount >= totalCandles - 1) {
        const peakX = paddingLeft + (totalCandles - 1) * candleSpacing + candleSpacing / 2;
        const peakY = getY(284.5) - 15;

        ctx.fillStyle = isDark ? '#fbbf24' : '#d97706';
        ctx.beginPath();
        ctx.arc(peakX, peakY, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = 'black 10px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('💰 MAX PROFIT $284.50', peakX - 10, peakY - 8);
      }

      // Live Stats Calculation (Invest -> Skyrockets -> Profit)
      const currentCandle = BASE_CANDLES[visibleCandlesCount - 1] || BASE_CANDLES[0];
      setStockPrice(currentCandle.close);

      let calcValuation = 10000;
      let calcRoi = 0;

      if (progress < 0.25) {
        // Stage 1: Capital Invested
        const t = progress / 0.25;
        calcValuation = Math.round(10000 + t * 18000);
        calcRoi = Math.round(((calcValuation - 10000) / 10000) * 100);
        setPhaseText('1. CAPITAL INVESTED ($10,000)');
        setPhaseColor('text-sky-600 dark:text-sky-400');
      } else if (progress < 0.72) {
        // Stage 2: Stock Skyrockets
        const t = (progress - 0.25) / 0.47;
        calcValuation = Math.round(28000 + Math.pow(t, 2.0) * 165000);
        calcRoi = Math.round(((calcValuation - 10000) / 10000) * 100);
        setPhaseText('2. STOCK SKYROCKETS (BULL BREAKOUT)');
        setPhaseColor('text-emerald-600 dark:text-emerald-400');
      } else {
        // Stage 3: Max Profit Realized
        const t = (progress - 0.72) / 0.28;
        calcValuation = Math.round(193000 + t * 91500);
        calcRoi = Math.round(((calcValuation - 10000) / 10000) * 100);
        setPhaseText('3. MAX PROFIT REALIZED (+2,845%)');
        setPhaseColor('text-amber-600 dark:text-amber-400');
      }

      setCurrentValuation(calcValuation);
      setCurrentRoi(calcRoi);

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [theme, isDark]);

  return (
    <div className="w-full h-full relative flex flex-col justify-between p-5 sm:p-7 select-none overflow-hidden bg-white dark:bg-slate-950 text-slate-900 dark:text-white rounded-3xl border border-slate-200 dark:border-slate-800 transition-colors duration-300">
      
      {/* 60 FPS Canvas Element */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-0" />

      {/* Top HUD: Stock Ticker Header */}
      <div className="relative z-10 space-y-2 pointer-events-none">
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700/80 shadow-md backdrop-blur-md">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className={`text-[11px] font-black uppercase tracking-wider ${phaseColor}`}>
              {phaseText}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold bg-white/90 dark:bg-slate-900/90 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 shadow-sm backdrop-blur-md">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>NYSE: WISB • REAL-TIME 1M</span>
          </div>
        </div>

        <div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Invest ➔ Stock Skyrockets ➔ <span className="text-emerald-600 dark:text-emerald-400">Profit</span>
          </h2>
          <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400 mt-1">
            <span className="font-mono font-black text-slate-900 dark:text-white text-sm">
              ${stockPrice.toFixed(2)}
            </span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>+{currentRoi}%</span>
            </span>
            <span>•</span>
            <span className="text-[11px]">Vol: 14.8M (Bull Accumulation)</span>
          </div>
        </div>
      </div>

      {/* Floating Valuation Card */}
      <div className="relative z-10 pointer-events-none mt-auto mb-3">
        <div className="max-w-xs p-3.5 rounded-2xl bg-white/90 dark:bg-slate-900/85 border border-emerald-500/40 dark:border-emerald-500/30 backdrop-blur-xl shadow-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Portfolio Valuation
            </span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 font-mono text-[10px] font-extrabold border border-emerald-300 dark:border-emerald-800/60 flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3" />
              <span>+{currentRoi}% ROI</span>
            </span>
          </div>

          <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-slate-900 dark:text-white flex items-baseline gap-1">
            <span className="text-emerald-600 dark:text-emerald-400">$</span>
            <span>{currentValuation.toLocaleString()}</span>
          </div>

          <div className="space-y-1">
            <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-sky-500 via-emerald-500 to-amber-500 transition-all duration-75"
                style={{ width: `${Math.min(100, (currentRoi / 2845) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[9px] font-mono text-slate-500 dark:text-slate-400">
              <span>$10,000 Invested</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">$284,500 (+28.4x)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom HUD: 3-Stage Financial Metrics */}
      <div className="relative z-10 grid grid-cols-3 gap-2 pointer-events-none">
        <div className="p-2.5 rounded-2xl bg-white/90 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/80 backdrop-blur-md shadow-xs">
          <div className="text-[9px] font-bold uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <DollarSign className="w-3 h-3 text-sky-600 dark:text-sky-400" />
            <span>1. Invest</span>
          </div>
          <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white font-mono mt-0.5">
            $10,000
          </div>
        </div>

        <div className="p-2.5 rounded-2xl bg-white/90 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/80 backdrop-blur-md shadow-xs">
          <div className="text-[9px] font-bold uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Flame className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            <span>2. Surge</span>
          </div>
          <div className="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
            +2,845%
          </div>
        </div>

        <div className="p-2.5 rounded-2xl bg-white/90 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/80 backdrop-blur-md shadow-xs">
          <div className="text-[9px] font-bold uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            <span>3. Profit</span>
          </div>
          <div className="text-xs sm:text-sm font-black text-amber-600 dark:text-amber-400 font-mono mt-0.5">
            +$274,500
          </div>
        </div>
      </div>

    </div>
  );
}
