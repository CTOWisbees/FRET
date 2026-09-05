'use client';

import React from 'react';

interface TaskBoardProps {
  x: number;
  y: number;
  progressVal?: number; // 0 to 100
  opacity?: number;
  scale?: number;
}

export const TaskBoard: React.FC<TaskBoardProps> = ({
  x,
  y,
  progressVal = 92,
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
        {/* Whiteboard Surface Gradient */}
        <linearGradient id="boardSurfaceGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#F1F5F9" />
        </linearGradient>

        {/* Board Aluminum Frame Gradient */}
        <linearGradient id="boardFrameGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#CBD5E1" />
          <stop offset="50%" stopColor="#94A3B8" />
          <stop offset="100%" stopColor="#64748B" />
        </linearGradient>

        {/* Progress Bar Gradient */}
        <linearGradient id="boardProgGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0D9488" />
          <stop offset="50%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#34D399" />
        </linearGradient>
      </defs>

      {/* Ground Shadow under Rolling Stand */}
      <ellipse cx="70" cy="5" rx="80" ry="10" fill="rgba(15, 23, 42, 0.25)" />

      {/* STAND LEGS ON WHEELS */}
      {/* Left Leg */}
      <path d="M15 0 L15 -170" stroke="url(#boardFrameGrad)" strokeWidth="5" strokeLinecap="round" />
      <path d="M0 2 L30 2" stroke="url(#boardFrameGrad)" strokeWidth="4" strokeLinecap="round" />
      <circle cx="2" cy="4" r="3" fill="#0F172A" />
      <circle cx="28" cy="4" r="3" fill="#0F172A" />

      {/* Right Leg */}
      <path d="M125 0 L125 -170" stroke="url(#boardFrameGrad)" strokeWidth="5" strokeLinecap="round" />
      <path d="M110 2 L140 2" stroke="url(#boardFrameGrad)" strokeWidth="4" strokeLinecap="round" />
      <circle cx="112" cy="4" r="3" fill="#0F172A" />
      <circle cx="138" cy="4" r="3" fill="#0F172A" />

      {/* Cross Brace */}
      <line x1="15" y1="-50" x2="125" y2="-50" stroke="#94A3B8" strokeWidth="3" />

      {/* WHITEBOARD FRAME & SURFACE */}
      <g transform="translate(0, -210)">
        {/* Outer Bezel Frame */}
        <rect
          x="0"
          y="0"
          width="140"
          height="145"
          rx="6"
          fill="url(#boardFrameGrad)"
          stroke="#475569"
          strokeWidth="1.5"
        />
        {/* Whiteboard Inset Panel */}
        <rect
          x="4"
          y="4"
          width="132"
          height="137"
          rx="4"
          fill="url(#boardSurfaceGrad)"
          stroke="#CBD5E1"
          strokeWidth="1"
        />

        {/* Marker Tray at Bottom of Board */}
        <rect x="25" y="141" width="90" height="4" rx="1.5" fill="#475569" />
        {/* Dry Erase Markers */}
        <rect x="35" y="139" width="12" height="3" rx="1" fill="#0284C7" />
        <rect x="52" y="139" width="12" height="3" rx="1" fill="#10B981" />
        <rect x="69" y="139" width="12" height="3" rx="1" fill="#EF4444" />
        <rect x="86" y="138" width="14" height="4" rx="1" fill="#1E293B" />

        {/* BOARD HEADER */}
        <rect x="8" y="8" width="124" height="18" rx="3" fill="#0F172A" />
        <text x="14" y="20" fill="#38BDF8" fontSize="6.5" fontWeight="900" fontFamily="sans-serif">
          SPRINT #42 • OPERATIONS MATRIX
        </text>
        <circle cx="124" cy="17" r="2.5" fill="#10B981" />

        {/* SECTION 1: TASKS */}
        <g transform="translate(10, 32)">
          <text x="0" y="7" fill="#0F172A" fontSize="5.5" fontWeight="bold" fontFamily="sans-serif">
            TASKS (18/20 DONE)
          </text>
          {/* Task 1 */}
          <rect x="0" y="11" width="56" height="12" rx="2" fill="#E0F2FE" stroke="#38BDF8" strokeWidth="0.8" />
          <text x="4" y="19" fill="#0369A1" fontSize="4.2" fontWeight="bold">
            ✓ Role Matrix Sync
          </text>
          {/* Task 2 */}
          <rect x="0" y="25" width="56" height="12" rx="2" fill="#DCFCE7" stroke="#34D399" strokeWidth="0.8" />
          <text x="4" y="33" fill="#15803D" fontSize="4.2" fontWeight="bold">
            ✓ Auto Dispatch API
          </text>
          {/* Task 3 */}
          <rect x="0" y="39" width="56" height="12" rx="2" fill="#FEF3C7" stroke="#FBBF24" strokeWidth="0.8" />
          <text x="4" y="47" fill="#B45309" fontSize="4.2" fontWeight="bold">
            ✓ Live Attendance Timer
          </text>
        </g>

        {/* SECTION 2: PROGRESS */}
        <g transform="translate(72, 32)">
          <text x="0" y="7" fill="#0F172A" fontSize="5.5" fontWeight="bold" fontFamily="sans-serif">
            PROGRESS: {progressVal}%
          </text>
          {/* Progress Bar Container */}
          <rect x="0" y="11" width="58" height="7" rx="3" fill="#E2E8F0" stroke="#CBD5E1" strokeWidth="0.5" />
          <rect
            x="0"
            y="11"
            width={(58 * Math.min(progressVal, 100)) / 100}
            height="7"
            rx="3"
            fill="url(#boardProgGrad)"
          />

          {/* SECTION 3: TEAM & DEADLINE */}
          <g transform="translate(0, 24)">
            <text x="0" y="6" fill="#0F172A" fontSize="5.5" fontWeight="bold" fontFamily="sans-serif">
              TEAM: 4 SYNCHRONIZED
            </text>
            {/* Team Avatars */}
            <circle cx="6" cy="14" r="4" fill="#0D9488" />
            <circle cx="16" cy="14" r="4" fill="#059669" />
            <circle cx="26" cy="14" r="4" fill="#7C3AED" />
            <circle cx="36" cy="14" r="4" fill="#0284C7" />

            {/* Deadline Tag */}
            <rect x="0" y="22" width="58" height="12" rx="2" fill="#EDE9FE" stroke="#A78BFA" strokeWidth="0.8" />
            <text x="4" y="30" fill="#6D28D9" fontSize="4.2" fontWeight="bold">
              DEADLINE: ON TRACK ✓
            </text>
          </g>
        </g>

        {/* Physical Sticky Notes on Board */}
        {/* Pink Sticky */}
        <rect x="14" y="100" width="22" height="22" rx="1.5" fill="#F472B6" transform="rotate(-4 14 100)" />
        <line x1="17" y1="106" x2="31" y2="106" stroke="#831843" strokeWidth="1" transform="rotate(-4 14 100)" />
        <line x1="17" y1="110" x2="28" y2="110" stroke="#831843" strokeWidth="1" transform="rotate(-4 14 100)" />

        {/* Yellow Sticky */}
        <rect x="42" y="98" width="22" height="22" rx="1.5" fill="#FDE047" transform="rotate(3 42 98)" />
        <line x1="45" y1="104" x2="59" y2="104" stroke="#713F12" strokeWidth="1" transform="rotate(3 42 98)" />
        <line x1="45" y1="108" x2="56" y2="108" stroke="#713F12" strokeWidth="1" transform="rotate(3 42 98)" />

        {/* Cyan Sticky */}
        <rect x="70" y="101" width="22" height="22" rx="1.5" fill="#38BDF8" transform="rotate(-2 70 101)" />
        <line x1="73" y1="107" x2="87" y2="107" stroke="#0C4A6E" strokeWidth="1" transform="rotate(-2 70 101)" />
        <line x1="73" y1="111" x2="83" y2="111" stroke="#0C4A6E" strokeWidth="1" transform="rotate(-2 70 101)" />

        {/* Green Sticky */}
        <rect x="98" y="99" width="22" height="22" rx="1.5" fill="#4ADE80" transform="rotate(4 98 99)" />
        <line x1="101" y1="105" x2="115" y2="105" stroke="#14532D" strokeWidth="1" transform="rotate(4 98 99)" />
      </g>
    </g>
  );
};
