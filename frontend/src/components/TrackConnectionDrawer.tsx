import React, { useState } from 'react';
import { X, Network, FileText, ArrowRight, ShieldAlert, Clock, Phone, Building2, MapPin, Calendar, CheckCircle2 } from 'lucide-react';
import { PredictionEngineResult, Entity, Relationship, Evidence } from '../types';

interface TrackConnectionDrawerProps {
  prediction: PredictionEngineResult | null;
  onClose: () => void;
  onOpenInGraph: (entityIds: string[]) => void;
  onViewEvidence: (evidenceName: string) => void;
  onSelectEntity: (entityId: string) => void;
  onOpenTimeline: () => void;
}

export const TrackConnectionDrawer: React.FC<TrackConnectionDrawerProps> = ({
  prediction,
  onClose,
  onOpenInGraph,
  onViewEvidence,
  onSelectEntity,
  onOpenTimeline
}) => {
  const [activeStepTab, setActiveStepTab] = useState<'pathway' | 'evidence' | 'timeline'>('pathway');

  if (!prediction) return null;

  // Dynamically compute hops from real prediction entity endpoints
  const hops = [
    {
      step: 1,
      entityId: prediction.entityA.id,
      name: prediction.entityA.name,
      type: prediction.entityA.type,
      role: 'Source Entity',
      detail: `Identified candidate endpoint for relational linkage with ${prediction.entityB.name}.`,
      icon: Building2
    },
    {
      step: 2,
      entityId: `${prediction.entityA.id}-${prediction.entityB.id}-nexus`,
      name: `Latent Conduit (${prediction.predictedRelationshipType.replace(/_/g, ' ')})`,
      type: 'predicted_connection',
      role: 'Neural Link Prediction',
      detail: prediction.description || prediction.explainability || 'High structural and topological overlap detected across case graph.',
      icon: Phone
    },
    {
      step: 3,
      entityId: prediction.entityB.id,
      name: prediction.entityB.name,
      type: prediction.entityB.type,
      role: 'Target Entity',
      detail: `Target endpoint correlated with ${prediction.entityA.name} by ${prediction.technicalDetails?.modelName || 'HeteroCrimeGNN'}.`,
      icon: CheckCircle2
    }
  ];

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[560px] bg-white border-l border-[#E2DDD5] shadow-xl flex flex-col justify-between overflow-hidden animate-fade-in">
      {/* Drawer Header */}
      <div className="p-6 border-b border-[#E2DDD5] bg-[#F7F5F0] space-y-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono tracking-widest text-[#6E1827] uppercase font-semibold px-2 py-0.5 bg-[#FAF1F2] border border-[#6E1827]/20 rounded-[2px]">
                Tracking Connection Pathway
              </span>
              <span className="text-[11px] font-mono text-[#6B6760] tabular-nums">
                Confidence: {(prediction.confidence * 100).toFixed(0)}%
              </span>
            </div>
            <h2 className="text-lg font-serif font-normal text-[#121110] tracking-tight">
              {prediction.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#6B6760] hover:text-[#121110] rounded-[2px] transition-colors"
            title="Close Connection Tracker"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Connection Entities Banner */}
        <div className="p-3 bg-white border border-[#E2DDD5] rounded-[2px] flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="font-medium text-[#121110] font-sans">{prediction.entityA.name}</span>
            <span className="text-[#6E1827] font-bold">↔</span>
            <span className="font-medium text-[#121110] font-sans">{prediction.entityB.name}</span>
          </div>
          <span className="text-[#6E1827] text-[11px] font-semibold">
            {prediction.predictedRelationshipType.replace(/_/g, ' ')}
          </span>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1 border-b border-[#E2DDD5] pt-2">
          <button
            onClick={() => setActiveStepTab('pathway')}
            className={`px-3 py-1.5 text-xs font-sans transition-colors ${
              activeStepTab === 'pathway'
                ? 'border-b-2 border-[#6E1827] text-[#6E1827] font-semibold'
                : 'text-[#6B6760] hover:text-[#121110]'
            }`}
          >
            Relational Path ({hops.length} Hops)
          </button>
          <button
            onClick={() => setActiveStepTab('evidence')}
            className={`px-3 py-1.5 text-xs font-sans transition-colors ${
              activeStepTab === 'evidence'
                ? 'border-b-2 border-[#6E1827] text-[#6E1827] font-semibold'
                : 'text-[#6B6760] hover:text-[#121110]'
            }`}
          >
            Supporting Evidence ({prediction.supportingEvidence.length})
          </button>
          <button
            onClick={() => setActiveStepTab('timeline')}
            className={`px-3 py-1.5 text-xs font-sans transition-colors ${
              activeStepTab === 'timeline'
                ? 'border-b-2 border-[#6E1827] text-[#6E1827] font-semibold'
                : 'text-[#6B6760] hover:text-[#121110]'
            }`}
          >
            Temporal Correlation
          </button>
        </div>
      </div>

      {/* Drawer Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* TAB 1: RELATIONAL PATHWAY */}
        {activeStepTab === 'pathway' && (
          <div className="space-y-6">
            <div className="space-y-1">
              <h3 className="text-xs font-mono text-[#6B6760] tracking-wider uppercase font-semibold">
                Investigation Trail
              </h3>
              <p className="text-xs text-[#6B6760] font-sans">
                Algorithmic graph correlation identifying latent link pathways between target endpoints.
              </p>
            </div>

            {/* Stepped Timeline Trail */}
            <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-[#E2DDD5]">
              {hops.map((hop, idx) => {
                const isFirst = idx === 0;
                const isLast = idx === hops.length - 1;
                return (
                  <div key={hop.step} className="relative group">
                    {/* Node bead on the vertical line */}
                    <div
                      className={`absolute -left-6 top-1 w-4 h-4 rounded-full border-2 flex items-center justify-center text-[9px] font-mono ${
                        isFirst || isLast
                          ? 'bg-[#6E1827] border-white text-white'
                          : 'bg-white border-[#E2DDD5] text-[#121110]'
                      }`}
                    >
                      {hop.step}
                    </div>

                    <div className="p-3.5 bg-[#F7F5F0] border border-[#E2DDD5] rounded-[2px] space-y-1.5 hover:border-[#C8C3BA] transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-[#6E1827] uppercase tracking-wider font-semibold">
                          {hop.role}
                        </span>
                        <span className="text-[10px] font-mono text-[#6B6760] uppercase">
                          Type: {hop.type}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => onSelectEntity(hop.entityId)}
                          className="text-sm font-medium text-[#121110] hover:text-[#6E1827] text-left transition-colors font-sans"
                        >
                          {hop.name}
                        </button>
                        {!hop.entityId.includes('nexus') && (
                          <button
                            onClick={() => onSelectEntity(hop.entityId)}
                            className="text-[11px] font-mono text-[#6B6760] hover:text-[#121110]"
                          >
                            Inspect Entity →
                          </button>
                        )}
                      </div>

                      <p className="text-xs text-[#6B6760] leading-relaxed font-sans">
                        {hop.detail}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Contributing Signals */}
            <div className="p-4 bg-[#F7F5F0] border border-[#E2DDD5] rounded-[2px] space-y-2">
              <div className="text-xs font-mono text-[#121110] font-semibold uppercase tracking-wide">
                Model Graph Signals Detected
              </div>
              <ul className="text-xs text-[#6B6760] space-y-1.5 list-disc list-inside font-sans">
                {prediction.contributingGraphSignals.map((sig, i) => (
                  <li key={i} className="leading-relaxed">
                    <span className="text-[#121110]">{sig}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* TAB 2: SUPPORTING EVIDENCE */}
        {activeStepTab === 'evidence' && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-xs font-mono text-[#6B6760] tracking-wider uppercase font-semibold">
                Forensic Artifacts Anchoring This Prediction
              </h3>
              <p className="text-xs text-[#6B6760] font-sans">
                Documentary evidence containing entity co-occurrences and communications.
              </p>
            </div>

            {prediction.supportingEvidence.length > 0 ? (
              <div className="space-y-3">
                {prediction.supportingEvidence.map((evItem, idx) => (
                  <div
                    key={idx}
                    className="p-4 bg-[#F7F5F0] border border-[#E2DDD5] rounded-[2px] space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-[#6E1827]" />
                        <span className="text-xs font-mono font-medium text-[#121110]">
                          {evItem}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-[2px] border border-emerald-200">
                        Registered Evidence
                      </span>
                    </div>
                    <div className="pt-1 flex items-center justify-end">
                      <button
                        onClick={() => onViewEvidence(evItem)}
                        className="text-xs font-mono text-[#6E1827] hover:underline flex items-center gap-1 font-medium"
                      >
                        <span>Open in Evidence Module</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 bg-[#F7F5F0] border border-[#E2DDD5] rounded-[2px] text-xs font-mono text-[#6B6760] text-center">
                No direct evidence artifacts registered for this unobserved link candidate.
              </div>
            )}
          </div>
        )}

        {/* TAB 3: TIMELINE CORRELATION */}
        {activeStepTab === 'timeline' && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-xs font-mono text-[#6B6760] tracking-wider uppercase font-semibold">
                Temporal Event Sequence
              </h3>
              <p className="text-xs text-[#6B6760] font-sans">
                Chronological sequence correlating activity between these entities.
              </p>
            </div>

            {prediction.timelineEvents.length > 0 ? (
              <div className="border border-[#E2DDD5] rounded-[2px] divide-y divide-[#E2DDD5] text-xs font-mono">
                {prediction.timelineEvents.map((evt, idx) => (
                  <div key={idx} className="p-3 space-y-1 hover:bg-[#F7F5F0] transition-colors">
                    <div className="flex items-center justify-between text-[#6E1827]">
                      <span className="font-semibold flex items-center gap-1.5">
                        <Clock className="w-3 h-3" />
                        <span>{evt.date}</span>
                      </span>
                      {evt.evidenceRef && (
                        <span className="text-[10px] text-[#6B6760]">
                          Ref: {evt.evidenceRef}
                        </span>
                      )}
                    </div>
                    <p className="text-[#121110] font-sans text-xs leading-relaxed">
                      {evt.event}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 bg-[#F7F5F0] border border-[#E2DDD5] rounded-[2px] text-xs font-mono text-[#6B6760] text-center">
                No specific timestamps recorded for this predicted conduit.
              </div>
            )}

            <div className="pt-2">
              <button
                onClick={onOpenTimeline}
                className="w-full py-2.5 border border-[#E2DDD5] text-xs font-mono text-[#121110] rounded-[2px] hover:bg-[#121110] hover:text-white transition-colors"
              >
                Inspect Full Investigation Timeline →
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Drawer Footer Actions */}
      <div className="p-4 border-t border-[#E2DDD5] bg-[#F7F5F0] flex items-center gap-3">
        <button
          onClick={() => onOpenInGraph([prediction.entityA.id, prediction.entityB.id])}
          className="flex-1 py-3 bg-[#6E1827] text-white text-xs font-mono font-medium rounded-[2px] hover:bg-[#4E101B] transition-colors flex items-center justify-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#6E1827]"
        >
          <Network className="w-3.5 h-3.5" />
          <span>Open Pathway in 3D Knowledge Graph</span>
        </button>
      </div>
    </div>
  );
};
