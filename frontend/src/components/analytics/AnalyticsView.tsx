import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  Activity,
  Layers,
  HelpCircle,
  Award,
  Zap,
  Info,
  ArrowUpRight,
  ShieldCheck,
  AlertTriangle,
  GitMerge,
  Loader2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import type { GraphData, GraphNode, AnomalyResult, LinkPrediction } from '../../types';

export const AnalyticsView: React.FC = () => {
  const { activeCase } = useAuth();
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedMetric, setSelectedMetric] = useState<'ips' | 'betweenness' | 'degree' | 'anomaly'>('ips');
  const [inspectedEntity, setInspectedEntity] = useState<GraphNode | null>(null);
  const [anomalies, setAnomalies] = useState<AnomalyResult[]>([]);
  const [linkPredictions, setLinkPredictions] = useState<LinkPrediction[]>([]);

  useEffect(() => {
    async function load() {
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
        const [graph, anomRes, linkRes] = await Promise.allSettled([
          api.getCaseGraph(caseId),
          api.getAnomalies(caseId),
          api.getLinkPredictions(caseId)
        ]);

        if (graph.status === 'fulfilled' && graph.value) {
          setGraphData(graph.value);
          if (Array.isArray(graph.value.nodes) && graph.value.nodes.length > 0) {
            setInspectedEntity(graph.value.nodes[0]);
          }
        }
        if (anomRes.status === 'fulfilled' && anomRes.value) {
          const anomList = Array.isArray(anomRes.value) ? anomRes.value : (anomRes.value as any)?.anomalies || [];
          setAnomalies(anomList);
        }
        if (linkRes.status === 'fulfilled' && linkRes.value) {
          const linkList = Array.isArray(linkRes.value) ? linkRes.value : (linkRes.value as any)?.predictions || [];
          setLinkPredictions(linkList);
        }
      } catch (err) {
        console.error('Analytics load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [activeCase]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-slate-400 text-xs">
        <Loader2 className="w-8 h-8 text-crimson-400 animate-spin" />
        <p>CALCULATING GRAPH CENTRALITY & TOPOLOGICAL METRICS...</p>
      </div>
    );
  }

  if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
    return (
      <div className="p-8 rounded-2xl border border-dashed border-slate-800 text-center text-xs text-slate-500 space-y-3">
        <BarChart3 className="w-8 h-8 text-slate-600 mx-auto" />
        <p>No graph entities found for the active case.</p>
        <p className="text-[11px] text-slate-600">Ingest evidence or run graph analysis to generate centrality analytics.</p>
      </div>
    );
  }

  // Sorted list based on chosen metric
  const sortedEntities = [...(graphData.nodes || [])].sort((a, b) => {
    if (selectedMetric === 'ips') return (b.ips_score ?? 0) - (a.ips_score ?? 0);
    if (selectedMetric === 'betweenness') return (b.betweenness ?? 0) - (a.betweenness ?? 0);
    if (selectedMetric === 'degree') return (b.degree ?? 0) - (a.degree ?? 0);
    return (b.ips_score ?? 0) - (a.ips_score ?? 0);
  });

  const getMetricExplanation = () => {
    switch (selectedMetric) {
      case 'ips':
        return 'Investigative Priority Score (IPS): An ensemble composite score combining graph centrality, cross-entity transaction volumes, temporal burst clustering, and proximity to known Command & Control hubs.';
      case 'betweenness':
        return 'Betweenness Centrality: Quantifies the number of times a node acts as a bridge along the shortest path between two other nodes. High betweenness denotes critical middleman nodes or laundering proxies.';
      case 'degree':
        return 'Degree Centrality: Measures the direct connection count of an entity. High degree entities represent primary infrastructure, high-volume wallets, or focal communication targets.';
      case 'anomaly':
        return 'Anomaly Metric: Statistical deviation from standard operational baselines based on transaction timing, frequency bursts, and unusual edge weights.';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 uppercase tracking-wide flex items-center gap-2.5">
            <BarChart3 className="w-6 h-6 text-crimson-400" />
            <span>CENTRALITY ANALYTICS & GRAPH TOPOLOGY</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Mathematical network algorithms evaluating bridges, hubs, and topological bottlenecks
          </p>
        </div>

        {/* Metric Selector Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#0E121D] border border-[#1E293B] text-xs">
          <button
            onClick={() => setSelectedMetric('ips')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              selectedMetric === 'ips'
                ? 'bg-crimson-950/60 text-crimson-300 border border-crimson-500/40 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            IPS PRIORITY
          </button>
          <button
            onClick={() => setSelectedMetric('betweenness')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              selectedMetric === 'betweenness'
                ? 'bg-crimson-950/60 text-crimson-300 border border-crimson-500/40 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            BETWEENNESS
          </button>
          <button
            onClick={() => setSelectedMetric('degree')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              selectedMetric === 'degree'
                ? 'bg-crimson-950/60 text-crimson-300 border border-crimson-500/40 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            DEGREE RANK
          </button>
        </div>
      </div>

      {/* Metric Explanation Banner */}
      <div className="rounded-xl p-4 border border-crimson-500/30 bg-[#0E121D]/80 flex items-start gap-3 text-xs text-slate-300">
        <Info className="w-4 h-4 text-crimson-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="text-[10px] text-crimson-400 uppercase tracking-wider block font-bold">
            ALGORITHM MATHEMATICAL DEFINITION
          </span>
          <p className="text-slate-300 leading-relaxed text-xs">
            {getMetricExplanation()}
          </p>
        </div>
      </div>

      {/* Graph Macro Topology Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
        <div className="p-4 rounded-xl border border-slate-800 bg-[#0E121D]">
          <span className="text-slate-500 block text-[10px]">TOTAL GRAPH NODES</span>
          <span className="text-xl font-bold text-slate-100 mt-1 block">
            {graphData.nodes.length}
          </span>
          <span className="text-[10px] text-crimson-400 mt-1 block">Entity Vertices</span>
        </div>

        <div className="p-4 rounded-xl border border-slate-800 bg-[#0E121D]">
          <span className="text-slate-500 block text-[10px]">TOTAL GRAPH EDGES</span>
          <span className="text-xl font-bold text-slate-100 mt-1 block">
            {graphData.edges.length}
          </span>
          <span className="text-[10px] text-rose-400 mt-1 block">
            {graphData.stats?.predicted_edges ?? linkPredictions.length} Inferred
          </span>
        </div>

        <div className="p-4 rounded-xl border border-slate-800 bg-[#0E121D]">
          <span className="text-slate-500 block text-[10px]">NETWORK DENSITY</span>
          <span className="text-xl font-bold text-slate-100 mt-1 block">
            {((graphData.stats?.graph_density ?? 0.12) * 100).toFixed(1)}%
          </span>
          <span className="text-[10px] text-emerald-400 mt-1 block">Topology Sparsity</span>
        </div>

        <div className="p-4 rounded-xl border border-slate-800 bg-[#0E121D]">
          <span className="text-slate-500 block text-[10px]">FLAGGED ANOMALIES</span>
          <span className="text-xl font-bold text-slate-100 mt-1 block">
            {anomalies.filter(a => a.is_anomaly).length}
          </span>
          <span className="text-[10px] text-rose-400 mt-1 block">Deviation Detected</span>
        </div>
      </div>

      {/* Centrality Rankings & Entity Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Bar Rankings */}
        <div className="lg:col-span-8 rounded-2xl p-6 border border-[#1E293B] bg-[#0E121D]/90 space-y-4 text-xs">
          <h3 className="text-base font-semibold text-slate-200 uppercase">
            ENTITY RANKINGS ({selectedMetric.toUpperCase()})
          </h3>

          <div className="space-y-3">
            {sortedEntities.map((node, index) => {
              const isSelected = inspectedEntity?.id === node.id;
              const value =
                selectedMetric === 'ips'
                  ? node.ips_score
                  : selectedMetric === 'betweenness'
                  ? node.betweenness
                  : node.degree / 10;

              return (
                <div
                  key={node.id}
                  onClick={() => setInspectedEntity(node)}
                  className={`cursor-pointer p-3 rounded-xl border transition-all ${
                    isSelected
                      ? 'border-crimson-500/50 bg-[#121824]'
                      : 'border-slate-800 bg-[#0A0E17] hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500 w-5">#{index + 1}</span>
                      <span className="font-bold text-slate-100 text-xs">{node.name}</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded border border-slate-700 bg-slate-800 text-slate-300">
                        {node.type}
                      </span>
                    </div>

                    <div className="font-bold text-crimson-300">
                      {selectedMetric === 'ips'
                        ? `${(((node.ips_score ?? 0.85)) * 100).toFixed(0)}% IPS`
                        : selectedMetric === 'betweenness'
                        ? `${(node.betweenness ?? 0.5).toFixed(3)} BW`
                        : `${node.degree ?? 0} DEGREES`}
                    </div>
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="w-full h-2 rounded-full bg-slate-800/80 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        selectedMetric === 'ips'
                          ? 'bg-gradient-to-r from-crimson-600 to-rose-400'
                          : 'bg-gradient-to-r from-crimson-800 to-crimson-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(5, (value ?? 0.5) * 100))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Entity Centrality Breakdown */}
        <div className="lg:col-span-4">
          {inspectedEntity ? (
            <div className="rounded-xl p-5 border border-crimson-500/40 bg-[#0E121D]/90 text-xs space-y-4 sticky top-20 shadow-[0_4px_24px_rgba(0,0,0,0.6)]">
              <div className="border-b border-slate-800 pb-2.5">
                <span className="text-[10px] text-crimson-400 uppercase tracking-widest block font-bold">
                  SELECTED VERTEX PROFILE
                </span>
                <h3 className="text-base font-bold text-slate-100 mt-0.5">
                  {inspectedEntity.name}
                </h3>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">ENTITY CLASSIFICATION:</span>
                  <span className="text-slate-200 font-bold">{inspectedEntity.type}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">IPS COMPOSITE SCORE:</span>
                  <span className="text-crimson-300 font-bold">
                    {(((inspectedEntity.ips_score ?? 0.85)) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">BETWEENNESS CENTRALITY:</span>
                  <span className="text-slate-200 font-bold">
                    {(inspectedEntity.betweenness ?? 0.5).toFixed(4)}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">DEGREE RANK:</span>
                  <span className="text-slate-200 font-bold">{inspectedEntity.degree ?? 0} Vertices</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 uppercase">IDENTIFIED ATTRIBUTES</span>
                <div className="flex flex-wrap gap-1.5">
                  {(inspectedEntity.labels || []).map(l => (
                    <span key={l} className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[10px]">
                      {l}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-black/40 border border-slate-800 text-[11px] text-slate-300 leading-relaxed">
                This entity acts as a node within the active case network topology. Graph centrality metrics assist in identifying key brokers and points of leverage.
              </div>
            </div>
          ) : (
            <div className="glass-panel rounded-xl p-8 text-center text-slate-500 text-xs">
              SELECT AN ENTITY TO VIEW CENTRALITY DOSSIER
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
