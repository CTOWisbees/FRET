'use client';

import React from 'react';

interface LaptopProps {
  x: number;
  y: number;
  lidOpen: boolean; // true: lid open 105deg, false: closed 0deg
  codeStep: number; // 0 to 100 for typing animation
  opacity?: number;
  scale?: number;
}

export const Laptop: React.FC<LaptopProps> = ({
  x,
  y,
  lidOpen,
  codeStep,
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
        {/* Desk Surface Gradient */}
        <linearGradient id="deskSurfaceGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#1E293B" />
          <stop offset="50%" stopColor="#334155" />
          <stop offset="100%" stopColor="#1E293B" />
        </linearGradient>

        {/* Laptop Metal Gradient */}
        <linearGradient id="laptopSilver" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E2E8F0" />
          <stop offset="50%" stopColor="#CBD5E1" />
          <stop offset="100%" stopColor="#94A3B8" />
        </linearGradient>

        {/* IDE Screen Gradient */}
        <linearGradient id="screenIdeBg" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#0B132B" />
          <stop offset="100%" stopColor="#020617" />
        </linearGradient>

        {/* Screen Ambient Glow */}
        <radialGradient id="deskGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(56, 189, 248, 0.4)" />
          <stop offset="100%" stopColor="rgba(56, 189, 248, 0)" />
        </radialGradient>
      </defs>

      {/* Desk Ground Shadow */}
      <ellipse cx="60" cy="5" rx="85" ry="12" fill="rgba(15, 23, 42, 0.25)" />

      {/* WORKSTATION DESK */}
      {/* Tapered Legs */}
      <line x1="-10" y1="-50" x2="-20" y2="0" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
      <line x1="130" y1="-50" x2="140" y2="0" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
      <line x1="5" y1="-50" x2="0" y2="-5" stroke="#334155" strokeWidth="3" strokeLinecap="round" />
      <line x1="115" y1="-50" x2="120" y2="-5" stroke="#334155" strokeWidth="3" strokeLinecap="round" />

      {/* Desk Top Bevel (Isometric Top View) */}
      <polygon
        points="-25,-55 145,-55 130,-48 -10,-48"
        fill="url(#deskSurfaceGrad)"
        stroke="#475569"
        strokeWidth="1"
      />
      {/* Front Edge of Desk */}
      <rect x="-10" y="-48" width="140" height="6" rx="2" fill="#0F172A" />
      <line x1="-10" y1="-48" x2="130" y2="-48" stroke="#38BDF8" strokeWidth="1" opacity="0.6" />

      {/* Coffee Mug on Desk */}
      <g transform="translate(105, -70)">
        <rect x="0" y="5" width="14" height="16" rx="3" fill="#0284C7" />
        <path d="M14 8 C18 8 18 16 14 16" stroke="#0284C7" strokeWidth="2.5" fill="none" />
        {/* Steam */}
        <path
          d="M4 2 Q7 -4 4 -8"
          stroke="#94A3B8"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
          opacity="0.7"
        />
        <path
          d="M9 3 Q12 -3 9 -7"
          stroke="#94A3B8"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
          opacity="0.5"
        />
      </g>

      {/* Screen Light Projection on Desk when Lid is Open */}
      {lidOpen && (
        <ellipse cx="45" cy="-52" rx="45" ry="12" fill="url(#deskGlow)" />
      )}

      {/* LAPTOP BASE (Keyboard Chassis resting on desk) */}
      <g id="laptop-chassis" transform="translate(15, -60)">
        {/* Lower Case Base */}
        <polygon
          points="0,6 60,6 55,0 5,0"
          fill="url(#laptopSilver)"
          stroke="#475569"
          strokeWidth="0.8"
        />
        {/* Dark Keyboard Well */}
        <polygon
          points="6,4 54,4 51,1 9,1"
          fill="#0F172A"
        />
        {/* Key Rows Glowing */}
        <line x1="10" y1="2" x2="50" y2="2" stroke="#38BDF8" strokeWidth="0.8" strokeDasharray="2 1.5" opacity="0.9" />
        <line x1="8" y1="3.2" x2="52" y2="3.2" stroke="#38BDF8" strokeWidth="0.8" strokeDasharray="3 1.5" opacity="0.9" />
        {/* Trackpad */}
        <polygon points="24,5 36,5 35,4.2 25,4.2" fill="#334155" />

        {/* LAPTOP LID (Rotates Open/Closed) */}
        {lidOpen ? (
          /* OPEN LID VIEW: Screen Facing Character */
          <g id="laptop-screen-open" transform="translate(5, 0)">
            {/* Screen Housing */}
            <rect
              x="0"
              y="-46"
              width="50"
              height="46"
              rx="2.5"
              fill="#0F172A"
              stroke="#64748B"
              strokeWidth="1.2"
            />
            {/* Screen Glass Bezel */}
            <rect
              x="2"
              y="-44"
              width="46"
              height="42"
              rx="1.5"
              fill="url(#screenIdeBg)"
            />

            {/* IDE Top Bar (macOS Window Control Dots) */}
            <rect x="2" y="-44" width="46" height="5" rx="1" fill="#1E293B" />
            <circle cx="5" cy="-41.5" r="1" fill="#EF4444" />
            <circle cx="8" cy="-41.5" r="1" fill="#F59E0B" />
            <circle cx="11" cy="-41.5" r="1" fill="#10B981" />
            <text x="16" y="-40" fill="#94A3B8" fontSize="2.8" fontFamily="monospace" fontWeight="bold">
              ops_core.ts
            </text>

            {/* CHANGING REAL-TIME CODE SYNTAX LINES */}
            <g id="ide-code-content">
              {/* Line 1: import */}
              <rect x="5" y="-36" width="9" height="1.8" rx="0.5" fill="#F43F5E" />
              <rect x="15" y="-36" width="16" height="1.8" rx="0.5" fill="#38BDF8" />
              <rect x="32" y="-36" width="8" height="1.8" rx="0.5" fill="#FBBF24" />

              {/* Line 2: function */}
              <rect x="5" y="-32" width="14" height="1.8" rx="0.5" fill="#38BDF8" />
              <rect x="20" y="-32" width="20" height="1.8" rx="0.5" fill="#34D399" />

              {/* Line 3: const workflow = await sync(); */}
              <rect x="8" y="-28" width="8" height="1.8" rx="0.5" fill="#F43F5E" />
              <rect
                x="17"
                y="-28"
                width={Math.min(26, Math.max(4, (codeStep % 30) * 1.2))}
                height="1.8"
                rx="0.5"
                fill="#E2E8F0"
              />

              {/* Line 4: dispatch.optimize(); */}
              <rect
                x="8"
                y="-24"
                width={Math.min(22, Math.max(6, ((codeStep + 10) % 30) * 1.1))}
                height="1.8"
                rx="0.5"
                fill="#38BDF8"
              />
              <rect x="31" y="-24" width="8" height="1.8" rx="0.5" fill="#A855F7" />

              {/* Line 5: return { status: 200 }; */}
              <rect x="8" y="-20" width="10" height="1.8" rx="0.5" fill="#F43F5E" />
              <rect x="19" y="-20" width="18" height="1.8" rx="0.5" fill="#34D399" />

              {/* Blinking typing cursor */}
              <rect
                x={8 + (codeStep % 25)}
                y="-16"
                width="1.5"
                height="2.5"
                fill="#38BDF8"
                opacity={codeStep % 2 === 0 ? 1 : 0.2}
              />

              {/* Mini Terminal Status Box */}
              <rect x="4" y="-12" width="42" height="8" rx="1" fill="#050914" stroke="#1E293B" strokeWidth="0.5" />
              <circle cx="7" cy="-8" r="1" fill="#10B981" />
              <text x="10" y="-7.2" fill="#34D399" fontSize="2.8" fontFamily="monospace" fontWeight="bold">
                ✓ Build 100% Passed
              </text>
            </g>
          </g>
        ) : (
          /* CLOSED LID VIEW */
          <g id="laptop-screen-closed" transform="translate(5, 0)">
            <polygon
              points="0,0 50,0 46,-3 4,-3"
              fill="url(#laptopSilver)"
              stroke="#64748B"
              strokeWidth="0.8"
            />
            {/* Glowing Logo on Lid */}
            <circle cx="25" cy="-1.5" r="1.5" fill="#38BDF8" opacity="0.6" />
          </g>
        )}
      </g>
    </g>
  );
};
