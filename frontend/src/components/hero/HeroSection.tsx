import React, { useState, useEffect } from 'react';
import {
  ArrowRight,
  Share2,
  Lock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { HeroVisualSphere } from './HeroVisualSphere';
import { useAuth } from '../../context/AuthContext';

interface Props {
  onExploreIntelligence: () => void;
  onViewKnowledgeGraph: () => void;
  onOpenAuthModal: () => void;
}

export const HeroSection: React.FC<Props> = ({
  onExploreIntelligence,
  onViewKnowledgeGraph,
  onOpenAuthModal
}) => {
  const { isAuthenticated } = useAuth();
  const [wordIndex, setWordIndex] = useState<number>(0);
  const words = ['CONNECTIONS', 'LINKS', 'RELATIONSHIPS', 'LEADS', 'PATTERNS', 'ANOMALIES', 'EVIDENCE'];

  // Dynamic alternate headline animation
  useEffect(() => {
    const interval = setInterval(() => {
      setWordIndex(prev => (prev + 1) % words.length);
    }, 3200);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative w-full min-h-screen flex flex-col justify-center items-center pt-24 pb-16 px-4 sm:px-6 lg:px-12 bg-[#050507] overflow-hidden select-none">
      {/* 1. ATMOSPHERIC BACKGROUND LAYERS */}
      {/* Radial Vignette & Technical Forensic Grid */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_40%,rgba(230,0,60,0.12),transparent_65%)] pointer-events-none z-0" />
      <div className="absolute inset-0 bg-[radial-gradient(#ffffff_0.6px,transparent_0.6px)] [background-size:36px_36px] opacity-[0.035] pointer-events-none z-0" />
      
      {/* Top subtle scanline accent */}
      <div className="absolute top-16 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#E6003C]/40 to-transparent pointer-events-none" />

      {/* 2. 3D CRIMSON INTELLIGENCE SPHERE ENGINE */}
      <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none overflow-hidden">
        <HeroVisualSphere interactive={true} />
      </div>

      {/* 3. MAIN HERO COMPOSITION (CENTERED) */}
      <div className="relative z-10 w-full max-w-4xl mx-auto flex flex-col items-center text-center my-auto py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-7 flex flex-col items-center text-center"
        >
          {/* Eyebrow badge (No blinking light) */}
          <div className="inline-flex items-center px-4 py-1.5 rounded-full border border-[#E6003C]/30 bg-[#E6003C]/10 backdrop-blur-md">
            <span className="text-[10px] sm:text-[11px] font-semibold tracking-[0.25em] text-[#FF4D79] uppercase">
              ADVANCED CRIMINAL NETWORK INTELLIGENCE
            </span>
          </div>

          {/* Main Headline */}
          <div className="space-y-2">
            <h1 className="text-4xl sm:text-6xl lg:text-7xl xl:text-8xl font-black tracking-tight text-white leading-[1.05] uppercase">
              SEE THE <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-400">
                HIDDEN
              </span>{' '}
              <br />
              <span className="relative inline-block min-h-[1.1em] text-[#800020] drop-shadow-[0_0_25px_rgba(128,0,32,0.6)]">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={words[wordIndex]}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.45, ease: 'easeInOut' }}
                    className="inline-block"
                  >
                    {words[wordIndex]}.
                  </motion.span>
                </AnimatePresence>
                <span className="absolute bottom-1 left-0 right-0 h-[3px] bg-gradient-to-r from-[#800020] to-transparent rounded-full opacity-80" />
              </span>
            </h1>
          </div>

          {/* Supporting Technical Text */}
          <p className="text-sm sm:text-base lg:text-lg text-slate-300/90 max-w-2xl leading-relaxed font-light">
            Connect evidence, entities, events and relationships to uncover hidden patterns across complex investigations.
          </p>

          {/* Forensic Pipeline Pill Indicator */}
          <div className="p-3 rounded-xl border border-white/[0.08] bg-[#090C14]/70 backdrop-blur-md max-w-lg w-full">
            <div className="flex items-center justify-between text-[10px] sm:text-xs tracking-wider text-slate-400">
              <span className="text-slate-300">EVIDENCE</span>
              <span className="text-[#E6003C]">→</span>
              <span className="text-slate-300">ENTITIES</span>
              <span className="text-[#E6003C]">→</span>
              <span className="text-[#FF4D79] font-bold">PREDICTIONS</span>
              <span className="text-[#E6003C]">→</span>
              <span className="text-rose-400">NETWORK GRAPH</span>
              <span className="text-[#E6003C]">→</span>
              <span className="text-emerald-400">INTEGRITY</span>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <button
              onClick={onExploreIntelligence}
              className="px-7 py-3.5 rounded-xl border border-[#E6003C] bg-gradient-to-r from-[#E6003C] to-[#B3002E] hover:from-[#FF1A53] hover:to-[#CC0035] text-white font-bold text-xs uppercase tracking-[0.16em] transition-all shadow-[0_0_30px_rgba(230,0,60,0.45)] hover:shadow-[0_0_40px_rgba(230,0,60,0.7)] active:scale-[0.98] flex items-center gap-2.5 cursor-pointer"
            >
              <span>EXPLORE INTELLIGENCE</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={onViewKnowledgeGraph}
              className="px-6 py-3.5 rounded-xl border border-white/[0.14] bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/[0.25] text-slate-200 font-bold text-xs uppercase tracking-[0.16em] transition-all backdrop-blur-md active:scale-[0.98] flex items-center gap-2 cursor-pointer"
            >
              <Share2 className="w-4 h-4 text-slate-300" />
              <span>VIEW KNOWLEDGE GRAPH</span>
            </button>

            {!isAuthenticated && (
              <button
                onClick={onOpenAuthModal}
                className="px-5 py-3.5 rounded-xl border border-dashed border-white/[0.16] hover:border-[#E6003C]/60 text-slate-400 hover:text-white text-[11px] uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5 text-[#E6003C]" />
                <span>INVESTIGATOR LOGIN</span>
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

