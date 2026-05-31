import React from 'react';

interface IntradetectorLogoProps {
  /** Size variant for the logotype */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Whether to show the "by Sebratel" tagline */
  showTagline?: boolean;
  className?: string;
}

const sizeMap = {
  sm: { logo: 'text-xl', tagline: 'text-[8px]' },
  md: { logo: 'text-2xl', tagline: 'text-[9px]' },
  lg: { logo: 'text-3xl', tagline: 'text-[10px]' },
  xl: { logo: 'text-5xl', tagline: 'text-xs' },
};

export default function IntradetectorLogo({
  size = 'xl',
  showTagline = true,
  className = '',
}: IntradetectorLogoProps) {
  const { logo, tagline } = sizeMap[size];

  return (
    <div className={`flex flex-col leading-none select-none ${className}`}>
      {/* Logotype — Barlow Condensed Bold */}
      <span
        className={`${logo} font-extrabold tracking-tight`}
        style={{ fontFamily: 'var(--font-sans), sans-serif' }}
      >
        <span className="text-red-500">Intra</span>
        <span className="text-white">detector</span>
      </span>

      {/* Tagline */}
      {showTagline && (
        <span
          className={`${tagline} text-zinc-500 font-medium tracking-wide mt-0.5 leading-none`}
          style={{ fontFamily: 'var(--font-sans), sans-serif' }}
        >
          by Sebratel
        </span>
      )}
    </div>
  );
}
