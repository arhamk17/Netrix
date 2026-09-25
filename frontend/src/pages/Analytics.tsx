import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Award, Users, AlertCircle, RotateCw, Calendar } from 'lucide-react';
import { apiClient } from '../api/client';
import { Entity, Case } from '../types';

interface AnalyticsProps {
  activeCase?: Case | null;
}

export const Analytics: React.FC<AnalyticsProps> = ({ activeCase }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'centrality' | 'communities' | 'anomalies' | 'temporal'>('centrality');
  const [data, setData] = useState<{
    centrality: Entity[];
    pagerank: Entity[];
    betweenness: Entity[];
    anomalyScores: Entity[];
    communities: Array<{ id: string; name: string; nodesCount: number; color: string }>;
    temporalPatterns: Array<{ date: string; events: number; volume: number }>;
  } | null>(null);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      let targetCaseId = activeCase?.id;
      if (!targetCaseId) {
        const cases = await apiClient.cases.list();
        if (cases.length > 0) targetCaseId = cases[0].id;
      }

      const [analytics, eventsList, evList] = await Promise.all([
        apiClient.analytics.get(targetCaseId),
        targetCaseId ? apiClient.timeline.getEvents(targetCaseId).catch(() => []) : Promise.resolve([]),
        targetCaseId ? apiClient.evidence.list(targetCaseId).catch(() => []) : Promise.resolve([])
      ]);

      const centralityList = (analytics.centrality || []).map((c: any) => ({
        id: c.id || c.node_id || c.name || 'ent-0',
        name: c.name || c.canonical_name || c.id || 'Entity',
        label: c.name || c.canonical_name || c.id || 'Entity',
        type: c.type || 'person',
        caseId: c.case_id || '',
        riskScore: typeof c.score === 'number' ? c.score : 0.75,
        centralityScore: typeof c.score === 'number' ? c.score : 0.75,
        pagerankScore: typeof c.score === 'number' ? c.score : 0.75,
        betweennessScore: typeof c.score === 'number' ? c.score : 0.75,
        anomalyScore: 0.1,
        degree: 4,
        properties: {},
        status: 'active',
        tags: []
      })) as unknown as Entity[];

      const ipsList = (analytics.ips || []).map((item: any) => ({
        id: item.id || item.node_id || item.name || 'ent-0',
        name: item.name || item.canonical_name || item.id || 'Entity',
        label: item.name || item.canonical_name || item.id || 'Entity',
        type: item.type || 'person',
        caseId: item.case_id || '',
        riskScore: typeof item.ips === 'number' ? item.ips : 0.8,
        centralityScore: typeof item.ips === 'number' ? item.ips : 0.8,
        pagerankScore: typeof item.ips === 'number' ? item.ips : 0.8,
        betweennessScore: typeof item.ips === 'number' ? item.ips : 0.8,
        anomalyScore: 0.1,
        degree: 4,
        properties: {},
        status: 'active',
        tags: []
      })) as unknown as Entity[];

      const anomaliesList = (analytics.anomalies || []).map((item: any) => ({
        id: item.id || item.node_id || item.name || 'ent-0',
        name: item.name || item.canonical_name || item.id || 'Entity',
        label: item.name || item.canonical_name || item.id || 'Entity',
        type: item.type || 'person',
        caseId: item.case_id || '',
        riskScore: typeof item.anomaly_score === 'number' ? item.anomaly_score : 0.85,
        centralityScore: typeof item.anomaly_score === 'number' ? item.anomaly_score : 0.85,
        pagerankScore: typeof item.anomaly_score === 'number' ? item.anomaly_score : 0.85,
        betweennessScore: typeof item.anomaly_score === 'number' ? item.anomaly_score : 0.85,
        anomalyScore: typeof item.anomaly_score === 'number' ? item.anomaly_score : 0.85,
        degree: 4,
        properties: {},
        status: 'active',
        tags: []
      })) as unknown as Entity[];

      const communitiesList = (analytics.communities || []).map((comm: any, idx: number) => ({
        id: `comm-${idx}`,
        name: comm.name || `Subnetwork Cluster ${idx + 1}`,
        nodesCount: Array.isArray(comm.nodes) ? comm.nodes.length : (comm.count || 1),
        color: ['#6E1827', '#121110', '#0F766E', '#854D0E', '#4338CA'][idx % 5]
      }));

      const dateCounts: Record<string, { events: number; volume: number }> = {};
      
      eventsList.forEach((ev: any) => {
        if (ev.timestamp) {
          const d = new Date(ev.timestamp).toISOString().split('T')[0];
          if (!dateCounts[d]) dateCounts[d] = { events: 0, volume: 0 };
          dateCounts[d].events += 1;
          dateCounts[d].volume += Math.round((ev.confidence || 0.8) * 100);
        }
      });

      evList.forEach((ev: any) => {
        if (ev.uploadedAt || ev.createdAt) {
          const d = new Date(ev.uploadedAt || ev.createdAt).toISOString().split('T')[0];
          if (!dateCounts[d]) dateCounts[d] = { events: 0, volume: 0 };
          dateCounts[d].events += 1;
          dateCounts[d].volume += 100;
        }
      });

      const temporalPatterns = Object.entries(dateCounts)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, val]) => ({
          date,
          events: val.events,
          volume: val.volume
        }));

      setData({
        centrality: centralityList,
        pagerank: centralityList.length > 0 ? centralityList : ipsList,
        betweenness: ipsList.length > 0 ? ipsList : centralityList,
        anomalyScores: anomaliesList,
        communities: communitiesList,
        temporalPatterns
      });
    } catch (err: any) {
      setError(err.message || 'Failed to calculate network analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [activeCase?.id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]" id="analytics-loading">
        <RotateCw className="h-6 w-6 text-[#6B6760] animate-spin" />
        <span className="mt-3 text-xs font-mono text-[#6B6760] uppercase tracking-wider">Processing structural GNN algorithms...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] px-4" id="analytics-error">
        <AlertCircle className="h-8 w-8 text-[#6E1827] mb-2" />
        <span className="text-sm font-medium text-[#121110]">Analytics Processing Failed</span>
        <p className="mt-1 text-xs text-[#6B6760] text-center max-w-sm">{error}</p>
        <button
          onClick={fetchAnalytics}
          className="mt-4 px-3 py-1.5 border border-[#E2DDD5] rounded-[2px] bg-white text-xs font-mono tracking-wider hover:bg-[#F7F5F0]"
        >
          RETRY
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8" id="analytics-container">
      {/* Editorial Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-[#E2DDD5] pb-5" id="analytics-header">
        <div>
          <span className="text-[10px] font-mono tracking-widest text-[#6E1827] uppercase font-semibold">Network Analytical Center</span>
          <h1 className="text-3xl font-serif font-normal tracking-tight text-[#121110] mt-1">Graph Analytics & Patterns</h1>
        </div>
        <div className="mt-4 md:mt-0 flex border border-[#E2DDD5] rounded-[2px] overflow-hidden text-xs font-mono" id="analytics-tab-selectors">
          {(['centrality', 'communities', 'anomalies', 'temporal'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 uppercase tracking-wider font-medium border-r border-[#E2DDD5] last:border-none cursor-pointer transition-colors ${
                activeTab === tab ? 'bg-[#121110] text-white border-transparent' : 'bg-white text-[#6B6760] hover:text-[#121110] hover:bg-[#F7F5F0]'
              }`}
            >
              {tab === 'temporal' ? 'Temporal Trends' : tab}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white border border-[#E2DDD5] rounded-[2px] p-6 min-h-[450px]" id="analytics-panel">
        {activeTab === 'centrality' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12" id="analytics-centrality-grid">
            {/* PageRank Influence */}
            <div className="space-y-6">
              <div className="border-b border-[#E2DDD5] pb-3">
                <h3 className="text-sm font-medium text-[#121110] flex items-center gap-2">
                  <Award className="h-4 w-4 text-[#6B6760] stroke-[1.5]" /> PageRank Centrality (Eigenvector)
                </h3>
                <p className="text-[11px] text-[#6B6760] mt-0.5 font-sans">Calculates global network influence, measuring recursive importance of surrounding neighbors.</p>
              </div>

              <div className="space-y-4">
                {data.pagerank.slice(0, 6).map((entity, i) => (
                  <div key={entity.id} className="space-y-1.5" id={`pagerank-row-${entity.id}`}>
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-[#121110]">{i + 1}. {entity.label} <span className="text-[10px] font-mono text-[#6B6760] uppercase">({entity.type})</span></span>
                      <span className="font-mono font-medium text-[#121110] tabular-nums">{entity.pagerank.toFixed(3)}</span>
                    </div>
                    {/* Visual Bar Indicator */}
                    <div className="h-1.5 w-full bg-[#F7F5F0] border border-[#E2DDD5] rounded-[2px] overflow-hidden">
                      <div className="h-full bg-[#121110] rounded-[2px]" style={{ width: `${entity.pagerank * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Betweenness Centrality */}
            <div className="space-y-6">
              <div className="border-b border-[#E2DDD5] pb-3">
                <h3 className="text-sm font-medium text-[#121110] flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-[#6B6760] stroke-[1.5]" /> Betweenness Centrality
                </h3>
                <p className="text-[11px] text-[#6B6760] mt-0.5 font-sans">Identifies critical informational gateways; nodes sitting on high volumes of shortest routes.</p>
              </div>

              <div className="space-y-4">
                {data.betweenness.slice(0, 6).map((entity, i) => (
                  <div key={entity.id} className="space-y-1.5" id={`betweenness-row-${entity.id}`}>
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-[#121110]">{i + 1}. {entity.label} <span className="text-[10px] font-mono text-[#6B6760] uppercase">({entity.type})</span></span>
                      <span className="font-mono font-medium text-[#121110] tabular-nums">{entity.betweenness.toFixed(3)}</span>
                    </div>
                    {/* Visual Bar Indicator */}
                    <div className="h-1.5 w-full bg-[#F7F5F0] border border-[#E2DDD5] rounded-[2px] overflow-hidden">
                      <div className="h-full bg-[#6E1827] rounded-[2px]" style={{ width: `${Math.min(100, Math.max(8, entity.betweenness * 100))}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'communities' && (
          <div className="space-y-6" id="analytics-communities-pane">
            <div className="border-b border-[#E2DDD5] pb-3">
              <h3 className="text-sm font-medium text-[#121110] flex items-center gap-2">
                <Users className="h-4 w-4 text-[#6B6760] stroke-[1.5]" /> Modularity Community Detection
              </h3>
              <p className="text-[11px] text-[#6B6760] mt-0.5 font-sans">Partitions the criminal network into high-density co-occurring subgroups.</p>
            </div>

            {data.communities.length === 0 ? (
              <div className="p-12 text-center text-xs font-mono text-[#6B6760] bg-white border border-[#E2DDD5] rounded-[2px]">
                No modular subnetwork communities detected for this case.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {data.communities.map(comm => (
                  <div key={comm.id} className="border border-[#E2DDD5] rounded-[2px] p-5 space-y-4 hover:border-[#121110] transition-colors bg-white">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono tracking-wider text-[#6B6760] uppercase">Topological Sub-Cluster</span>
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: comm.color }} />
                    </div>
                    <h4 className="text-sm font-medium text-[#121110] font-sans">{comm.name}</h4>
                    <div className="flex items-baseline gap-1.5 font-mono">
                      <span className="text-2xl font-light text-[#121110] tabular-nums">{comm.nodesCount}</span>
                      <span className="text-[10px] text-[#6B6760] uppercase">Associated core entities</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'anomalies' && (
          <div className="space-y-6" id="analytics-anomalies-pane">
            <div className="border-b border-[#E2DDD5] pb-3">
              <h3 className="text-sm font-medium text-[#121110] flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-[#6E1827] stroke-[1.5]" /> Graph Neural Anomaly Scoring
              </h3>
              <p className="text-[11px] text-[#6B6760] mt-0.5 font-sans">Automated detection of relational configurations deviating from standard baseline communication trees.</p>
            </div>

            {data.anomalyScores.length === 0 ? (
              <div className="p-12 text-center text-xs font-mono text-[#6B6760] bg-white border border-[#E2DDD5] rounded-[2px]">
                No anomalous graph patterns detected for this case.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.anomalyScores.slice(0, 6).map(entity => (
                  <div key={entity.id} className="border border-[#E2DDD5] p-4 rounded-[2px] flex items-start gap-4 hover:border-[#C8C3BA] transition-colors bg-white">
                    <div className="h-8 w-8 rounded-[2px] bg-[#FAF1F2] border border-[#6E1827]/20 flex items-center justify-center shrink-0">
                      <AlertCircle className="h-4 w-4 text-[#6E1827]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-xs font-medium text-[#121110] truncate font-sans">{entity.label}</span>
                        <span className="font-mono text-xs font-semibold text-[#6E1827] tabular-nums">{(entity.anomalyScore * 100).toFixed(1)}% risk</span>
                      </div>
                      <p className="text-[11px] text-[#6B6760] mt-0.5 font-mono">Type: {entity.type}</p>
                      <div className="mt-2.5 pt-2 border-t border-[#E2DDD5] flex items-center justify-between text-[10px] font-mono text-[#6B6760]">
                        <span>PageRank: {entity.pagerank.toFixed(3)}</span>
                        <span>Betweenness: {entity.betweenness.toFixed(3)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'temporal' && (
          <div className="space-y-6" id="analytics-temporal-pane">
            <div className="border-b border-[#E2DDD5] pb-3">
              <h3 className="text-sm font-medium text-[#121110] flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[#6B6760] stroke-[1.5]" /> Temporal Communications & Events Volume
              </h3>
              <p className="text-[11px] text-[#6B6760] mt-0.5 font-sans">Chronological distribution mapping contact events and evidentiary uploads.</p>
            </div>

            {data.temporalPatterns.length === 0 ? (
              <div className="p-12 text-center text-xs font-mono text-[#6B6760] bg-white border border-[#E2DDD5] rounded-[2px]">
                No chronological events or timestamped evidence recorded for this case yet.
              </div>
            ) : (
              <>
                <div className="h-[300px]" id="temporal-area-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.temporalPatterns} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6E1827" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="#6E1827" stopOpacity={0.0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2DDD5" />
                      <XAxis dataKey="date" stroke="#6B6760" fontSize={10} fontFamily="monospace" tickLine={false} />
                      <YAxis stroke="#6B6760" fontSize={10} fontFamily="monospace" tickLine={false} />
                      <ChartTooltip
                        contentStyle={{
                          backgroundColor: '#FFFFFF',
                          border: '1px solid #E2DDD5',
                          borderRadius: '2px',
                          fontSize: '11px',
                          fontFamily: 'monospace'
                        }}
                      />
                      <Area type="monotone" dataKey="volume" stroke="#6E1827" strokeWidth={1.5} fillOpacity={1} fill="url(#colorVolume)" name="Activity Intensity" />
                      <Area type="monotone" dataKey="events" stroke="#121110" strokeWidth={1} fill="none" name="Events Count" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="text-[10px] font-mono text-[#6B6760] text-center">
                  Chronological distribution of recorded case events.
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
export default Analytics;
