import React from 'react';

export type LogoVariant = 'full' | 'compact' | 'emblem' | 'horizontal' | 'wordmark';
export type LogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'hero';

export interface NetrixLogoProps {
  variant?: LogoVariant;
  size?: LogoSize | string;
  className?: string;
  glow?: boolean;
  animated?: boolean;
  showSubtext?: boolean;
  onClick?: () => void;
  alt?: string;
}

const SIZE_MAP: Record<LogoSize, { img: string; text: string; subtext: string; gap: string }> = {
  xs: { img: 'w-6 h-6', text: 'text-xs tracking-wider', subtext: 'text-[8px] tracking-widest', gap: 'gap-2' },
  sm: { img: 'w-8 h-8', text: 'text-sm tracking-wider', subtext: 'text-[9px] tracking-widest', gap: 'gap-2.5' },
  md: { img: 'w-10 h-10', text: 'text-base tracking-wider', subtext: 'text-[10px] tracking-widest', gap: 'gap-3' },
  lg: { img: 'w-14 h-14', text: 'text-xl tracking-wider', subtext: 'text-xs tracking-widest', gap: 'gap-3.5' },
  xl: { img: 'w-20 h-20', text: 'text-2xl tracking-widest', subtext: 'text-xs tracking-widest', gap: 'gap-4' },
  hero: { img: 'w-28 h-28', text: 'text-4xl tracking-widest', subtext: 'text-sm tracking-widest', gap: 'gap-5' }
};

export const NetrixLogo: React.FC<NetrixLogoProps> = ({
  variant = 'horizontal',
  size = 'md',
  className = '',
  glow = false,
  animated = false,
  showSubtext = false,
  onClick,
  alt = 'NETRIX Criminal Network Intelligence'
}) => {
  const logoSrc = '/LOGONETRIX.png';
  const sizeConfig = typeof size === 'string' && (size in SIZE_MAP) ? SIZE_MAP[size as LogoSize] : SIZE_MAP.md;

  return (
    <div
      onClick={onClick}
      className={`relative inline-flex items-center select-none ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {/* Ambient Burgundy Glow Backlight */}
      {glow && (
        <div
          className={`absolute -inset-1 rounded-full bg-[#6E1827]/30 blur-md pointer-events-none -z-10 ${
            animated ? 'animate-pulse' : ''
          }`}
        />
      )}

      {/* Emblem Only */}
      {variant === 'emblem' && (
        <div className={`relative ${sizeConfig.img} rounded-lg bg-white/90 border border-[#6E1827]/25 shadow-xs p-1 flex items-center justify-center shrink-0`}>
          <img
            src={logoSrc}
            alt={alt}
            className="w-full h-full object-contain"
          />
        </div>
      )}

      {/* Horizontal Wordmark + Emblem */}
      {variant === 'horizontal' && (
        <div className={`flex items-center ${sizeConfig.gap}`}>
          <div className={`relative ${sizeConfig.img} rounded-lg bg-white/95 border border-[#6E1827]/25 shadow-xs p-1 flex items-center justify-center shrink-0 transition-transform duration-200 hover:scale-105`}>
            <img
              src={logoSrc}
              alt={alt}
              className="w-full h-full object-contain"
            />
          </div>
          <div className="flex flex-col">
            <span className={`font-serif font-bold text-[#0D0D0C] ${sizeConfig.text} leading-none tracking-tight`}>
              NETRIX
            </span>
            {showSubtext && (
              <span className={`font-mono text-[#6E1827] ${sizeConfig.subtext} font-semibold uppercase leading-tight mt-0.5`}>
                CRIMINAL NETWORK INTELLIGENCE
              </span>
            )}
          </div>
        </div>
      )}

      {/* Compact Header Badge */}
      {variant === 'compact' && (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-white border border-[#6E1827]/20 shadow-xs p-0.5 flex items-center justify-center shrink-0">
            <img src={logoSrc} alt={alt} className="w-full h-full object-contain" />
          </div>
          <span className="font-serif font-bold text-xs tracking-tight text-[#0D0D0C]">
            NETRIX
          </span>
        </div>
      )}

      {/* Full Vertical Presentation */}
      {variant === 'full' && (
        <div className="flex flex-col items-center justify-center text-center gap-3">
          <div className="w-20 h-20 rounded-2xl bg-white border border-[#6E1827]/25 shadow-md p-2 flex items-center justify-center shrink-0">
            <img src={logoSrc} alt={alt} className="w-full h-full object-contain" />
          </div>
          <div className="flex flex-col items-center">
            <span className="font-serif font-bold text-2xl text-[#0D0D0C] tracking-tight">
              NETRIX
            </span>
            {showSubtext && (
              <span className="font-mono text-xs text-[#6E1827] font-semibold tracking-widest uppercase mt-1">
                CRIMINAL NETWORK INTELLIGENCE & FORENSICS
              </span>
            )}
          </div>
        </div>
      )}

      {/* Wordmark Only */}
      {variant === 'wordmark' && (
        <span className={`font-serif font-bold text-[#0D0D0C] ${sizeConfig.text} tracking-tight`}>
          NETRIX
        </span>
      )}
    </div>
  );
};
