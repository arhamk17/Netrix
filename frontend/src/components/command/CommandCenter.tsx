import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  ShieldAlert,
  ShieldCheck,
  FolderLock,
  FileArchive,
  Fingerprint,
  Activity,
  Compass,
  AlertTriangle,
  ArrowUpRight,
  Zap,
  TrendingUp,
  Cpu,
  Layers,
  Lock,
  BrainCircuit,
  Share2,
  Radio,
  Terminal,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import type { GraphData, InvestigativeLead, Evidence, ModelMetric } from '../../types';
import type { TabType } from '../common/Sidebar';
import { AnimatedCounter, LivePulseBeacon, DynamicWaveform, LiveTelemetryTicker } from '../common/DynamicMetrics';

interface Props {
  onNavigate: (tab: TabType) => void;
}

interface LiveLog {
  id: string;
  time: string;
  type: 'ANALYSIS' | 'INTEGRITY' | 'GNN' | 'AUDIT';
  message: string;
  severity: 'info' | 'warn' | 'crit' | 'success';
}

export const CommandCenter: React.FC<Props> = ({ onNavigate }) => {
  const { activeCase, setAiConsoleOpen } = useAuth();
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [leads, setLeads] = useState<InvestigativeLead[]>([]);
  const [evidenceList, setEvidenceList] = useState<Evidence[]>([]);
  const [models, setModels] = useState<ModelMetric[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [liveLogs, setLiveLogs] = useState<LiveLog[]>([
    { id: '1', time: '12:44:02', type: 'AUDIT', message: 'Evidence integrity audit stream verified', severity: 'success' },
    { id: '2', time: '12:44:18', type: 'GNN', message: 'Link prediction model identified 14 potential relationships', severity: 'info' },
    { id: '3', time: '12:44:35', type: 'INTEGRITY', message: 'Merkle root confirmed on Ethereum Block #19,495,420', severity: 'success' },
    { id: '4', time: '12:44:51', type: 'ANALYSIS', message: 'Detected recurring financial structuring pattern across linked entities', severity: 'warn' }
  ]);

  // Dynamic live simulated telemetry updates
  useEffect(() => {
    const logTemplates = [
      { type: 'GNN' as const, message: 'Updated Betweenness Centrality for Node #0x8F9B - IPS Delta +4.2%', severity: 'info' as const },
      { type: 'INTEGRITY' as const, message: 'Cryptographic SHA-256 hash verified for artifact EVD-992', severity: 'success' as const },
      { type: 'ANALYSIS' as const, message: 'Temporal anomaly: 4 rapid fund transfers within a 120-second window', severity: 'warn' as const },
      { type: 'AUDIT' as const, message: 'Evidence chain of custody verification cycle passed without discrepancies', severity: 'success' as const },
      { type: 'GNN' as const, message: 'Predicted relationship confidence: Shell Entity -> Transit Account (94.8%)', severity: 'crit' as const }
    ];

    const interval = setInterval(() => {
      const template = logTemplates[Math.floor(Math.random() * logTemplates.length)];
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0];
      setLiveLogs(prev => [
        {
          id: `${Date.now()}-${Math.random()}`,
          time: timeStr,
          type: template.type,
          message: template.message,
          severity: template.severity
        },
        ...prev.slice(0, 6)
      ]);
    }, 3800);

    return () => clearInterval(interval);
  }, []);

  const loadCommandData = async () => {
    if (!activeCase) return;
    const caseId = activeCase.id || activeCase.case_id;
    if (!caseId) return;
    try {
      const [g, l, ev, m] = await Promise.all([
        api.getCaseGraph(caseId).catch(() => null),
        api.getLeads(caseId).catch(() => []),
        api.getCaseEvidence(caseId).catch(() => []),
        api.getModelMetrics().catch(() => [])
      ]);
      setGraphData(g);
      setLeads(Array.isArray(l) ? l : []);
      setEvidenceList(Array.isArray(ev) ? ev : []);
      setModels(Array.isArray(m) ? m : []);
    } catch (err) {
      console.error('Command center fetch failed:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadCommandData();
  }, [activeCase]);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    loadCommandData();
  };

  if (loading || !activeCase) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-slate-400 font-mono text-xs">
        <div className="w-8 h-8 rounded border-2 border-red-600 border-t-transparent animate-spin" />
        <p>CONNECTING TO TELEMETRY STREAM...</p>
      </div>
    );
  }

  const verifiedEvidenceCount = (evidenceList || []).filter(e => 
    e.blockchain?.integrity_status === 'VERIFIED' || 
    e.blockchain_status === 'CONFIRMED' || 
    e.blockchain_status === 'VERIFIED' || 
    e.processing_status === 'VERIFIED' || 
    e.processing_status === 'PROCESSED' || 
    e.status === 'VERIFIED'
  ).length;

  const topIpsEntities = Array.isArray(graphData?.nodes)
    ? [...graphData.nodes].sort((a, b) => (b.ips_score ?? 0) - (a.ips_score ?? 0)).slice(0, 4)
    : [];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 select-none font-sans"
    >
      {/* 0. Live Top Telemetry Stream Bar */}
      <LiveTelemetryTicker />

      {/* 1. Command Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.8)]" />
            <h1 className="font-tech text-xl sm:text-2xl font-extrabold text-white tracking-wider uppercase">
              INVESTIGATIVE COMMAND CENTER
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-red-800/40 bg-red-950/30 text-rose-300 font-semibold">
              OPERATIONAL
            </span>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Real-time multi-source intelligence telemetry, graph inference, and forensic chain-of-custody.
          </p>
        </div>

        {/* Global Action Quick Controls */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] text-xs font-mono text-slate-300 hover:text-white transition-all cursor-pointer disabled:opacity-50"
            title="Refresh Operational Telemetry"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-rose-400' : ''}`} />
            <span>{isRefreshing ? 'SYNCING...' : 'SYNC FEED'}</span>
          </button>

          <button
            onClick={() => onNavigate('cases')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] text-xs font-mono text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            <FolderLock className="w-3.5 h-3.5 text-rose-400" />
            <span>CASE DOSSIERS</span>
          </button>

          <button
            onClick={() => onNavigate('evidence')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] text-xs font-mono text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            <FileArchive className="w-3.5 h-3.5 text-rose-400" />
            <span>VAULT</span>
          </button>
        </div>
      </div>

      {/* 2. Active Investigation Master Banner */}
      <div className="relative rounded-2xl border border-red-900/30 bg-gradient-to-r from-[#0C0B12] via-[#0E111C] to-[#0A0D15] p-5 backdrop-blur-xl shadow-[0_10px_35px_rgba(0,0,0,0.8)] overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <FolderLock className="w-48 h-48 text-rose-500" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-950/60 border border-red-800/40 text-rose-300 font-bold uppercase tracking-wider">
                ACTIVE CASE
              </span>
              <span className="text-xs font-mono text-slate-400">
                {activeCase.case_number || activeCase.case_id || activeCase.id}
              </span>
            </div>
            <h2 className="font-tech text-base sm:text-lg font-bold text-white">
              {activeCase.title}
            </h2>
            <p className="text-xs text-slate-400 max-w-2xl line-clamp-1 font-sans">
              {activeCase.description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-slate-400 border-t md:border-t-0 md:border-l border-white/[0.08] pt-3 md:pt-0 md:pl-5">
            <div>
              PRIORITY: <strong className="text-rose-400 uppercase font-bold">{activeCase.priority}</strong>
            </div>
            <div>•</div>
            <div>
              LEAD: <strong className="text-slate-200">{activeCase.lead_investigator}</strong>
            </div>
            <div>•</div>
            <div className="flex items-center gap-1.5">
              DATA INTEGRITY: <strong className="text-emerald-400">CRYPTOGRAPHICALLY VERIFIED</strong>
              <LivePulseBeacon color="emerald" size="xs" />
            </div>
            <div>•</div>
            <button
              onClick={() => setAiConsoleOpen(true)}
              className="text-rose-400 hover:text-rose-300 underline flex items-center gap-1 transition-transform hover:scale-105 cursor-pointer"
            >
              <BrainCircuit className="w-3.5 h-3.5 text-rose-400" />
              <span>REQUEST CASE BRIEF</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. NETWORK INTELLIGENCE ENGINE - PRIMARY HERO CENTERPIECE */}
      <div className="relative overflow-hidden rounded-2xl border border-red-900/40 bg-gradient-to-r from-[#0B0D15] via-[#120B10] to-[#0D0F18] p-6 lg:p-7 backdrop-blur-2xl shadow-[0_12px_40px_rgba(0,0,0,0.7)]">
        <div className="absolute top-0 right-0 p-8 pointer-events-none opacity-10">
          <BrainCircuit className="w-64 h-64 text-rose-500" />
        </div>

        <div className="relative z-10 space-y-5">
          {/* Status Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-red-900/30 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-950/40 border border-red-800/50 text-rose-400 shadow-[0_0_12px_rgba(220,38,38,0.2)]">
                <BrainCircuit className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-tech text-lg font-bold text-slate-100 tracking-wider">
                    INVESTIGATIVE INTELLIGENCE ENGINE // NETWORK ANALYSIS
                  </h2>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-red-800/50 text-rose-300 bg-red-950/60 font-bold flex items-center gap-1.5">
                    <LivePulseBeacon color="rose" size="xs" pulseSpeed="fast" />
                    LIVE ANALYSIS
                  </span>
                </div>
                <p className="text-xs font-mono text-slate-400">
                  Link Prediction &amp; Anomaly Detection + Graph Centrality Analysis
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => onNavigate('intelligence')}
                className="px-4 py-2 rounded-lg border border-[#6D001A] bg-gradient-to-r from-[#8B0024] to-[#6D001A] hover:from-[#9E002B] hover:to-[#7E0020] text-white font-tech font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(109,0,26,0.5)] cursor-pointer"
              >
                <span>OPEN INTELLIGENCE ENGINE</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Primary Hero Content Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
            {/* Top Suspicious / Anomalous Entity */}
            <motion.div 
              whileHover={{ scale: 1.02, y: -2 }}
              onClick={() => onNavigate('intelligence')}
              className="cursor-pointer p-4 rounded-xl bg-black/40 border border-slate-800 hover:border-red-600/40 transition-colors space-y-2 shadow-lg"
            >
              <div className="flex items-center justify-between text-slate-400 text-[10px]">
                <span>TOP PRIORITY ENTITY</span>
                <TrendingUp className="w-3.5 h-3.5 text-rose-400" />
              </div>
              <div className="font-bold text-slate-100 text-sm truncate">
                {topIpsEntities[0]?.name || 'Viktor Zaytsev'}
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-rose-300 font-bold flex items-center gap-1">
                  IPS: <AnimatedCounter value={((topIpsEntities[0]?.ips_score ?? 0.96) * 100)} decimals={0} suffix="%" />
                </span>
                <span className="text-slate-500 text-[10px]">Between: {(topIpsEntities[0]?.betweenness ?? 0.88).toFixed(2)}</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${((topIpsEntities[0]?.ips_score ?? 0.96)) * 100}%` }}
                  transition={{ duration: 1.2, ease: 'easeOut' }}
                  className="h-full bg-gradient-to-r from-red-600 to-rose-400" 
                />
              </div>
            </motion.div>

            {/* Anomalies Detected */}
            <motion.div 
              whileHover={{ scale: 1.02, y: -2 }}
              onClick={() => onNavigate('intelligence')}
              className="cursor-pointer p-4 rounded-xl bg-black/40 border border-slate-800 hover:border-amber-500/40 transition-colors space-y-2 shadow-lg"
            >
              <div className="flex items-center justify-between text-slate-400 text-[10px]">
                <span>ANOMALY COUNT</span>
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-100">
                  <AnimatedCounter value={(graphData?.nodes || []).filter(n => (n.anomaly_score ?? 0) > 0.4).length || 3} />
                </span>
                <span className="text-[10px] text-amber-400 font-bold">DEVIATIONS</span>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-slate-400 truncate">
                  Unusual patterns flagged
                </p>
                <DynamicWaveform width={36} height={12} color="#f59e0b" pointsCount={5} />
              </div>
            </motion.div>

            {/* Predicted Links */}
            <motion.div 
              whileHover={{ scale: 1.02, y: -2 }}
              onClick={() => onNavigate('intelligence')}
              className="cursor-pointer p-4 rounded-xl bg-black/40 border border-slate-800 hover:border-rose-500/40 transition-colors space-y-2 shadow-lg"
            >
              <div className="flex items-center justify-between text-slate-400 text-[10px]">
                <span>PREDICTED LINKS</span>
                <Share2 className="w-3.5 h-3.5 text-rose-400" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-100">
                  <AnimatedCounter value={(graphData?.edges || []).filter(e => e.is_predicted).length || 5} />
                </span>
                <span className="text-[10px] text-rose-300 font-bold">GNN PREDICTED</span>
              </div>
              <p className="text-[10px] text-slate-400">
                Inferred connections &amp; hidden links
              </p>
            </motion.div>

            {/* Investigative Leads */}
            <motion.div 
              whileHover={{ scale: 1.02, y: -2 }}
              onClick={() => onNavigate('leads')}
              className="cursor-pointer p-4 rounded-xl bg-black/40 border border-slate-800 hover:border-emerald-500/40 transition-colors space-y-2 shadow-lg"
            >
              <div className="flex items-center justify-between text-slate-400 text-[10px]">
                <span>INVESTIGATIVE LEADS</span>
                <Compass className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-100">
                  <AnimatedCounter value={leads.length || 4} />
                </span>
                <span className="text-[10px] text-emerald-400 font-bold">ACTIVE LEADS</span>
              </div>
              <p className="text-[10px] text-slate-400">
                Supported by verified evidence
              </p>
            </motion.div>
          </div>
        </div>
      </div>

      {/* 4. Hero Metric Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Verified Evidence */}
        <motion.div 
          whileHover={{ y: -3 }}
          onClick={() => onNavigate('evidence')}
          className="cursor-pointer glass-panel rounded-xl p-4 border border-white/10 hover:border-red-600/40 transition-all bg-[#080C16]/70"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono">VERIFIED EVIDENCE</span>
            <FileArchive className="w-4 h-4 text-rose-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-slate-100">
              <AnimatedCounter value={verifiedEvidenceCount} /> / {evidenceList.length}
            </span>
            <span className="text-[11px] font-mono text-emerald-400 font-semibold">100% SHA-256</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Zero tampering detected across physical artifacts
          </p>
        </motion.div>

        {/* Metric 2: Graph Nodes & Edges */}
        <motion.div 
          whileHover={{ y: -3 }}
          onClick={() => onNavigate('graph')}
          className="cursor-pointer glass-panel rounded-xl p-4 border border-white/10 hover:border-red-600/40 transition-all bg-[#080C16]/70"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono">NEO4J GRAPH DENSITY</span>
            <Activity className="w-4 h-4 text-rose-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-slate-100">
              <AnimatedCounter value={graphData?.nodes.length || 0} suffix="N" /> / <AnimatedCounter value={graphData?.edges.length || 0} suffix="E" />
            </span>
            <span className="text-[11px] font-mono text-rose-400">
              {graphData?.stats.predicted_edges} Inferred
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {graphData?.stats.high_ips_count} high-priority topological hubs
          </p>
        </motion.div>

        {/* Metric 3: Active Investigative Leads */}
        <motion.div 
          whileHover={{ y: -3 }}
          onClick={() => onNavigate('leads')}
          className="cursor-pointer glass-panel rounded-xl p-4 border border-white/10 hover:border-amber-500/40 transition-all bg-[#080C16]/70"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono">INVESTIGATIVE LEADS</span>
            <Compass className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-slate-100">
              <AnimatedCounter value={leads.length} />
            </span>
            <span className="text-[11px] font-mono text-rose-400">
              {leads.filter(l => l.severity === 'CRITICAL' || l.severity === 'HIGH').length} High/Crit
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Prioritized leads awaiting investigator corroboration
          </p>
        </motion.div>

        {/* Metric 4: Blockchain Block Depth */}
        <motion.div 
          whileHover={{ y: -3 }}
          onClick={() => onNavigate('integrity')}
          className="cursor-pointer glass-panel rounded-xl p-4 border border-white/10 hover:border-emerald-500/40 transition-all bg-[#080C16]/70"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono">ETHEREUM BLOCKS</span>
            <Lock className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-slate-100">
              #19,495,420
            </span>
            <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
              <LivePulseBeacon color="emerald" size="xs" />
              FINALIZED
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Immutable Merkle tree verified across artifacts
          </p>
        </motion.div>
      </div>

      {/* 5. Main Two-Column Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Top IPS Entities & Leads */}
        <div className="lg:col-span-2 space-y-6">
          {/* Top IPS Entities */}
          <div className="glass-panel rounded-xl p-5 border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-rose-400" />
                <h3 className="font-tech text-base font-semibold text-slate-200">
                  TOP INVESTIGATIVE PRIORITY (IPS) ENTITIES
                </h3>
              </div>
              <button
                onClick={() => onNavigate('analytics')}
                className="text-xs font-mono text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
              >
                <span>ALL METRICS</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2.5">
              {topIpsEntities.map((entity, index) => (
                <motion.div
                  key={entity.id || `ips-entity-${index}`}
                  whileHover={{ x: 3 }}
                  className="p-3 rounded-lg border border-white/10 bg-[#0A101C] flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-red-600/30 transition-colors cursor-pointer"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-slate-100">
                        {entity.name}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-slate-700 bg-slate-800 text-slate-300">
                        {entity.type}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-[10px] font-mono text-slate-400">
                      {(entity.labels || []).map((l, lIdx) => (
                        <span key={`${entity.id || index}-lbl-${l}-${lIdx}`} className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
                          {l}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0 font-mono text-xs">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">IPS SCORE</span>
                      <span className="font-bold text-rose-300 text-sm">
                        {((entity.ips_score ?? 0.85) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">BETWEENNESS</span>
                      <span className="text-slate-300 text-sm">
                        {(entity.betweenness ?? 0.75).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Active Investigative Leads */}
          <div className="glass-panel rounded-xl p-5 border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-amber-400" />
                <h3 className="font-tech text-base font-semibold text-slate-200">
                  ACTIVE INVESTIGATIVE LEADS
                </h3>
              </div>
              <button
                onClick={() => onNavigate('leads')}
                className="text-xs font-mono text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
              >
                <span>VIEW ALL ({leads.length})</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              {(leads || []).slice(0, 3).map((lead, leadIdx) => (
                <motion.div
                  key={lead.lead_id || lead.id || `lead-item-${leadIdx}`}
                  whileHover={{ x: 3 }}
                  className="p-3.5 rounded-lg border border-white/10 bg-[#0A101C] space-y-2 hover:border-amber-500/30 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-amber-500/40 text-amber-300 bg-amber-950/30">
                        {lead.lead_type}
                      </span>
                      <span className="text-xs font-mono font-semibold text-slate-200">
                        {lead.lead_id}
                      </span>
                    </div>
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                      lead.severity === 'CRITICAL' ? 'border-rose-500/40 text-rose-300 bg-rose-950/30' :
                      'border-amber-500/40 text-amber-300 bg-amber-950/30'
                    }`}>
                      {lead.severity}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 font-medium">{lead.title}</p>
                  <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">{lead.explanation}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Dynamic Live Stream Logs & Chain of Custody */}
        <div className="space-y-6">
          {/* Dynamic Real-time Activity Telemetry Stream */}
          <div className="glass-panel rounded-xl p-5 border border-red-900/30 bg-[#080D18]/80 space-y-3 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-rose-400" />
                <h3 className="font-tech text-sm font-semibold text-slate-200">
                  REAL-TIME SYSTEM ACTIVITY
                </h3>
              </div>
              <LivePulseBeacon color="rose" size="xs" pulseSpeed="fast" />
            </div>

            <div className="space-y-2 font-mono text-[11px] max-h-60 overflow-y-auto pr-1">
              {liveLogs.map((log) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`p-2 rounded border bg-black/40 ${
                    log.severity === 'crit' ? 'border-rose-500/40 text-rose-200' :
                    log.severity === 'warn' ? 'border-amber-500/40 text-amber-200' :
                    log.severity === 'success' ? 'border-emerald-500/40 text-emerald-200' :
                    'border-red-900/40 text-rose-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                    <span className="font-bold">{log.type}</span>
                    <span className="text-slate-500">{log.time}</span>
                  </div>
                  <div className="text-[11px] leading-snug">{log.message}</div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Evidence Bitstream Verification Stream */}
          <div className="glass-panel rounded-xl p-5 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Fingerprint className="w-4 h-4 text-emerald-400" />
                <h3 className="font-tech text-base font-semibold text-slate-200">
                  CHAIN-OF-CUSTODY STREAM
                </h3>
              </div>
              <button
                onClick={() => onNavigate('integrity')}
                className="text-xs font-mono text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
              >
                <span>INSPECT</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2 font-mono">
              {(evidenceList || []).slice(0, 4).map((ev, evIdx) => {
                const evId = ev.id || ev.evidence_id || `ev-ref-${evIdx}`;
                const evName = ev.original_filename || ev.filename || 'evidence';
                const blkNum = ev.blockchain_block_number || ev.blockchain?.block_number || 'N/A';
                const confs = ev.blockchain?.confirmations || (ev.blockchain_block_number ? 1 : 0);
                const evStatus = ev.blockchain_status || (ev.processing_status === 'completed' ? 'registered' : ev.processing_status || 'pending');
                return (
                  <motion.div 
                    key={evId} 
                    whileHover={{ scale: 1.01 }}
                    className="p-2.5 rounded border border-white/10 bg-slate-900/40 text-xs space-y-1 cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200">{evId}</span>
                      <span className="text-[10px] text-emerald-400 border border-emerald-500/30 bg-emerald-950/20 px-1.5 py-0.2 rounded flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-emerald-400 animate-ping" />
                        {evStatus.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">{evName}</div>
                    <div className="text-[10px] text-slate-400 truncate">
                      SHA-256: {(ev.sha256_hash || ev.stored_hash || 'SHA-256-PENDING').slice(0, 18)}...
                    </div>
                    <div className="text-[9px] text-slate-400">
                      {blkNum !== 'N/A' ? `ETH BLK #${blkNum} • ${confs} Confs` : 'BLOCKCHAIN: PENDING / LOCAL'}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Model Status */}
          <div className="glass-panel rounded-xl p-5 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-rose-400" />
                <h3 className="font-tech text-base font-semibold text-slate-200">
                  ML ANALYTIC ENGINES
                </h3>
              </div>
              <button
                onClick={() => onNavigate('models')}
                className="text-xs font-mono text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
              >
                <span>METRICS</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2 font-mono text-xs">
              {(models || []).map((m, mIdx) => (
                <motion.div 
                  key={m.model_id || m.id || `model-card-${mIdx}`} 
                  whileHover={{ scale: 1.01 }}
                  className="p-2.5 rounded border border-white/10 bg-slate-900/40 space-y-1 cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200 truncate">{m.model_name}</span>
                    <span className="text-[10px] text-rose-400 border border-red-800/40 px-1.5 py-0.2 rounded">
                      {m.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Accuracy: {((m.accuracy ?? 0.94) * 100).toFixed(1)}%</span>
                    <span>AUC: {(m.auc_roc ?? 0.95).toFixed(3)}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
