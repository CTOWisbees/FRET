'use client';

import React from 'react';

interface WisBeesLogoProps {
  className?: string;
  imgClassName?: string;
  alt?: string;
}

export function WisBeesLogo({
  className = '',
  imgClassName = 'h-7 w-auto object-contain',
  alt = 'WisBees'
}: WisBeesLogoProps) {
  return (
    <div className={`inline-flex items-center ${className}`}>
      {/* Light mode: official logo with black Bees */}
      <img
        src="/logo.png"
        alt={alt}
        className={`${imgClassName} block dark:hidden`}
      />
      {/* Dark mode: official logo with white Bees */}
      <img
        src="/logo-dark.png"
        alt={alt}
        className={`${imgClassName} hidden dark:block`}
      />
    </div>
  );
}

export default WisBeesLogo;
