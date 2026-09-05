'use client';

import React from 'react';

interface ChairProps {
  x: number;
  y: number;
  opacity?: number;
  scale?: number;
}

export const Chair: React.FC<ChairProps> = ({ x, y, opacity = 1, scale = 1 }) => {
  return (
    <g
      transform={`translate(${x}, ${y}) scale(${scale})`}
      opacity={opacity}
      className="pointer-events-none select-none transition-opacity duration-300"
    >
      <defs>
        <linearGradient id="chairMeshGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1E293B" />
          <stop offset="100%" stopColor="#0F172A" />
        </linearGradient>
        <linearGradient id="chairMetalGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#94A3B8" />
          <stop offset="100%" stopColor="#475569" />
        </linearGradient>
      </defs>

      {/* Chair Ground Shadow */}
      <ellipse cx="0" cy="5" rx="35" ry="8" fill="rgba(15, 23, 42, 0.25)" />

      {/* 5-Star Wheel Base */}
      <path
        d="M-28 2 L28 2 M0 2 L0 -45"
        stroke="url(#chairMetalGrad)"
        strokeWidth="4"
        strokeLinecap="round"
      />
      {/* Wheels */}
      <circle cx="-28" cy="3" r="3" fill="#0F172A" />
      <circle cx="28" cy="3" r="3" fill="#0F172A" />
      <circle cx="0" cy="3" r="3" fill="#0F172A" />

      {/* Pneumatic Cylinder */}
      <rect x="-4" y="-45" width="8" height="22" rx="2" fill="#334155" />
      <rect x="-2" y="-30" width="4" height="15" fill="#64748B" />

      {/* Ergonomic Seat Cushion */}
      <path
        d="M-28 -45 Q0 -42 28 -45 Q30 -38 24 -36 Q0 -33 -24 -36 Q-30 -38 -28 -45 Z"
        fill="url(#chairMeshGrad)"
        stroke="#0284C7"
        strokeWidth="1"
      />

      {/* Armrests */}
      <path
        d="M-22 -44 L-22 -65 L-12 -65"
        stroke="#475569"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <rect x="-24" y="-68" width="16" height="4" rx="2" fill="#1E293B" />

      {/* Ergonomic Curved Mesh Backrest */}
      <path
        d="M-24 -46 C-32 -80 -30 -115 -18 -135 C-12 -145 -2 -140 -2 -130 C-14 -115 -18 -80 -12 -46 Z"
        fill="url(#chairMeshGrad)"
        stroke="#38BDF8"
        strokeWidth="1.2"
      />

      {/* Lumbar Support Pad */}
      <rect x="-22" y="-85" width="8" height="18" rx="4" fill="#0284C7" opacity="0.8" />
    </g>
  );
};
