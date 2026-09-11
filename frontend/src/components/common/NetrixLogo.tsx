import React from 'react';

export type LogoVariant = 'full' | 'compact' | 'emblem' | 'horizontal' | 'wordmark';

interface NetrixLogoProps {
  variant?: LogoVariant;
  className?: string;
  glow?: boolean;
  animated?: boolean;
  onClick?: () => void;
  alt?: string;
}

export const NetrixLogo: React.FC<NetrixLogoProps> = ({
  variant = 'full',
  className = 'w-full',
  glow = false,
  animated = false,
  onClick,
  alt = 'NETRIX — Criminal Network Intelligence'
}) => {
  const logoSrc = '/netrix-logo.png';

  // Responsive container styles per variant
  const getContainerStyle = () => {
    switch (variant) {
      case 'horizontal':
        return 'flex items-center gap-3';
      case 'emblem':
        return 'relative flex items-center justify-center';
      case 'wordmark':
        return 'relative flex items-center justify-center';
      case 'compact':
        return 'relative flex items-center gap-2.5';
      case 'full':
      default:
        return 'relative flex flex-col items-center justify-center';
    }
  };

  return (
    <div
      onClick={onClick}
      className={`relative inline-flex select-none ${onClick ? 'cursor-pointer' : ''} ${getContainerStyle()} ${className}`}
    >
      {/* Ambient Crimson / Dark Backlight Glow */}
      {glow && (
        <div
          className={`absolute inset-0 pointer-events-none rounded-2xl bg-red-950/25 blur-xl transform -z-10 ${
            animated ? 'animate-pulse' : ''
          }`}
          style={{ transform: 'scale(0.95)' }}
        />
      )}

      {/* RENDER ACCORDING TO VARIANT */}
      {variant === 'full' && (
        <div className="relative flex flex-col items-center justify-center w-full">
          <img
            src={logoSrc}
            alt={alt}
            className={`w-full h-auto object-contain max-w-full drop-shadow-[0_12px_30px_rgba(0,0,0,0.8)] rounded-2xl ${
              animated ? 'hover:scale-[1.02] transition-transform duration-300' : ''
            }`}
          />
        </div>
      )}

      {variant === 'emblem' && (
        <div className="relative w-10 h-10 sm:w-11 sm:h-11 overflow-hidden rounded-xl border border-white/10 bg-[#0B0F19] shadow-[0_4px_16px_rgba(0,0,0,0.6)] flex items-center justify-center shrink-0">
          <img
            src={logoSrc}
            alt={alt}
            className="w-full h-full object-contain p-1 rounded-lg"
          />
        </div>
      )}

      {variant === 'horizontal' && (
        <div className="flex items-center gap-3 w-full">
          {/* Square Emblem Container */}
          <div className="relative w-8 h-8 sm:w-9 sm:h-9 overflow-hidden rounded-lg border border-white/10 bg-[#0B0F19] shadow-[0_2px_10px_rgba(0,0,0,0.5)] shrink-0 flex items-center justify-center">
            <img
              src={logoSrc}
              alt="NETRIX Emblem"
              className="w-full h-full object-contain p-0.5 rounded-md"
            />
          </div>
          {/* Typography Branding Wordmark & Subtitle */}
          <div className="flex flex-col justify-center leading-none">
            <div className="flex items-center gap-1.5">
              <span className="font-tech font-extrabold text-sm sm:text-base tracking-[0.2em] text-slate-100">
                NETRIX
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-red-600 shadow-[0_0_6px_rgba(220,38,38,0.7)]" />
            </div>
            <span className="text-[7.5px] sm:text-[8px] font-mono tracking-[0.16em] text-slate-400 uppercase font-semibold mt-0.5">
              CRIMINAL INTELLIGENCE
            </span>
          </div>
        </div>
      )}

      {variant === 'compact' && (
        <div className="flex items-center gap-2.5">
          <div className="relative w-7 h-7 overflow-hidden rounded-md border border-white/10 bg-[#0B0F19] shrink-0 flex items-center justify-center">
            <img
              src={logoSrc}
              alt="NETRIX"
              className="w-full h-full object-contain p-0.5 rounded-sm"
            />
          </div>
          <span className="font-tech font-bold text-xs tracking-wider text-slate-100">
            NETRIX
          </span>
        </div>
      )}

      {variant === 'wordmark' && (
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2">
            <span className="font-tech font-black text-2xl sm:text-3xl tracking-[0.25em] text-slate-100 drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
              NETRIX
            </span>
            <span className="w-2 h-2 rounded-full bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.8)]" />
          </div>
          <span className="text-[10px] font-mono tracking-[0.3em] text-red-500/90 font-bold uppercase mt-1">
            CRIMINAL NETWORK INTELLIGENCE
          </span>
        </div>
      )}
    </div>
  );
};
