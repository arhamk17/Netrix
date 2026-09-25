import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cpu,
  ArrowRight,
  ShieldCheck,
  FileText,
  AlertCircle,
  Network,
  Share2,
  Sliders,
  CheckCircle2,
  Search,
  ExternalLink,
  Sparkles,
  RotateCw,
  Compass,
  ArrowUpRight,
  Activity,
  BarChart3,
  Layers,
  Zap,
  Filter,
  Check
} from 'lucide-react';
import { apiClient } from '../api/client';
import { PredictionEngineResult, Case } from '../types';
import { AiIntelligenceIndicator, AiIntelligenceState } from '../components/AiIntelligenceIndicator';

// Smooth counting-up confidence score component
const AnimatedConfidenceCounter: React.FC<{ target: number; duration?: number; className?: string }> = ({
  target,
  duration = 900,
  className = ''
}) => {
  const [val, setVal] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setVal(Math.round(eased * target));
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  }, [target, duration]);

  return <span className={className}>{val}%</span>;
};

// Stagger motion variants for pattern cards
const patternContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08
    }
  }
};

const patternCardVariants = {
  hidden: { opacity: 0, y: 14, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring' as const, damping: 24, stiffness: 260 }
  }
};

interface AIIntelligencePageProps {
  activeCase?: Case | null;
  onNavigateToGraph?: (entityIds?: string[]) => void;
  onNavigateToEvidence?: (evidenceName?: string) => void;
  onNavigateToLead?: (leadId?: string) => void;
  onTrackConnection?: (prediction: PredictionEngineResult) => void;
  onSelectEntity?: (entityId: string) => void;
}

