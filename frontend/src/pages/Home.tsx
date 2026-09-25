import React, { useState, useEffect, lazy, Suspense } from 'react';
import { motion, AnimatePresence, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { ArrowRight, Network, Eye, ShieldCheck } from 'lucide-react';
import { NetrixLogo } from '../components/common/NetrixLogo';

const CinematicNetwork3D = lazy(() =>
  import('../components/Home/CinematicNetwork3D').then((m) => ({ default: m.CinematicNetwork3D }))
);

interface HomeProps {
  onEnterPlatform: () => void;
}

const FLICKER_WORDS = [
  "doesn't.",
  "conceals.",
  "hides.",
  "obscures.",
  "misses.",
  "bypasses."
];

export const Home: React.FC<HomeProps> = ({ onEnterPlatform }) => {
  const [highlightHidden, setHighlightHidden] = useState(false);
  const [wordIndex, setWordIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setWordIndex(prev => (prev + 1) % FLICKER_WORDS.length);
    }, 2600);
    return () => clearInterval(interval);
  }, []);

  const prefersReducedMotion = useReducedMotion();
  const { scrollY } = useScroll();
  const heroTextY = useTransform(scrollY, [0, 500], [0, prefersReducedMotion ? 0 : 20]);

  return (
    <div className="min-h-screen bg-[#F7F5F0] text-[#121110] flex flex-col justify-between selection:bg-[#6E1827] selection:text-white">
      {/* 3-Zone Top Navigation Bar */}
      <header className="fixed top-0 left-0 right-0 z-50 h-20 px-6 sm:px-12 flex items-center justify-between border-b border-[#E2DDD5] bg-[#F7F5F0]/90 backdrop-blur-md">
        {/* Zone 1: Authentic NETRIX Logo & Brand Typography */}
        <div className="flex items-center gap-3">
          <NetrixLogo size="md" variant="horizontal" glow={true} showSubtext={true} />
        </div>

        {/* Zone 2: Clean navigation links */}
        <nav className="hidden md:flex items-center gap-8 text-xs font-sans font-medium text-[#6B6760]">
          <a href="#network" className="hover:text-[#121110] transition-colors">
            Network Synthesis
          </a>
          <a href="#leads" className="hover:text-[#121110] transition-colors">
            Hidden Connections
          </a>
          <a href="#integrity" className="hover:text-[#121110] transition-colors">
            Evidence Integrity
          </a>
        </nav>

        {/* Zone 3: Primary Action */}
        <div className="flex items-center gap-4">
          <button
            onClick={onEnterPlatform}
            className="px-5 py-2.5 bg-[#121110] text-white text-xs font-mono font-medium rounded-[2px] hover:bg-[#262524] transition-colors flex items-center gap-2 group focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#6E1827]"
          >
            <span>Enter NETRIX</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#F7F5F0] group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </header>

      {/* Hero Viewport: Full-screen 3D Motion Experience */}
      <main className="relative w-full h-[90vh] min-h-[640px] pt-20 flex flex-col justify-center overflow-hidden">
        {/* Cinematic 3D Network Canvas Background */}
        <div className="absolute inset-0 w-full h-full">
          <Suspense fallback={<div className="w-full h-full bg-[#F7F5F0]" />}>
            <CinematicNetwork3D
              onExploreClick={onEnterPlatform}
              onEnterClick={onEnterPlatform}
            />
          </Suspense>
        </div>

        {/* Hero Editorial Text Overlay */}
        <motion.div style={{ y: heroTextY }} className="relative z-10 max-w-4xl mx-auto px-6 text-center pointer-events-none space-y-6">
          {/* Highlighted NETRIX Brand Emblem */}
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white/90 backdrop-blur-md border border-[#6E1827]/25 shadow-xs pointer-events-auto">
            <div className="w-5 h-5 rounded-xs overflow-hidden shadow-xs shrink-0">
              <img src="/LOGONETRIX.png" alt="NETRIX Emblem" className="w-full h-full object-contain" />
            </div>
            <span className="text-[10px] font-mono tracking-widest text-[#6E1827] uppercase font-bold">
              CRIMINAL NETWORK INTELLIGENCE PLATFORM
            </span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-serif font-normal tracking-tight text-[#121110] leading-[1.08] [text-wrap:balance]">
            See what the data{' '}
            <AnimatePresence mode="wait">
              <motion.span
                key={FLICKER_WORDS[wordIndex]}
                initial={{ opacity: 0, filter: 'blur(4px)', y: 3 }}
                animate={{
                  opacity: [0, 0.3, 0.15, 0.9, 0.4, 1],
                  filter: ['blur(4px)', 'blur(1px)', 'blur(0px)'],
                  y: 0
                }}
                exit={{
                  opacity: [1, 0.3, 0],
                  filter: ['blur(0px)', 'blur(3px)'],
                  y: -3
                }}
                transition={{ duration: 0.4, ease: 'easeInOut' }}
                className="inline-block font-serif italic font-normal text-[#6E1827]"
              >
                {FLICKER_WORDS[wordIndex]}
              </motion.span>
            </AnimatePresence>
          </h1>

          <p className="max-w-xl mx-auto text-sm sm:text-base text-[#6B6760] font-sans leading-relaxed [text-wrap:balance]">
            NETRIX analyzes multi-hop evidence and relational networks to uncover hidden connections, financial bypass pathways, and investigative leads.
          </p>

          {/* Call to Actions */}
          <div className="pt-4 flex flex-wrap items-center justify-center gap-4 pointer-events-auto">
            <button
              onClick={onEnterPlatform}
              className="px-6 py-3.5 bg-[#121110] text-white text-xs font-mono font-medium rounded-[2px] hover:bg-[#262524] transition-colors flex items-center gap-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#6E1827]"
            >
              <span>Enter NETRIX</span>
              <ArrowRight className="w-4 h-4 text-white" />
            </button>

            <button
              onClick={() => {
                setHighlightHidden(prev => !prev);
                onEnterPlatform();
              }}
              className="px-6 py-3.5 bg-white/90 backdrop-blur-md text-[#121110] border border-[#E2DDD5] text-xs font-mono font-medium rounded-[2px] hover:bg-white hover:border-[#6E1827] transition-colors flex items-center gap-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#6E1827]"
            >
              <Network className="w-4 h-4 text-[#6E1827]" />
              <span>Explore Network</span>
            </button>
          </div>
        </motion.div>
      </main>

      {/* Editorial Footer */}
      <footer className="relative z-20 w-full border-t border-[#E6E1D8] bg-[#F8F7F4] py-8 px-6 sm:px-12 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#6B6760] font-mono">
        <div className="flex items-center gap-3">
          <NetrixLogo size="xs" variant="horizontal" glow={false} showSubtext={false} />
          <span>·</span>
          <span>Criminal Network Intelligence</span>
        </div>
        <div className="flex items-center gap-6">
          <span>Local ML Model Online</span>
          <span>·</span>
          <span>SHA-256 Verified</span>
        </div>
      </footer>
    </div>
  );
};
