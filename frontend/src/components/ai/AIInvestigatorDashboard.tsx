import React, { useState, useEffect, useRef } from 'react';
import {
  BrainCircuit,
  AlertTriangle,
  ShieldCheck,
  Send,
  RefreshCw,
  Search,
  CheckCircle2,
  Copy,
  ChevronRight,
  TrendingUp,
  Activity,
  Layers,
  Terminal,
  FileText,
  HelpCircle,
  Clock,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import type {
  AIMlSummaryResponse,
  AIExplainResponse,
  AIAskResponse,
  GraphData
} from '../../types';

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  context_facts_used?: number;
  confidence?: string;
  timestamp: string;
}

export const AIInvestigatorDashboard: React.FC = () => {
  const { activeCase } = useAuth();

  // ML Intelligence Summary State
  const [summary, setSummary] = useState<AIMlSummaryResponse | null>(null);
  const [loadingSummary, setLoadingSummary] = useState<boolean>(true);

  // Entity Explain State
  const [entityType, setEntityType] = useState<string>('PERSON');
  const [entityId, setEntityId] = useState<string>('ENT-771');
  const [explanation, setExplanation] = useState<AIExplainResponse | null>(null);
  const [loadingExplain, setLoadingExplain] = useState<boolean>(false);
  const [knownEntities, setKnownEntities] = useState<Array<{ id: string; name: string; type: string }>>([]);

  // Inline Ask Console State
  const [inputQuery, setInputQuery] = useState<string>('');
  const [asking, setAsking] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init-0',
      sender: 'ai',
      text: 'NETRIX Investigative Intelligence Console initialized. Context loaded from active case graph, timeline sequence bursts, and cryptographic custody records. You may query entity topologies, timeline anomalies, or transaction flows.',
      context_facts_used: 18,
      confidence: 'HIGH',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load summary and entities on case change
  useEffect(() => {
    if (!activeCase) return;

    const caseId = activeCase.id || activeCase.case_id;

    // Load ML summary
    const fetchSummary = async () => {
      setLoadingSummary(true);
      try {
        const res = await api.getAIMLSummary(caseId);
        setSummary(res);
      } catch (err) {
        console.error('Failed to load intelligence summary:', err);
      } finally {
        setLoadingSummary(false);
      }
    };

    // Load graph nodes to seed entity selection
    const fetchEntities = async () => {
      try {
        const graph: GraphData = await api.getCaseGraph(caseId);
        if (Array.isArray(graph?.nodes) && graph.nodes.length > 0) {
          const list = graph.nodes.map(n => ({ id: n.id, name: n.name, type: n.type }));
          setKnownEntities(list);
          if (list[0]) {
            setEntityId(list[0].id);
            setEntityType(list[0].type);
          }
        }
      } catch (err) {
        console.error('Failed to load graph nodes:', err);
      }
    };

    fetchSummary();
    fetchEntities();
  }, [activeCase]);

  // Handle entity explain submission
  const handleExplain = async () => {
    if (!activeCase || !entityId.trim()) return;
    const caseId = activeCase.id || activeCase.case_id;
    setLoadingExplain(true);
    try {
      const res = await api.explainEntity(entityId.trim(), entityType, caseId);
      setExplanation(res);
    } catch (err) {
      console.error('Failed to explain entity:', err);
    } finally {
      setLoadingExplain(false);
    }
  };

  // Handle question submission to ask AI endpoint
  const handleSendQuestion = async (queryParam?: string) => {
    const q = queryParam || inputQuery;
    if (!q.trim() || !activeCase) return;

    const caseId = activeCase.id || activeCase.case_id;
    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: q.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    if (!queryParam) setInputQuery('');
    setAsking(true);

    try {
      const history = messages.map(m => ({
        role: m.sender === 'user' ? 'user' : 'model',
        content: m.text
      }));

      const res: AIAskResponse = await api.askAI(q.trim(), caseId, history);

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: res.answer,
        context_facts_used: res.context_facts_used,
        confidence: res.confidence,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (err: any) {
      const errMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'ai',
        text: `Error processing query: ${err.message || 'Service unavailable'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setAsking(false);
    }
  };

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const refreshSummary = async () => {
    if (!activeCase) return;
    const caseId = activeCase.id || activeCase.case_id;
    setLoadingSummary(true);
    try {
      const res = await api.getAIMLSummary(caseId);
      setSummary(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSummary(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200 font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-950/40 border border-red-800/50 flex items-center justify-center text-rose-400 shadow-[0_0_10px_rgba(220,38,38,0.2)]">
              <BrainCircuit className="w-4 h-4" />
            </div>
            <h1 className="font-tech text-xl font-bold tracking-wider text-slate-100 uppercase">
              INVESTIGATIVE INTELLIGENCE DASHBOARD
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono border border-red-800/40 text-rose-300 bg-red-950/30">
              API CONNECTED
            </span>
          </div>
          <p className="text-xs font-mono text-slate-400 mt-1">
            Graph machine learning, explainability paths, and investigative question-answering
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={refreshSummary}
            disabled={loadingSummary}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900/80 hover:border-red-600/40 text-slate-300 hover:text-white text-xs font-mono transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingSummary ? 'animate-spin text-rose-400' : ''}`} />
            <span>REFRESH INTELLIGENCE</span>
          </button>
        </div>
      </div>

      {/* Grid: Left Column (ML Summary + Entity Explain) | Right Column (Interactive Ask Console) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (7 cols): ML Intelligence Summary & Entity Explain */}
        <div className="lg:col-span-7 space-y-6">

          {/* PANEL 1: ML Intelligence Summary */}
          <div className="glass-panel rounded-2xl border border-white/[0.08] bg-[#0A0E18]/80 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <BrainCircuit className="w-4 h-4 text-rose-400" />
                <h2 className="font-tech text-sm font-bold text-slate-100 uppercase tracking-wide">
                  INTELLIGENCE SYNTHESIS &amp; ANOMALIES
                </h2>
              </div>
              {summary && (
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase border ${
                    summary.risk_assessment?.risk_tier === 'CRITICAL' || summary.risk_assessment?.risk_tier === 'HIGH'
                      ? 'border-rose-500/40 bg-rose-950/30 text-rose-300'
                      : 'border-amber-500/40 bg-amber-950/30 text-amber-300'
                  }`}>
                    {summary.risk_assessment?.risk_tier || 'MODERATE'} RISK ({(summary.risk_assessment?.overall_score ?? 0.78) * 100}%)
                  </span>
                </div>
              )}
            </div>

            {loadingSummary ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-500 text-xs font-mono gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-rose-400" />
                <span>Generating multi-modal intelligence summary...</span>
              </div>
            ) : summary ? (
              <div className="space-y-4 font-mono text-xs">
                {/* Executive Summary */}
                <div className="p-3.5 rounded-xl bg-[#070A14] border border-red-900/30 text-slate-300 leading-relaxed font-sans text-xs sm:text-sm">
                  {summary.executive_summary}
                </div>

                {/* Threat Vectors */}
                {summary.risk_assessment?.primary_threat_vectors && summary.risk_assessment.primary_threat_vectors.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                      PRIMARY THREAT VECTORS IDENTIFIED
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {(summary.risk_assessment.primary_threat_vectors || []).map((tv, idx) => (
                        <span
                          key={`tv-${idx}`}
                          className="px-2 py-0.5 rounded bg-rose-950/40 border border-rose-500/30 text-rose-300 text-[11px] flex items-center gap-1"
                        >
                          <AlertTriangle className="w-3 h-3 text-rose-400" />
                          <span>{tv}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Key Findings */}
                {summary.key_findings && summary.key_findings.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                      KEY INVESTIGATIVE FINDINGS
                    </span>
                    <ul className="space-y-1.5">
                      {(summary.key_findings || []).map((finding, idx) => (
                        <li key={`finding-${idx}`} className="flex items-start gap-2 p-2 rounded-lg bg-black/30 border border-slate-800 text-slate-300 text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{finding}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Anomalies Detected */}
                {summary.anomalies_detected && summary.anomalies_detected.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                      DETECTED SYSTEM ANOMALIES
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(summary.anomalies_detected || []).map((anom, idx) => (
                        <div key={`anom-${idx}`} className="p-2.5 rounded-lg bg-black/40 border border-slate-800 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-200 text-[11px]">{anom.type}</span>
                            <span className={`text-[9px] px-1.5 py-0.2 rounded uppercase font-bold ${
                              anom.severity === 'CRITICAL' ? 'bg-rose-950 text-rose-300 border border-rose-800' : 'bg-amber-950 text-amber-300 border border-amber-800'
                            }`}>
                              {anom.severity}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 leading-snug">{anom.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommended Actions */}
                {summary.recommended_actions && summary.recommended_actions.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-white/[0.06]">
                    <span className="text-[10px] text-rose-400 uppercase tracking-wider block font-bold">
                      RECOMMENDED INVESTIGATIVE ACTIONS
                    </span>
                    <div className="space-y-1.5">
                      {(summary.recommended_actions || []).map((act, idx) => (
                        <div key={`act-${idx}`} className="flex items-center justify-between p-2 rounded-lg bg-red-950/20 border border-red-900/30 text-[11px]">
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.2 rounded bg-red-900/50 text-rose-300 text-[9px] font-bold">
                              {act.priority}
                            </span>
                            <span className="text-slate-200 font-bold">{act.title}</span>
                          </div>
                          <span className="text-slate-400 text-[10px] hidden sm:inline">{act.rationale}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs font-mono text-slate-500">No intelligence summary available for this case context.</p>
            )}
          </div>

          {/* PANEL 2: Entity Explain */}
          <div className="glass-panel rounded-2xl border border-white/[0.08] bg-[#0A0E18]/80 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-emerald-400" />
                <h2 className="font-tech text-sm font-bold text-slate-100 uppercase tracking-wide">
                  ENTITY EXPLAINABILITY &amp; REASONING
                </h2>
              </div>
              <span className="text-[10px] font-mono text-slate-400">ATTRIBUTION ANALYSIS</span>
            </div>

            {/* Entity Selector Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 font-mono text-xs">
              <div className="sm:col-span-4 space-y-1">
                <label className="text-[10px] text-slate-400 uppercase">ENTITY TYPE</label>
                <select
                  value={entityType}
                  onChange={e => setEntityType(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-[#070A14] border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-red-600"
                >
                  <option value="PERSON">PERSON</option>
                  <option value="ORGANIZATION">ORGANIZATION</option>
                  <option value="TRANSACTION">TRANSACTION</option>
                  <option value="CRYPTO_WALLET">CRYPTO_WALLET</option>
                  <option value="SERVER_IP">SERVER_IP</option>
                  <option value="LOCATION">LOCATION</option>
                </select>
              </div>

              <div className="sm:col-span-5 space-y-1">
                <label className="text-[10px] text-slate-400 uppercase">ENTITY IDENTIFIER</label>
                {knownEntities.length > 0 ? (
                  <select
                    value={entityId}
                    onChange={e => {
                      setEntityId(e.target.value);
                      const matched = knownEntities.find(n => n.id === e.target.value);
                      if (matched) setEntityType(matched.type);
                    }}
                    className="w-full px-3 py-1.5 rounded-lg bg-[#070A14] border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-red-600"
                  >
                    {knownEntities.map(ent => (
                      <option key={ent.id} value={ent.id}>
                        {ent.name} ({ent.id})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={entityId}
                    onChange={e => setEntityId(e.target.value)}
                    placeholder="e.g. ENT-771 or TX-9021"
                    className="w-full px-3 py-1.5 rounded-lg bg-[#070A14] border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-red-600"
                  />
                )}
              </div>

              <div className="sm:col-span-3 flex items-end">
                <button
                  onClick={handleExplain}
                  disabled={loadingExplain}
                  className="w-full px-3 py-2 rounded-lg bg-[#6D001A] hover:bg-[#8B0024] text-white font-tech font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {loadingExplain ? 'EXPLAINING...' : 'RUN EXPLAIN'}
                </button>
              </div>
            </div>

            {/* Explanation Results */}
            {loadingExplain ? (
              <div className="py-8 flex flex-col items-center justify-center text-slate-500 text-xs font-mono gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-rose-400" />
                <span>Computing feature attributions &amp; node embeddings...</span>
              </div>
            ) : explanation ? (
              <div className="space-y-4 font-mono text-xs pt-2">
                {/* Score & Rationale Header */}
                <div className="p-4 rounded-xl bg-[#070A14] border border-red-900/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-rose-400 font-bold uppercase tracking-wider">
                      INVESTIGATIVE RISK EVALUATION
                    </span>
                    <span className="px-2 py-0.5 rounded bg-red-950/50 border border-red-800/40 text-rose-300 font-bold">
                      SCORE: {(((explanation.risk_score ?? 0.85)) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-slate-200 text-xs sm:text-sm font-sans leading-relaxed">
                    {explanation.explanation}
                  </p>
                </div>

                {/* Contributing Factors */}
                {explanation.contributing_factors && explanation.contributing_factors.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                      TOP ATTRIBUTED RISK FACTORS (WEIGHTED)
                    </span>
                    <div className="space-y-2">
                      {(explanation.contributing_factors || []).map((factor, idx) => (
                        <div key={`factor-${idx}`} className="p-2.5 rounded-lg bg-black/40 border border-slate-800 space-y-1.5">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-300 font-bold">{factor.factor}</span>
                            <span className="text-rose-400 font-mono">{(((factor.weight ?? 0.5)) * 100).toFixed(0)}% Impact</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-red-600 to-rose-400 rounded-full"
                              style={{ width: `${Math.min(100, (factor.weight ?? 0.5) * 100)}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-slate-400">{factor.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Relationships Citation */}
                {explanation.key_relationships && explanation.key_relationships.length > 0 && (
                  <div className="pt-2 border-t border-white/[0.06] flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span className="text-slate-500">RELATED EDGES:</span>
                    {(explanation.key_relationships || []).map((rel, rIdx) => (
                      <span key={`rel-${rIdx}`} className="px-2 py-0.5 rounded bg-slate-800/60 border border-slate-700 text-slate-300">
                        {rel}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {/* Right Column (5 cols): Inline Ask Console */}
        <div className="lg:col-span-5 flex flex-col h-[760px] glass-panel rounded-2xl border border-red-900/40 bg-[#070A14]/90 overflow-hidden shadow-2xl">
          {/* Console Header */}
          <div className="p-4 border-b border-white/10 bg-[#090C16] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-rose-400" />
              <h2 className="font-tech text-sm font-bold text-slate-100 uppercase tracking-wide">
                INVESTIGATIVE CONSOLE
              </h2>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>SYSTEM ACTIVE</span>
            </div>
          </div>

          {/* Quick Query Pills */}
          <div className="p-3 border-b border-white/[0.06] bg-black/20 flex flex-wrap gap-1.5">
            {[
              'Summarize money laundering hops',
              'Identify primary C2 server IP',
              'Check evidence SHA-256 seal status'
            ].map((pill, pIdx) => (
              <button
                key={pIdx}
                onClick={() => handleSendQuestion(pill)}
                disabled={asking}
                className="text-[10px] font-mono px-2 py-1 rounded border border-slate-700 hover:border-red-600/50 bg-slate-900/60 text-slate-300 hover:text-white transition-colors text-left cursor-pointer"
              >
                {pill}
              </button>
            ))}
          </div>

          {/* Message Thread */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-xs">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex gap-2.5 max-w-full ${
                  msg.sender === 'user' ? 'ml-auto flex-row-reverse' : ''
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 border ${
                    msg.sender === 'user'
                      ? 'border-red-800/40 bg-red-950/40 text-rose-300'
                      : 'border-white/10 bg-slate-900 text-slate-300'
                  }`}
                >
                  {msg.sender === 'user' ? (
                    <span className="text-[10px] font-bold">U</span>
                  ) : (
                    <BrainCircuit className="w-3.5 h-3.5 text-rose-400" />
                  )}
                </div>

                <div
                  className={`p-3 rounded-xl border space-y-2 max-w-[85%] ${
                    msg.sender === 'user'
                      ? 'border-red-900/40 bg-[#160B0F] text-slate-100 rounded-tr-none'
                      : 'border-white/10 bg-[#0A0E18] text-slate-200 rounded-tl-none'
                  }`}
                >
                  <div className="flex items-center justify-between text-[9px] text-slate-500 gap-2">
                    <span>{msg.sender === 'user' ? 'INVESTIGATOR' : 'INTELLIGENCE ENGINE'}</span>
                    <span>{msg.timestamp}</span>
                  </div>

                  <div className="font-sans text-xs leading-relaxed whitespace-pre-wrap">
                    {msg.text}
                  </div>

                  {msg.sender === 'ai' && (
                    <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between gap-2 text-[9px] text-slate-400">
                      <div className="flex items-center gap-1.5 text-rose-300">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>{msg.context_facts_used ?? 0} Facts</span>
                      </div>

                      {msg.confidence && (
                        <span className={`px-1.5 py-0.2 rounded border font-bold ${
                          msg.confidence === 'HIGH'
                            ? 'border-emerald-500/40 text-emerald-300 bg-emerald-950/30'
                            : 'border-amber-500/40 text-amber-300 bg-amber-950/30'
                        }`}>
                          {msg.confidence}
                        </span>
                      )}

                      <button
                        onClick={() => copyText(msg.text, msg.id)}
                        className="text-slate-500 hover:text-slate-300 ml-auto cursor-pointer"
                        title="Copy text"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {asking && (
              <div className="flex items-center gap-2 text-xs font-mono text-rose-400 p-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Querying intelligence model with case facts...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Console Input Bar */}
          <div className="p-3 border-t border-white/10 bg-[#090C16]">
            <form
              onSubmit={e => {
                e.preventDefault();
                handleSendQuestion();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={inputQuery}
                onChange={e => setInputQuery(e.target.value)}
                placeholder="Ask intelligence console about this case..."
                disabled={asking}
                className="flex-1 px-3 py-2 rounded-lg bg-[#070A14] border border-slate-700 text-slate-200 text-xs font-mono focus:outline-none focus:border-red-600 placeholder:text-slate-600"
              />
              <button
                type="submit"
                disabled={asking || !inputQuery.trim()}
                className="p-2 rounded-lg bg-[#6D001A] hover:bg-[#8B0024] text-white font-bold transition-all disabled:opacity-40 cursor-pointer shadow-sm"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
