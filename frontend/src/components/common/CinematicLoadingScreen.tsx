import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { NetrixLogo } from './NetrixLogo';
import { Shield, Cpu, Fingerprint } from 'lucide-react';

interface LoadingScreenProps {
  onComplete?: () => void;
  duration?: number; // duration in ms, default ~2800ms
}

const BOOT_STAGES = [
  { progress: 18, label: 'INITIALIZING CRIMINAL INTELLIGENCE CORE...', sub: 'INTELLIGENCE ENGINE' },
  { progress: 42, label: 'SYNCHRONIZING EVIDENCE INTEGRITY LEDGER...', sub: 'EVIDENCE ATTESTATION' },
  { progress: 74, label: 'MAPPING 3D INVESTIGATION KNOWLEDGE GRAPH...', sub: 'NETWORK INTELLIGENCE' },
  { progress: 95, label: 'INITIALIZING LINK PREDICTION & RISK MODELS...', sub: 'ANALYTICAL INTEGRITY CHECK' },
  { progress: 100, label: 'SYSTEM READY. INVESTIGATIVE ACCESS GRANTED.', sub: 'INITIALIZATION COMPLETE' }
];

export const CinematicLoadingScreen: React.FC<LoadingScreenProps> = ({
  onComplete,
  duration = 2800
}) => {
  const [progress, setProgress] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);
  const [isFinishing, setIsFinishing] = useState(false);

  useEffect(() => {
    const startTime = performance.now();

    const interval = setInterval(() => {
      const elapsed = performance.now() - startTime;
      const pct = Math.min(100, Math.floor((elapsed / duration) * 100));
      setProgress(pct);

      if (pct < 25) setStageIndex(0);
      else if (pct < 55) setStageIndex(1);
      else if (pct < 85) setStageIndex(2);
      else if (pct < 98) setStageIndex(3);
      else setStageIndex(4);

      if (pct >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          setIsFinishing(true);
          setTimeout(() => {
            onComplete?.();
          }, 600);
        }, 300);
      }
    }, 25);

    return () => clearInterval(interval);
  }, [duration, onComplete]);

  const handleSkip = () => {
    setIsFinishing(true);
    setTimeout(() => {
      onComplete?.();
    }, 300);
  };

  const currentStage = BOOT_STAGES[stageIndex];

  return (
    <AnimatePresence>
      {!isFinishing && (
        <motion.div
          key="cinematic-loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.02, filter: 'blur(8px)' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#000000] text-slate-100 select-none overflow-hidden"
        >
          {/* 1. Subtle Background Grids & Orbital Lines */}
          <div className="absolute inset-0 pointer-events-none opacity-25">
            {/* Fine forensic dot grid */}
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(185, 28, 28, 0.15) 1px, transparent 0)',
                backgroundSize: '40px 40px'
              }}
            />
            {/* Subtle concentric orbital rings */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full border border-red-950/20 pointer-events-none" />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] rounded-full border border-red-950/10 border-dashed pointer-events-none" />
          </div>

          {/* 2. Central Subtle Crimson Atmospheric Backlight */}
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] sm:w-[540px] h-[380px] sm:h-[540px] rounded-full bg-red-950/[0.15] blur-[120px] pointer-events-none"
          />

          {/* 3. Top Security Metadata Header */}
          <div className="absolute top-6 left-6 right-6 flex items-center justify-between text-[10px] font-mono text-slate-400">
            <div className="flex items-center gap-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.8)] animate-pulse" />
              <span className="tracking-widest">NETRIX PLATFORM // BUILD 4.8.2</span>
            </div>
            <div className="hidden sm:flex items-center gap-4 text-slate-400">
              <span>LATENCY: 4ms</span>
              <span>CIPHER: AES-256-GCM</span>
              <span>INTEGRITY: 100%</span>
            </div>
          </div>

          {/* 4. EXACT CENTERED NETRIX LOGO */}
          <div className="relative z-10 flex flex-col items-center justify-center px-4">
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              className="relative flex items-center justify-center w-[280px] sm:w-[360px] md:w-[440px] lg:w-[480px] max-w-[90vw]"
            >
              <NetrixLogo
                variant="full"
                glow={true}
                animated={true}
                className="w-full drop-shadow-[0_20px_40px_rgba(0,0,0,0.8)]"
              />
            </motion.div>

            {/* 5. Minimalist Cyber Loading Indicator */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="mt-6 sm:mt-8 w-[280px] sm:w-[360px] md:w-[420px] max-w-[85vw] flex flex-col items-center"
            >
              {/* Status Text */}
              <div className="w-full flex items-center justify-between text-[11px] font-mono tracking-[0.18em] text-slate-300 uppercase mb-2.5">
                <span className="truncate flex items-center gap-1.5 text-rose-300">
                  <span className="inline-block w-1 h-3 bg-red-500 animate-pulse" />
                  {currentStage.label}
                </span>
                <span className="font-bold text-rose-400 ml-2">{progress}%</span>
              </div>

              {/* Thin Animated Crimson Progress Line */}
              <div className="relative w-full h-[2px] bg-slate-900 rounded-full overflow-hidden border border-white/[0.08]">
                <motion.div
                  className="h-full bg-gradient-to-r from-[#6D001A] via-[#B91C1C] to-white shadow-[0_0_12px_rgba(220,38,38,0.6)]"
                  style={{ width: `${progress}%` }}
                  transition={{ ease: 'linear' }}
                />
              </div>

              {/* Sub-status & Milestones */}
              <div className="w-full flex items-center justify-between text-[9px] font-mono text-slate-400 mt-2">
                <span>{currentStage.sub}</span>
                <span>BOOT SEQUENCE {progress < 100 ? 'ACTIVE' : 'COMPLETE'}</span>
              </div>
            </motion.div>
          </div>

          {/* 6. Bottom Enclave Verification Footer / Skip Button */}
          <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">VERIFIED EVIDENCE LEDGER ACTIVE</span>
            </div>

            <button
              onClick={handleSkip}
              className="text-[10px] font-mono text-slate-400 hover:text-rose-300 px-3 py-1 rounded border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              ENTER CONSOLE [ESC]
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
