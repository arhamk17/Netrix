import React, { useEffect, useState } from 'react';
import {
  Lightbulb,
  AlertTriangle,
  ArrowRight,
  Network,
  FileText,
  Clock,
  Search,
  Filter,
  ShieldAlert,
  ChevronRight,
  Sparkles,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { apiClient } from '../api/client';
import { InvestigativeLead, PredictionEngineResult, Case } from '../types';

interface LeadsProps {
  activeCase?: Case | null;
  onNavigateToGraph?: (entityIds?: string[]) => void;
  onNavigateToEvidence?: (evidenceName?: string) => void;
  onTrackConnection?: (prediction: PredictionEngineResult) => void;
  onSelectEntity?: (entityId: string) => void;
}

export const Leads: React.FC<LeadsProps> = ({
  activeCase,
  onNavigateToGraph,
  onNavigateToEvidence,
  onTrackConnection,
  onSelectEntity
}) => {
  const [leads, setLeads] = useState<InvestigativeLead[]>([]);
  const [predictions, setPredictions] = useState<PredictionEngineResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    loadData();
  }, [activeCase?.id]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      let targetCaseId = activeCase?.id;
      if (!targetCaseId) {
        const cases = await apiClient.cases.list();
        if (cases.length > 0) targetCaseId = cases[0].id;
      }

      const [leadsData, predsData] = await Promise.all([
        targetCaseId ? apiClient.leads.list(targetCaseId) : Promise.resolve([]),
        targetCaseId ? apiClient.predictions.list(targetCaseId) : Promise.resolve([])
      ]);
      setLeads(leadsData);
      setPredictions(predsData);
    } catch (err: any) {
      setError(err.message || 'Failed to load investigative intelligence leads.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateLeads = async () => {
    if (!activeCase?.id) {
      setError('Please select an active case to run investigative lead generation.');
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      await apiClient.leads.generate(activeCase.id);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to generate algorithmic investigative leads.');
    } finally {
      setGenerating(false);
    }
  };

  const filteredLeads = leads.filter(lead => {
    const matchesSearch =
      lead.explanation.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.entitiesInvolved.some(e => e.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = typeFilter === 'all' || lead.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-[#6E1827] bg-[#6E1827]/10 border-[#6E1827]/30';
      case 'high':
        return 'text-amber-800 bg-amber-50 border-amber-200';
      default:
        return 'text-[#6B6760] bg-[#F7F5F0] border-[#E2DDD5]';
    }
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-7xl mx-auto">
      {/* Module Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E2DDD5]">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono tracking-widest text-[#6E1827] uppercase font-semibold">
            <span>Pattern recognition</span>
            <span>·</span>
            <span>Hypothesis prioritization</span>
          </div>
          <h1 className="text-3xl font-serif font-normal tracking-tight text-[#121110]">
            Investigation Leads
          </h1>
          <p className="text-sm text-[#6B6760] font-sans mt-1">
            Algorithmic leads highlighting structural anomalies, communication surges, and latent criminal associations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerateLeads}
            disabled={generating || loading || !activeCase}
            className="px-3.5 py-2 bg-[#6E1827] hover:bg-[#58131F] text-white text-xs font-mono rounded-[2px] flex items-center gap-1.5 transition-colors disabled:opacity-50"
            title="Execute algorithmic lead discovery on active case graph"
          >
            {generating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>{generating ? 'Generating Leads...' : 'Generate Leads'}</span>
          </button>

          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-[#6B6760] hover:text-[#121110] bg-white border border-[#E2DDD5] rounded-[2px] transition-colors disabled:opacity-50"
            title="Refresh Leads"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#6E1827]' : ''}`} />
          </button>

          <div className="text-xs font-mono text-[#6B6760] bg-white border border-[#E2DDD5] px-3.5 py-2 rounded-[2px] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#6E1827]" />
            <span>{leads.length} leads generated</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-[2px] text-xs font-mono text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={loadData} className="underline hover:text-red-900 ml-4">Retry</button>
        </div>
      )}

      {/* Compliance Disclaimer Notice */}
      <div className="p-4 bg-[#F7F5F0] border border-[#E2DDD5] rounded-[2px] flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-[#6E1827] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="text-xs font-mono font-medium text-[#121110] uppercase tracking-wide">
            Investigative Notice
          </div>
          <p className="text-xs text-[#6B6760] leading-relaxed font-sans">
            All items produced by NETRIX are investigative leads, hypotheses, and analytical pointers for prioritization. They do not constitute proof of criminal involvement. All conclusions must be verified against primary evidence and corroborated through legal process.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative max-w-sm w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6760]" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search leads, entities, explanations..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-[#E2DDD5] rounded-[2px] text-xs font-mono text-[#121110] placeholder-[#6B6760] focus:outline-none focus:border-[#6E1827]"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-mono text-[#6B6760] mr-1">Filter:</span>
          {['all', 'hidden_relationship', 'financial_anomaly', 'communication_surge'].map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 text-xs font-mono rounded-[2px] transition-colors ${
                typeFilter === t
                  ? 'bg-[#121110] text-white'
                  : 'bg-white border border-[#E2DDD5] text-[#6B6760] hover:text-[#121110] hover:bg-[#F7F5F0]'
              }`}
            >
              {t.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Leads List */}
      {loading ? (
        <div className="p-12 text-center text-xs font-mono text-[#6B6760] bg-white border border-[#E2DDD5] rounded-[2px]">
          Loading investigation leads...
        </div>
      ) : error ? (
        <div className="p-4 bg-[#6E1827]/5 border border-[#6E1827]/20 text-xs text-[#6E1827] rounded-[2px]">
          {error}
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="p-8 text-center text-xs font-mono text-[#6B6760] bg-white border border-[#E2DDD5] rounded-[2px]">
          No matching investigative leads located.
        </div>
      ) : (
        <div className="space-y-6">
          {filteredLeads.map(lead => {
            const correspondingPred = predictions.find(
              p => lead.entitiesInvolved.some(e => e === p.entityA.id || e === p.entityB.id)
            ) || predictions[0];

            return (
              <div
                key={lead.id}
                className="bg-white border border-[#E2DDD5] p-6 rounded-[2px] space-y-5 hover:border-[#C8C3BA] transition-colors"
              >
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#E2DDD5]">
                  <div className="flex items-center gap-2.5">
                    <span className="text-[10px] font-mono tracking-widest text-[#6E1827] uppercase font-semibold">
                      Investigation Lead
                    </span>
                    <span className="text-[11px] font-mono text-[#6B6760]">·</span>
                    <span className="text-xs font-mono text-[#6B6760]">
                      ID: {lead.id}
                    </span>
                    <span className={`text-[10px] font-mono uppercase px-2 py-0.5 border rounded-[2px] font-medium ${getSeverityBadge(lead.severity)}`}>
                      {lead.severity} severity
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-mono text-[#6B6760]">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#6B6760]" />
                      <span>{new Date(lead.createdAt).toLocaleDateString()}</span>
                    </span>
                    <span className="text-[#6E1827] font-medium tabular-nums">
                      {(lead.confidence * 100).toFixed(0)}% confidence
                    </span>
                  </div>
                </div>

                {/* Main Entities & Pattern */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Column 1: Entities Involved */}
                  <div className="space-y-2">
                    <div className="text-[10px] font-mono text-[#6B6760] uppercase tracking-wider">
                      Entities Involved
                    </div>
                    <div className="p-3 bg-[#F7F5F0] border border-[#E2DDD5] rounded-[2px] space-y-2">
                      <div className="text-xs font-medium text-[#121110] font-sans">
                        {lead.type === 'hidden_relationship'
                          ? 'Potential Hidden Association'
                          : lead.type.replace('_', ' ')}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {lead.entitiesInvolved.map((eId, idx) => (
                          <button
                            key={idx}
                            onClick={() => onSelectEntity?.(eId)}
                            className="px-2 py-1 bg-white border border-[#E2DDD5] text-xs font-mono text-[#121110] hover:text-[#6E1827] rounded-[2px] hover:border-[#C8C3BA] transition-colors"
                          >
                            {eId}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Column 2: Reason & Explanation */}
                  <div className="lg:col-span-2 space-y-2">
                    <div className="text-[10px] font-mono text-[#6B6760] uppercase tracking-wider">
                      Investigative Reason
                    </div>
                    <p className="text-xs text-[#121110] leading-relaxed font-sans">
                      {lead.explanation}
                    </p>
                  </div>
                </div>

                {/* Contributing Signals & Supporting Evidence */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="p-3.5 bg-[#F7F5F0] border border-[#E2DDD5] rounded-[2px] space-y-1.5">
                    <div className="text-[10px] font-mono text-[#6B6760] uppercase tracking-wider">
                      Detected Signals ({lead.contributingSignals.length})
                    </div>
                    <ul className="text-xs text-[#121110] space-y-1 list-disc list-inside font-sans">
                      {lead.contributingSignals.map((sig, idx) => (
                        <li key={idx} className="leading-snug">
                          {sig}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3.5 bg-[#F7F5F0] border border-[#E2DDD5] rounded-[2px] space-y-1.5">
                    <div className="text-[10px] font-mono text-[#6B6760] uppercase tracking-wider">
                      Supporting Evidence Records
                    </div>
                    <div className="space-y-1">
                      {lead.supportingEvidence.map((ev, idx) => (
                        <button
                          key={idx}
                          onClick={() => onNavigateToEvidence?.(ev)}
                          className="flex items-center gap-2 text-xs font-mono text-[#121110] hover:text-[#6E1827] transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5 text-[#6E1827]" />
                          <span>{ev}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Actions: VIEW NETWORK, VIEW EVIDENCE, TRACK CONNECTION */}
                <div className="pt-3 border-t border-[#E2DDD5] flex flex-wrap items-center justify-end gap-2">
                  {correspondingPred && (
                    <button
                      onClick={() => onTrackConnection?.(correspondingPred)}
                      className="px-4 py-2 bg-[#6E1827] text-white text-xs font-mono font-medium rounded-[2px] hover:bg-[#4E101B] transition-colors flex items-center gap-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#6E1827]"
                    >
                      <span>Track Connection</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    onClick={() => onNavigateToGraph?.(lead.entitiesInvolved)}
                    className="px-4 py-2 bg-white border border-[#E2DDD5] text-xs font-mono text-[#121110] rounded-[2px] hover:bg-[#F0ECE4] transition-colors flex items-center gap-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#6E1827]"
                  >
                    <Network className="w-3.5 h-3.5" />
                    <span>View Network</span>
                  </button>

                  <button
                    onClick={() => onNavigateToEvidence?.(lead.supportingEvidence[0])}
                    className="px-4 py-2 bg-white border border-[#E2DDD5] text-xs font-mono text-[#121110] rounded-[2px] hover:bg-[#F0ECE4] transition-colors flex items-center gap-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#6E1827]"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>View Evidence</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
