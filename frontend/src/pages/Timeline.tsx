import React, { useState, useEffect } from 'react';
import {
  Clock,
  Filter,
  FileText,
  Network,
  Cpu,
  ShieldCheck,
  Search,
  ArrowRight,
  Calendar,
  AlertCircle,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { apiClient } from '../api/client';
import { Case } from '../types';

interface TimelineProps {
  activeCase?: Case | null;
  onNavigateToGraph?: (entityIds?: string[]) => void;
  onNavigateToEvidence?: (evidenceName?: string) => void;
  onSelectEntity?: (entityId: string) => void;
}

interface TimelineEvent {
  id: string;
  timestamp: string;
  category: 'evidence' | 'entity' | 'relationship' | 'ai_prediction' | 'lead' | 'verification';
  title: string;
  description: string;
  evidenceRef?: string;
  entitiesInvolved?: string[];
  severity?: 'normal' | 'high' | 'critical';
}

export const Timeline: React.FC<TimelineProps> = ({
  activeCase,
  onNavigateToGraph,
  onNavigateToEvidence,
  onSelectEntity
}) => {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadTimeline();
  }, [activeCase?.id]);

  const loadTimeline = async () => {
    setLoading(true);
    setError(null);
    try {
      const liveEvents = await apiClient.timeline.getEvents(activeCase?.id);
      if (liveEvents && liveEvents.length > 0) {
        const mapped: TimelineEvent[] = liveEvents.map((ev: any, idx: number) => {
          const type = (ev.eventType || '').toUpperCase();
          let cat: TimelineEvent['category'] = 'relationship';
          if (type.includes('EVIDENCE') || ev.evidenceId) cat = 'evidence';
          else if (type.includes('PREDICTION') || type.includes('GNN')) cat = 'ai_prediction';
          else if (type.includes('LEAD')) cat = 'lead';
          else if (type.includes('VERIF') || type.includes('SHA')) cat = 'verification';

          const entities = [ev.sourceEntity, ev.targetEntity].filter(Boolean);

          return {
            id: ev.id || `evt-${idx}`,
            timestamp: ev.timestamp ? new Date(ev.timestamp).toUTCString() : 'Time Unspecified',
            category: cat,
            title: `${ev.sourceEntity} → ${ev.eventType?.replace(/_/g, ' ') || 'INTERACTED'} → ${ev.targetEntity}`,
            description: ev.description || `Temporal event recorded with confidence ${(ev.confidence * 100).toFixed(0)}%.`,
            evidenceRef: ev.evidenceId ? `Evidence ID: ${ev.evidenceId}` : undefined,
            entitiesInvolved: entities.length > 0 ? entities : undefined,
            severity: ev.confidence > 0.85 ? 'high' : 'normal'
          };
        });
        setEvents(mapped);
      } else {
        setEvents([]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load chronological timeline.');
    } finally {
      setLoading(false);
    }
  };

  const getCategoryIcon = (category: TimelineEvent['category']) => {
    switch (category) {
      case 'evidence':
        return FileText;
      case 'entity':
        return Network;
      case 'relationship':
        return Network;
      case 'ai_prediction':
        return Cpu;
      case 'lead':
        return AlertCircle;
      case 'verification':
        return ShieldCheck;
    }
  };

  const filteredEvents = events.filter(evt => {
    const matchesCategory = selectedCategory === 'all' || evt.category === selectedCategory;
    const matchesSearch =
      evt.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      evt.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (evt.evidenceRef && evt.evidenceRef.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-8 animate-fade-in max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E2DDD5]">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono tracking-widest text-[#6E1827] uppercase font-semibold">
            <span>Chronological correlation</span>
            <span>·</span>
            <span>Temporal event log</span>
          </div>
          <h1 className="text-3xl font-serif font-normal tracking-tight text-[#121110]">
            Investigation Timeline
          </h1>
          <p className="text-sm text-[#6B6760] font-sans mt-1">
            Chronological audit trail of evidence ingestion, entity discoveries, relational mapping, and local ML predictions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadTimeline}
            disabled={loading}
            className="text-xs font-mono text-[#6B6760] hover:text-[#121110] bg-white border border-[#E2DDD5] px-3 py-2 rounded-[2px] flex items-center gap-1.5 transition-colors disabled:opacity-50"
            title="Refresh Timeline"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#6E1827]' : ''}`} />
            <span>Sync</span>
          </button>
          <div className="text-xs font-mono text-[#6B6760] bg-white border border-[#E2DDD5] px-3.5 py-2 rounded-[2px] flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#6E1827]" />
            <span>{filteredEvents.length} chronicled events</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-[2px] text-xs font-mono text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={loadTimeline} className="underline hover:text-red-900 ml-4">Retry</button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative max-w-sm w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6760]" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search chronological events..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-[#E2DDD5] rounded-[2px] text-xs font-mono text-[#121110] placeholder-[#6B6760] focus:outline-none focus:border-[#6E1827]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'all', label: 'All' },
            { id: 'evidence', label: 'Evidence' },
            { id: 'entity', label: 'Entities' },
            { id: 'relationship', label: 'Relations' },
            { id: 'ai_prediction', label: 'AI Predictions' },
            { id: 'lead', label: 'Leads' },
            { id: 'verification', label: 'Verification' }
          ].map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 text-xs font-mono rounded-[2px] transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-[#121110] text-white'
                  : 'bg-white border border-[#E2DDD5] text-[#6B6760] hover:text-[#121110] hover:bg-[#F7F5F0]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline Content */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-6 h-6 animate-spin text-[#6E1827]" />
          <p className="text-xs font-mono text-[#6B6760]">Reconstructing chronological audit trail...</p>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="p-12 text-center bg-white border border-dashed border-[#E2DDD5] rounded-[2px] space-y-2">
          <Clock className="w-8 h-8 text-[#6B6760] mx-auto opacity-40" />
          <p className="text-sm font-serif text-[#121110]">No chronological events found</p>
          <p className="text-xs font-mono text-[#6B6760]">
            {searchQuery ? 'Try adjusting your search criteria or filter.' : 'Temporal records will appear as evidence and relationships are ingested.'}
          </p>
        </div>
      ) : (
        <div className="relative pl-8 space-y-8 before:absolute before:left-3 before:top-3 before:bottom-3 before:w-px before:bg-[#E2DDD5]">
          {filteredEvents.map(evt => {
            const Icon = getCategoryIcon(evt.category);
            const isPrediction = evt.category === 'ai_prediction';
            const isCritical = evt.severity === 'critical';

            return (
              <div key={evt.id} className="relative group">
                {/* Timeline Pin */}
                <div
                  className={`absolute -left-8 top-1 w-6 h-6 rounded-full border-2 flex items-center justify-center text-white ${
                    isCritical || isPrediction
                      ? 'bg-[#6E1827] border-white'
                      : 'bg-[#121110] border-white'
                  }`}
                >
                  <Icon className="w-3 h-3 text-white" />
                </div>

                {/* Event Content Card */}
                <div className="p-5 bg-white border border-[#E2DDD5] rounded-[2px] space-y-2 hover:border-[#C8C3BA] transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-[#E2DDD5]">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono tracking-widest text-[#6E1827] uppercase font-semibold">
                      {evt.category.replace('_', ' ')}
                    </span>
                    {evt.severity && (
                      <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 bg-[#6E1827]/10 text-[#6E1827] border border-[#6E1827]/20 rounded-[2px]">
                        {evt.severity}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-mono text-[#6B6760]">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{evt.timestamp}</span>
                  </div>
                </div>

                <h3 className="text-base font-serif font-normal text-[#121110]">
                  {evt.title}
                </h3>

                <p className="text-xs text-[#6B6760] leading-relaxed font-sans">
                  {evt.description}
                </p>

                {/* Auxiliary Links (Evidence or Graph) */}
                <div className="pt-2 flex flex-wrap items-center gap-3 text-xs font-mono">
                  {evt.evidenceRef && (
                    <button
                      onClick={() => onNavigateToEvidence?.(evt.evidenceRef)}
                      className="text-[#6E1827] hover:underline flex items-center gap-1"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>{evt.evidenceRef}</span>
                    </button>
                  )}

                  {evt.entitiesInvolved && (
                    <button
                      onClick={() => onNavigateToGraph?.(evt.entitiesInvolved)}
                      className="text-[#121110] hover:text-[#6E1827] flex items-center gap-1"
                    >
                      <Network className="w-3.5 h-3.5" />
                      <span>View in Graph ({evt.entitiesInvolved.join(', ')})</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        </div>
      )}
    </div>
  );
};
