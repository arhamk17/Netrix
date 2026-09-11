import React, { useState, useEffect } from 'react';
import {
  Compass,
  AlertTriangle,
  CheckCircle2,
  FileArchive,
  ArrowRight,
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Layers,
  GitMerge,
  Loader2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import type { InvestigativeLead, LeadSeverity, LeadType } from '../../types';

interface Props {
  onInspectEvidence: (evidenceId: string) => void;
  onExplainLead: (lead: InvestigativeLead) => void;
}

export const InvestigativeLeads: React.FC<Props> = ({ onInspectEvidence, onExplainLead }) => {
  const { activeCase } = useAuth();
  const [leads, setLeads] = useState<InvestigativeLead[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [generating, setGenerating] = useState<boolean>(false);
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');

  const loadLeads = async () => {
    if (!activeCase) {
      setLoading(false);
      return;
    }
    const caseId = activeCase.id || activeCase.case_id;
    if (!caseId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await api.getLeads(caseId).catch(() => []);
      setLeads(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load leads:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeads();
  }, [activeCase]);

  const handleGenerateLeads = async () => {
    if (!activeCase) return;
    const caseId = activeCase.id || activeCase.case_id;
    if (!caseId) return;
    setGenerating(true);
    try {
      await api.generateLeads(caseId);
      await loadLeads();
    } catch (err: any) {
      alert(err.message || 'Lead generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const filteredLeads = (leads || []).filter(l => {
    const matchesType = typeFilter === 'ALL' || l.lead_type === typeFilter;
    const matchesSev = severityFilter === 'ALL' || l.severity === severityFilter;
    return matchesType && matchesSev;
  });

  const getSeverityBadge = (sev: LeadSeverity) => {
    switch (sev) {
      case 'CRITICAL':
        return 'border-rose-500/50 text-rose-400 bg-rose-950/40';
      case 'HIGH':
        return 'border-amber-500/50 text-amber-400 bg-amber-950/40';
      case 'MEDIUM':
        return 'border-slate-700 text-slate-300 bg-slate-800/40';
      default:
        return 'border-slate-700 text-slate-400 bg-slate-800';
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-tech text-2xl font-bold text-slate-100 uppercase tracking-wide flex items-center gap-2.5">
            <Compass className="w-6 h-6 text-amber-400" />
            <span>ALGORITHMIC INVESTIGATIVE LEADS</span>
          </h2>
          <p className="text-xs font-mono text-slate-400 mt-0.5">
            Automated hypothesis extraction identifying anomalous network hubs, laundering bridges, and covert tunnels
          </p>
        </div>

        <button
          onClick={handleGenerateLeads}
          disabled={generating || !activeCase}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-slate-950 font-mono font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(245,158,11,0.2)] disabled:opacity-50 cursor-pointer"
        >
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
          <span>{generating ? 'SYNTHESIZING LEADS...' : 'RUN HYPOTHESIS ENGINE'}</span>
        </button>
      </div>

      {/* Mandatory Investigative Safety Notice */}
      <div className="rounded-xl border border-amber-500/40 bg-amber-950/20 p-4 font-mono text-xs flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-bold text-amber-300 text-xs">
            INVESTIGATIVE SAFETY DIRECTIVE: LEADS ARE ANALYTICAL HYPOTHESES
          </div>
          <p className="text-[11px] text-slate-300 font-sans leading-relaxed">
            All investigative leads are model-generated statistical correlations, anomalous graph patterns, and hypothesis formulations. They serve as investigative pointers to guide analysts toward verified evidence, observed relationships, and evidentiary corroboration.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-panel rounded-xl p-3 border border-white/10 flex flex-wrap items-center gap-3 font-mono text-xs">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <span className="text-slate-400">LEAD TYPE:</span>
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded bg-[#070C16] border border-slate-800 text-slate-200 text-xs focus:outline-none"
          >
            <option value="ALL">ALL CATEGORIES</option>
            <option value="NETWORK_HUB">NETWORK_HUB</option>
            <option value="HIDDEN_CONNECTION">HIDDEN_CONNECTION</option>
            <option value="TEMPORAL_ANOMALY">TEMPORAL_ANOMALY</option>
            <option value="BEHAVIORAL_SHIFT">BEHAVIORAL_SHIFT</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400">SEVERITY:</span>
          <select
            value={severityFilter}
            onChange={e => setSeverityFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded bg-[#070C16] border border-slate-800 text-slate-200 text-xs focus:outline-none"
          >
            <option value="ALL">ALL SEVERITIES</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
          </select>
        </div>

        <div className="ml-auto text-slate-400 text-[11px]">
          SHOWING {filteredLeads.length} OF {leads.length} LEADS
        </div>
      </div>

      {/* Leads Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 text-amber-400 font-mono text-xs gap-3">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p>LOADING INVESTIGATIVE LEADS...</p>
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="p-8 rounded-2xl border border-dashed border-slate-800 text-center font-mono text-xs text-slate-500 space-y-2">
          <Compass className="w-8 h-8 text-slate-600 mx-auto" />
          <p>No investigative leads found for the active case.</p>
          <p className="text-[11px] text-slate-600">Click &quot;RUN HYPOTHESIS ENGINE&quot; above to synthesize leads based on case graph data and anomalies.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredLeads.map(lead => (
            <div
              key={lead.lead_id}
              className="glass-panel rounded-2xl p-5 border border-white/10 hover:border-amber-500/40 transition-all font-mono text-xs space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded border border-amber-500/40 text-amber-300 bg-amber-950/30">
                      {lead.lead_type}
                    </span>
                    <span className="font-bold text-slate-300">{lead.lead_id}</span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getSeverityBadge(lead.severity)}`}>
                    {lead.severity}
                  </span>
                </div>

                {/* Title & Explanation */}
                <div>
                  <h3 className="font-tech text-base font-bold text-slate-100">
                    {lead.title}
                  </h3>
                  <p className="text-slate-300 font-sans text-xs leading-relaxed mt-1">
                    {lead.explanation}
                  </p>
                </div>

                {/* Contributing Signals */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
                    CONTRIBUTING SIGNALS:
                  </span>
                  <div className="space-y-1">
                    {(lead.contributing_signals || []).map(signal => (
                      <div
                        key={signal}
                        className="text-[11px] text-slate-300 flex items-start gap-1.5"
                      >
                        <span className="text-amber-400 mt-0.5">▪</span>
                        <span>{signal}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Involved Entities */}
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
                    INVOLVED ENTITIES:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {(lead.entities_involved || []).map(ent => (
                      <span
                        key={ent}
                        className="px-2 py-0.5 rounded bg-[#070D18] border border-slate-800 text-rose-300 text-[10px]"
                      >
                        {ent}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom Actions & Evidence Links */}
              <div className="pt-3 border-t border-white/[0.06] space-y-3">
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500">CONFIDENCE:</span>
                    <span className="font-bold text-amber-400">
                      {((lead.confidence_score ?? 0.85) * 100).toFixed(0)}% GAUGE
                    </span>
                  </div>

                  {/* Evidence Reference Chips */}
                  <div className="flex items-center gap-1">
                    {(lead.evidence_ids || []).map(evId => (
                      <button
                        key={evId}
                        onClick={() => onInspectEvidence(evId)}
                        className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border border-red-900/40 text-rose-300 hover:bg-red-950/40 cursor-pointer"
                        title="Inspect Evidence in Integrity Vault"
                      >
                        <FileArchive className="w-3 h-3" />
                        <span>{evId}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => onExplainLead(lead)}
                  className="w-full py-2 rounded-lg border border-red-900/40 bg-red-950/30 hover:bg-red-900/40 text-rose-300 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <GitMerge className="w-3.5 h-3.5" />
                  <span>TRACE REASONING CHAIN &amp; PROVENANCE</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
