import React from 'react';
import { motion } from 'framer-motion';
import { X, Network, FileText, ArrowRight, ShieldAlert } from 'lucide-react';
import { Entity, Relationship, Evidence, PredictionEngineResult } from '../types';

interface EntityInspectorDrawerProps {
  entity: Entity | null;
  onClose: () => void;
  relationships?: Relationship[];
  evidenceList?: Evidence[];
  predictions?: PredictionEngineResult[];
  onViewOnGraph?: (entityId: string) => void;
  onOpenInGraph?: () => void;
  onViewEvidence?: (evidenceId: string) => void;
  onTrackConnection?: (prediction: PredictionEngineResult) => void;
}

export const EntityInspectorDrawer: React.FC<EntityInspectorDrawerProps> = ({
  entity,
  onClose,
  relationships = [],
  evidenceList = [],
  predictions = [],
  onViewOnGraph,
  onOpenInGraph,
  onViewEvidence,
  onTrackConnection
}) => {
  if (!entity) return null;

  const handleOpenGraph = () => {
    if (onOpenInGraph) onOpenInGraph();
    else if (onViewOnGraph) onViewOnGraph(entity.id);
  };

  // Filter connected relationships
  const connectedRels = relationships.filter(
    r => r.source === entity.id || r.target === entity.id
  );

  // Filter relevant predictions
  const relevantPredictions = predictions.filter(
    p => p.entityA.id === entity.id || p.entityB.id === entity.id || p.entitiesInvolved.includes(entity.label)
  );

  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'person': return 'text-[#121110] border-[#E2DDD5] bg-[#F7F5F0]';
      case 'organization': return 'text-[#6E1827] border-[#6E1827]/20 bg-[#FAF1F2]';
      case 'phone': return 'text-[#6E1827] border-[#6E1827]/20 bg-[#FAF1F2]';
      default: return 'text-[#6B6760] border-[#E2DDD5] bg-[#F7F5F0]';
    }
  };

  return (
    <motion.div
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] flex flex-col justify-between overflow-hidden bg-white/70 backdrop-blur-lg border-l border-black/10 shadow-2xl"
    >
      {/* Drawer Header */}
      <div className="p-6 border-b border-[#E2DDD5] flex items-start justify-between bg-white/40 backdrop-blur-xs">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-mono tracking-widest uppercase px-2 py-0.5 border rounded-[2px] font-medium ${getTypeBadgeClass(entity.type)}`}>
              {entity.type}
            </span>
            <span className="text-[11px] font-mono text-[#6B6760]">
              ID: {entity.id}
            </span>
          </div>
          <h2 className="text-xl font-serif font-normal text-[#121110] tracking-tight">
            {entity.label}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-[#6B6760] hover:text-[#121110] rounded-[2px] transition-colors"
          title="Close Inspector"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Drawer Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        
        {/* Network Metrics Bar */}
        <div className="grid grid-cols-4 gap-2 p-3 bg-[#F7F5F0] border border-[#E2DDD5] rounded-[2px] text-center font-mono">
          <div>
            <div className="text-[10px] text-[#6B6760] uppercase">Risk score</div>
            <div className="text-base font-medium text-[#6E1827] tabular-nums">
              {entity.riskScore}%
            </div>
          </div>
          <div>
            <div className="text-[10px] text-[#6B6760] uppercase">Centrality</div>
            <div className="text-base font-medium text-[#121110] tabular-nums">
              {entity.centrality.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-[#6B6760] uppercase">PageRank</div>
            <div className="text-base font-medium text-[#121110] tabular-nums">
              {entity.pagerank.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-[#6B6760] uppercase">Anomaly</div>
            <div className="text-base font-medium text-[#121110] tabular-nums">
              {(entity.anomalyScore * 100).toFixed(0)}%
            </div>
          </div>
        </div>

        {/* Entity Attributes & Properties */}
        <div className="space-y-2">
          <h3 className="text-xs font-mono text-[#6B6760] tracking-wider uppercase font-semibold">
            Entity Properties
          </h3>
          <div className="border border-[#E2DDD5] rounded-[2px] divide-y divide-[#E2DDD5] text-xs font-mono">
            {Object.entries(entity.properties).map(([key, val]) => (
              <div key={key} className="px-3 py-2 flex items-center justify-between">
                <span className="text-[#6B6760]">{key}</span>
                <span className="text-[#121110] font-medium max-w-[240px] truncate text-right">
                  {String(val)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Model-Predicted Connections */}
        {relevantPredictions.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono text-[#6E1827] tracking-wider uppercase flex items-center gap-1.5 font-semibold">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Model-Predicted Links ({relevantPredictions.length})</span>
              </h3>
            </div>
            <div className="space-y-2">
              {relevantPredictions.map(pred => (
                <div
                  key={pred.id}
                  className="p-3.5 bg-[#FAF1F2] border border-[#6E1827]/25 rounded-[2px] space-y-2"
                >
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="font-semibold text-[#6E1827]">
                      {pred.predictedRelationshipType}
                    </span>
                    <span className="text-[#6E1827] font-medium tabular-nums">
                      {(pred.confidence * 100).toFixed(0)}% confidence
                    </span>
                  </div>
                  <p className="text-xs text-[#121110] leading-relaxed font-sans">
                    {pred.description}
                  </p>
                  <div className="pt-1 flex items-center gap-2">
                    <button
                      onClick={() => onTrackConnection?.(pred)}
                      className="px-2.5 py-1 bg-[#6E1827] text-white text-[11px] font-mono rounded-[2px] hover:bg-[#4E101B] transition-colors flex items-center gap-1"
                    >
                      <span>Track Connection</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Connected Relationships */}
        <div className="space-y-2.5">
          <h3 className="text-xs font-mono text-[#6B6760] tracking-wider uppercase font-semibold">
            Direct Network Connections ({connectedRels.length})
          </h3>
          <div className="space-y-2">
            {connectedRels.map(rel => {
              const otherId = rel.source === entity.id ? rel.target : rel.source;
              const isPred = rel.isPredicted;
              return (
                <div
                  key={rel.id}
                  className={`p-3 border rounded-[2px] text-xs space-y-1 ${
                    isPred
                      ? 'border-[#6E1827]/30 bg-[#FAF1F2]'
                      : 'border-[#E2DDD5] bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between font-mono text-[11px]">
                    <span className="font-medium text-[#121110]">
                      {rel.type.replace('_', ' ')}
                    </span>
                    <span className={isPred ? 'text-[#6E1827] font-medium' : 'text-[#6B6760]'}>
                      {isPred ? 'Predicted' : 'Confirmed'} · {(rel.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="text-[#6B6760] text-[11px]">
                    Target Entity ID: <span className="text-[#121110] font-mono">{otherId}</span>
                  </div>
                  {rel.properties.notes && (
                    <p className="text-[#121110] text-xs pt-1 font-sans">
                      {rel.properties.notes}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Supporting Evidence References */}
        <div className="space-y-2.5">
          <h3 className="text-xs font-mono text-[#6B6760] tracking-wider uppercase font-semibold">
            Related Evidence Records
          </h3>
          <div className="space-y-2">
            {evidenceList.slice(0, 3).map(ev => (
              <div
                key={ev.id}
                className="p-3 border border-[#E2DDD5] rounded-[2px] flex items-center justify-between hover:bg-[#F7F5F0] transition-colors"
              >
                <div className="space-y-0.5">
                  <div className="text-xs font-medium text-[#121110] font-sans">{ev.name}</div>
                  <div className="text-[10px] font-mono text-[#6B6760]">
                    SHA-256: {ev.sha256.substring(0, 16)}...
                  </div>
                </div>
                <button
                  onClick={() => onViewEvidence?.(ev.name || ev.id)}
                  className="px-2.5 py-1 text-[11px] font-mono border border-[#E2DDD5] hover:bg-[#121110] hover:text-white rounded-[2px] transition-colors"
                >
                  Inspect
                </button>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Drawer Footer Actions */}
      <div className="p-4 border-t border-[#E2DDD5] bg-[#F7F5F0] flex items-center gap-3">
        <button
          onClick={handleOpenGraph}
          className="flex-1 py-2.5 bg-[#121110] text-white text-xs font-mono font-medium rounded-[2px] hover:bg-[#262524] transition-colors flex items-center justify-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#6E1827]"
        >
          <Network className="w-3.5 h-3.5" />
          <span>Locate in 3D Graph</span>
        </button>
      </div>
    </motion.div>
  );
};
