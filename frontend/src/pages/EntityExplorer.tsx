import React, { useEffect, useState } from 'react';
import {
  Search,
  Users,
  Building2,
  Phone,
  Truck,
  MapPin,
  Calendar,
  Network,
  ArrowRight,
  TrendingUp,
  ShieldAlert,
  Sliders,
  ExternalLink
} from 'lucide-react';
import { apiClient } from '../api/client';
import { Entity, Relationship, EntityType, GraphData, Case } from '../types';

interface EntityExplorerProps {
  activeCase?: Case | null;
  onSelectEntity?: (entity: Entity) => void;
  onNavigateToGraph?: (entityIds?: string[]) => void;
}

export const EntityExplorer: React.FC<EntityExplorerProps> = ({
  activeCase,
  onSelectEntity,
  onNavigateToGraph
}) => {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTypeTab, setActiveTypeTab] = useState<string>('all');

  useEffect(() => {
    fetchEntities();
  }, [activeCase?.id]);

  const fetchEntities = async () => {
    setLoading(true);
    setError(null);
    try {
      let targetCaseId = activeCase?.id;
      if (!targetCaseId) {
        const cases = await apiClient.cases.list();
        if (cases.length > 0) targetCaseId = cases[0].id;
      }

      const data = await apiClient.graph.getGraphData(targetCaseId);
      setGraphData(data);
      setEntities(data.nodes);
      if (data.nodes.length > 0) {
        setSelectedEntity(data.nodes[0]);
      } else {
        setSelectedEntity(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch entities directory records.');
    } finally {
      setLoading(false);
    }
  };

  const filteredEntities = entities.filter(ent => {
    const matchesSearch =
      ent.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ent.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      Object.values(ent.properties).some(v => String(v).toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesTab = activeTypeTab === 'all' || ent.type === activeTypeTab;
    return matchesSearch && matchesTab;
  });

  const getEntityIcon = (type: EntityType) => {
    switch (type) {
      case 'person':
        return Users;
      case 'organization':
        return Building2;
      case 'phone':
        return Phone;
      case 'vehicle':
        return Truck;
      case 'location':
        return MapPin;
      case 'event':
        return Calendar;
      default:
        return Users;
    }
  };

  // 1-hop connections for the selected entity
  const connectedNeighbors = selectedEntity && graphData
    ? graphData.links
        .map(link => {
          const sourceId = typeof link.source === 'object' ? (link.source as any).id : link.source;
          const targetId = typeof link.target === 'object' ? (link.target as any).id : link.target;

          if (sourceId === selectedEntity.id) {
            const node = graphData.nodes.find(n => n.id === targetId);
            return node ? { node, relationship: link, direction: 'outgoing' as const } : null;
          }
          if (targetId === selectedEntity.id) {
            const node = graphData.nodes.find(n => n.id === sourceId);
            return node ? { node, relationship: link, direction: 'incoming' as const } : null;
          }
          return null;
        })
        .filter(Boolean) as Array<{ node: Entity; relationship: Relationship; direction: 'incoming' | 'outgoing' }>
    : [];

  return (
    <div className="space-y-8 animate-fade-in max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E2DDD5]">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono tracking-widest text-[#6E1827] uppercase font-semibold">
            <span>Intelligence Directory</span>
            <span>·</span>
            <span>Topological Centrality</span>
          </div>
          <h1 className="text-3xl font-serif font-normal tracking-tight text-[#121110]">
            Entities Explorer
          </h1>
          <p className="text-sm text-[#6B6760] font-sans mt-1">
            Directory of extracted persons, front organizations, communication devices, vehicles, and logistical locations.
          </p>
        </div>

        <div className="text-xs font-mono text-[#6B6760] bg-white border border-[#E2DDD5] px-3.5 py-2 rounded-[2px]">
          Total nodes: {entities.length}
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
            placeholder="Search entity name, alias, properties..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-[#E2DDD5] rounded-[2px] text-xs font-mono text-[#121110] placeholder-[#6B6760] focus:outline-none focus:border-[#6E1827]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'all', label: 'All' },
            { id: 'person', label: 'Persons' },
            { id: 'organization', label: 'Organizations' },
            { id: 'phone', label: 'Phones' },
            { id: 'vehicle', label: 'Vehicles' },
            { id: 'location', label: 'Locations' },
            { id: 'event', label: 'Events' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTypeTab(tab.id)}
              className={`px-3 py-1.5 text-xs font-mono rounded-[2px] transition-colors ${
                activeTypeTab === tab.id
                  ? 'bg-[#121110] text-white'
                  : 'bg-white border border-[#E2DDD5] text-[#6B6760] hover:text-[#121110] hover:bg-[#F7F5F0]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Catalog + Deep Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Entity Cards */}
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {loading ? (
            <div className="col-span-2 p-12 text-center text-xs font-mono text-[#6B6760] bg-white border border-[#E2DDD5] rounded-[2px]">
              Loading network nodes...
            </div>
          ) : filteredEntities.length === 0 ? (
            <div className="col-span-2 p-8 text-center text-xs font-mono text-[#6B6760] bg-white border border-[#E2DDD5] rounded-[2px]">
              No matching entities located.
            </div>
          ) : (
            filteredEntities.map(ent => {
              const isSelected = selectedEntity?.id === ent.id;
              const Icon = getEntityIcon(ent.type);
              return (
                <div
                  key={ent.id}
                  onClick={() => setSelectedEntity(ent)}
                  className={`p-4 rounded-[2px] border cursor-pointer transition-colors space-y-2.5 ${
                    isSelected
                      ? 'bg-white border-[#121110]'
                      : 'bg-white border-[#E2DDD5] hover:border-[#C8C3BA]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-[#6E1827] uppercase tracking-wider font-semibold">
                      {ent.type}
                    </span>
                    <span className="text-[10px] font-mono text-[#6B6760]">
                      ID: {ent.id}
                    </span>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-[2px] bg-[#F7F5F0] border border-[#E2DDD5] flex items-center justify-center text-[#121110] shrink-0">
                      <Icon className="w-4 h-4 text-[#6B6760]" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-[#121110] font-sans">
                        {ent.label}
                      </h4>
                      <div className="text-[11px] text-[#6B6760] font-mono mt-0.5">
                        Degree: {ent.degree} · PageRank: {ent.pagerank?.toFixed(2) || '0.12'}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#E2DDD5] flex items-center justify-between text-[10px] font-mono text-[#6B6760]">
                    <span>Centrality: {(ent.centrality * 100).toFixed(0)}%</span>
                    <span className="text-[#6E1827] font-semibold">
                      {ent.anomalyScore && ent.anomalyScore > 0.6 ? 'High Risk' : 'Normal'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Selected Entity Dossier Inspector */}
        <div className="lg:col-span-5 bg-white border border-[#E2DDD5] p-6 rounded-[2px] space-y-6">
          {selectedEntity ? (
            <>
              <div className="space-y-1 pb-4 border-b border-[#E2DDD5]">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-[#6E1827] uppercase tracking-wider font-semibold">
                    Entity Profile Dossier
                  </span>
                  <span className="text-xs font-mono text-[#6B6760]">
                    Type: {selectedEntity.type}
                  </span>
                </div>
                <h3 className="text-xl font-serif font-normal text-[#121110]">
                  {selectedEntity.label}
                </h3>
              </div>

              {/* Topological Metrics */}
              <div className="grid grid-cols-3 gap-2 font-mono text-center">
                <div className="p-3 bg-[#F7F5F0] border border-[#E2DDD5] rounded-[2px]">
                  <div className="text-[10px] text-[#6B6760] uppercase">Degree</div>
                  <div className="text-lg font-medium text-[#121110] tabular-nums">
                    {selectedEntity.degree}
                  </div>
                </div>
                <div className="p-3 bg-[#F7F5F0] border border-[#E2DDD5] rounded-[2px]">
                  <div className="text-[10px] text-[#6B6760] uppercase">Betweenness</div>
                  <div className="text-lg font-medium text-[#121110] tabular-nums">
                    {selectedEntity.betweenness.toFixed(2)}
                  </div>
                </div>
                <div className="p-3 bg-[#F7F5F0] border border-[#E2DDD5] rounded-[2px]">
                  <div className="text-[10px] text-[#6E1827] uppercase">PageRank</div>
                  <div className="text-lg font-medium text-[#6E1827] tabular-nums">
                    {selectedEntity.pagerank?.toFixed(2) || '0.12'}
                  </div>
                </div>
              </div>

              {/* Entity Properties */}
              <div className="space-y-2">
                <div className="text-[10px] font-mono text-[#6B6760] uppercase tracking-wider">
                  Extracted Properties
                </div>
                <div className="p-3 bg-[#F7F5F0] border border-[#E2DDD5] rounded-[2px] divide-y divide-[#E2DDD5] text-xs font-mono">
                  {Object.entries(selectedEntity.properties).map(([k, v]) => (
                    <div key={k} className="py-1.5 flex items-center justify-between">
                      <span className="text-[#6B6760] uppercase">{k}:</span>
                      <span className="text-[#121110] font-medium">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Connected Neighbors */}
              <div className="space-y-2">
                <div className="text-[10px] font-mono text-[#6B6760] uppercase tracking-wider">
                  1-Hop Neighbors ({connectedNeighbors.length})
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {connectedNeighbors.map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedEntity(item.node)}
                      className="p-2.5 bg-white border border-[#E2DDD5] hover:border-[#C8C3BA] rounded-[2px] cursor-pointer flex items-center justify-between text-xs font-mono transition-colors"
                    >
                      <div>
                        <div className="font-medium text-[#121110] font-sans">{item.node.label}</div>
                        <div className="text-[10px] text-[#6B6760]">
                          {item.relationship.type} · {item.direction}
                        </div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-[#6B6760]" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions: Open Drawer / Open in Graph */}
              <div className="pt-2 space-y-2">
                <button
                  onClick={() => onSelectEntity?.(selectedEntity)}
                  className="w-full py-2.5 bg-[#121110] text-white text-xs font-mono font-medium rounded-[2px] hover:bg-[#262524] transition-colors flex items-center justify-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#6E1827]"
                >
                  <Users className="w-4 h-4" />
                  <span>Inspect Full Dossier Drawer</span>
                </button>

                <button
                  onClick={() => onNavigateToGraph?.([selectedEntity.id])}
                  className="w-full py-2 bg-white border border-[#E2DDD5] text-xs font-mono text-[#121110] rounded-[2px] hover:bg-[#F0ECE4] transition-colors flex items-center justify-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#6E1827]"
                >
                  <Network className="w-4 h-4" />
                  <span>Locate in 3D Knowledge Graph</span>
                </button>
              </div>
            </>
          ) : (
            <div className="py-12 text-center text-xs font-mono text-[#6B6760]">
              Select an entity record to inspect dossier.
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
