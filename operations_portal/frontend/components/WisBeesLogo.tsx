'use client';

import React from 'react';

interface WisBeesLogoProps {
  className?: string;
  imgClassName?: string;
  alt?: string;
  showText?: boolean;
}

export function WisBeesLogo({
  className = '',
  imgClassName = 'h-8 w-auto object-contain',
  alt = 'WisBees',
  showText = false,
}: WisBeesLogoProps) {
  return (
    <div className={`inline-flex items-center gap-2 select-none ${className}`}>
      {/* Light Mode Logo (Black Bees) */}
      <img
        src="/logo.png"
        alt={alt}
        className={`${imgClassName} block dark:hidden transition-all duration-200`}
      />
      {/* Dark Mode Logo (White Bees with crisp rendering) */}
      <img
        src="/logo-dark.png"
        alt={alt}
        onError={(e) => {
          // Fallback if logo-dark is unavailable
          const target = e.currentTarget;
          target.src = '/logo.png';
          target.className = `${imgClassName} hidden dark:block filter invert brightness-200 contrast-200`;
        }}
        className={`${imgClassName} hidden dark:block transition-all duration-200`}
      />
      {showText && (
        <span className="font-black tracking-tight text-slate-900 dark:text-white text-base">
          <span className="text-emerald-500">Wis</span>
          <span className="text-slate-900 dark:text-white">Bees</span>
        </span>
      )}
    </div>
  );
}

export default WisBeesLogo;
