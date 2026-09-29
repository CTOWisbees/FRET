'use client';

import React from 'react';

export type CharacterAction =
  | 'walk'
  | 'sit_typing'
  | 'stand'
  | 'manage_team'
  | 'point_sales';

interface CharacterProps {
  x: number;
  y: number;
  action: CharacterAction;
  walkCycle?: number; // 0 to 1 for walking leg animation
  typingCycle?: number; // 0 to 1 for typing fingers animation
  pointProgress?: number; // 0 to 1 for pointing target sweep
  facing?: 'left' | 'right';
  opacity?: number;
  scale?: number;
}

export const Character: React.FC<CharacterProps> = ({
  x,
  y,
  action,
  walkCycle = 0,
  typingCycle = 0,
  pointProgress = 0,
  facing = 'right',
  opacity = 1,
  scale = 1,
}) => {
  const isFlipped = facing === 'left';
  const isWalking = action === 'walk';
  const isSitting = action === 'sit_typing';
  const isManaging = action === 'manage_team';
  const isPointing = action === 'point_sales';

  // Dynamic leg angles during walk cycle (-26deg to +26deg)
  const legAngle = Math.sin(walkCycle * Math.PI * 2) * 26;
  const armAngle = -legAngle;
  const bounceY = isWalking ? -Math.abs(Math.sin(walkCycle * Math.PI * 2)) * 5 : 0;

  // Typing finger tap offsets
  const typeTapLeft = Math.sin(typingCycle * Math.PI * 8) * 3;
  const typeTapRight = Math.cos(typingCycle * Math.PI * 8) * 3;

  return (
    <g
      transform={`translate(${x}, ${y + bounceY}) scale(${scale}) ${isFlipped ? 'scale(-1, 1)' : ''}`}
      opacity={opacity}
      className="pointer-events-none select-none"
    >
      <defs>
        {/* Hair Gradient */}
        <linearGradient id="mainCharHair" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1E293B" />
          <stop offset="100%" stopColor="#0F172A" />
        </linearGradient>

        {/* Skin Tone Gradient */}
        <linearGradient id="mainCharSkin" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FED7AA" />
          <stop offset="100%" stopColor="#FDBA74" />
        </linearGradient>

        {/* Navy Tech Blazer Gradient */}
        <linearGradient id="mainCharJacket" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1E3A8A" />
          <stop offset="50%" stopColor="#1E40AF" />
          <stop offset="100%" stopColor="#0F172A" />
        </linearGradient>

        {/* Cyan Shirt */}
        <linearGradient id="mainCharShirt" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#0284C7" />
        </linearGradient>

        {/* Trousers */}
        <linearGradient id="mainCharPants" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#334155" />
          <stop offset="100%" stopColor="#1E293B" />
        </linearGradient>
      </defs>

      {/* Ground Shadow */}
      <ellipse
        cx="0"
        cy="5"
        rx={isSitting ? 32 : 24}
        ry="6"
        fill="rgba(15, 23, 42, 0.25)"
      />

      {/* LEGS & FEET SKELETON */}
      {!isSitting ? (
        /* STANDING / WALKING LEGS */
        <g id="standing-legs">
          {/* Back (Left) Leg */}
          <g transform={`translate(-6, -82) rotate(${isWalking ? legAngle : 0})`}>
            <rect x="-4" y="0" width="8" height="82" rx="3" fill="url(#mainCharPants)" />
            {/* Shoe */}
            <path d="M-5 78 L9 78 C12 78 13 83 10 85 L-6 85 Z" fill="#F8FAFC" />
            <rect x="-6" y="83" width="16" height="2" fill="#0284C7" />
          </g>

          {/* Front (Right) Leg */}
          <g transform={`translate(6, -82) rotate(${isWalking ? -legAngle : 0})`}>
            <rect x="-4" y="0" width="8" height="82" rx="3" fill="#1E293B" />
            {/* Shoe */}
            <path d="M-5 78 L9 78 C12 78 13 83 10 85 L-6 85 Z" fill="#CBD5E1" />
            <rect x="-6" y="83" width="16" height="2" fill="#0284C7" />
          </g>
        </g>
      ) : (
        /* SITTING LEGS (Bent at Knee resting towards desk) */
        <g id="sitting-legs">
          {/* Thigh extending forward to desk */}
          <path
            d="M-8 -65 L25 -60 Q32 -58 30 -50 L-8 -46 Z"
            fill="url(#mainCharPants)"
          />
          {/* Lower leg extending down */}
          <path
            d="M22 -52 L18 0 L26 0 L30 -50 Z"
            fill="url(#mainCharPants)"
          />
          {/* Foot on Floor */}
          <path d="M14 -2 L32 -2 C35 -2 36 2 34 4 L12 4 Z" fill="#F8FAFC" />
          <rect x="12" y="3" width="22" height="2" fill="#0284C7" />
        </g>
      )}

      {/* TORSO, SHIRT & NAVY BLAZER */}
      <g id="torso-group" transform={`translate(0, ${isSitting ? 22 : 0})`}>
        {/* Belt */}
        <rect x="-14" y="-85" width="28" height="4" rx="1.5" fill="#0F172A" />
        <rect x="-3" y="-85" width="6" height="4" rx="1" fill="#94A3B8" />

        {/* Inner Cyan Shirt */}
        <path d="M-12 -135 L12 -135 L9 -85 L-9 -85 Z" fill="url(#mainCharShirt)" />
        {/* Collar V-Neck */}
        <polygon points="-4,-135 0,-122 4,-135" fill="#FED7AA" />

        {/* Navy Tech Blazer */}
        <path
          d="M-18 -135 C-18 -135 -10 -130 -4 -115 L-6 -84 L-15 -82 C-20 -105 -20 -125 -18 -135 Z"
          fill="url(#mainCharJacket)"
        />
        <path
          d="M18 -135 C18 -135 10 -130 4 -115 L6 -84 L15 -82 C20 -105 20 -125 18 -135 Z"
          fill="url(#mainCharJacket)"
        />

        {/* Smart Employee ID Badge */}
        <path d="M-2 -130 L0 -115 L2 -130" stroke="#38BDF8" strokeWidth="1" strokeLinecap="round" />
        <rect x="-3" y="-115" width="6" height="9" rx="1" fill="#FFFFFF" />
        <rect x="-2" y="-114" width="4" height="3" rx="0.5" fill="#0284C7" />
        <rect x="-2" y="-110" width="4" height="1" fill="#94A3B8" />
        <rect x="-2" y="-108" width="3" height="1" fill="#94A3B8" />

        {/* HEAD & FACE */}
        <g id="head-group">
          {/* Neck */}
          <rect x="-4" y="-144" width="8" height="10" rx="2" fill="url(#mainCharSkin)" />

          {/* Head Contour */}
          <ellipse cx="0" cy="-154" rx="13" ry="15" fill="url(#mainCharSkin)" />

          {/* Styled Modern Haircut */}
          <path
            d="M-13 -156 C-14 -168 -6 -174 4 -174 C14 -174 18 -170 16 -160 C13 -164 9 -166 0 -165 C-7 -164 -11 -161 -13 -156 Z"
            fill="url(#mainCharHair)"
          />
          <path d="M-12 -158 L-11 -148 L-9 -151 Z" fill="url(#mainCharHair)" />

          {/* Ears */}
          <circle cx="-13" cy="-154" r="3" fill="url(#mainCharSkin)" />
          <circle cx="13" cy="-154" r="3" fill="url(#mainCharSkin)" />

          {/* Eyeglasses */}
          <rect x="-9" y="-157" width="8" height="6" rx="1.5" stroke="#0F172A" strokeWidth="1" fill="none" />
          <rect x="1" y="-157" width="8" height="6" rx="1.5" stroke="#0F172A" strokeWidth="1" fill="none" />
          <line x1="-1" y1="-154" x2="1" y2="-154" stroke="#0F172A" strokeWidth="1" />
          {/* Eyes */}
          <circle cx="-5" cy="-154" r="1.2" fill="#0F172A" />
          <circle cx="5" cy="-154" r="1.2" fill="#0F172A" />

          {/* Friendly Smile */}
          <path d="M-3 -146 Q0 -143 3 -146" stroke="#EA580C" strokeWidth="1" strokeLinecap="round" />
        </g>

        {/* ARTICULATED ARMS AND HANDS BASED ON ACTION */}
        {/* CASE 1: SITTING & CODING (Arms bent over keyboard with active typing fingers) */}
        {isSitting && (
          <g id="coding-typing-arms">
            {/* Left Arm */}
            <path
              d="M-16 -132 Q-24 -105 -5 -94 L22 -92"
              stroke="#1E3A8A"
              strokeWidth="7"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            {/* Left Hand Typing */}
            <g transform={`translate(${22}, ${-92 + typeTapLeft})`}>
              <rect x="0" y="-3" width="4" height="6" rx="1" fill="#0284C7" />
              <circle cx="2" cy="0" r="1" fill="#10B981" />
              <circle cx="6" cy="0" r="3" fill="url(#mainCharSkin)" />
              <circle cx="9" cy="-1" r="1.2" fill="url(#mainCharSkin)" />
              <circle cx="9" cy="1" r="1.2" fill="url(#mainCharSkin)" />
            </g>

            {/* Right Arm */}
            <path
              d="M16 -132 Q10 -105 15 -94 L32 -92"
              stroke="#1E40AF"
              strokeWidth="7"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            {/* Right Hand Typing */}
            <g transform={`translate(${32}, ${-92 + typeTapRight})`}>
              <circle cx="4" cy="0" r="3" fill="url(#mainCharSkin)" />
              <circle cx="7" cy="-1" r="1.2" fill="url(#mainCharSkin)" />
              <circle cx="7" cy="1" r="1.2" fill="url(#mainCharSkin)" />
            </g>
          </g>
        )}

        {/* CASE 2: MANAGING TEAM (Gesturing toward board, holding digital tablet) */}
        {isManaging && (
          <g id="managing-team-arms">
            {/* Left Arm holding tablet at waist */}
            <path
              d="M-16 -132 Q-22 -105 -12 -92"
              stroke="#1E3A8A"
              strokeWidth="7"
              strokeLinecap="round"
              fill="none"
            />
            <rect x="-16" y="-98" width="12" height="18" rx="2" fill="#0F172A" stroke="#38BDF8" strokeWidth="1" transform="rotate(-10 -16 -98)" />
            <rect x="-14" y="-94" width="8" height="3" rx="0.5" fill="#10B981" transform="rotate(-10 -16 -98)" />

            {/* Right Arm Gesturing toward Task Board */}
            <g transform="translate(16, -132)">
              <path
                d="M0 0 Q20 10 38 -5"
                stroke="#1E40AF"
                strokeWidth="7"
                strokeLinecap="round"
                fill="none"
              />
              {/* Open Gesturing Palm */}
              <circle cx="42" cy="-6" r="3.5" fill="url(#mainCharSkin)" />
              <path d="M42 -6 L50 -8 Q52 -5 49 -3 L42 -4 Z" fill="url(#mainCharSkin)" />
              <rect x="34" y="-8" width="3" height="5" rx="0.8" fill="#0284C7" />
              <circle cx="35.5" cy="-5.5" r="0.8" fill="#10B981" />
            </g>
          </g>
        )}

        {/* CASE 3: POINTING AT SALES DASHBOARD */}
        {isPointing && (
          <g id="pointing-sales-arms">
            {/* Left Arm relaxed at side */}
            <path
              d="M-16 -132 Q-20 -105 -16 -85"
              stroke="#1E3A8A"
              strokeWidth="7"
              strokeLinecap="round"
              fill="none"
            />
            <circle cx="-16" cy="-84" r="3.5" fill="url(#mainCharSkin)" />

            {/* Right Arm Raised Pointing at Analytics Chart */}
            <g transform="translate(16, -132)">
              {/* Sweeping pointing arm */}
              <path
                d={`M0 0 Q25 ${-20 - pointProgress * 15} ${45 + pointProgress * 10} ${-40 - pointProgress * 20}`}
                stroke="#1E40AF"
                strokeWidth="7"
                strokeLinecap="round"
                fill="none"
              />
              {/* Hand with extended pointing index finger */}
              <g transform={`translate(${45 + pointProgress * 10}, ${-40 - pointProgress * 20})`}>
                <circle cx="0" cy="0" r="3.5" fill="url(#mainCharSkin)" />
                <path d="M0 -2 L12 -10 Q14 -7 11 -4 L0 2 Z" fill="url(#mainCharSkin)" />
                {/* Pointer Focus Target Ring */}
                <circle cx="14" cy="-10" r="2.5" fill="#38BDF8" />
                <circle cx="14" cy="-10" r="6" stroke="#0284C7" strokeWidth="1" fill="none" opacity="0.8" />
              </g>
            </g>
          </g>
        )}

        {/* CASE 4: WALKING / STANDING DEFAULT */}
        {!isSitting && !isManaging && !isPointing && (
          <g id="walking-arms">
            {/* Left Arm Swinging */}
            <g transform={`translate(-16, -132) rotate(${isWalking ? armAngle : 0})`}>
              <path d="M0 0 Q-6 25 -2 46" stroke="#1E3A8A" strokeWidth="7" strokeLinecap="round" fill="none" />
              <circle cx="-2" cy="48" r="3.5" fill="url(#mainCharSkin)" />
            </g>

            {/* Right Arm Swinging */}
            <g transform={`translate(16, -132) rotate(${isWalking ? -armAngle : 0})`}>
              <path d="M0 0 Q6 25 2 46" stroke="#1E40AF" strokeWidth="7" strokeLinecap="round" fill="none" />
              <circle cx="2" cy="48" r="3.5" fill="url(#mainCharSkin)" />
            </g>
          </g>
        )}
      </g>
    </g>
  );
};
