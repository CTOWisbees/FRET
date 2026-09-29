'use client';

import React from 'react';

interface TeamProps {
  x: number;
  y: number;
  isWalking: boolean;
  walkCycle: number; // 0 to 1 for leg swing angle
  facing?: 'left' | 'right';
  opacity?: number;
  scale?: number;
}

export const Team: React.FC<TeamProps> = ({
  x,
  y,
  isWalking,
  walkCycle,
  facing = 'left',
  opacity = 1,
  scale = 1,
}) => {
  const isFlipped = facing === 'right';
  const legAngle = Math.sin(walkCycle * Math.PI * 2) * 22;
  const armAngle = -legAngle;

  return (
    <g
      transform={`translate(${x}, ${y}) scale(${scale}) ${isFlipped ? 'scale(-1, 1)' : ''}`}
      opacity={opacity}
      className="pointer-events-none select-none"
    >
      <defs>
        {/* Gradients for Member 1 (UI Lead - Teal) */}
        <linearGradient id="t1Jacket" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#0D9488" />
          <stop offset="100%" stopColor="#115E59" />
        </linearGradient>

        {/* Gradients for Member 2 (Data Eng - Emerald) */}
        <linearGradient id="t2Jacket" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#059669" />
          <stop offset="100%" stopColor="#064E3B" />
        </linearGradient>

        {/* Gradients for Member 3 (Product Lead - Violet/Indigo) */}
        <linearGradient id="t3Jacket" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#4F46E5" />
          <stop offset="100%" stopColor="#3730A3" />
        </linearGradient>

        {/* Skin Tones */}
        <linearGradient id="skinLight" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FED7AA" />
          <stop offset="100%" stopColor="#FDBA74" />
        </linearGradient>
        <linearGradient id="skinWarm" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
        <linearGradient id="skinRich" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FCA5A5" />
          <stop offset="100%" stopColor="#F87171" />
        </linearGradient>
      </defs>

      {/* TEAM MEMBER 1: UI Designer (Left position in team cluster, holding tablet) */}
      <g id="member-1-designer" transform="translate(0, 0)">
        {/* Ground Shadow */}
        <ellipse cx="0" cy="5" rx="20" ry="5" fill="rgba(15, 23, 42, 0.25)" />

        {/* Articulated Legs */}
        {/* Left Leg */}
        <g transform={`translate(-5, -75) rotate(${isWalking ? legAngle : 0})`}>
          <rect x="-3.5" y="0" width="7" height="75" rx="2.5" fill="#334155" />
          {/* Shoe */}
          <path d="M-4 72 L6 72 C8 72 9 76 7 78 L-5 78 Z" fill="#F8FAFC" />
        </g>
        {/* Right Leg */}
        <g transform={`translate(5, -75) rotate(${isWalking ? -legAngle : 0})`}>
          <rect x="-3.5" y="0" width="7" height="75" rx="2.5" fill="#1E293B" />
          {/* Shoe */}
          <path d="M-4 72 L6 72 C8 72 9 76 7 78 L-5 78 Z" fill="#F8FAFC" />
        </g>

        {/* Torso & Teal Blazer */}
        <path d="M-14 -125 Q0 -130 14 -125 L10 -75 L-10 -75 Z" fill="url(#t1Jacket)" />

        {/* Head & Hair */}
        <circle cx="0" cy="-145" r="12" fill="url(#skinLight)" />
        {/* Ponytail Hair */}
        <path d="M-10 -150 C-10 -162 -2 -165 6 -162 C14 -158 14 -148 10 -140 C5 -148 -2 -150 -10 -150 Z" fill="#78350F" />
        <path d="M-8 -150 Q-18 -142 -14 -128 Q-10 -138 -6 -144 Z" fill="#78350F" />
        <circle cx="4" cy="-146" r="1.2" fill="#0F172A" />
        <path d="M2 -141 Q5 -139 7 -141" stroke="#EA580C" strokeWidth="1" strokeLinecap="round" />

        {/* Arms holding Tablet */}
        <g transform={`translate(-12, -120) rotate(${isWalking ? armAngle * 0.5 : 0})`}>
          <path d="M0 0 Q8 20 18 18" stroke="#0D9488" strokeWidth="6" strokeLinecap="round" fill="none" />
          {/* Tablet Screen */}
          <rect x="14" y="6" width="16" height="20" rx="2" fill="#0F172A" stroke="#2DD4BF" strokeWidth="1" />
          <rect x="17" y="10" width="10" height="3" rx="1" fill="#2DD4BF" />
          <rect x="17" y="15" width="7" height="2" rx="0.5" fill="#94A3B8" />
        </g>
      </g>

      {/* TEAM MEMBER 2: Data Engineer (Center position, glasses, holding clipboard) */}
      <g id="member-2-engineer" transform="translate(60, 0)">
        {/* Ground Shadow */}
        <ellipse cx="0" cy="5" rx="20" ry="5" fill="rgba(15, 23, 42, 0.25)" />

        {/* Legs */}
        <g transform={`translate(-5, -78) rotate(${isWalking ? -legAngle : 0})`}>
          <rect x="-4" y="0" width="8" height="78" rx="2.5" fill="#1E293B" />
          <path d="M-5 75 L7 75 C9 75 10 79 8 81 L-6 81 Z" fill="#E2E8F0" />
        </g>
        <g transform={`translate(5, -78) rotate(${isWalking ? legAngle : 0})`}>
          <rect x="-4" y="0" width="8" height="78" rx="2.5" fill="#334155" />
          <path d="M-5 75 L7 75 C9 75 10 79 8 81 L-6 81 Z" fill="#E2E8F0" />
        </g>

        {/* Torso & Emerald Sweater */}
        <path d="M-15 -130 Q0 -135 15 -130 L11 -78 L-11 -78 Z" fill="url(#t2Jacket)" />

        {/* Head & Glasses */}
        <circle cx="0" cy="-150" r="13" fill="url(#skinWarm)" />
        <path d="M-11 -155 C-11 -170 0 -172 10 -170 C16 -165 16 -156 12 -150 C7 -158 0 -160 -11 -155 Z" fill="#1E293B" />
        {/* Eyeglasses */}
        <rect x="-8" y="-153" width="7" height="6" rx="1.5" stroke="#0F172A" strokeWidth="1" fill="none" />
        <rect x="2" y="-153" width="7" height="6" rx="1.5" stroke="#0F172A" strokeWidth="1" fill="none" />
        <line x1="-1" y1="-150" x2="2" y2="-150" stroke="#0F172A" strokeWidth="1" />
        <circle cx="5" cy="-150" r="1.2" fill="#0F172A" />

        {/* Clipboard with Tasks */}
        <g transform="translate(-6, -118)">
          <path d="M-6 -5 Q0 15 8 12" stroke="#059669" strokeWidth="7" strokeLinecap="round" fill="none" />
          <rect x="2" y="2" width="18" height="24" rx="2" fill="#FFFFFF" stroke="#10B981" strokeWidth="1" />
          <line x1="5" y1="8" x2="16" y2="8" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="5" y1="13" x2="14" y2="13" stroke="#94A3B8" strokeWidth="1" strokeLinecap="round" />
          <line x1="5" y1="18" x2="17" y2="18" stroke="#94A3B8" strokeWidth="1" strokeLinecap="round" />
        </g>
      </g>

      {/* TEAM MEMBER 3: Product Specialist (Right position, giving thumbs up) */}
      <g id="member-3-product" transform="translate(120, 0)">
        {/* Ground Shadow */}
        <ellipse cx="0" cy="5" rx="20" ry="5" fill="rgba(15, 23, 42, 0.25)" />

        {/* Legs */}
        <g transform={`translate(-5, -75) rotate(${isWalking ? legAngle : 0})`}>
          <rect x="-3.5" y="0" width="7" height="75" rx="2.5" fill="#334155" />
          <path d="M-4 72 L6 72 C8 72 9 76 7 78 L-5 78 Z" fill="#F8FAFC" />
        </g>
        <g transform={`translate(5, -75) rotate(${isWalking ? -legAngle : 0})`}>
          <rect x="-3.5" y="0" width="7" height="75" rx="2.5" fill="#1E293B" />
          <path d="M-4 72 L6 72 C8 72 9 76 7 78 L-5 78 Z" fill="#F8FAFC" />
        </g>

        {/* Torso & Indigo Shirt */}
        <path d="M-14 -125 Q0 -130 14 -125 L10 -75 L-10 -75 Z" fill="url(#t3Jacket)" />

        {/* Head */}
        <circle cx="0" cy="-145" r="12" fill="url(#skinRich)" />
        <path d="M-10 -150 C-10 -162 -2 -164 8 -162 C14 -158 14 -150 11 -142 Z" fill="#451A03" />
        <circle cx="3" cy="-146" r="1.2" fill="#0F172A" />
        <path d="M1 -141 Q4 -139 6 -141" stroke="#EA580C" strokeWidth="1" strokeLinecap="round" />

        {/* Thumbs up arm */}
        <g transform="translate(-10, -120)">
          <path d="M0 0 Q-10 12 -8 20" stroke="#4F46E5" strokeWidth="6" strokeLinecap="round" fill="none" />
          <path d="M20 0 Q28 15 22 18" stroke="#4F46E5" strokeWidth="6" strokeLinecap="round" fill="none" />
          {/* Hand Thumbs Up */}
          <circle cx="22" cy="18" r="3.5" fill="#FCA5A5" />
          <path d="M22 18 L22 13 Q24 13 25 15 L24 18 Z" fill="#FCA5A5" />
        </g>
      </g>
    </g>
  );
};
