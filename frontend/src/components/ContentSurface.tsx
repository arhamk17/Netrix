import React from 'react';

export type SurfaceVariant = 'solid' | 'subtle' | 'transparent';

interface ContentSurfaceProps {
  children: React.ReactNode;
  variant?: SurfaceVariant;
  className?: string;
  id?: string;
  as?: React.ElementType;
  style?: React.CSSProperties;
}

/**
 * ContentSurface establishes strict section containment & stacking context.
 * - 'solid': Opaque white/off-white surface (100% opacity) that completely masks background animation bleed-through.
 * - 'subtle': Controlled near-opaque surface (95%+ white) with hairline borders for floating cards & panels.
 * - 'transparent': Open hero/ambient space where background animation is intentionally meant to be seen.
 */
export const ContentSurface: React.FC<ContentSurfaceProps> = ({
  children,
  variant = 'solid',
  className = '',
  id,
  as: Component = 'div',
  style
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'solid':
        return 'bg-[#F8F7F4] text-[#121110] relative z-10 overflow-hidden';
      case 'subtle':
        return 'bg-white text-[#121110] relative z-10 overflow-hidden border border-[#E6E1D8] shadow-2xs';
      case 'transparent':
        return 'bg-transparent text-[#121110] relative z-10';
      default:
        return 'bg-[#F8F7F4] text-[#121110] relative z-10 overflow-hidden';
    }
  };

  return (
    <Component id={id} className={`${getVariantStyles()} ${className}`} style={style}>
      {children}
    </Component>
  );
};
