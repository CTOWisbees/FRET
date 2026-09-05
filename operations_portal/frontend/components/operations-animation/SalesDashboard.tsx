'use client';

import React from 'react';

interface SalesDashboardProps {
  x: number;
  y: number;
  chartProgress?: number; // 0 to 1 for animated spline drawing
  activeKpi?: 'revenue' | 'orders' | 'growth';
  opacity?: number;
  scale?: number;
}

export const SalesDashboard: React.FC<SalesDashboardProps> = ({
  x,
  y,
  chartProgress = 1,
  activeKpi = 'revenue',
  opacity = 1,
  scale = 1,
}) => {
  return (
    <g
      transform={`translate(${x}, ${y}) scale(${scale})`}
      opacity={opacity}
      className="pointer-events-none select-none"
    >
      <defs>
        {/* Frame Metal Gradient */}
        <linearGradient id="smartboardFrame" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#334155" />
          <stop offset="50%" stopColor="#1E293B" />
          <stop offset="100%" stopColor="#0F172A" />
        </linearGradient>

        {/* Display Screen Dark Gradient */}
        <linearGradient id="smartboardScreen" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#0B132B" />
          <stop offset="100%" stopColor="#030712" />
        </linearGradient>

        {/* Chart Gradient Area */}
        <linearGradient id="salesGraphArea" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#0284C7" stopOpacity="0.5" />
          <stop offset="50%" stopColor="#10B981" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#0F172A" stopOpacity="0" />
        </linearGradient>

        {/* Spline Line Gradient */}
        <linearGradient id="salesSplineStroke" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="50%" stopColor="#0284C7" />
          <stop offset="100%" stopColor="#34D399" />
        </linearGradient>
      </defs>

      {/* Ground Shadow for Mobile Stand */}
      <ellipse cx="110" cy="5" rx="120" ry="12" fill="rgba(15, 23, 42, 0.3)" />

      {/* STAND LEGS ON WHEELS (Modern Interactive Display Stand) */}
      {/* Heavy Base with Wheels */}
      <path d="M20 0 L200 0" stroke="#475569" strokeWidth="6" strokeLinecap="round" />
      <circle cx="25" cy="3" r="4" fill="#0F172A" />
      <circle cx="195" cy="3" r="4" fill="#0F172A" />
      <circle cx="110" cy="3" r="4" fill="#0F172A" />

      {/* Vertical Twin Aluminum Support Pillars */}
      <rect x="95" y="-180" width="12" height="180" rx="3" fill="#475569" stroke="#64748B" strokeWidth="1" />
      <rect x="113" y="-180" width="12" height="180" rx="3" fill="#334155" stroke="#475569" strokeWidth="1" />

      {/* DIGITAL DISPLAY SCREEN HOUSING (65" Smart Display Screen) */}
      <g transform="translate(0, -260)">
        {/* Screen Outer Bezel Frame */}
        <rect
          x="0"
          y="0"
          width="220"
          height="160"
          rx="8"
          fill="url(#smartboardFrame)"
          stroke="#38BDF8"
          strokeWidth="1.5"
        />
        {/* High-Gloss Display Glass Screen */}
        <rect
          x="4"
          y="4"
          width="212"
          height="152"
          rx="6"
          fill="url(#smartboardScreen)"
        />

        {/* SCREEN CONTENT & ANALYTICS DASHBOARD */}
        {/* Top Header Bar */}
        <g transform="translate(10, 10)">
          <rect x="0" y="0" width="200" height="16" rx="3" fill="#1E293B" />
          <text x="8" y="11" fill="#FFFFFF" fontSize="6.5" fontWeight="900" fontFamily="sans-serif">
            EXECUTIVE SALES &amp; OPERATIONS KPI
          </text>
          {/* Live Status Beacon */}
          <circle cx="188" cy="8" r="3" fill="#10B981" />
          <text x="160" y="11" fill="#34D399" fontSize="5" fontWeight="bold">
            LIVE FEED
          </text>
        </g>

        {/* 3 KPI SUMMARY CARDS */}
        <g transform="translate(10, 32)">
          {/* Card 1: Revenue */}
          <rect
            x="0"
            y="0"
            width="62"
            height="26"
            rx="3"
            fill={activeKpi === 'revenue' ? '#0F2A4A' : '#1E293B'}
            stroke={activeKpi === 'revenue' ? '#38BDF8' : '#334155'}
            strokeWidth="1"
          />
          <text x="4" y="8" fill="#94A3B8" fontSize="4.5" fontWeight="bold">
            TOTAL REVENUE
          </text>
          <text x="4" y="17" fill="#FFFFFF" fontSize="8" fontWeight="900">
            $148,250
          </text>
          <text x="4" y="23" fill="#34D399" fontSize="4.5" fontWeight="bold">
            +34.8% YoY ▲
          </text>

          {/* Card 2: Orders */}
          <rect
            x="68"
            y="0"
            width="62"
            height="26"
            rx="3"
            fill="#1E293B"
            stroke="#334155"
            strokeWidth="1"
          />
          <text x="72" y="8" fill="#94A3B8" fontSize="4.5" fontWeight="bold">
            MONTHLY ORDERS
          </text>
          <text x="72" y="17" fill="#FFFFFF" fontSize="8" fontWeight="900">
            1,842 units
          </text>
          <text x="72" y="23" fill="#38BDF8" fontSize="4.5" fontWeight="bold">
            +18.2% MoM ▲
          </text>

          {/* Card 3: Growth / Efficiency */}
          <rect
            x="136"
            y="0"
            width="64"
            height="26"
            rx="3"
            fill="#1E293B"
            stroke="#334155"
            strokeWidth="1"
          />
          <text x="140" y="8" fill="#94A3B8" fontSize="4.5" fontWeight="bold">
            CSAT &amp; ON-TIME
          </text>
          <text x="140" y="17" fill="#FFFFFF" fontSize="8" fontWeight="900">
            99.4%
          </text>
          <text x="140" y="23" fill="#A855F7" fontSize="4.5" fontWeight="bold">
            100% Target Met ✓
          </text>
        </g>

        {/* SECTION 4: ANIMATED REVENUE SPLINE LINE GRAPH */}
        <g transform="translate(10, 64)">
          <rect x="0" y="0" width="130" height="58" rx="3" fill="#0A0F1D" stroke="#1E293B" strokeWidth="0.8" />
          <text x="6" y="8" fill="#94A3B8" fontSize="4.5" fontWeight="bold">
            REVENUE TRAJECTORY (Q1 - Q4)
          </text>

          {/* Grid lines */}
          <line x1="8" y1="20" x2="122" y2="20" stroke="#1E293B" strokeWidth="0.5" strokeDasharray="2 2" />
          <line x1="8" y1="34" x2="122" y2="34" stroke="#1E293B" strokeWidth="0.5" strokeDasharray="2 2" />
          <line x1="8" y1="48" x2="122" y2="48" stroke="#1E293B" strokeWidth="0.5" strokeDasharray="2 2" />

          {/* Area under curve */}
          <path
            d="M10 46 C35 42 55 38 75 26 C95 14 110 18 122 8 L122 52 L10 52 Z"
            fill="url(#salesGraphArea)"
          />

          {/* Spline curve */}
          <path
            d="M10 46 C35 42 55 38 75 26 C95 14 110 18 122 8"
            stroke="url(#salesSplineStroke)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="140"
            strokeDashoffset={140 * (1 - Math.min(chartProgress, 1))}
            fill="none"
          />

          {/* Peak Target Marker */}
          <circle cx="122" cy="8" r="3" fill="#34D399" />
          <circle cx="122" cy="8" r="5" stroke="#34D399" strokeWidth="0.8" fill="none" />
          {/* Peak Tooltip */}
          <rect x="90" y="0" width="30" height="9" rx="2" fill="#0284C7" />
          <text x="105" y="6.5" fill="#FFFFFF" fontSize="4" fontWeight="bold" textAnchor="middle">
            ★ $148.2K Peak
          </text>
        </g>

        {/* SECTION 5: ANIMATED BAR CHART (Quarterly Distribution) */}
        <g transform="translate(146, 64)">
          <rect x="0" y="0" width="64" height="58" rx="3" fill="#0A0F1D" stroke="#1E293B" strokeWidth="0.8" />
          <text x="6" y="8" fill="#94A3B8" fontSize="4.5" fontWeight="bold">
            QUARTERLY
          </text>

          {/* Bar 1 - Q1 */}
          <rect x="8" y="32" width="9" height="18" rx="1.5" fill="#38BDF8" />
          <text x="9" y="54" fill="#64748B" fontSize="4">Q1</text>

          {/* Bar 2 - Q2 */}
          <rect x="22" y="24" width="9" height="26" rx="1.5" fill="#0284C7" />
          <text x="23" y="54" fill="#64748B" fontSize="4">Q2</text>

          {/* Bar 3 - Q3 */}
          <rect x="36" y="16" width="9" height="34" rx="1.5" fill="#0D9488" />
          <text x="37" y="54" fill="#64748B" fontSize="4">Q3</text>

          {/* Bar 4 - Q4 Peak */}
          <rect x="50" y="10" width="9" height="40" rx="1.5" fill="#10B981" />
          <text x="51" y="54" fill="#34D399" fontSize="4" fontWeight="bold">Q4</text>
        </g>

        {/* Bottom Banner on Screen */}
        <rect x="10" y="128" width="200" height="18" rx="3" fill="#1E293B" />
        <circle cx="20" cy="137" r="4" fill="#10B981" />
        <text x="30" y="140" fill="#E2E8F0" fontSize="5.5" fontWeight="bold" fontFamily="sans-serif">
          WisBees Global Operations: 100% On-Schedule • Q3 Exceeded
        </text>
      </g>
    </g>
  );
};
