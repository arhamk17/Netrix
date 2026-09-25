import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Share2,
  Search,
  Shield,
  AlertCircle,
  BarChart3,
  Navigation,
  RotateCcw,
  Maximize2,
  Eye,
  Layers,
  ChevronDown,
  ChevronUp,
  FileText,
  Clock,
  Zap,
  Cpu,
  Link as LinkIcon,
  X,
  Check,
  Network
} from 'lucide-react';
import { apiClient } from '../api/client';
import { GraphData, Entity, Relationship, EntityType, NetworkStatistics, Case } from '../types';
import { ThreeGraph } from '../components/ThreeGraph';

interface KnowledgeGraphPageProps {
  activeCase?: Case | null;
  onNavigateToPage?: (page: string) => void;
  onSelectEntity?: (entity: Entity) => void;
  initialHighlightEntityIds?: string[];
}

export const KnowledgeGraphPage: React.FC<KnowledgeGraphPageProps> = ({
  activeCase,
  onNavigateToPage,
  onSelectEntity,
  initialHighlightEntityIds
}) => {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [stats, setStats] = useState<NetworkStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inspector States
  const [selectedNode, setSelectedNode] = useState<Entity | null>(null);
  const [selectedRel, setSelectedRel] = useState<Relationship | null>(null);
  const [inspectorTab, setInspectorTab] = useState<'inspector' | 'relations' | 'evidence' | 'timeline'>('inspector');
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  // Controls triggers
  const [resetLayoutTrigger, setResetLayoutTrigger] = useState(0);
  const [fitScreenTrigger, setFitScreenTrigger] = useState(0);
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [highlightPredictions, setHighlightPredictions] = useState(false);
  const [expandedNeighborsNodeId, setExpandedNeighborsNodeId] = useState<string | null>(null);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTypes, setFilterTypes] = useState<EntityType[]>([
    'person', 'organization', 'phone', 'vehicle', 'location', 'event', 'case', 'other'
  ]);
  const [filterRelTypes, setFilterRelTypes] = useState<string[]>([]);

  // Shortest Path State
  const [sourceNodeId, setSourceNodeId] = useState('');
  const [targetNodeId, setTargetNodeId] = useState('');
  const [activePathQuery, setActivePathQuery] = useState<{ sourceId: string; targetId: string } | null>(null);

  // Neighborhood Isolation State
  const [isolatedNodeId, setIsolatedNodeId] = useState<string | null>(null);

  const hasAutoSelectedRef = useRef(false);

  const fetchGraphData = async () => {
    setLoading(true);
    setError(null);
    try {
      let targetCaseId = activeCase?.id;
      if (!targetCaseId) {
        const cases = await apiClient.cases.list();
        if (cases.length > 0) targetCaseId = cases[0].id;
      }

      const data = await apiClient.graph.getGraphData(targetCaseId);
      const netStats = await apiClient.graph.getStats(targetCaseId, data);
      setGraphData(data);
      setStats(netStats);
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve global intelligence graph data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSelectedNode(null);
    setSelectedRel(null);
    setActivePathQuery(null);
    setSourceNodeId('');
    setTargetNodeId('');
    setIsolatedNodeId(null);
    setExpandedNeighborsNodeId(null);
    setFocusNodeId(null);
    hasAutoSelectedRef.current = false;
    fetchGraphData();
  }, [activeCase?.id]);

  // Auto-select first real node ONCE on initial case load, NOT when user clears selection
  useEffect(() => {
    if (graphData && graphData.nodes.length > 0 && !hasAutoSelectedRef.current) {
      hasAutoSelectedRef.current = true;
      if (initialHighlightEntityIds && initialHighlightEntityIds.length > 0) {
        const target = graphData.nodes.find(n => initialHighlightEntityIds.includes(n.id));
        if (target) {
          setSelectedNode(target);
          setFocusNodeId(target.id);
          return;
        }
      }
      // Default to first node from real backend data
      setSelectedNode(graphData.nodes[0]);
      setFocusNodeId(graphData.nodes[0].id);
    }
  }, [graphData, initialHighlightEntityIds]);

  const handleToggleNodeType = (type: EntityType) => {
    setFilterTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const handleSolvePath = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceNodeId || !targetNodeId) {
      setActivePathQuery(null);
      return;
    }
    setActivePathQuery({ sourceId: sourceNodeId, targetId: targetNodeId });
  };

  const handleClearPath = () => {
    setSourceNodeId('');
    setTargetNodeId('');
    setActivePathQuery(null);
  };

  // Compute path result for display (mirrors BFS in ThreeGraph)
  const computedPathResult = React.useMemo(() => {
    if (!activePathQuery || !graphData) return null;
    const { sourceId, targetId } = activePathQuery;
    const adjMap: Record<string, Array<{ neighbor: string }>> = {};
    graphData.links.forEach(l => {
      const sId = typeof l.source === 'object' ? (l.source as any).id : l.source;
      const tId = typeof l.target === 'object' ? (l.target as any).id : l.target;
      if (!adjMap[sId]) adjMap[sId] = [];
      if (!adjMap[tId]) adjMap[tId] = [];
      adjMap[sId].push({ neighbor: tId });
      adjMap[tId].push({ neighbor: sId });
    });
    const queue: Array<{ id: string; depth: number }> = [{ id: sourceId, depth: 0 }];
    const visited = new Set<string>([sourceId]);
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.id === targetId) return { found: true, hops: current.depth };
      for (const { neighbor } of (adjMap[current.id] || [])) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push({ id: neighbor, depth: current.depth + 1 });
        }
      }
    }
    return { found: false, hops: 0 };
  }, [activePathQuery, graphData]);

  const handleToggleIsolate = (nodeId: string) => {
    setIsolatedNodeId(prev => (prev === nodeId ? null : nodeId));
  };

  // Helper to compute node relationships and metrics for inspector
  const getNodeIncidentLinks = (nodeId: string) => {
    if (!graphData) return [];
    return graphData.links.filter(l => {
      const sId = typeof l.source === 'object' ? (l.source as any).id : l.source;
      const tId = typeof l.target === 'object' ? (l.target as any).id : l.target;
      return sId === nodeId || tId === nodeId;
    });
  };

  const getNodePartnerEntity = (link: Relationship, currentId: string) => {
    if (!graphData) return null;
    const sId = typeof link.source === 'object' ? (link.source as any).id : link.source;
    const tId = typeof link.target === 'object' ? (link.target as any).id : link.target;
    const partnerId = sId === currentId ? tId : sId;
    return graphData.nodes.find(n => n.id === partnerId) || null;
  };

  const getNetworkImportance = (node: Entity) => {
    if (node.betweenness >= 0.5 || node.centrality >= 0.7) {
      return {
        level: 'High',
        badgeColor: 'bg-[#6E1827]/10 text-[#6E1827] border-[#6E1827]/30',
        explanation: 'Key Bridge — Connects multiple distinct sub-clusters across the network.'
      };
    }
    if (node.betweenness >= 0.25 || node.centrality >= 0.4) {
      return {
        level: 'Medium',
        badgeColor: 'bg-[#262422]/10 text-[#262422] border-black/15',
        explanation: 'Operational Node — Frequent direct interactions with key hubs.'
      };
    }
    return {
      level: 'Low',
      badgeColor: 'bg-[#F0EDE6] text-[#6B6760] border-[#E2DDD5]',
      explanation: 'Peripheral Node — Isolated connections or single event activity.'
    };
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="h-[calc(100vh-100px)] min-h-[660px] flex overflow-hidden rounded-[24px] border border-[#E2DDD5] bg-[#F7F5F0] shadow-sm relative"
      id="graph-workspace-full"
    >
      {/* 1. LEFT PANEL: Controls, Filters & Analyzer */}
      <motion.div
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="w-[310px] border-r border-[#E2DDD5] bg-white/90 backdrop-blur-md flex flex-col h-full overflow-y-auto select-none"
        id="graph-controls-sidebar"
      >
        {/* FIND ENTITY */}
        <div className="p-5 border-b border-[#E2DDD5] space-y-2.5">
          <span className="text-[10px] font-mono font-bold text-[#6E1827] uppercase tracking-wider block">
            FIND ENTITY
          </span>
          <div className="relative">
            <Search className="absolute left-3.5 top-2.5 h-3.5 w-3.5 text-[#8C877D]" />
            <input
              type="text"
              placeholder="Search suspect, alias, device..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8 py-2 w-full border border-black/10 rounded-xl bg-white text-xs text-[#121110] placeholder-[#8C877D] focus:border-[#6E1827] focus:outline-none transition-colors font-sans shadow-2xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-[#8C877D] hover:text-[#121110] cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* ENTITY TYPES */}
        <div className="p-5 border-b border-[#E2DDD5] space-y-3">
          <span className="text-[10px] font-mono font-bold text-[#6B6760] uppercase tracking-wider block">
            ENTITY TYPES
          </span>
          <div className="grid grid-cols-2 gap-2">
            {([
              { key: 'person', label: 'Persons' },
              { key: 'organization', label: 'Organizations' },
              { key: 'phone', label: 'Phones' },
              { key: 'vehicle', label: 'Vehicles' },
              { key: 'location', label: 'Locations' },
              { key: 'event', label: 'Events' }
            ] as const).map(({ key, label }) => {
              const active = filterTypes.includes(key);
              return (
                <motion.button
                  key={key}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleToggleNodeType(key)}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-sans transition-all cursor-pointer text-left ${
                    active
                      ? 'bg-white border border-black/15 text-[#121110] shadow-2xs font-medium'
                      : 'bg-[#F7F5F0]/70 border border-transparent text-[#8C877D] hover:bg-[#F0EDE6] hover:text-[#121110]'
                  }`}
                >
                  <span className="truncate">{label}</span>
                  <div
                    className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-colors ${
                      active
                        ? 'bg-[#121110] border-[#121110] text-white'
                        : 'border-[#C8C3BA] bg-transparent'
                    }`}
                  >
                    {active && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* CONNECTIVITY PATH ANALYZER */}
        <div className="p-5 border-b border-[#E2DDD5] space-y-3">
          <span className="text-[10px] font-mono font-bold text-[#6B6760] uppercase tracking-wider block flex items-center gap-1.5">
            <Navigation className="h-3 w-3 text-[#6E1827]" /> Connectivity Path Analyzer
          </span>
          {graphData ? (
            <form onSubmit={handleSolvePath} className="space-y-3" id="graph-path-form">
              <div className="space-y-1">
                <label className="text-[#6B6760] font-mono text-[9px] uppercase font-medium">Source Entity</label>
                <select
                  value={sourceNodeId}
                  onChange={(e) => setSourceNodeId(e.target.value)}
                  className="w-full border border-black/10 bg-white p-2.5 rounded-xl font-sans text-xs text-[#121110] focus:outline-none focus:border-[#6E1827] shadow-2xs"
                >
                  <option value="">Select source node</option>
                  {graphData.nodes.map(n => (
                    <option key={n.id} value={n.id}>{n.label} ({n.type})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[#6B6760] font-mono text-[9px] uppercase font-medium">Target Entity</label>
                <select
                  value={targetNodeId}
                  onChange={(e) => setTargetNodeId(e.target.value)}
                  className="w-full border border-black/10 bg-white p-2.5 rounded-xl font-sans text-xs text-[#121110] focus:outline-none focus:border-[#6E1827] shadow-2xs"
                >
                  <option value="">Select target node</option>
                  {graphData.nodes.map(n => (
                    <option key={n.id} value={n.id}>{n.label} ({n.type})</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={!sourceNodeId || !targetNodeId}
                  className="flex-1 bg-[#6E1827] text-white font-mono uppercase tracking-wider text-[10px] py-2.5 rounded-xl hover:bg-[#52111C] transition-colors cursor-pointer disabled:bg-black/5 disabled:text-[#8C877D] disabled:cursor-not-allowed font-medium shadow-2xs"
                >
                  Trace Path
                </button>
                {activePathQuery && (
                  <button
                    type="button"
                    onClick={handleClearPath}
                    className="border border-black/10 text-[#6B6760] font-mono uppercase tracking-wider text-[10px] px-3.5 py-2.5 rounded-xl hover:bg-black/5 transition-colors cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Path Result Display */}
              {computedPathResult && (
                <div className={`mt-2 p-2.5 rounded-xl text-[10px] font-mono border ${
                  computedPathResult.found
                    ? 'bg-[#F0FDF4] border-green-200/50 text-[#166534]'
                    : 'bg-[#F7F5F0] border-black/10 text-[#6B6760]'
                }`}>
                  {computedPathResult.found
                    ? `✓ Path found — ${computedPathResult.hops} hop${computedPathResult.hops !== 1 ? 's' : ''} (highlighted in graph)`
                    : '✗ No path found between these entities'}
                </div>
              )}
            </form>
          ) : (
            <div className="text-[10px] text-[#8C877D] font-mono uppercase">Loading network nodes...</div>
          )}
        </div>

        {/* GRAPH TOPOLOGY METRICS */}
        <div className="p-5 space-y-3">
          <span className="text-[10px] font-mono font-bold text-[#6B6760] uppercase tracking-wider block flex items-center gap-1.5">
            <BarChart3 className="h-3 w-3 text-[#6B6760]" /> Graph Topology Metrics
          </span>
          {stats ? (
            <div className="space-y-2 font-mono text-xs text-[#6B6760]">
              <div className="flex justify-between items-center py-1 border-b border-black/5">
                <span>Total Nodes (N):</span>
                <span className="font-semibold text-[#121110] tabular-nums">{stats.nodeCount}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-black/5">
                <span>Total Edges (E):</span>
                <span className="font-semibold text-[#121110] tabular-nums">{stats.edgeCount}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-black/5">
                <span>Graph Density:</span>
                <span className="font-semibold text-[#121110] tabular-nums">{(stats.density * 100).toFixed(2)}%</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span>Clustering Ratio:</span>
                <span className="font-semibold text-[#121110] tabular-nums">{stats.clusteringCoefficient}</span>
              </div>
            </div>
          ) : (
            <div className="text-[10px] text-[#8C877D] font-mono uppercase">Calculating topology...</div>
          )}
        </div>
      </motion.div>

      {/* 2. CENTER: 3D Network Canvas + Compact Unobtrusive Controls */}
      <div className="flex-1 h-full relative bg-[#F7F5F0]" id="graph-main-canvas-area">
        {/* Unobtrusive Top Controls Toolbar */}
        <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-1.5 p-1.5 rounded-full bg-white/90 backdrop-blur-md border border-[#E2DDD5] shadow-xs">
          <button
            onClick={() => setFitScreenTrigger(prev => prev + 1)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[#121110] hover:bg-[#F7F5F0] rounded-full transition-colors text-xs font-sans font-medium cursor-pointer"
            title="Fit to Screen"
          >
            <Maximize2 className="h-3.5 w-3.5 text-[#6B6760]" />
            <span>Fit Screen</span>
          </button>
          <div className="h-4 w-px bg-black/10" />
          <button
            onClick={() => setResetLayoutTrigger(prev => prev + 1)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[#121110] hover:bg-[#F7F5F0] rounded-full transition-colors text-xs font-sans font-medium cursor-pointer"
            title="Reset 3D Force Layout"
          >
            <RotateCcw className="h-3.5 w-3.5 text-[#6B6760]" />
            <span>Reset</span>
          </button>
          <div className="h-4 w-px bg-black/10" />
          <button
            onClick={() => setHighlightPredictions(prev => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all text-xs font-sans font-medium cursor-pointer ${
              highlightPredictions
                ? 'bg-[#6E1827] text-white shadow-2xs'
                : 'text-[#121110] hover:bg-[#F7F5F0]'
            }`}
            title="Highlight local ML link predictions"
          >
            <Zap className={`h-3.5 w-3.5 ${highlightPredictions ? 'text-white' : 'text-[#6E1827]'}`} />
            <span>{highlightPredictions ? 'Predictions Active' : 'Highlight Predictions'}</span>
          </button>

          {selectedNode && (
            <>
              <div className="h-4 w-px bg-black/10" />
              <button
                onClick={() => setFocusNodeId(selectedNode.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[#121110] hover:bg-[#F7F5F0] rounded-full transition-colors text-xs font-sans font-medium cursor-pointer"
                title="Glide camera to selected node"
              >
                <Eye className="h-3.5 w-3.5 text-[#6B6760]" />
                <span>Focus Node</span>
              </button>
              <button
                onClick={() => setExpandedNeighborsNodeId(prev => (prev === selectedNode.id ? null : selectedNode.id))}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all text-xs font-sans font-medium cursor-pointer ${
                  expandedNeighborsNodeId === selectedNode.id
                    ? 'bg-[#121110] text-white shadow-2xs'
                    : 'text-[#121110] hover:bg-[#F7F5F0]'
                }`}
                title="Blossom connected neighbors outward"
              >
                <Share2 className="h-3.5 w-3.5" />
                <span>{expandedNeighborsNodeId === selectedNode.id ? 'Neighbors Blossomed' : 'Blossom Neighbors'}</span>
              </button>
              <button
                onClick={() => handleToggleIsolate(selectedNode.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all text-xs font-sans font-medium cursor-pointer ${
                  isolatedNodeId === selectedNode.id
                    ? 'bg-[#6E1827] text-white'
                    : 'text-[#121110] hover:bg-[#F7F5F0]'
                }`}
                title="Isolate immediate neighbors"
              >
                <Layers className="h-3.5 w-3.5" />
                <span>{isolatedNodeId === selectedNode.id ? 'Exit Isolation' : 'Isolate'}</span>
              </button>
            </>
          )}
        </div>

        {/* 3D Canvas Viewport */}
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#F7F5F0] p-6 text-center">
            <AlertCircle className="h-8 w-8 text-[#6E1827] mb-2" />
            <p className="text-xs font-mono text-[#6B6760]">{error}</p>
          </div>
        ) : graphData ? (
          <>
            <ThreeGraph
              data={graphData}
              onNodeSelect={(node) => {
                setSelectedNode(node);
                setSelectedRel(null);
                if (node) setInspectorTab('inspector');
              }}
              onRelationshipSelect={(rel) => {
                setSelectedRel(rel);
                setSelectedNode(null);
              }}
              selectedNode={selectedNode}
              selectedRelationship={selectedRel}
              filterTypes={filterTypes}
              filterRelTypes={filterRelTypes}
              searchTerm={searchQuery}
              shortestPathQuery={activePathQuery}
              isolateNodeId={isolatedNodeId}
              resetLayoutTrigger={resetLayoutTrigger}
              fitScreenTrigger={fitScreenTrigger}
              focusNodeId={focusNodeId}
              highlightPredictedConnections={highlightPredictions}
              expandNeighborsNodeId={expandedNeighborsNodeId}
            />
            {loading && (
              <div className="absolute top-4 right-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-md border border-[#E2DDD5] text-[11px] font-mono text-[#6E1827] shadow-xs">
                <span className="w-2 h-2 rounded-full bg-[#6E1827] animate-ping" />
                <span>Refreshing Graph Data...</span>
              </div>
            )}
          </>
        ) : loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-[#F7F5F0]">
            <span className="text-xs font-mono text-[#8C877D] animate-pulse">Initializing 3D Intelligence Canvas...</span>
          </div>
        ) : null}

        {/* Compact Legend & Viewport Controls Overlay */}
        <div className="absolute bottom-4 right-4 z-20 flex flex-wrap items-center gap-2">
          {/* Legend */}
          <div className="bg-white/90 backdrop-blur-md border border-[#E2DDD5] rounded-full px-4 py-1.5 text-xs text-[#6B6760] flex items-center gap-4 shadow-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-0.5 bg-[#1C1B1A] rounded-full"></div>
              <span className="text-[#121110] font-sans font-medium text-[11px]">Verified Link</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-0.5 border-b-2 border-dashed border-[#6E1827]"></div>
              <span className="text-[#6E1827] font-sans font-semibold text-[11px]">Predicted Conduit (ML)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full border-2 border-[#6E1827] bg-[#6E1827]/10"></div>
              <span className="text-[#121110] font-sans font-medium text-[11px]">Selected Entity</span>
            </div>
          </div>

          {/* Tips */}
          <div className="bg-white/80 backdrop-blur-sm border border-black/5 rounded-full px-3 py-1.5 text-[10px] text-[#8C877D] font-mono shadow-2xs hidden sm:flex items-center gap-2.5">
            <span>• <b>Drag</b> reposition</span>
            <span>• <b>Click</b> inspect</span>
            <span>• <b>Right-click</b> pan</span>
            <span>• <b>Scroll</b> zoom</span>
          </div>
        </div>
      </div>

      {/* 3. RIGHT PANEL: Investigation Inspector */}
      <motion.div
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="w-[350px] border-l border-[#E2DDD5] bg-white/90 backdrop-blur-md flex flex-col h-full overflow-y-auto select-none"
        id="graph-inspector-sidebar"
      >
        {/* Header */}
        <div className="p-4 border-b border-[#E2DDD5] bg-white/50 flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[#6E1827] font-bold">
            INTELLIGENCE INSPECTOR
          </span>
          {(selectedNode || selectedRel) && (
            <button
              onClick={() => {
                setSelectedNode(null);
                setSelectedRel(null);
              }}
              className="text-[10px] font-mono text-[#8C877D] hover:text-[#6E1827] uppercase cursor-pointer transition-colors"
            >
              Clear selection
            </button>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-[#E2DDD5] flex gap-1 px-4 pt-2 bg-white/40">
          {[
            { id: 'inspector', label: 'Inspector' },
            { id: 'relations', label: 'Relations' },
            { id: 'evidence', label: 'Evidence' },
            { id: 'timeline', label: 'Timeline' }
          ].map(tab => {
            const active = inspectorTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setInspectorTab(tab.id as any)}
                className={`pb-2 px-2 text-xs font-sans transition-all cursor-pointer border-b-2 font-medium ${
                  active
                    ? 'border-[#6E1827] text-[#6E1827] font-semibold'
                    : 'border-transparent text-[#8C877D] hover:text-[#121110]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content Pane */}
        <div className="p-5 flex-1" id="graph-inspector-pane">
          <AnimatePresence mode="wait">
            {selectedNode ? (
              <motion.div
                key={`node-${selectedNode.id}-${inspectorTab}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="space-y-5"
              >
                {/* TAB: Inspector (Overview / Details) */}
                {inspectorTab === 'inspector' && (
                  <>
                    {/* Entity Title & Type Header */}
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono uppercase font-bold text-[#6E1827] bg-[#6E1827]/10 border border-[#6E1827]/20 px-2.5 py-0.5 rounded-full">
                          {selectedNode.type}
                        </span>
                        <span className="text-[10px] font-mono border border-[#6E1827]/30 bg-[#6E1827]/10 text-[#6E1827] px-2.5 py-0.5 rounded-full font-bold tabular-nums">
                          Risk score: {Math.round((selectedNode.riskScore > 1.0 ? selectedNode.riskScore : selectedNode.riskScore * 100))}%
                        </span>
                      </div>
                      <h3 className="text-lg font-serif font-normal text-[#121110] mt-2">
                        {selectedNode.label}
                      </h3>
                    </div>

                    {/* Network Importance Translation */}
                    {(() => {
                      const importance = getNetworkImportance(selectedNode);
                      return (
                        <div className="border border-black/5 rounded-2xl p-4 bg-white/80 space-y-1.5 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-[#121110] font-sans">Network Importance</span>
                            <span className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded-full border uppercase ${importance.badgeColor}`}>
                              {importance.level}
                            </span>
                          </div>
                          <p className="text-xs text-[#6B6760] font-sans leading-relaxed">
                            {importance.explanation}
                          </p>
                        </div>
                      );
                    })()}

                    {/* Entity Overview Stats */}
                    {(() => {
                      const links = getNodeIncidentLinks(selectedNode.id);
                      const predictedCount = links.filter(l => l.isPredicted).length;
                      const verifiedCount = links.length - predictedCount;
                      return (
                        <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                          <div className="p-3 border border-black/5 rounded-2xl bg-white/80 shadow-2xs">
                            <div className="text-[10px] text-[#8C877D] uppercase font-medium">Links</div>
                            <div className="text-base font-semibold text-[#121110] mt-0.5 tabular-nums">{links.length}</div>
                          </div>
                          <div className="p-3 border border-black/5 rounded-2xl bg-white/80 shadow-2xs">
                            <div className="text-[10px] text-[#8C877D] uppercase font-medium">Verified</div>
                            <div className="text-base font-semibold text-[#121110] mt-0.5 tabular-nums">{verifiedCount}</div>
                          </div>
                          <div className="p-3 border border-[#6E1827]/15 rounded-2xl bg-[#6E1827]/5 shadow-2xs">
                            <div className="text-[10px] text-[#6E1827] uppercase font-medium">Predicted</div>
                            <div className="text-base font-semibold text-[#6E1827] mt-0.5 tabular-nums">{predictedCount}</div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Technical Graph Metrics Accordion */}
                    <div className="border border-black/5 rounded-2xl overflow-hidden bg-white/80">
                      <button
                        onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                        className="w-full flex items-center justify-between p-3.5 text-xs font-sans text-[#121110] hover:bg-black/5 transition-colors cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5 font-medium">
                          <BarChart3 className="h-3.5 w-3.5 text-[#6E1827]" />
                          Technical Graph Metrics
                        </span>
                        {showTechnicalDetails ? <ChevronUp className="h-4 w-4 text-[#8C877D]" /> : <ChevronDown className="h-4 w-4 text-[#8C877D]" />}
                      </button>
                      {showTechnicalDetails && (
                        <div className="p-3 bg-white space-y-2 text-xs font-mono text-[#6B6760] border-t border-black/5">
                          <div className="flex justify-between">
                            <span>Betweenness Centrality:</span>
                            <span className="font-semibold text-[#121110] tabular-nums">{selectedNode.betweenness.toFixed(3)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Eigenvector PageRank:</span>
                            <span className="font-semibold text-[#121110] tabular-nums">{selectedNode.pagerank.toFixed(3)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Degree Centrality:</span>
                            <span className="font-semibold text-[#121110] tabular-nums">{selectedNode.centrality.toFixed(3)}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Resolved Entity Attributes */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-mono text-[#8C877D] uppercase tracking-wider block border-b border-black/5 pb-1 font-medium">
                        Resolved Entity Attributes
                      </span>
                      <div className="space-y-1 font-mono text-xs">
                        {Object.entries(selectedNode.properties).map(([key, val]) => (
                          <div key={key} className="flex justify-between py-1 border-b border-black/5 text-[11px]">
                            <span className="text-[#8C877D] uppercase mr-2">{key}:</span>
                            <span className="text-[#121110] font-medium text-right max-w-[170px] truncate">{String(val)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Neighborhood Isolation Action Button */}
                    <div className="pt-2">
                      <button
                        onClick={() => handleToggleIsolate(selectedNode.id)}
                        className={`w-full flex items-center justify-center gap-2 rounded-2xl py-3 px-4 text-xs font-mono font-medium tracking-wider uppercase transition-colors cursor-pointer shadow-2xs ${
                          isolatedNodeId === selectedNode.id
                            ? 'bg-[#6E1827] hover:bg-[#52111C] text-white'
                            : 'bg-[#121110] hover:bg-[#6E1827] text-white'
                        }`}
                      >
                        {isolatedNodeId === selectedNode.id ? 'Clear Neighborhood Isolation' : 'Isolate Connected Neighbors'}
                      </button>
                    </div>
                  </>
                )}

                {/* TAB: Relations */}
                {inspectorTab === 'relations' && (
                  <div className="space-y-3">
                    <span className="text-[10px] font-mono text-[#6E1827] uppercase tracking-wider block font-bold">
                      Connected Entities ({getNodeIncidentLinks(selectedNode.id).length})
                    </span>
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {getNodeIncidentLinks(selectedNode.id).map(link => {
                        const partner = getNodePartnerEntity(link, selectedNode.id);
                        if (!partner) return null;
                        return (
                          <div
                            key={link.id}
                            className="p-3 border border-black/5 rounded-2xl bg-white flex items-center justify-between text-xs shadow-2xs hover:border-black/15 transition-colors"
                          >
                            <div>
                              <div className="font-semibold text-[#121110] font-sans">{partner.label}</div>
                              <div className="text-[10px] text-[#8C877D] font-mono mt-0.5 flex items-center gap-1.5">
                                <span className="uppercase">{link.type.replace('_', ' ')}</span>
                                <span>·</span>
                                <span className="tabular-nums">{Math.round(link.confidence * 100)}% conf</span>
                                {link.isPredicted && (
                                  <span className="bg-[#6E1827]/10 text-[#6E1827] px-1.5 py-0.2 rounded-full text-[9px] font-bold">
                                    PREDICTED
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setSelectedNode(partner);
                                setFocusNodeId(partner.id);
                              }}
                              className="text-[10px] font-mono text-[#121110] hover:text-white hover:bg-[#6E1827] border border-black/10 px-3 py-1 rounded-full transition-colors cursor-pointer"
                            >
                              Focus
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* TAB: Evidence */}
                {inspectorTab === 'evidence' && (
                  <div className="space-y-3 text-xs">
                    <span className="text-[10px] font-mono text-[#6E1827] uppercase tracking-wider block font-bold">
                      Entity Attributes &amp; Source Data
                    </span>
                    <div className="space-y-2">
                      {Object.keys(selectedNode.properties).length > 0 ? (
                        Object.entries(selectedNode.properties).map(([key, val]) => (
                          <div key={key} className="p-3.5 border border-black/5 rounded-2xl bg-white shadow-2xs space-y-1">
                            <div className="font-semibold text-[#121110] font-sans capitalize">{key.replace(/_/g, ' ')}</div>
                            <p className="text-xs text-[#6B6760] font-mono break-all">{String(val)}</p>
                          </div>
                        ))
                      ) : (
                        <div className="p-3.5 border border-black/5 rounded-2xl bg-white shadow-2xs space-y-1">
                          <div className="font-semibold text-[#121110] font-sans">Entity ID</div>
                          <p className="text-xs text-[#6B6760] font-mono break-all">{selectedNode.id}</p>
                        </div>
                      )}
                      <div className="p-3.5 border border-black/5 rounded-2xl bg-white shadow-2xs space-y-1">
                        <div className="font-semibold text-[#121110] font-sans">Graph UUID</div>
                        <p className="text-xs text-[#6B6760] font-mono break-all">{selectedNode.id}</p>
                      </div>
                      <div className="p-3.5 border border-black/5 rounded-2xl bg-white shadow-2xs space-y-1">
                        <div className="font-semibold text-[#121110] font-sans">Entity Type</div>
                        <p className="text-xs text-[#6B6760] font-mono uppercase">{selectedNode.type}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB: Timeline */}
                {inspectorTab === 'timeline' && (
                  <div className="space-y-3 text-xs">
                    <span className="text-[10px] font-mono text-[#6E1827] uppercase tracking-wider block font-bold">
                      Relationship Activity ({getNodeIncidentLinks(selectedNode.id).length} connections)
                    </span>
                    {getNodeIncidentLinks(selectedNode.id).length > 0 ? (
                      <div className="relative border-l border-black/10 ml-2 pl-3 space-y-4 py-1">
                        {getNodeIncidentLinks(selectedNode.id).map(link => {
                          const partner = getNodePartnerEntity(link, selectedNode.id);
                          return (
                            <div key={link.id}>
                              <div className="text-[10px] font-mono text-[#8C877D] uppercase">
                                {link.type.replace(/_/g, ' ')}
                                {link.isPredicted && <span className="ml-2 text-[#6E1827] font-bold">· PREDICTED</span>}
                              </div>
                              <div className="font-semibold text-[#121110] mt-0.5 font-sans">
                                {partner ? partner.label : 'Unknown Entity'}
                              </div>
                              <p className="text-xs text-[#6B6760] font-sans leading-relaxed mt-0.5">
                                Confidence: {Math.round((link.confidence || 0.8) * 100)}%
                                {partner && <span> · {partner.type}</span>}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-[10px] text-[#8C877D] font-mono uppercase p-3 border border-black/5 rounded-2xl bg-white">
                        No relationship events found for this entity.
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            ) : selectedRel ? (
              <motion.div
                key={`rel-${selectedRel.id}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="space-y-5"
              >
                {/* Relationship Inspector Header */}
                <div>
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-mono uppercase font-bold px-2.5 py-0.5 rounded-full border ${
                      selectedRel.isPredicted
                        ? 'bg-[#6E1827]/10 text-[#6E1827] border-[#6E1827]/30'
                        : 'bg-[#F7F5F0] text-[#121110] border-black/10'
                    }`}>
                      {selectedRel.isPredicted ? 'Predicted Relationship' : 'Verified Relationship'}
                    </span>
                    <span className="text-[10px] font-mono border border-black/10 bg-[#F7F5F0] text-[#121110] px-2.5 py-0.5 rounded-full font-bold tabular-nums">
                      Confidence: {Math.round(selectedRel.confidence * 100)}%
                    </span>
                  </div>
                  <h3 className="text-base font-serif font-normal text-[#121110] mt-2 uppercase">
                    {selectedRel.type.replace('_', ' ')}
                  </h3>
                </div>

                {/* Human-readable explanation */}
                {selectedRel.isPredicted ? (
                  <div className="p-4 border border-[#6E1827]/25 bg-[#6E1827]/5 rounded-2xl space-y-1.5 text-xs">
                    <div className="font-semibold text-[#6E1827] font-sans flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5 text-[#6E1827]" />
                      Potential Connection — High Model Confidence
                    </div>
                    <p className="text-[#6B6760] font-sans leading-relaxed">
                      Signals suggest a relationship based on shared communication patterns, co-location, and mutual associates.
                    </p>
                  </div>
                ) : (
                  <div className="p-4 border border-black/5 bg-white rounded-2xl space-y-1.5 text-xs shadow-2xs">
                    <div className="font-semibold text-[#121110] font-sans flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5 text-[#8C877D]" />
                      Verified Direct Link
                    </div>
                    <p className="text-[#6B6760] font-sans leading-relaxed">
                      This connection was extracted directly from registered documentary evidence and communication records.
                    </p>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="empty-state"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-6 flex flex-col items-center justify-center text-center text-[#8C877D] p-2 space-y-4"
                id="graph-inspector-empty"
              >
                <div className="w-12 h-12 rounded-full bg-[#6E1827]/10 border border-[#6E1827]/20 flex items-center justify-center text-[#6E1827]">
                  <Network className="h-6 w-6 stroke-[1.5]" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-serif font-normal text-[#121110]">No Entity Selected</h4>
                  <p className="text-xs font-sans text-[#6B6760] max-w-xs leading-relaxed">
                    Select any node in the 3D viewport or pick a key suspect below to inspect risk metrics, evidence, and predictive conduits:
                  </p>
                </div>

                {/* Quick Select Primary Targets */}
                {graphData && graphData.nodes.length > 0 && (
                  <div className="w-full pt-2 space-y-1.5 text-left">
                    <span className="text-[10px] font-mono text-[#6E1827] uppercase tracking-wider block font-bold">
                      Key Case Entities
                    </span>
                    <div className="space-y-1.5">
                      {graphData.nodes.slice(0, 4).map(node => (
                        <button
                          key={node.id}
                          onClick={() => {
                            setSelectedNode(node);
                            setFocusNodeId(node.id);
                          }}
                          className="w-full p-2.5 rounded-2xl bg-white border border-[#E6E1D8] hover:border-[#6E1827]/40 flex items-center justify-between text-xs font-sans transition-all shadow-2xs hover:shadow-xs cursor-pointer"
                        >
                          <div>
                            <div className="font-semibold text-[#121110]">{node.label}</div>
                            <div className="text-[10px] text-[#6B6760] font-mono uppercase">{node.type} · Risk {Math.round((node.riskScore > 1.0 ? node.riskScore : node.riskScore * 100))}%</div>
                          </div>
                          <span className="text-[10px] font-mono text-[#6E1827] font-bold">Inspect →</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default KnowledgeGraphPage;