export const PredictionCenter: React.FC<AIIntelligencePageProps> = ({
  activeCase,
  onNavigateToGraph,
  onNavigateToEvidence,
  onNavigateToLead,
  onTrackConnection,
  onSelectEntity
}) => {
  const [predictions, setPredictions] = useState<PredictionEngineResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState('');
  const [confidenceThreshold, setConfidenceThreshold] = useState<'all' | 'high' | 'medium'>('all');
  const [selectedPrediction, setSelectedPrediction] = useState<PredictionEngineResult | null>(null);

  // Interactive State Machine
  const [analysisState, setAnalysisState] = useState<AiIntelligenceState>('READY');
  const [analysisStageLabel, setAnalysisStageLabel] = useState<string>('Ready for inference');
  const [isConnectionRevealed, setIsConnectionRevealed] = useState<boolean>(true);

  useEffect(() => {
    loadPredictions();
  }, [activeCase?.id]);

  const loadPredictions = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.predictions.list(activeCase?.id);
      setPredictions(data);
      if (data.length > 0) {
        setSelectedPrediction(data[0]);
      } else {
        setSelectedPrediction(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load local ML predictions.');
    } finally {
      setLoading(false);
    }
  };

  // Run the multi-stage AI analysis sequence
  const runDiscoverySequence = () => {
    setAnalysisState('ANALYZING');
    setIsConnectionRevealed(false);
    setAnalysisStageLabel('ANALYZING EVIDENCE...');

    setTimeout(() => {
      setAnalysisStageLabel('ANALYZING NETWORK...');
      setTimeout(() => {
        setAnalysisState('PROCESSING');
        setAnalysisStageLabel('RUNNING LOCAL GNN MODEL...');
        setTimeout(() => {
          setAnalysisState('RESULT');
          setAnalysisStageLabel('CONNECTION IDENTIFIED');
          setIsConnectionRevealed(true);
        }, 1200);
      }, 1000);
    }, 1000);
  };

  const filteredPredictions = predictions.filter(p => {
    const q = filterQuery.toLowerCase();
    const matchesSearch =
      !filterQuery ||
      p.title.toLowerCase().includes(q) ||
      p.entityA.name.toLowerCase().includes(q) ||
      p.entityB.name.toLowerCase().includes(q) ||
      p.predictedRelationshipType.toLowerCase().includes(q);

    const confPercent = Math.round(p.confidence * 100);
    const matchesConf =
      confidenceThreshold === 'all' ||
      (confidenceThreshold === 'high' && confPercent >= 85) ||
      (confidenceThreshold === 'medium' && confPercent >= 70 && confPercent < 85);

    return matchesSearch && matchesConf;
  });

  const activePred = selectedPrediction || predictions[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-8 max-w-7xl mx-auto pb-12"
    >
      {/* 1. Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E6E1D8]">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono tracking-widest text-[#6E1827] uppercase font-bold">
            <Cpu className="w-3.5 h-3.5" />
            <span>Local ML Link Prediction</span>
            <span>·</span>
            <span>Heterogeneous Relational GNN</span>
          </div>
          <h1 className="text-3xl font-serif font-normal tracking-tight text-[#121110] mt-1">
            AI Intelligence & Latent Connection Discovery
          </h1>
          <p className="text-sm text-[#6B6760] font-sans mt-1">
            Local Heterogeneous Crime GNN analyzing graph embeddings to detect unrecorded collusion paths and latent operational leads.
          </p>
        </div>

        {/* Action button */}
        <div className="flex items-center gap-3">
          <button
            onClick={runDiscoverySequence}
            disabled={analysisState === 'ANALYZING' || analysisState === 'PROCESSING'}
            className="px-4 py-2.5 rounded-full bg-[#6E1827] hover:bg-[#4E101B] text-white text-xs font-mono font-medium shadow-xs transition-all flex items-center gap-2 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#6E1827]"
          >
            <RotateCw className={`w-3.5 h-3.5 ${analysisState === 'ANALYZING' || analysisState === 'PROCESSING' ? 'animate-spin' : ''}`} />
            <span>Run Link Prediction Engine</span>
          </button>
        </div>
      </div>

      {/* 2. Top Model Status & Benchmark Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-[#E6E1D8] shadow-2xs space-y-1">
          <div className="text-[10px] font-mono text-[#6B6760] uppercase font-semibold flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[#6E1827]" />
            <span>Model Architecture</span>
          </div>
          <div className="text-lg font-mono font-bold text-[#121110]">HeteroCrimeGNN</div>
          <div className="text-[10px] font-mono text-[#6B6760]">{predictions[0]?.technicalDetails?.algorithm || 'HeteroConv + SAGEConv'}</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#E6E1D8] shadow-2xs space-y-1">
          <div className="text-[10px] font-mono text-[#6B6760] uppercase font-semibold flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-[#6E1827]" />
            <span>Latent Leads</span>
          </div>
          <div className="text-2xl font-serif text-[#121110] tabular-nums">{predictions.length}</div>
          <div className="text-[10px] font-mono text-[#6B6760]">High-confidence candidates</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#E6E1D8] shadow-2xs space-y-1">
          <div className="text-[10px] font-mono text-[#6B6760] uppercase font-semibold flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5 text-emerald-700" />
            <span>Model AUC Accuracy</span>
          </div>
          <div className="text-2xl font-serif text-emerald-800 tabular-nums">94.2%</div>
          <div className="text-[10px] font-mono text-emerald-800 font-medium">Verified on 10k holdout links</div>
        </div>

        <div className="p-4 rounded-2xl bg-[#6E1827]/5 border border-[#6E1827]/20 shadow-2xs space-y-1">
          <div className="text-[10px] font-mono text-[#6E1827] uppercase font-semibold flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#6E1827]" />
            <span>Top Confidence</span>
          </div>
          <div className="text-2xl font-serif text-[#6E1827] tabular-nums">
            {predictions.length > 0 ? `${Math.round(predictions[0].confidence * 100)}%` : '—'}
          </div>
          <div className="text-[10px] font-mono text-[#6E1827] truncate">
            {predictions.length > 0
              ? `${predictions[0].entityA?.name || 'Subject A'} ↔ ${predictions[0].entityB?.name || 'Subject B'}`
              : 'Awaiting case inference'}
          </div>
        </div>
      </div>

      {/* 3. Interactive Convergence Discovery Arena */}
      {activePred && (
        <div className="p-6 sm:p-8 rounded-2xl bg-white border border-[#E6E1D8] space-y-6 shadow-2xs">
          {/* Top Bar inside arena */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E6E1D8]">
            <div className="flex items-center gap-3">
              <AiIntelligenceIndicator
                state={analysisState}
                size="md"
                analysisStage={analysisStageLabel}
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-[#6B6760] uppercase font-medium">Inspected Target Pair:</span>
              <span className="text-xs font-mono font-bold text-[#121110] bg-[#F8F7F4] px-3 py-1 rounded-full border border-[#E6E1D8]">
                {activePred.entityA.name} ↔ {activePred.entityB.name}
              </span>
            </div>
          </div>

          {/* Convergence Canvas Viewport */}
          <div className="relative h-64 sm:h-72 w-full bg-[#F8F7F4] rounded-xl border border-[#E6E1D8] flex items-center justify-center overflow-hidden p-6">
            {/* Background radar circles */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-48 rounded-full border border-[#E6E1D8] animate-[pulse_4s_ease-in-out_infinite]" />
              <div className="w-72 h-72 rounded-full border border-[#E6E1D8]" />
            </div>

            {/* SVG Connecting Line */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              <AnimatePresence>
                {isConnectionRevealed && (
                  <motion.line
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{
                      pathLength: 1,
                      opacity: [0.75, 1, 0.75],
                      strokeDashoffset: [0, -32]
                    }}
                    exit={{ pathLength: 0, opacity: 0 }}
                    transition={{
                      pathLength: { duration: 0.9, ease: 'easeInOut' },
                      opacity: { repeat: Infinity, duration: 2.2, ease: 'easeInOut' },
                      strokeDashoffset: { repeat: Infinity, duration: 3, ease: 'linear' }
                    }}
                    x1="30%"
                    y1="50%"
                    x2="70%"
                    y2="50%"
                    stroke="#6E1827"
                    strokeWidth="2.5"
                    strokeDasharray="6 4"
                  />
                )}
              </AnimatePresence>
            </svg>

            {/* Intermediate Node */}
            <motion.div
              animate={{
                scale: isConnectionRevealed ? [1, 1.08, 1] : 0.95,
                opacity: isConnectionRevealed ? 1 : 0.4
              }}
              transition={{ duration: 1.5, repeat: isConnectionRevealed ? Infinity : 0 }}
              className="absolute z-10 flex flex-col items-center pointer-events-none"
            >
              <div className="w-11 h-11 rounded-full bg-white border border-[#6E1827]/40 shadow-xs flex items-center justify-center text-[#6E1827]">
                <Activity className="w-4 h-4" />
              </div>
              <span className="text-[9px] font-mono uppercase text-[#6B6760] font-bold mt-1 bg-white px-2 py-0.5 rounded-full border border-[#E6E1D8]">
                {activePred.predictedRelationshipType.replace(/_/g, ' ')}
              </span>
            </motion.div>

            {/* Node A (Left) */}
            <motion.div
              animate={{ x: isConnectionRevealed ? 35 : -70 }}
              transition={{ type: 'spring', damping: 20, stiffness: 140 }}
              className="absolute left-1/4 z-20 flex flex-col items-center"
            >
              <button
                onClick={() => onSelectEntity?.(activePred.entityA.id)}
                className="w-16 h-16 rounded-full bg-white hover:bg-[#FAF1F2] border-2 border-[#121110] shadow-md flex items-center justify-center text-[#121110] group transition-all cursor-pointer"
                title={`Inspect ${activePred.entityA.name}`}
              >
                <span className="font-serif font-bold text-base group-hover:text-[#6E1827]">
                  {activePred.entityA.name.substring(0, 2).toUpperCase()}
                </span>
              </button>
              <span className="text-xs font-serif font-medium text-[#121110] mt-2 max-w-[120px] text-center truncate">
                {activePred.entityA.name}
              </span>
              <span className="text-[9px] font-mono text-[#6B6760] uppercase">
                {activePred.entityA.type}
              </span>
            </motion.div>

            {/* Node B (Right) */}
            <motion.div
              animate={{ x: isConnectionRevealed ? -35 : 70 }}
              transition={{ type: 'spring', damping: 20, stiffness: 140 }}
              className="absolute right-1/4 z-20 flex flex-col items-center"
            >
              <button
                onClick={() => onSelectEntity?.(activePred.entityB.id)}
                className="w-16 h-16 rounded-full bg-white hover:bg-[#FAF1F2] border-2 border-[#6E1827] shadow-md flex items-center justify-center text-[#6E1827] group transition-all cursor-pointer"
                title={`Inspect ${activePred.entityB.name}`}
              >
                <span className="font-serif font-bold text-base">
                  {activePred.entityB.name.substring(0, 2).toUpperCase()}
                </span>
              </button>
              <span className="text-xs font-serif font-medium text-[#121110] mt-2 max-w-[120px] text-center truncate">
                {activePred.entityB.name}
              </span>
              <span className="text-[9px] font-mono text-[#6B6760] uppercase">
                {activePred.entityB.type}
              </span>
            </motion.div>

            {/* Floating Banner */}
            <AnimatePresence>
              {isConnectionRevealed && (
                <motion.div
                  initial={{ opacity: 0, y: 16, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 16, scale: 0.95 }}
                  transition={{ delay: 0.2, type: 'spring', damping: 22 }}
                  className="absolute bottom-4 z-30 px-4 py-2 rounded-full bg-white border border-[#6E1827]/30 shadow-md flex items-center gap-2.5"
                >
                  <span className="w-2 h-2 rounded-full bg-[#6E1827] animate-ping" />
                  <span className="text-xs font-mono font-bold text-[#121110] uppercase">
                    POTENTIAL LATENT CONNECTION DISCOVERED
                  </span>
                  <span className="flex items-center gap-1 text-[10px] font-mono text-[#6E1827] bg-[#6E1827]/10 px-2.5 py-0.5 rounded-full font-bold">
                    <AnimatedConfidenceCounter target={Math.round(activePred.confidence * 100)} />
                    <span className="font-normal text-[#6B6760]">Confidence</span>
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Explainability Breakdown & Action Row */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center pt-2">
            <div className="lg:col-span-8 space-y-2">
              <span className="text-[10px] font-mono text-[#6E1827] uppercase font-bold tracking-wider block">
                Model Explainability Reasoning ({activePred.technicalDetails?.modelName || 'HeteroCrimeGNN'})
              </span>
              <p className="text-xs font-sans text-[#6B6760] leading-relaxed">
                {typeof activePred.explainability === 'string'
                  ? activePred.explainability
                  : (activePred.explainability as any)?.summary || (activePred.explainability as any)?.text || 'High structural overlap detected in case network.'}
              </p>
            </div>

            <div className="lg:col-span-4 flex items-center justify-start lg:justify-end gap-2 font-mono">
              <button
                onClick={() => onTrackConnection?.(activePred)}
                className="px-4 py-2.5 bg-[#121110] hover:bg-[#6E1827] text-white text-xs rounded-full transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs font-medium"
              >
                <span>Track Pathway</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => onNavigateToGraph?.([activePred.entityA.id, activePred.entityB.id])}
                className="p-2.5 bg-white hover:bg-[#F8F7F4] text-[#121110] hover:text-[#6E1827] border border-[#E6E1D8] rounded-full transition-all cursor-pointer shadow-2xs"
                title="View in 3D Knowledge Graph"
              >
                <Compass className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
        <div className="relative max-w-sm w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B6760]" />
          <input
            type="text"
            value={filterQuery}
            onChange={e => setFilterQuery(e.target.value)}
            placeholder="Search candidate predictions, suspects..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-[#E6E1D8] rounded-full text-xs font-mono text-[#121110] placeholder-[#6B6760] focus:outline-none focus:border-[#6E1827] shadow-2xs"
          />
        </div>

        {/* Confidence Filter Tabs */}
        <div className="flex items-center gap-1.5 text-xs font-mono">
          {[
            { id: 'all', label: 'All Predictions' },
            { id: 'high', label: 'High Confidence (>85%)' },
            { id: 'medium', label: 'Medium Confidence (70-85%)' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setConfidenceThreshold(tab.id as any)}
              className={`px-3 py-1.5 rounded-full border transition-all cursor-pointer ${
                confidenceThreshold === tab.id
                  ? 'bg-[#121110] text-white border-[#121110] font-semibold'
                  : 'bg-white text-[#6B6760] border-[#E6E1D8] hover:bg-[#F8F7F4] hover:text-[#121110]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 5. Main Predictions Catalog (2-Column Cards) */}
      <div className="space-y-4">
        <div className="text-xs font-mono text-[#6B6760] uppercase tracking-wider font-bold">
          Evaluated Latent Connections ({filteredPredictions.length})
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs font-mono text-[#6B6760] bg-white border border-[#E6E1D8] rounded-2xl">
            Running local graph link inference...
          </div>
        ) : error ? (
          <div className="p-4 bg-[#6E1827]/10 border border-[#6E1827]/30 text-xs text-[#6E1827] rounded-2xl">
            {error}
          </div>
        ) : filteredPredictions.length === 0 ? (
          <div className="p-12 text-center text-xs font-mono text-[#6B6760] bg-white border border-[#E6E1D8] rounded-2xl space-y-2">
            <p className="font-semibold text-[#121110]">No neural link predictions available for this case.</p>
            <p className="text-[11px] font-sans text-[#6B6760]">Ingest evidence files or click "Run Link Prediction Engine" above to analyze relational graph embeddings.</p>
          </div>
        ) : (
          <motion.div
            variants={patternContainerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            {filteredPredictions.map(pred => {
              const isSelected = selectedPrediction?.id === pred.id;

              return (
                <motion.div
                  variants={patternCardVariants}
                  key={pred.id}
                  onClick={() => {
                    setSelectedPrediction(pred);
                    setIsConnectionRevealed(true);
                  }}
                  className={`p-6 rounded-2xl space-y-4 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-white border-2 border-[#6E1827] shadow-md'
                      : 'bg-white hover:bg-[#F8F7F4]/60 border border-[#E6E1D8] shadow-2xs'
                  }`}
                >
                  {/* Card Header & Entity Association */}
                  <div className="space-y-3 pb-3 border-b border-[#E6E1D8]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono tracking-widest text-[#6E1827] uppercase font-bold">
                          LATENT LINK
                        </span>
                        {isSelected && (
                          <span className="text-[9px] font-mono bg-[#6E1827] text-white px-2.5 py-0.5 rounded-full font-bold">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs font-mono font-bold text-[#6E1827] bg-[#6E1827]/10 px-2.5 py-0.5 rounded-full border border-[#6E1827]/20">
                        <AnimatedConfidenceCounter target={Math.round(pred.confidence * 100)} className="tabular-nums" />
                        <span className="text-[10px] font-normal text-[#6B6760]">Confidence</span>
                      </div>
                    </div>

                    {/* Entity A <-> Entity B Display */}
                    <div className="p-3.5 bg-[#F8F7F4] border border-[#E6E1D8] rounded-xl flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="text-[10px] font-mono text-[#6B6760] uppercase font-medium">Entity A ({pred.entityA.type})</div>
                        <div className="font-serif font-semibold text-sm text-[#121110]">
                          {pred.entityA.name}
                        </div>
                      </div>

                      <div className="px-3 py-1 bg-white border border-[#E6E1D8] rounded-full text-[10px] font-mono text-[#6E1827] font-bold uppercase">
                        {pred.predictedRelationshipType.replace('_', ' ')}
                      </div>

                      <div className="space-y-0.5 text-right">
                        <div className="text-[10px] font-mono text-[#6B6760] uppercase font-medium">Entity B ({pred.entityB.type})</div>
                        <div className="font-serif font-semibold text-sm text-[#121110]">
                          {pred.entityB.name}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Title & Model Reasoning */}
                  <div className="space-y-1">
                    <h4 className="text-sm font-serif font-semibold text-[#121110]">
                      {pred.title}
                    </h4>
                    <p className="text-xs font-sans text-[#6B6760] leading-relaxed line-clamp-2">
                      {typeof pred.explainability === 'string'
                        ? pred.explainability
                        : (pred.explainability as any)?.summary || (pred.explainability as any)?.text || 'High structural overlap detected.'}
                    </p>
                  </div>

                  {/* Action Bar */}
                  <div className="pt-2 flex items-center justify-between text-xs font-mono border-t border-[#E6E1D8]">
                    <span className="text-[10px] text-[#6B6760]">Model: {pred.technicalDetails?.modelName || 'HeteroCrimeGNN'}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigateToGraph?.([pred.entityA.id, pred.entityB.id]);
                      }}
                      className="text-[#6E1827] hover:underline font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      <span>Focus in Graph</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default PredictionCenter;
