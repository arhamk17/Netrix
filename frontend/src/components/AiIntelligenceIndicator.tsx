import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type AiIntelligenceState = 'IDLE' | 'READY' | 'ANALYZING' | 'PROCESSING' | 'RESULT' | 'OFFLINE';

interface AiIntelligenceIndicatorProps {
  state?: AiIntelligenceState;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
  onClick?: () => void;
  analysisStage?: string;
}

export const AiIntelligenceIndicator: React.FC<AiIntelligenceIndicatorProps> = ({
  state = 'READY',
  size = 'md',
  showLabel = true,
  className = '',
  onClick,
  analysisStage
}) => {
  // Dimensions
  const dimensions = size === 'sm' ? 32 : size === 'lg' ? 64 : 42;
  const strokeWidth = size === 'sm' ? 1.2 : size === 'lg' ? 1.8 : 1.5;

  // Nodes for the internal circular network
  // In IDLE/READY: stable subtle breathing
  // In ANALYZING/PROCESSING: nodes dynamically shift position and connections pulse
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (state === 'ANALYZING' || state === 'PROCESSING') {
      const interval = setInterval(() => {
        setPhase(p => (p + 1) % 4);
      }, 700);
      return () => clearInterval(interval);
    }
  }, [state]);

  const stateColors = {
    IDLE: { stroke: '#6B6760', fill: '#121110', accent: '#6B6760', ring: 'rgba(107, 103, 96, 0.2)' },
    READY: { stroke: '#121110', fill: '#121110', accent: '#6E1827', ring: 'rgba(110, 24, 39, 0.25)' },
    ANALYZING: { stroke: '#6E1827', fill: '#6E1827', accent: '#801B2E', ring: 'rgba(110, 24, 39, 0.45)' },
    PROCESSING: { stroke: '#6E1827', fill: '#6E1827', accent: '#4E101B', ring: 'rgba(110, 24, 39, 0.5)' },
    RESULT: { stroke: '#0F766E', fill: '#0F766E', accent: '#0D9488', ring: 'rgba(13, 148, 136, 0.35)' },
    OFFLINE: { stroke: '#9CA3AF', fill: '#D1D5DB', accent: '#9CA3AF', ring: 'rgba(156, 163, 175, 0.15)' }
  }[state];

  // Dynamic positions of 5 internal network nodes based on state and phase
  const getNodes = () => {
    const r = dimensions * 0.34;
    const center = dimensions / 2;
    const offset = (state === 'ANALYZING' || state === 'PROCESSING') ? (phase * 15 * Math.PI) / 180 : 0;

    return [
      { x: center, y: center, r: size === 'sm' ? 2 : size === 'lg' ? 3.5 : 2.5 },
      { x: center + r * Math.cos(offset), y: center + r * Math.sin(offset), r: size === 'sm' ? 1.5 : size === 'lg' ? 2.5 : 2 },
      { x: center + r * Math.cos(offset + (2 * Math.PI) / 3), y: center + r * Math.sin(offset + (2 * Math.PI) / 3), r: size === 'sm' ? 1.5 : size === 'lg' ? 2.5 : 2 },
      { x: center + r * Math.cos(offset + (4 * Math.PI) / 3), y: center + r * Math.sin(offset + (4 * Math.PI) / 3), r: size === 'sm' ? 1.5 : size === 'lg' ? 2.5 : 2 },
      { x: center + r * 0.6 * Math.cos(offset + Math.PI / 4), y: center + r * 0.6 * Math.sin(offset + Math.PI / 4), r: size === 'sm' ? 1.2 : size === 'lg' ? 2 : 1.5 }
    ];
  };

  const nodes = getNodes();

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full transition-all bg-white/70 backdrop-blur-lg border border-black/10 shadow-sm ${
        onClick ? 'cursor-pointer group hover:bg-white/90' : ''
      } ${className}`}
    >
      <div
        className="relative flex items-center justify-center shrink-0 rounded-full"
        style={{ width: dimensions, height: dimensions }}
      >
        {/* Outer glowing circular pulse during active analysis */}
        <AnimatePresence>
          {(state === 'ANALYZING' || state === 'PROCESSING') && (
            <motion.div
              initial={{ scale: 0.85, opacity: 0.8 }}
              animate={{ scale: [1, 1.35, 1], opacity: [0.6, 0.1, 0.6] }}
              transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                border: `1.5px solid ${stateColors.accent}`,
                background: stateColors.ring
              }}
            />
          )}
        </AnimatePresence>

        {/* Glassmorphic circular enclosure */}
        <div
          className="absolute inset-0 rounded-full transition-all duration-300"
          style={{
            background: 'rgba(255, 255, 255, 0.75)',
            backdropFilter: 'blur(12px)',
            border: `1px solid ${state === 'ANALYZING' ? 'rgba(110, 24, 39, 0.4)' : 'rgba(255, 255, 255, 0.6)'}`,
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.04)'
          }}
        />

        {/* Minimal circular network SVG */}
        <svg
          width={dimensions}
          height={dimensions}
          viewBox={`0 0 ${dimensions} ${dimensions}`}
          className="relative z-10"
        >
          {/* Outer ring */}
          <circle
            cx={dimensions / 2}
            cy={dimensions / 2}
            r={dimensions / 2 - 2}
            fill="none"
            stroke={stateColors.stroke}
            strokeWidth={strokeWidth * 0.75}
            strokeDasharray={state === 'ANALYZING' ? '3 3' : undefined}
            className={state === 'ANALYZING' ? 'animate-[spin_8s_linear_infinite]' : ''}
            style={{ transformOrigin: 'center' }}
            opacity={0.35}
          />

          {/* Internal network links */}
          <g stroke={stateColors.accent} strokeWidth={strokeWidth * 0.6} opacity={0.65}>
            <line x1={nodes[0].x} y1={nodes[0].y} x2={nodes[1].x} y2={nodes[1].y} />
            <line x1={nodes[0].x} y1={nodes[0].y} x2={nodes[2].x} y2={nodes[2].y} />
            <line x1={nodes[0].x} y1={nodes[0].y} x2={nodes[3].x} y2={nodes[3].y} />
            <line x1={nodes[1].x} y1={nodes[1].y} x2={nodes[4].x} y2={nodes[4].y} />
            <line x1={nodes[2].x} y1={nodes[2].y} x2={nodes[3].x} y2={nodes[3].y} strokeDasharray="1.5 1.5" />
          </g>

          {/* Internal network nodes */}
          {nodes.map((node, i) => (
            <motion.circle
              key={i}
              cx={node.x}
              cy={node.y}
              r={node.r}
              fill={i === 0 ? stateColors.stroke : stateColors.accent}
              animate={{
                scale: (state === 'ANALYZING' || state === 'PROCESSING') && i === phase ? [1, 1.4, 1] : 1
              }}
              transition={{ duration: 0.4 }}
            />
          ))}
        </svg>
      </div>

      {/* Label & Stage State */}
      {showLabel && (
        <div className="flex flex-col text-left font-mono">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] tracking-wider text-[#6B6760] uppercase">
              LOCAL GNN ENGINE
            </span>
            <span
              className={`text-[9px] font-bold tracking-widest px-1.5 py-0.2 rounded-full border uppercase ${
                state === 'ANALYZING' || state === 'PROCESSING'
                  ? 'text-[#6E1827] bg-[#FAF1F2] border-[#6E1827]/30'
                  : state === 'RESULT'
                  ? 'text-emerald-800 bg-emerald-50 border-emerald-200'
                  : 'text-[#121110] bg-white border-[#E2DDD5]'
              }`}
            >
              {state}
            </span>
          </div>
          {analysisStage ? (
            <span className="text-[11px] font-sans font-medium text-[#6E1827] tracking-tight animate-pulse">
              {analysisStage}
            </span>
          ) : (
            <span className="text-[11px] font-sans text-[#121110]">
              {state === 'ANALYZING'
                ? 'Resolving hidden topology...'
                : state === 'READY'
                ? 'Heterogeneous Graph Ready'
                : state === 'RESULT'
                ? 'Pattern Linked'
                : 'Standby'}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
