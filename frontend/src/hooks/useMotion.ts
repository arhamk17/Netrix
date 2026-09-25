import { useScroll, useTransform, useReducedMotion, Variants, MotionValue } from 'framer-motion';
import { RefObject } from 'react';

/**
 * Editorial Motion Principles & Configurations for NETRIX Intelligence Platform
 */

// Premium Easing Curves & Springs
export const EASING_PREMIUM = [0.16, 1, 0.3, 1] as const;
export const EASING_SOFT_EXIT = [0.4, 0, 1, 1] as const;

export const SPRING_TACTILE = {
  type: 'spring',
  damping: 26,
  stiffness: 320
} as const;

export const SPRING_EXPAND = {
  type: 'spring',
  damping: 28,
  stiffness: 280
} as const;

export const SPRING_DRAWER = {
  type: 'spring',
  damping: 30,
  stiffness: 300
} as const;

// Framer Motion Reusable Variants
export const fadeInUpVariants: Variants = {
  initial: {
    opacity: 0,
    y: 8,
    scale: 0.995
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.32,
      ease: EASING_PREMIUM
    }
  },
  exit: {
    opacity: 0,
    y: -6,
    scale: 0.995,
    transition: {
      duration: 0.2,
      ease: EASING_SOFT_EXIT
    }
  }
};

export const staggerContainerVariants: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.02
    }
  }
};

export const scaleInVariants: Variants = {
  initial: {
    opacity: 0,
    scale: 0.95,
    y: 10
  },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: SPRING_TACTILE
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: 8,
    transition: {
      duration: 0.18,
      ease: 'easeOut'
    }
  }
};

export const drawerSlideVariants: Variants = {
  initial: {
    x: '100%',
    opacity: 0
  },
  animate: {
    x: 0,
    opacity: 1,
    transition: SPRING_DRAWER
  },
  exit: {
    x: '100%',
    opacity: 0,
    transition: {
      duration: 0.22,
      ease: 'easeIn'
    }
  }
};

// Glassmorphism Utility Presets
export const GLASS_FLOATING_CLASSES = 'bg-white/70 backdrop-blur-lg border border-black/10 shadow-lg';
export const GLASS_CARD_CLASSES = 'bg-white/80 backdrop-blur-md border border-[#E6E1D8] shadow-sm';

/**
 * Custom hook to calculate subtle, accessibility-compliant scroll parallax transforms
 *
 * @param outputRange Vertical pixel translation bounds e.g. [0, -30]
 * @param targetRef Optional target element ref for container-level scroll tracking
 */
export function useParallaxScroll(
  outputRange: [number, number] = [0, -20],
  targetRef?: RefObject<HTMLElement | null>
): MotionValue<number> {
  const prefersReducedMotion = useReducedMotion();
  
  const { scrollYProgress } = useScroll(
    targetRef ? { target: targetRef, offset: ['start end', 'end start'] } : undefined
  );

  // Fallback to 0 transform when reduced motion is enabled
  const safeOutputRange: [number, number] = prefersReducedMotion ? [0, 0] : outputRange;

  return useTransform(scrollYProgress, [0, 1], safeOutputRange);
}
