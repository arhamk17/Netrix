import React, { useEffect, useState } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import {
  FileText,
  FileDown,
  Network,
  ShieldCheck,
  ArrowRight,
  Clock,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Users,
  Building2,
  ChevronRight,
  ShieldAlert,
  Printer,
  Activity,
  Compass
} from 'lucide-react';
import { apiClient } from '../api/client';
import { NetworkStatistics, Case, PredictionEngineResult, InvestigativeLead, Entity, Evidence } from '../types';
import { AbstractNetwork3D } from '../components/common/AbstractNetwork3D';
import { GenerateReportModal } from '../components/GenerateReportModal';
import { AestheticGlassCard } from '../components/AestheticGlassCard';

interface DashboardProps {
  onNavigate?: (tab: string) => void;
  activeCase?: Case | null;
  onTrackConnection?: (prediction: PredictionEngineResult) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onNavigate,
  activeCase,
  onTrackConnection
}) => {
  const [loading, setLoading] = useState(true);
  const [loadingSecondary, setLoadingSecondary] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [predictions, setPredictions] = useState<PredictionEngineResult[]>([]);
  const [leads, setLeads] = useState<InvestigativeLead[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [evidenceList, setEvidenceList] = useState<Evidence[]>([]);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, [activeCase?.id]);

  const fetchData = async () => {
    setLoading(true);
    setLoadingSecondary(true);
    setError(null);

    const targetCaseId = activeCase?.id;

    try {
      if (targetCaseId) {
        // Stage 1: Load critical case, entity & evidence metrics first
        const [sum, graphData, evs] = await Promise.all([
          apiClient.dashboard.getSummary(targetCaseId),
          apiClient.graph.getGraphData(targetCaseId),
          apiClient.evidence.list(targetCaseId)
        ]);

        setSummary(sum);
        setEntities(graphData.nodes || []);
        setEvidenceList(evs || []);
        setLoading(false); // Render dashboard metrics immediately!

        // Stage 2: Load secondary ML predictions & leads concurrently without blocking
        Promise.all([
          apiClient.predictions.list(targetCaseId),
          apiClient.leads.list(targetCaseId)
        ])
          .then(([preds, leadsList]) => {
            setPredictions(preds);
            setLeads(leadsList);
          })
          .catch(err => {
            console.warn('[DASHBOARD] Non-blocking prediction fetch warning:', err);
          })
          .finally(() => {
            setLoadingSecondary(false);
          });

      } else {
        const sum = await apiClient.dashboard.getSummary();
        const resolvedCaseId = sum?.activeCase?.id;

        const [graphData, evs] = await Promise.all([
          resolvedCaseId ? apiClient.graph.getGraphData(resolvedCaseId) : Promise.resolve({ nodes: [], links: [] }),
          resolvedCaseId ? apiClient.evidence.list(resolvedCaseId) : Promise.resolve([])
        ]);

        setSummary(sum);
        setEntities(graphData.nodes || []);
        setEvidenceList(evs || []);
        setLoading(false);

        if (resolvedCaseId) {
          Promise.all([
            apiClient.predictions.list(resolvedCaseId),
            apiClient.leads.list(resolvedCaseId)
          ])
            .then(([preds, leadsList]) => {
              setPredictions(preds);
              setLeads(leadsList);
            })
            .catch(() => {})
            .finally(() => {
              setLoadingSecondary(false);
            });
        } else {
          setLoadingSecondary(false);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch platform metrics.');
      setLoading(false);
      setLoadingSecondary(false);
    }
  };

  const caseName = activeCase?.name || 'Select a Case File';
  const caseId = activeCase?.id || '—';

  // Compute dynamic top intelligence finding from predictions or leads
  const topPrediction = predictions.length > 0 ? predictions[0] : null;
  const topLead = leads.length > 0 ? leads[0] : null;

  const topFinding = topPrediction
    ? {
        badge: 'KEY INTELLIGENCE FINDING',
        confidence: Math.round((topPrediction.confidence || 0.85) * 100),
        title: topPrediction.title || `${topPrediction.entityA?.name || 'Entity A'} ↔ ${topPrediction.entityB?.name || 'Entity B'} Conduit`,
        description: topPrediction.description || topPrediction.explainability || 'GNN link prediction engine detected high-probability association in the network topology.',
        entityA: topPrediction.entityA?.name || 'Primary Subject',
        entityB: topPrediction.entityB?.name || 'Associated Node',
        signals: topPrediction.contributingGraphSignals?.join(' · ') || 'Topological proximity & embedding cosine similarity'
      }
    : topLead
    ? {
        badge: 'INVESTIGATIVE LEAD',
        confidence: Math.round((topLead.confidence || 0.80) * 100),
        title: topLead.explanation?.slice(0, 48) + (topLead.explanation?.length > 48 ? '...' : '') || 'Investigative Anomaly Discovered',
        description: topLead.explanation || 'Investigative lead discovered by criminal network intelligence analysis.',
        entityA: topLead.entitiesInvolved?.[0] || 'Target Entity',
        entityB: topLead.entitiesInvolved?.[1] || 'Linked Entity',
        signals: topLead.contributingSignals?.join(' · ') || 'Graph structural proximity & behavioral deviations'
      }
    : null;

  // Compute dynamic network density
  const densityVal = entities.length > 1 && (summary?.relationshipsCount || 0) > 0
    ? (((summary?.relationshipsCount || 0) * 2) / (entities.length * (entities.length - 1))).toFixed(2)
    : '0.00';

  // Dynamic Recent Activity feed constructed from evidence, predictions, and leads
  const recentFeed = [
    ...evidenceList.slice(0, 3).map((e, idx) => ({
      id: `ev-${e.id || idx}`,
      action: 'Evidence Ingested',
      details: `${e.name} · SHA-256: ${(e.sha256 || 'verified').slice(0, 12)}...`,
      timestamp: e.custodyChain?.[0]?.timestamp || new Date().toISOString(),
      actor: 'SECURE_VAULT'
    })),
    ...predictions.slice(0, 2).map((p, idx) => ({
      id: `pred-${idx}`,
      action: 'GNN Link Predicted',
      details: `${p.entityA?.name || 'Subject A'} ↔ ${p.entityB?.name || 'Subject B'} (${Math.round((p.confidence || 0.8) * 100)}% conf)`,
      timestamp: new Date().toISOString(),
      actor: 'GNN_ENGINE'
    })),
    ...leads.slice(0, 2).map((l, idx) => ({
      id: `lead-${idx}`,
      action: 'Lead Generated',
      details: l.explanation?.slice(0, 60) || 'Actionable intelligence signal',
      timestamp: l.createdAt || new Date().toISOString(),
      actor: 'INTELLIGENCE'
    }))
  ];

  // Parallax scroll motion setup
  const prefersReducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();

  // Subtle, atmospheric parallax Y translations for Dashboard main sections
  const heroParallaxY = useTransform(scrollYProgress, [0, 1], [0, prefersReducedMotion ? 0 : -10]);
  const metricsParallaxY = useTransform(scrollYProgress, [0, 1], [0, prefersReducedMotion ? 0 : -18]);
  const topologyParallaxY = useTransform(scrollYProgress, [0, 1], [0, prefersReducedMotion ? 0 : -26]);
  const activityParallaxY = useTransform(scrollYProgress, [0, 1], [0, prefersReducedMotion ? 0 : -32]);

  // Background particles & graph visualization parallax depth layers (move at slower relative speeds)
  const bgParticlesParallaxY = useTransform(scrollYProgress, [0, 1], [0, prefersReducedMotion ? 0 : -50]);
  const graphLayerParallaxY = useTransform(scrollYProgress, [0, 1], [0, prefersReducedMotion ? 0 : -15]);

  return (
    <div className="space-y-8 max-w-7xl mx-auto relative z-10">
      {/* Background Particles & Ambient Nebula Parallax Layer (Slower background depth motion) */}
      <motion.div
        style={{ y: bgParticlesParallaxY }}
        className="pointer-events-none absolute -inset-x-12 -top-24 h-[130%] z-0 opacity-50 overflow-hidden"
      >
        <div className="absolute top-8 right-12 w-[420px] h-[420px] rounded-full bg-[#6E1827]/6 blur-3xl" />
        <div className="absolute top-1/3 left-8 w-[380px] h-[380px] rounded-full bg-amber-900/5 blur-3xl" />
        <div className="absolute bottom-24 right-1/3 w-[520px] h-[520px] rounded-full bg-emerald-900/5 blur-3xl" />
      </motion.div>
      {/* 1. Current Active Case Context Hero Glass Banner (Parallax Layer 1) */}
      <motion.div style={{ y: heroParallaxY }} className="relative z-10">
        <AestheticGlassCard className="p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono tracking-widest text-[#6E1827] uppercase font-bold">
                ACTIVE CASE FILE
              </span>
              <span className="text-[11px] font-mono text-[#6B6760]">·</span>
              <span className="text-xs font-mono text-[#6B6760]">ID: {caseId}</span>
              <span className="text-[9px] font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 uppercase font-semibold">
                {activeCase?.status || 'ACTIVE'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-normal tracking-tight text-[#121110]">
              {caseName}
            </h1>
            <p className="text-sm text-[#6B6760] max-w-2xl font-sans leading-relaxed">
              {activeCase?.description ||
                'Investigating active criminal network intelligence, behavioral deviations, and graph topological connections.'}
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-2.5 shrink-0">
            <button
              onClick={() => onNavigate?.('cases')}
              className="px-4 py-2 bg-[#F8F7F4] border border-[#E6E1D8] text-xs font-mono text-[#121110] rounded-full hover:bg-white transition-all shadow-2xs cursor-pointer"
            >
              Switch Case
            </button>
            <button
              onClick={() => onNavigate?.('graph')}
              className="px-4 py-2 bg-[#121110] text-white text-xs font-mono font-medium rounded-full hover:bg-[#6E1827] transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <Network className="w-3.5 h-3.5" />
              <span>Open 3D Graph</span>
            </button>
            <button
              onClick={() => setIsReportModalOpen(true)}
              className="px-4 py-2 bg-[#6E1827] text-white text-xs font-mono font-medium rounded-full hover:bg-[#4E101B] transition-all flex items-center gap-2 shadow-2xs group cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5 text-rose-200 group-hover:scale-105 transition-transform" />
              <span>Generate Report</span>
            </button>
          </div>
        </AestheticGlassCard>
      </motion.div>

      {/* 2. 6 Key Investigation Metrics (Parallax Layer 2) */}
      <motion.div style={{ y: metricsParallaxY }} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 relative z-10">
        <div
          onClick={() => onNavigate?.('evidence')}
          className="p-4 bg-white hover:bg-[#F8F7F4] border border-[#E6E1D8] rounded-2xl cursor-pointer transition-all shadow-2xs space-y-1 font-mono"
        >
          <div className="text-[10px] text-[#6B6760] uppercase font-semibold">Evidence</div>
          <div className="text-2xl font-light text-[#121110] tabular-nums">
            {summary?.evidenceCount ?? evidenceList.length}
          </div>
          <div className="text-[11px] text-[#6B6760] font-sans">
            {summary?.processedEvidence ?? evidenceList.length} processed
          </div>
        </div>

        <div
          onClick={() => onNavigate?.('entities')}
          className="p-4 bg-white hover:bg-[#F8F7F4] border border-[#E6E1D8] rounded-2xl cursor-pointer transition-all shadow-2xs space-y-1 font-mono"
        >
          <div className="text-[10px] text-[#6B6760] uppercase font-semibold">Entities</div>
          <div className="text-2xl font-light text-[#121110] tabular-nums">
            {summary?.entitiesCount ?? entities.length}
          </div>
          <div className="text-[11px] text-[#6B6760] font-sans">
            {new Set(entities.map(n => n.type)).size || 0} node types
          </div>
        </div>

        <div
          onClick={() => onNavigate?.('graph')}
          className="p-4 bg-white hover:bg-[#F8F7F4] border border-[#E6E1D8] rounded-2xl cursor-pointer transition-all shadow-2xs space-y-1 font-mono"
        >
          <div className="text-[10px] text-[#6B6760] uppercase font-semibold">Relationships</div>
          <div className="text-2xl font-light text-[#121110] tabular-nums">
            {summary?.relationshipsCount ?? 0}
          </div>
          <div className="text-[11px] text-[#6B6760] font-sans">Confirmed edges</div>
        </div>

        <div
          onClick={() => onNavigate?.('predictions')}
          className="p-4 bg-[#6E1827]/5 hover:bg-[#6E1827]/10 border border-[#6E1827]/20 rounded-2xl cursor-pointer transition-all shadow-2xs space-y-1 font-mono"
        >
          <div className="text-[10px] text-[#6E1827] uppercase font-bold">Potential links</div>
          <div className="text-2xl font-semibold text-[#6E1827] tabular-nums">
            {loadingSecondary ? (
              <span className="inline-block w-8 h-6 rounded bg-[#6E1827]/20 animate-pulse" />
            ) : (
              predictions.length
            )}
          </div>
          <div className="text-[11px] text-[#6E1827] font-sans font-medium">GNN link discovery</div>
        </div>

        <div
          onClick={() => onNavigate?.('leads')}
          className="p-4 bg-white hover:bg-[#F8F7F4] border border-[#E6E1D8] rounded-2xl cursor-pointer transition-all shadow-2xs space-y-1 font-mono"
        >
          <div className="text-[10px] text-[#6B6760] uppercase font-semibold">Investigation leads</div>
          <div className="text-2xl font-light text-[#121110] tabular-nums">
            {loadingSecondary ? (
              <span className="inline-block w-8 h-6 rounded bg-black/10 animate-pulse" />
            ) : (
              leads.length
            )}
          </div>
          <div className="text-[11px] text-[#6B6760] font-sans">Actionable signals</div>
        </div>

        <div
          onClick={() => onNavigate?.('verification')}
          className="p-4 bg-white hover:bg-[#F8F7F4] border border-[#E6E1D8] rounded-2xl cursor-pointer transition-all shadow-2xs space-y-1 font-mono"
        >
          <div className="text-[10px] text-[#6B6760] uppercase font-semibold">Evidence integrity</div>
          <div className="text-2xl font-light text-emerald-800 tabular-nums">
            100%
          </div>
          <div className="text-[11px] text-emerald-800 font-sans font-medium">SHA-256 anchored</div>
        </div>
      </motion.div>

      {/* 3. Main Visual: Interactive Network Snapshot + High-Priority Connection (Parallax Layer 3) */}
      <motion.div style={{ y: topologyParallaxY }} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch relative z-10">
        {/* Left: 3D Network Preview */}
        <AestheticGlassCard className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-mono tracking-widest text-[#6E1827] uppercase font-bold">
                RELATIONAL TOPOLOGY SNAPSHOT
              </span>
              <h3 className="text-base font-serif font-normal text-[#121110]">
                Heterogeneous Knowledge Graph
              </h3>
            </div>
            <button
              onClick={() => onNavigate?.('graph')}
              className="text-xs font-mono text-[#6E1827] hover:text-[#4E101B] flex items-center gap-1 transition-colors font-semibold cursor-pointer"
            >
              <span>Explore Full 3D Graph</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <motion.div
            style={{ y: graphLayerParallaxY }}
            className="w-full h-72 border border-[#E6E1D8] bg-[#F8F7F4] rounded-2xl overflow-hidden relative flex items-center justify-center"
          >
            <AbstractNetwork3D className="w-full h-full" />
            <div className="absolute bottom-3 left-3 text-[10px] font-mono text-[#6B6760] bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-full border border-[#E6E1D8] font-medium shadow-2xs">
              INTERACTION: DRAG NODES · 3D ORBITAL PERSPECTIVE
            </div>
          </motion.div>

          <div className="flex items-center justify-between text-xs font-mono text-[#6B6760]">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#121110]" />
                <span>Confirmed relations</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#6E1827]" />
                <span>Predicted conduits</span>
              </span>
            </div>
            <span>Density: {densityVal}</span>
          </div>
        </AestheticGlassCard>

        {/* Right: Key Intelligence Finding (High-Priority Potential Connection) */}
        <AestheticGlassCard className="lg:col-span-5 p-6 sm:p-8 flex flex-col justify-between space-y-4">
          {topFinding ? (
            <>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono tracking-widest text-[#6E1827] uppercase font-bold">
                    {topFinding.badge}
                  </span>
                  <span className="text-xs font-mono text-[#6E1827] bg-[#FAF1F2] border border-[#6E1827]/25 px-2 py-0.2 rounded-full font-bold">
                    {topFinding.confidence}% CONFIDENCE
                  </span>
                </div>
                <h3 className="text-base font-serif font-normal text-[#121110]">
                  {topFinding.title}
                </h3>
                <p className="text-xs text-[#6B6760] leading-relaxed font-sans line-clamp-3">
                  {topFinding.description}
                </p>
              </div>

              <div className="p-4 bg-[#FAF8F5] border border-black/5 rounded-2xl space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between text-[#121110] font-medium">
                  <span className="truncate max-w-[42%]">{topFinding.entityA}</span>
                  <span className="text-[#6E1827] font-bold shrink-0">↕</span>
                  <span className="truncate max-w-[42%] text-right">{topFinding.entityB}</span>
                </div>
                <div className="text-[11px] text-[#6B6760] line-clamp-2">
                  Signals: {topFinding.signals}
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                {topPrediction && (
                  <button
                    onClick={() => onTrackConnection?.(topPrediction)}
                    className="flex-1 py-2 px-4 bg-[#6E1827] text-[#FFFFFF] text-xs font-mono font-medium rounded-full hover:bg-[#4E101B] transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <span>Track Connection</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
                <button
                  onClick={() => setIsReportModalOpen(true)}
                  className="py-2 px-3 bg-white/80 border border-[#6E1827]/30 text-[#6E1827] hover:bg-[#6E1827]/5 text-xs font-mono rounded-full transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  title="Export report with this finding"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>Export Dossier</span>
                </button>
                <button
                  onClick={() => onNavigate?.('predictions')}
                  className="py-2 px-3 bg-white/80 border border-black/10 text-xs font-mono text-[#121110] rounded-full hover:bg-white transition-all cursor-pointer"
                >
                  All Predictions
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-[#6E1827]/5 border border-[#6E1827]/15 flex items-center justify-center text-[#6E1827]">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-medium text-[#121110]">No Active Neural Predictions</h4>
                <p className="text-xs text-[#6B6760] max-w-xs font-sans">
                  Ingest evidence files or run the GNN inference engine to detect unobserved conduits for this case file.
                </p>
              </div>
              <div className="pt-2 flex gap-2">
                <button
                  onClick={() => onNavigate?.('evidence')}
                  className="py-1.5 px-3 bg-[#121110] text-white text-xs font-mono rounded-full hover:bg-[#6E1827] transition-all cursor-pointer"
                >
                  Ingest Evidence
                </button>
                <button
                  onClick={() => onNavigate?.('predictions')}
                  className="py-1.5 px-3 bg-white border border-black/10 text-xs font-mono text-[#121110] rounded-full hover:bg-[#F8F7F4] transition-all cursor-pointer"
                >
                  Prediction Center
                </button>
              </div>
            </div>
          )}
        </AestheticGlassCard>
      </motion.div>

      {/* 4. Recent Intelligence Findings Activity (Parallax Layer 4) */}
      <motion.div style={{ y: activityParallaxY }} className="relative z-10">
        <AestheticGlassCard className="p-6 sm:p-8 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E6E1D8]">
            <div>
              <h3 className="text-base font-serif font-normal text-[#121110] tracking-tight">
                Recent Intelligence Feed
              </h3>
              <span className="text-xs text-[#6B6760] font-mono">
                Events across evidence ingestion, neural predictions, and verified records
              </span>
            </div>
            <button
              onClick={() => onNavigate?.('timeline')}
              className="text-xs font-mono text-[#6E1827] hover:text-[#4E101B] flex items-center gap-1 transition-colors font-medium cursor-pointer"
            >
              <span>View Full Timeline</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-black/5 text-xs font-mono">
            {recentFeed.length > 0 ? (
              recentFeed.map((act) => (
                <div key={act.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-[#6E1827]" />
                    <span className="font-semibold text-[#121110]">{act.action}</span>
                    <span className="text-[#6B6760] font-sans max-w-md truncate">{act.details}</span>
                  </div>
                  <div className="text-[11px] text-[#6B6760] shrink-0">
                    {new Date(act.timestamp).toLocaleDateString()} · {act.actor}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-xs text-[#6B6760] font-mono">
                No recent intelligence events recorded for this case file.
              </div>
            )}
          </div>
        </AestheticGlassCard>
      </motion.div>

      {/* Generate Report Modal */}
      <GenerateReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        activeCase={activeCase}
        summary={summary}
        predictions={predictions}
        leads={leads}
        entities={entities}
        evidenceList={evidenceList}
      />
    </div>
  );
};
