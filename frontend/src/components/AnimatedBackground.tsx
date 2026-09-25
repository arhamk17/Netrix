import React, { useEffect, useState, useMemo } from 'react';
import { motion, useReducedMotion, useMotionValue, useSpring, useScroll, useTransform } from 'framer-motion';

export type BackgroundContext =
  | 'dashboard'
  | 'cases'
  | 'evidence'
  | 'graph'
  | 'predictions'
  | 'leads'
  | 'entities'
  | 'timeline'
  | 'verification'
  | 'admin'
  | 'auth'
  | 'home';

interface AnimatedBackgroundProps {
  context?: BackgroundContext | string;
  className?: string;
}

interface NetworkNode {
  id: number;
  x: number;
  y: number;
  r: number;
  connections: number[];
  colorType: 'burgundy' | 'charcoal' | 'neutral';
  speed: number;
  offsetRange: number;
}

export const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({
  context = 'dashboard',
  className = ''
}) => {
  const shouldReduceMotion = useReducedMotion();

  // Mouse parallax motion values
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Smooth spring physics for parallax depth
  const springX = useSpring(mouseX, { damping: 40, stiffness: 120 });
  const springY = useSpring(mouseY, { damping: 40, stiffness: 120 });

  // Scroll-driven subtle parallax Y shift
  const { scrollYProgress } = useScroll();
  const scrollParallaxY = useTransform(scrollYProgress, [0, 1], [0, shouldReduceMotion ? 0 : -35]);

  useEffect(() => {
    if (shouldReduceMotion || context === 'auth') return;

    let rafId: number | null = null;
    const handleMouseMove = (e: MouseEvent) => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        const { innerWidth, innerHeight } = window;
        const x = (e.clientX / innerWidth - 0.5) * 36;
        const y = (e.clientY / innerHeight - 0.5) * 36;
        mouseX.set(x);
        mouseY.set(y);
        rafId = null;
      });
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [shouldReduceMotion, context, mouseX, mouseY]);

  // Network topology definition (14 coordinated nodes across the viewport canvas)
  const nodes: NetworkNode[] = useMemo(() => [
    { id: 0, x: 12, y: 18, r: 3, connections: [1, 2, 4], colorType: 'charcoal', speed: 18, offsetRange: 16 },
    { id: 1, x: 28, y: 12, r: 2.5, connections: [0, 2, 3], colorType: 'neutral', speed: 22, offsetRange: 20 },
    { id: 2, x: 22, y: 32, r: 3.5, connections: [0, 1, 5, 6], colorType: 'burgundy', speed: 24, offsetRange: 18 },
    { id: 3, x: 44, y: 16, r: 2, connections: [1, 7], colorType: 'neutral', speed: 20, offsetRange: 14 },
    { id: 4, x: 14, y: 52, r: 2.5, connections: [0, 5, 8], colorType: 'charcoal', speed: 26, offsetRange: 22 },
    { id: 5, x: 34, y: 46, r: 4, connections: [2, 4, 6, 9], colorType: 'burgundy', speed: 19, offsetRange: 15 },
    { id: 6, x: 52, y: 38, r: 3, connections: [2, 5, 7, 10], colorType: 'charcoal', speed: 25, offsetRange: 24 },
    { id: 7, x: 68, y: 22, r: 2.5, connections: [3, 6, 11], colorType: 'neutral', speed: 21, offsetRange: 18 },
    { id: 8, x: 24, y: 76, r: 3, connections: [4, 9, 12], colorType: 'charcoal', speed: 23, offsetRange: 20 },
    { id: 9, x: 46, y: 68, r: 3.5, connections: [5, 8, 10, 13], colorType: 'burgundy', speed: 27, offsetRange: 25 },
    { id: 10, x: 66, y: 58, r: 2.5, connections: [6, 9, 11], colorType: 'charcoal', speed: 22, offsetRange: 17 },
    { id: 11, x: 84, y: 34, r: 3, connections: [7, 10], colorType: 'neutral', speed: 20, offsetRange: 19 },
    { id: 12, x: 38, y: 88, r: 2, connections: [8, 13], colorType: 'neutral', speed: 24, offsetRange: 16 },
    { id: 13, x: 62, y: 84, r: 3, connections: [9, 12], colorType: 'charcoal', speed: 21, offsetRange: 22 }
  ], []);

  // Context-specific behaviors and tinting
  const contextSettings = useMemo(() => {
    switch (context) {
      case 'predictions':
        return {
          burgundyGlow: 0.045,
          pulseDuration: 6,
          accentLineDash: '4 4',
          nodeOpacity: 0.7,
          meshScale: 1.05,
          themeHint: 'AI Analytical Resonance'
        };
      case 'verification':
        return {
          burgundyGlow: 0.03,
          pulseDuration: 8,
          accentLineDash: '2 6',
          nodeOpacity: 0.65,
          meshScale: 1.01,
          themeHint: 'Cryptographic Ledger Custody'
        };
      case 'graph':
        return {
          burgundyGlow: 0.025,
          pulseDuration: 10,
          accentLineDash: '1 5',
          nodeOpacity: 0.4, // lower opacity so Three.js canvas takes foreground
          meshScale: 1.1,
          themeHint: 'Spatial Topological Field'
        };
      case 'evidence':
        return {
          burgundyGlow: 0.035,
          pulseDuration: 7,
          accentLineDash: '3 3',
          nodeOpacity: 0.65,
          meshScale: 1.02,
          themeHint: 'Forensic Ingestion Stream'
        };
      case 'cases':
        return {
          burgundyGlow: 0.035,
          pulseDuration: 9,
          accentLineDash: '2 4',
          nodeOpacity: 0.65,
          meshScale: 1.02,
          themeHint: 'Case Intelligence Matrix'
        };
      case 'auth':
        return {
          burgundyGlow: 0.025,
          pulseDuration: 12,
          accentLineDash: '1 6',
          nodeOpacity: 0.5,
          meshScale: 0.98,
          themeHint: 'Perimeter Clearance Gateway'
        };
      default: // dashboard & others
        return {
          burgundyGlow: 0.03,
          pulseDuration: 8,
          accentLineDash: '3 5',
          nodeOpacity: 0.6,
          meshScale: 1.0,
          themeHint: 'Investigative Intelligence Overview'
        };
    }
  }, [context]);

  // If user prefers reduced motion, render static elegant vector network
  if (shouldReduceMotion) {
    return (
      <div className={`fixed inset-0 pointer-events-none z-0 overflow-hidden select-none bg-[#F7F5F0] ${className}`}>
        {/* Soft static ambient gradient */}
        <div
          className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full blur-[140px]"
          style={{ background: 'radial-gradient(circle, rgba(110, 24, 39, 0.05) 0%, transparent 70%)' }}
        />
        <div
          className="absolute -bottom-32 -right-32 w-[600px] h-[600px] rounded-full blur-[140px]"
          style={{ background: 'radial-gradient(circle, rgba(18, 17, 16, 0.04) 0%, transparent 70%)' }}
        />

        {/* Static SVG network */}
        <svg className="w-full h-full opacity-40" xmlns="http://www.w3.org/2000/svg">
          {nodes.map(n =>
            n.connections.map(targetId => {
              const target = nodes.find(item => item.id === targetId);
              if (!target || target.id < n.id) return null;
              return (
                <line
                  key={`${n.id}-${target.id}`}
                  x1={`${n.x}%`}
                  y1={`${n.y}%`}
                  x2={`${target.x}%`}
                  y2={`${target.y}%`}
                  stroke={n.colorType === 'burgundy' || target.colorType === 'burgundy' ? '#6E1827' : '#121110'}
                  strokeWidth="0.8"
                  strokeOpacity="0.12"
                />
              );
            })
          )}
          {nodes.map(n => (
            <circle
              key={n.id}
              cx={`${n.x}%`}
              cy={`${n.y}%`}
              r={n.r}
              fill={n.colorType === 'burgundy' ? '#6E1827' : '#121110'}
              fillOpacity={n.colorType === 'burgundy' ? 0.35 : 0.18}
            />
          ))}
        </svg>
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 pointer-events-none z-0 overflow-hidden select-none bg-[#F7F5F0] transition-colors duration-1000 ${className}`}
    >
      {/* ========================================================================= */}
      {/* 1. AMBIENT SOFT GRADIENT MESH (DEPTH LAYER 1)                              */}
      {/* ========================================================================= */}
      <motion.div
        style={{ x: springX, y: springY }}
        className="absolute inset-0 w-full h-full will-change-transform"
      >
        {/* Ambient Top Burgundy Nebula */}
        <motion.div
          animate={{
            scale: [1 * contextSettings.meshScale, 1.15 * contextSettings.meshScale, 1 * contextSettings.meshScale],
            opacity: [contextSettings.burgundyGlow, contextSettings.burgundyGlow * 1.35, contextSettings.burgundyGlow],
            x: [0, 24, 0],
            y: [0, -18, 0]
          }}
          transition={{
            duration: contextSettings.pulseDuration * 3.5,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
          className="absolute -top-40 left-1/4 w-[750px] h-[750px] rounded-full blur-[160px]"
          style={{
            background: 'radial-gradient(circle, rgba(110, 24, 39, 0.85) 0%, rgba(110, 24, 39, 0.25) 50%, transparent 75%)'
          }}
        />

        {/* Ambient Bottom Charcoal/Warm Canvas Glow */}
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.035, 0.065, 0.035],
            x: [0, -20, 0],
            y: [0, 25, 0]
          }}
          transition={{
            duration: contextSettings.pulseDuration * 4.2,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
          className="absolute -bottom-40 right-1/4 w-[850px] h-[850px] rounded-full blur-[180px]"
          style={{
            background: 'radial-gradient(circle, rgba(18, 17, 16, 0.7) 0%, rgba(18, 17, 16, 0.15) 55%, transparent 80%)'
          }}
        />

        {/* Subtle Lateral Ivory Luminescence */}
        <div
          className="absolute top-1/2 -right-40 w-[600px] h-[600px] rounded-full blur-[150px] opacity-40"
          style={{
            background: 'radial-gradient(circle, rgba(240, 236, 228, 0.9) 0%, transparent 70%)'
          }}
        />
      </motion.div>

      {/* ========================================================================= */}
      {/* 2. LIVING VECTOR NETWORK LAYER (DEPTH LAYER 2)                             */}
      {/* ========================================================================= */}
      <motion.svg
        style={{
          x: springX,
          y: scrollParallaxY
        }}
        className="absolute inset-0 w-full h-full will-change-transform"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {/* Subtle grid lines (microscopic archival measurement grid) */}
        <defs>
          <pattern id="archivalGrid" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#121110" strokeWidth="0.04" strokeOpacity="0.04" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#archivalGrid)" />

        {/* Interconnecting dynamic link paths */}
        <g strokeLinecap="round">
          {nodes.map(node =>
            node.connections.map(targetId => {
              const target = nodes.find(n => n.id === targetId);
              if (!target || target.id < node.id) return null;

              const isBurgundyActive =
                node.colorType === 'burgundy' || target.colorType === 'burgundy';

              return (
                <motion.line
                  key={`link-${node.id}-${target.id}`}
                  x1={node.x}
                  y1={node.y}
                  x2={target.x}
                  y2={target.y}
                  stroke={isBurgundyActive ? '#6E1827' : '#121110'}
                  strokeWidth={isBurgundyActive ? '0.18' : '0.12'}
                  strokeDasharray={isBurgundyActive ? contextSettings.accentLineDash : undefined}
                  animate={{
                    strokeOpacity: isBurgundyActive
                      ? [0.06, 0.12, 0.06]
                      : [0.025, 0.06, 0.025]
                  }}
                  transition={{
                    duration: node.speed * 0.5,
                    repeat: Infinity,
                    ease: 'easeInOut'
                  }}
                />
              );
            })
          )}
        </g>

        {/* Slow-moving Network Nodes with Orbital Micro-Displacements */}
        {nodes.map((node) => {
          const isBurgundy = node.colorType === 'burgundy';
          const fill = isBurgundy ? '#6E1827' : '#121110';
          const fillOpacity = isBurgundy
            ? 0.28 * contextSettings.nodeOpacity
            : 0.14 * contextSettings.nodeOpacity;

          return (
            <g key={`node-group-${node.id}`}>
              {/* Outer soft pulse ring on burgundy nodes */}
              {isBurgundy && (
                <motion.circle
                  cx={node.x}
                  cy={node.y}
                  r={node.r * 0.3}
                  fill="none"
                  stroke="#6E1827"
                  strokeWidth="0.08"
                  animate={{
                    scale: [1, 2.2, 1],
                    strokeOpacity: [0.3, 0.0, 0.3]
                  }}
                  transition={{
                    duration: contextSettings.pulseDuration,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: (node.id % 3) * 0.8
                  }}
                  style={{ transformOrigin: `${node.x}% ${node.y}%` }}
                />
              )}

              {/* Main Core Node */}
              <motion.circle
                cx={node.x}
                cy={node.y}
                r={node.r * 0.16}
                fill={fill}
                fillOpacity={fillOpacity}
                animate={{
                  x: [
                    0,
                    Math.cos((node.id * Math.PI) / 3) * (node.offsetRange * 0.06),
                    0
                  ],
                  y: [
                    0,
                    Math.sin((node.id * Math.PI) / 3) * (node.offsetRange * 0.06),
                    0
                  ],
                  scale: [1, 1.25, 1]
                }}
                transition={{
                  duration: node.speed,
                  repeat: Infinity,
                  ease: 'easeInOut'
                }}
              />
            </g>
          );
        })}
      </motion.svg>

      {/* ========================================================================= */}
      {/* 3. SUBTLE CONTEXTUAL SATELLITE PARTICLES (DEPTH LAYER 3)                   */}
      {/* ========================================================================= */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Floating delicate data points */}
        {[
          { top: '15%', left: '8%', delay: 0, duration: 16 },
          { top: '25%', left: '88%', delay: 2, duration: 22 },
          { top: '65%', left: '12%', delay: 1, duration: 19 },
          { top: '78%', left: '82%', delay: 3, duration: 24 },
          { top: '48%', left: '92%', delay: 4, duration: 18 }
        ].map((pt, i) => (
          <motion.div
            key={`particle-${i}`}
            animate={{
              y: [-12, 12, -12],
              x: [-8, 8, -8],
              opacity: [0.15, 0.4, 0.15]
            }}
            transition={{
              duration: pt.duration,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: pt.delay
            }}
            className="absolute w-1 h-1 rounded-full bg-[#6E1827]/40"
            style={{ top: pt.top, left: pt.left }}
          />
        ))}
      </div>

      {/* ========================================================================= */}
      {/* 4. VIGNETTE & CONTRAST SHIELD                                             */}
      {/* Ensures all text, charts, and 3D scenes stay pristine and readable        */}
      {/* ========================================================================= */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 40%, rgba(247, 245, 240, 0.45) 85%, rgba(247, 245, 240, 0.85) 100%)'
        }}
      />
    </div>
  );
};
