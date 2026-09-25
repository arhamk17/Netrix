import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { AnimatedBackground } from './AnimatedBackground';

interface SystemInitializerProps {
  onComplete: () => void;
  targetDestinationName?: string;
}

const INITIALIZATION_STAGES = [
  { label: 'INITIALIZING NETRIX', percent: 12 },
  { label: 'VERIFYING SESSION', percent: 28 },
  { label: 'LOADING CASE CONTEXT', percent: 48 },
  { label: 'CONNECTING KNOWLEDGE GRAPH', percent: 68 },
  { label: 'LOADING INTELLIGENCE MODELS', percent: 84 },
  { label: 'VERIFYING SYSTEM INTEGRITY', percent: 96 },
  { label: 'READY', percent: 100 }
];

export const SystemInitializer: React.FC<SystemInitializerProps> = ({
  onComplete,
  targetDestinationName = 'PLATFORM WORKSPACE'
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [currentStageIdx, setCurrentStageIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion) {
      setProgress(100);
      setCurrentStageIdx(INITIALIZATION_STAGES.length - 1);
      setIsDone(true);
      const timer = setTimeout(() => {
        onComplete();
      }, 300);
      return () => clearTimeout(timer);
    }

    let stageIdx = 0;
    const interval = setInterval(() => {
      stageIdx++;
      if (stageIdx < INITIALIZATION_STAGES.length) {
        setCurrentStageIdx(stageIdx);
        setProgress(INITIALIZATION_STAGES[stageIdx].percent);

        if (INITIALIZATION_STAGES[stageIdx].label === 'READY') {
          setIsDone(true);
          clearInterval(interval);
          setTimeout(() => {
            onComplete();
          }, 120);
        }
      } else {
        clearInterval(interval);
      }
    }, 45);

    return () => clearInterval(interval);
  }, [onComplete, prefersReducedMotion]);

  const currentStage = INITIALIZATION_STAGES[currentStageIdx];

  // SVG Circular Progress calculation
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.99, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#F8F7F4] text-[#121110] select-none overflow-hidden"
    >
      {/* Background Living Ambient Motion */}
      <AnimatedBackground context="auth" className="opacity-40" />

      {/* Center Branding & Progress Core */}
      <div className="relative z-10 max-w-sm w-full mx-auto px-6 text-center space-y-8">
        
        {/* Monogram Icon & Brand Title */}
        <div className="flex flex-col items-center space-y-4">
          <motion.div
            initial={{ scale: 0.75, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="relative"
          >
            {/* Ambient soft glow ring */}
            <div className="absolute -inset-3 bg-[#6E1827]/15 rounded-3xl blur-xl animate-pulse" />

            <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-white/95 border border-[#6E1827]/30 shadow-lg ring-1 ring-[#6E1827]/20 flex items-center justify-center p-1.5">
              <img
                src="/LOGONETRIX.png"
                alt="NETRIX"
                className="w-full h-full object-contain filter contrast-[1.03]"
              />
            </div>
          </motion.div>

          <div className="space-y-1">
            <h1 className="text-2xl font-light tracking-[0.25em] text-[#121110] font-sans">
              NETRIX
            </h1>
            <p className="text-[10px] font-mono tracking-widest text-[#6E1827] uppercase font-bold">
              Criminal Network Intelligence
            </p>
          </div>
        </div>

        {/* Circular Intelligence Progress Indicator */}
        <div className="relative flex items-center justify-center py-2">
          <svg className="w-16 h-16 transform -rotate-90">
            {/* Track Ring */}
            <circle
              cx="32"
              cy="32"
              r={radius}
              stroke="#E6E1D8"
              strokeWidth="2.5"
              fill="transparent"
            />
            {/* Animated Progress Ring */}
            <motion.circle
              cx="32"
              cy="32"
              r={radius}
              stroke={isDone ? '#6E1827' : '#121110'}
              strokeWidth="2.5"
              strokeDasharray={circumference}
              animate={{ strokeDashoffset }}
              transition={{ duration: 0.35, ease: 'easeInOut' }}
              strokeLinecap="round"
              fill="transparent"
            />
          </svg>

          {/* Center Percent Counter */}
          <div className="absolute font-mono text-[11px] font-bold text-[#121110] tabular-nums">
            {progress}%
          </div>
        </div>

        {/* Animated Initialization Stage Label */}
        <div className="min-h-[3rem] flex flex-col items-center justify-center space-y-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStage.label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className={`text-xs font-mono font-bold tracking-widest uppercase ${
                currentStage.label === 'READY' ? 'text-[#6E1827]' : 'text-[#121110]'
              }`}
            >
              {currentStage.label}
            </motion.div>
          </AnimatePresence>

          <p className="text-[10px] font-mono text-[#6B6760]">
            Target Context: {targetDestinationName.toUpperCase()}
          </p>
        </div>

        {/* Elegant Subtle Horizontal Progress Line */}
        <div className="w-full bg-[#E6E1D8] h-0.5 rounded-full overflow-hidden relative">
          <motion.div
            className={`h-full ${isDone ? 'bg-[#6E1827]' : 'bg-[#121110]'}`}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.35, ease: 'easeInOut' }}
          />
        </div>
      </div>

      {/* Footer System Status Seal */}
      <div className="absolute bottom-8 text-[10px] font-mono text-[#6B6760] tracking-wider uppercase flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
        <span>Local Model Core Online · SHA-256 Ledger Locked</span>
      </div>
    </motion.div>
  );
};

export default SystemInitializer;
