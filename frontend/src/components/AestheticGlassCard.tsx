import React from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';

interface AestheticGlassCardProps {
  children: React.ReactNode;
  className?: string;
  enableParallax?: boolean;
  parallaxOffset?: number;
  hoverEffect?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}

/**
 * AestheticGlassCard provides high-end glassmorphic styling with frosted blur,
 * hairline borders, soft shadows, and optional subtle parallax scroll motion.
 */
export const AestheticGlassCard: React.FC<AestheticGlassCardProps> = ({
  children,
  className = '',
  enableParallax = false,
  parallaxOffset = -12,
  hoverEffect = true,
  onClick,
  style
}) => {
  const prefersReducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], [0, prefersReducedMotion ? 0 : parallaxOffset]);

  return (
    <motion.div
      style={{
        ...(enableParallax && !prefersReducedMotion ? { y } : {}),
        background: 'rgba(255, 255, 255, 0.92)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        border: '1px solid rgba(230, 225, 216, 0.85)',
        boxShadow: '0 10px 30px -6px rgba(18, 17, 16, 0.04), 0 2px 6px -2px rgba(18, 17, 16, 0.02)',
        ...style
      }}
      whileHover={
        hoverEffect
          ? {
              y: -3,
              boxShadow: '0 18px 36px -8px rgba(18, 17, 16, 0.08), 0 4px 12px -2px rgba(110, 24, 39, 0.06)',
              borderColor: 'rgba(110, 24, 39, 0.3)',
              transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] }
            }
          : undefined
      }
      onClick={onClick}
      className={`rounded-3xl transition-colors duration-200 ${
        onClick ? 'cursor-pointer select-none' : ''
      } ${className}`}
    >
      {children}
    </motion.div>
  );
};

export default AestheticGlassCard;
