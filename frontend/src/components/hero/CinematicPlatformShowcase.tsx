import React, { useState, useRef } from 'react';
import { HeroSection } from './HeroSection';
import { EnclaveAuthModal } from './EnclaveAuthModal';
import { useAuth } from '../../context/AuthContext';
import { NetrixLogo } from '../common/NetrixLogo';
import { LayoutDashboard } from 'lucide-react';
import type { TabType } from '../common/Sidebar';

interface Props {
  onEnterWorkspace?: (initialTab?: TabType) => void;
  onOpenAuthModal?: () => void;
}

export const CinematicPlatformShowcase: React.FC<Props> = ({ onEnterWorkspace, onOpenAuthModal }) => {
  const { isAuthenticated } = useAuth();
  const [internalAuthModalOpen, setInternalAuthModalOpen] = useState<boolean>(false);

  const triggerAuth = () => {
    if (onOpenAuthModal) {
      onOpenAuthModal();
    } else {
      setInternalAuthModalOpen(true);
    }
  };

  const heroRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative min-h-screen w-full bg-[#000000] text-slate-100 flex flex-col selection:bg-[#6D001A]/50 selection:text-white">
      {/* 1. CINEMATIC HERO (FULL VIEWPORT) */}
      <div ref={heroRef} id="hero" className="w-full">
        <HeroSection
          onExploreIntelligence={() => {
            if (isAuthenticated && onEnterWorkspace) {
              onEnterWorkspace('intelligence');
            } else {
              triggerAuth();
            }
          }}
          onViewKnowledgeGraph={() => {
            if (isAuthenticated && onEnterWorkspace) {
              onEnterWorkspace('graph');
            } else {
              triggerAuth();
            }
          }}
          onOpenAuthModal={triggerAuth}
        />
      </div>

      {/* FORENSIC FLOW TRANSITION BANNER */}
      <div className="relative w-full border-y border-white/[0.08] bg-[#050508] py-4 px-6 sm:px-12 z-10 overflow-hidden">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2 text-white font-bold tracking-wider uppercase font-tech">
            <span className="w-2 h-2 rounded-full bg-[#6D001A] animate-ping" />
            <span>CRIMINAL NETWORK INTELLIGENCE PIPELINE</span>
          </div>
          <div className="flex items-center gap-3 sm:gap-4 text-[11px]">
            <span className="text-slate-300">Evidence Ingestion</span>
            <span className="text-[#8B0024]">→</span>
            <span className="text-rose-300">Entity Resolution</span>
            <span className="text-[#8B0024]">→</span>
            <span className="text-rose-400 font-semibold">Link Prediction</span>
            <span className="text-[#8B0024]">→</span>
            <span className="text-slate-200">Graph Analysis</span>
            <span className="text-[#8B0024]">→</span>
            <span className="text-emerald-400">Evidence Integrity</span>
          </div>
          {isAuthenticated && onEnterWorkspace && (
            <button
              onClick={() => onEnterWorkspace('command')}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-[#6D001A] bg-[#6D001A]/30 hover:bg-[#6D001A]/60 text-white text-[11px] font-tech font-bold uppercase transition-all cursor-pointer"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>ENTER WORKSPACE</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. FOOTER */}
      <footer className="w-full border-t border-white/[0.06] bg-[#040407] py-12 px-6 sm:px-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-xs font-mono text-slate-500">
          <div className="flex items-center gap-3">
            <NetrixLogo
              variant="horizontal"
              glow={false}
              className="w-[130px] sm:w-[150px]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-6 text-[11px]">
            <span>NETWORK INTELLIGENCE</span>
            <span>•</span>
            <span>EVIDENCE INTEGRITY</span>
            <span>•</span>
            <span>GRAPH ANALYTICS</span>
            <span>•</span>
            <span>INVESTIGATIVE LEADS</span>
          </div>

          <div>
            <span>© 2026 NETRIX CRIMINAL NETWORK INTELLIGENCE PLATFORM. ALL RIGHTS RESERVED.</span>
          </div>
        </div>
      </footer>

      {/* 3. GLASS AUTH MODAL */}
      <EnclaveAuthModal
        isOpen={internalAuthModalOpen}
        onClose={() => setInternalAuthModalOpen(false)}
        onSuccess={() => {
          if (onEnterWorkspace) {
            onEnterWorkspace('command');
          }
        }}
      />
    </div>
  );
};
