import React, { useState, useEffect } from 'react';
import {
  ArrowRight,
  ShieldAlert,
  Share2,
  Cpu,
  BrainCircuit,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  Zap,
  Lock,
  Layers,
  Fingerprint,
  Radio,
  ExternalLink,
  ChevronDown,
  Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { HeroVisualSphere } from './HeroVisualSphere';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';

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
  const { isAuthenticated, user, setAiConsoleOpen } = useAuth();
  const [wordIndex, setWordIndex] = useState<number>(0);
  const words = ['CONNECTIONS', 'LINKS', 'RELATIONSHIPS', 'LEADS', 'PATTERNS', 'ANOMALIES', 'EVIDENCE'];
  const [stats, setStats] = useState({
    evidence: 0,
    entities: 0,
    relationships: 0,
    anomalies: 0,
    predictedLinks: 0,
    blockchainStatus: 'ONLINE'
  });

  // Dynamic alternate headline animation
  useEffect(() => {
    const interval = setInterval(() => {
      setWordIndex(prev => (prev + 1) % words.length);
    }, 3200);
    return () => clearInterval(interval);
  }, []);

  // Fetch real backend metrics if available
  useEffect(() => {
    let isMounted = true;
    const token = localStorage.getItem('netrix_access_token');
    if (!token) return;

    api.getCases()
      .then(cases => {
        if (isMounted && cases && cases.length > 0) {
          let totalEv = 0;
          let totalEnt = 0;
          let totalRel = 0;
          let totalAnom = 0;
          cases.forEach(c => {
            totalEv += (c.evidence_count || 0);
            totalEnt += (c.entity_count || 0);
            totalRel += (c.relationship_count || 0);
            totalAnom += (c.anomaly_count || 0);
          });
          setStats({
            evidence: totalEv,
            entities: totalEnt,
            relationships: totalRel,
            anomalies: totalAnom,
            predictedLinks: 0,
            blockchainStatus: 'ONLINE'
          });
        }
      })
      .catch(() => {
        // Safe empty fallback
      });
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section className="relative w-full min-h-screen flex flex-col justify-between pt-20 pb-8 px-4 sm:px-6 lg:px-12 bg-[#050507] overflow-hidden select-none">
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

      {/* 3. MAIN HERO COMPOSITION (LEFT, CENTER OVERLAY, RIGHT) */}
      <div className="relative z-10 w-full max-w-7xl mx-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-6 items-center my-auto py-8">
        
        {/* ============================================================ */}
        {/* LEFT COLUMN: Main NETRIX Messaging                           */}
        {/* ============================================================ */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="lg:col-span-5 space-y-6 text-left"
        >
          {/* Eyebrow badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#E6003C]/30 bg-[#E6003C]/10 backdrop-blur-md">
            <span className="w-1.5 h-1.5 rounded-full bg-[#E6003C] animate-ping" />
            <span className="font-mono text-[10px] sm:text-[11px] font-semibold tracking-[0.25em] text-[#FF4D79] uppercase">
              ADVANCED CRIMINAL NETWORK INTELLIGENCE
            </span>
          </div>

          {/* Main Headline */}
          <div className="space-y-1">
            <h1 className="font-tech text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black tracking-tight text-white leading-[1.04] uppercase">
              SEE THE <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-400">
                HIDDEN
              </span>{' '}
              <br />
              <span className="relative inline-block min-h-[1.1em] text-transparent bg-clip-text bg-gradient-to-r from-[#FF2A5F] via-[#E6003C] to-[#FF5E85] drop-shadow-[0_0_35px_rgba(230,0,60,0.65)]">
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
                <span className="absolute bottom-1 left-0 right-0 h-[3px] bg-gradient-to-r from-[#E6003C] to-transparent rounded-full opacity-70" />
              </span>
            </h1>
          </div>

          {/* Supporting Technical Text */}
          <p className="font-sans text-sm sm:text-base text-slate-300/90 max-w-lg leading-relaxed font-light">
            Connect evidence, entities, events and relationships to uncover hidden patterns across complex investigations.
          </p>

          {/* Forensic Pipeline Pill Indicator */}
          <div className="p-2.5 rounded-xl border border-white/[0.08] bg-[#090C14]/70 backdrop-blur-md max-w-md">
            <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-mono tracking-wider text-slate-400">
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
          <div className="flex flex-wrap items-center gap-3.5 pt-2">
            <button
              onClick={onExploreIntelligence}
              className="px-6 py-3.5 rounded-xl border border-[#E6003C] bg-gradient-to-r from-[#E6003C] to-[#B3002E] hover:from-[#FF1A53] hover:to-[#CC0035] text-white font-tech font-bold text-xs uppercase tracking-[0.16em] transition-all shadow-[0_0_30px_rgba(230,0,60,0.45)] hover:shadow-[0_0_40px_rgba(230,0,60,0.7)] active:scale-[0.98] flex items-center gap-2.5 cursor-pointer"
            >
              <span>EXPLORE INTELLIGENCE</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={onViewKnowledgeGraph}
              className="px-5 py-3.5 rounded-xl border border-white/[0.14] bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/[0.25] text-slate-200 font-tech font-bold text-xs uppercase tracking-[0.16em] transition-all backdrop-blur-md active:scale-[0.98] flex items-center gap-2 cursor-pointer"
            >
              <Share2 className="w-4 h-4 text-slate-300" />
              <span>VIEW KNOWLEDGE GRAPH</span>
            </button>

            {!isAuthenticated && (
              <button
                onClick={onOpenAuthModal}
                className="px-4 py-3.5 rounded-xl border border-dashed border-white/[0.16] hover:border-[#E6003C]/60 text-slate-400 hover:text-white font-mono text-[11px] uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5 text-[#E6003C]" />
                <span>INVESTIGATOR LOGIN</span>
              </button>
            )}
          </div>
        </motion.div>

        {/* ============================================================ */}
        {/* CENTER COLUMN: Floating Glass Prediction Indicators         */}
        {/* ============================================================ */}
        <div className="lg:col-span-3 hidden lg:flex flex-col items-center justify-center space-y-4 pointer-events-none">
          {/* Top Indicator: Model Inference Badge */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="p-3 rounded-xl border border-[#E6003C]/40 bg-[#090B10]/85 backdrop-blur-xl shadow-[0_0_25px_rgba(230,0,60,0.25)] text-center w-52"
          >
            <div className="flex items-center justify-center gap-1.5 text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1">
              <BrainCircuit className="w-3.5 h-3.5 text-[#FF2A5F] animate-pulse" />
              <span>INTELLIGENCE ENGINE</span>
            </div>
            <div className="font-tech text-xs text-slate-200 font-semibold tracking-wide">
              GRAPH LINK PREDICTION
            </div>
          </motion.div>

          {/* Mid Indicator Cluster: Anomaly & Link Prediction */}
          <div className="flex items-center gap-3 w-full justify-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.35 }}
              className="p-2.5 rounded-xl border border-rose-500/30 bg-[#0E060A]/85 backdrop-blur-xl shadow-[0_0_20px_rgba(230,0,60,0.2)] text-left min-w-[100px]"
            >
              <span className="text-[9px] font-mono text-slate-400 uppercase block">ANOMALY</span>
              <span className="font-tech text-lg font-bold text-[#FF2A5F]">0.94</span>
              <span className="text-[8px] font-mono text-rose-400 block mt-0.5">CRITICAL SPIKE</span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.45 }}
              className="p-2.5 rounded-xl border border-red-900/40 bg-[#12080D]/85 backdrop-blur-xl shadow-[0_0_20px_rgba(185,28,28,0.2)] text-left min-w-[100px]"
            >
              <span className="text-[9px] font-mono text-slate-400 uppercase block">LINK PREDICTION</span>
              <span className="font-tech text-lg font-bold text-rose-300">0.87</span>
              <span className="text-[8px] font-mono text-rose-400 block mt-0.5">HIGH PROBABILITY</span>
            </motion.div>
          </div>

          {/* Bottom Indicator: IPS & Confidence */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.55 }}
            className="p-3 rounded-xl border border-white/[0.08] bg-[#090B10]/85 backdrop-blur-xl flex items-center justify-between gap-4 w-52"
          >
            <div>
              <span className="text-[9px] font-mono text-slate-400 uppercase block">IPS SCORE</span>
              <span className="font-tech text-sm font-bold text-slate-100">0.91 / 1.0</span>
            </div>
            <div className="text-right">
              <span className="text-[9px] font-mono text-slate-400 uppercase block">CONFIDENCE</span>
              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400 font-bold">
                <CheckCircle2 className="w-3 h-3" />
                HIGH
              </span>
            </div>
          </motion.div>
        </div>

        {/* ============================================================ */}
        {/* RIGHT COLUMN: Forensic Predictive Signal Panel               */}
        {/* ============================================================ */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="lg:col-span-4"
        >
          {/* Glass Intelligence Signal Box */}
          <div className="relative rounded-2xl p-5 sm:p-6 border border-[#E6003C]/35 bg-[#09080D]/85 backdrop-blur-2xl shadow-[0_20px_70px_rgba(0,0,0,0.8)] overflow-hidden space-y-4">
            {/* Top Glowing Beam */}
            <div className="absolute top-0 left-10 right-10 h-[1.5px] bg-gradient-to-r from-transparent via-[#E6003C] to-transparent shadow-[0_0_12px_#E6003C]" />

            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#E6003C] animate-ping" />
                <span className="font-tech text-xs font-bold tracking-[0.2em] text-slate-100 uppercase">
                  PREDICTIVE SIGNAL
                </span>
              </div>
              <span className="text-[9px] font-mono tracking-widest text-[#FF4D79] bg-[#E6003C]/15 border border-[#E6003C]/30 px-2 py-0.5 rounded">
                ML LINK PREDICTION
              </span>
            </div>

            {/* Entity A -> Connection -> Entity B Diagram */}
            <div className="space-y-2 py-1">
              {/* Entity A */}
              <div className="p-2.5 rounded-xl border border-white/[0.08] bg-white/[0.02] flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">
                    ENTITY A
                  </div>
                  <div className="font-mono text-xs text-slate-200 font-semibold truncate max-w-[180px]">
                    0x3C41bA89...7e88
                  </div>
                </div>
                <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded bg-red-950/40 border border-red-800/40 text-rose-300">
                  CRYPTO WALLET
                </span>
              </div>

              {/* Connecting Pulse Vector */}
              <div className="relative flex items-center justify-center py-2">
                <div className="absolute inset-x-8 top-1/2 h-[1px] bg-gradient-to-r from-transparent via-[#E6003C]/60 to-transparent" />
                <div className="relative px-3 py-1 rounded-full border border-[#E6003C]/50 bg-[#14050A] text-center shadow-[0_0_15px_rgba(230,0,60,0.3)]">
                  <span className="text-[9px] font-mono text-[#FF5E85] font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Zap className="w-3 h-3 text-[#FF2A5F] animate-pulse" />
                    PREDICTED CONNECTION (87%)
                  </span>
                </div>
              </div>

              {/* Entity B */}
              <div className="p-2.5 rounded-xl border border-white/[0.08] bg-white/[0.02] flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">
                    ENTITY B
                  </div>
                  <div className="font-mono text-xs text-slate-200 font-semibold truncate max-w-[180px]">
                    Aegis Cayman Holdings Ltd
                  </div>
                </div>
                <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded bg-slate-900/60 border border-slate-700/40 text-slate-300">
                  SHELL COMPANY
                </span>
              </div>
            </div>

            {/* Score & Attribution Signals */}
            <div className="p-3 rounded-xl border border-white/[0.06] bg-[#05060A]/80 space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 uppercase">Prediction Probability:</span>
                <span className="font-tech text-base font-bold text-[#FF2A5F]">87%</span>
              </div>

              <div className="space-y-1 pt-1 border-t border-white/[0.05] text-[10px] text-slate-300">
                <div className="text-slate-400 text-[9px] uppercase tracking-wider">Signals Detected:</div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-[#E6003C]" />
                  <span>Common Connections: 14 mutual transaction counterparties</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-[#E6003C]" />
                  <span>Temporal Pattern: Burst volume within 48h temporal window</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-[#E6003C]" />
                  <span>Network Centrality: Betweenness score 0.0482 (Top 1%)</span>
                </div>
              </div>
            </div>

            {/* Forensic Status Disclaimer */}
            <div className="p-2.5 rounded-xl border border-amber-500/30 bg-amber-950/20 text-[10px] font-mono space-y-0.5">
              <div className="text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>INVESTIGATIVE LEAD</span>
              </div>
              <div className="text-slate-400 leading-tight">
                Analytical hypothesis for investigative triaging only. NOT proof of guilt. Must be substantiated by verified on-chain evidence.
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ============================================================ */}
      {/* 4. BOTTOM DATA STRIP (Live Platform & Case Metrics)          */}
      {/* ============================================================ */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.6 }}
        className="relative z-10 w-full max-w-7xl mx-auto mt-4"
      >
        <div className="p-3 sm:p-4 rounded-2xl border border-white/[0.08] bg-[#07090F]/80 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.6)]">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 items-center text-center divide-y sm:divide-y-0 sm:divide-x divide-white/[0.06]">
            
            {/* EVIDENCE */}
            <div className="space-y-0.5 pt-2 sm:pt-0">
              <div className="text-[9px] sm:text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                EVIDENCE
              </div>
              <div className="font-tech text-lg sm:text-xl font-bold text-slate-100">
                {stats.evidence.toLocaleString()}
              </div>
            </div>

            {/* ENTITIES */}
            <div className="space-y-0.5 pt-2 sm:pt-0 sm:pl-3">
              <div className="text-[9px] sm:text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                ENTITIES
              </div>
              <div className="font-tech text-lg sm:text-xl font-bold text-slate-100">
                {stats.entities.toLocaleString()}
              </div>
            </div>

            {/* RELATIONSHIPS */}
            <div className="space-y-0.5 pt-2 sm:pt-0 sm:pl-3">
              <div className="text-[9px] sm:text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                RELATIONSHIPS
              </div>
              <div className="font-tech text-lg sm:text-xl font-bold text-slate-100">
                {stats.relationships.toLocaleString()}
              </div>
            </div>

            {/* ANOMALIES */}
            <div className="space-y-0.5 pt-2 sm:pt-0 sm:pl-3">
              <div className="text-[9px] sm:text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                ANOMALIES
              </div>
              <div className="font-tech text-lg sm:text-xl font-bold text-[#FF2A5F]">
                {stats.anomalies.toLocaleString()}
              </div>
            </div>

            {/* PREDICTED LINKS */}
            <div className="space-y-0.5 pt-2 sm:pt-0 sm:pl-3">
              <div className="text-[9px] sm:text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                PREDICTED LINKS
              </div>
              <div className="font-tech text-lg sm:text-xl font-bold text-slate-100">
                {stats.predictedLinks.toLocaleString()}
              </div>
            </div>

            {/* BLOCKCHAIN */}
            <div className="space-y-0.5 pt-2 sm:pt-0 sm:pl-3">
              <div className="text-[9px] sm:text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                BLOCKCHAIN
              </div>
              <div className="font-mono text-xs sm:text-sm font-bold text-emerald-400 flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>{stats.blockchainStatus}</span>
              </div>
            </div>

          </div>
        </div>
      </motion.div>
    </section>
  );
};
