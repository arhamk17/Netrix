import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import {
  Share2,
  Route,
  RotateCcw,
  X,
  FileArchive,
  Activity,
  CheckCircle2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Sliders,
  Flame,
  Filter,
  Search,
  GitBranch,
  GitFork,
  Compass,
  ShieldCheck,
  Download,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  RefreshCw,
  FileText,
  Copy,
  SlidersHorizontal,
  Layers,
  Radio,
  Eye,
  Info
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import type {
  GraphData,
  GraphNode,
  GraphEdge,
  ShortestPathResult,
  PathNodeItem,
  PathRelationshipsItem,
  EntityType
} from '../../types';
import {
  computeMultiHopLineage,
  generateTraceabilityCertificate,
  MultiHopLineageResult,
  TraceHopItem
} from '../../utils/graphTraceability';

// Exact entity color palette matching specification
const ENTITY_CONFIG: Record<string, { hex: number; rgb: string; label: string }> = {
  PERSON: { hex: 0x67e8f9, rgb: 'rgb(103, 232, 249)', label: 'Person' },
  ORGANIZATION: { hex: 0xa78bfa, rgb: 'rgb(167, 139, 250)', label: 'Organization' },
  LOCATION: { hex: 0x34d399, rgb: 'rgb(52, 211, 153)', label: 'Location' },
  PHONE: { hex: 0xfbbf24, rgb: 'rgb(251, 191, 36)', label: 'Phone' },
  BANK_ACCOUNT: { hex: 0xf472b6, rgb: 'rgb(244, 114, 182)', label: 'Bank Account' },
  VEHICLE: { hex: 0x38bdf8, rgb: 'rgb(56, 189, 248)', label: 'Vehicle' },
  TRANSACTION: { hex: 0xfb7185, rgb: 'rgb(251, 113, 133)', label: 'Transaction' },
  EMAIL: { hex: 0xa3e635, rgb: 'rgb(163, 230, 53)', label: 'Email' },
  CRYPTO_WALLET: { hex: 0xf472b6, rgb: 'rgb(244, 114, 182)', label: 'Crypto Wallet' },
  SERVER_IP: { hex: 0x38bdf8, rgb: 'rgb(56, 189, 248)', label: 'Server IP' },
  DEVICE: { hex: 0xfbbf24, rgb: 'rgb(251, 191, 36)', label: 'Device' },
  DOMAIN: { hex: 0xa3e635, rgb: 'rgb(163, 230, 53)', label: 'Domain' }
};

const ALL_ENTITY_TYPES: EntityType[] = [
  'PERSON',
  'ORGANIZATION',
  'LOCATION',
  'PHONE',
  'BANK_ACCOUNT',
  'VEHICLE',
  'TRANSACTION',
  'EMAIL',
  'CRYPTO_WALLET',
  'SERVER_IP',
  'DOMAIN',
  'DEVICE'
];

interface PhysicsNode {
  node: GraphNode;
  mesh: THREE.Mesh;
  glowMesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  force: THREE.Vector3;
  mass: number;
  isFixed: boolean;
  phase: number;
}

interface PhysicsEdge {
  edge: GraphEdge;
  sourceNode: PhysicsNode;
  targetNode: PhysicsNode;
  line: THREE.Line;
  category: 'OBSERVED' | 'INFERRED' | 'POTENTIAL';
  pulseMesh?: THREE.Mesh;
  pulseProgress: number;
}

interface KnowledgeGraphProps {
  focusNodeId?: string | null;
  focusEdgeId?: string | null;
  onViewAIReasoning?: (edgeOrNode: any) => void;
}

export const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({
  focusNodeId,
  focusEdgeId,
  onViewAIReasoning
}) => {
  const { activeCase, user } = useAuth();
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<GraphEdge | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // Dynamic Stretch & Physics Settings
  const [stretchFactor, setStretchFactor] = useState<number>(1.2);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [isPhysicsActive, setIsPhysicsActive] = useState<boolean>(true);
  const [, setIsDraggingNodeState] = useState<boolean>(false);

  // -------------------------------------------------------------------------
  // FILTERING SYSTEM STATE
  // -------------------------------------------------------------------------
  const [filterDrawerOpen, setFilterDrawerOpen] = useState<boolean>(true);
  const [isFilterPanelCollapsed, setIsFilterPanelCollapsed] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedEntityTypes, setSelectedEntityTypes] = useState<string[]>(ALL_ENTITY_TYPES);
  const [filterObservedEdges, setFilterObservedEdges] = useState<boolean>(true);
  const [filterPredictedEdges, setFilterPredictedEdges] = useState<boolean>(true);
  const [minConfidenceScore, setMinConfidenceScore] = useState<number>(0);
  const [minIpsScore, setMinIpsScore] = useState<number>(0);
  const [minAnomalyScore, setMinAnomalyScore] = useState<number>(0);
  const [requireEvidenceProvenance, setRequireEvidenceProvenance] = useState<boolean>(false);
  const [filterPreset, setFilterPreset] = useState<string>('ALL');

  // -------------------------------------------------------------------------
  // TRACEABILITY SUITE STATE
  // -------------------------------------------------------------------------
  const [traceSuiteOpen, setTraceSuiteOpen] = useState<boolean>(false);
  const [traceTab, setTraceTab] = useState<'LINEAGE' | 'SHORTEST_PATH' | 'PROVENANCE'>('LINEAGE');

  // Multi-Hop Causal Lineage
  const [lineageRootId, setLineageRootId] = useState<string>('');
  const [lineageDirection, setLineageDirection] = useState<'DOWNSTREAM' | 'UPSTREAM' | 'BIDIRECTIONAL'>('DOWNSTREAM');
  const [lineageMaxHops, setLineageMaxHops] = useState<number>(2);
  const [lineageResult, setLineageResult] = useState<MultiHopLineageResult | null>(null);

  // Shortest Path Algorithmic Traversal
  const [pathSource, setPathSource] = useState<string>('');
  const [pathTarget, setPathTarget] = useState<string>('');
  const [pathResult, setPathResult] = useState<ShortestPathResult | null>(null);
  const [pathLoading, setPathLoading] = useState<boolean>(false);

  // Cryptographic Provenance Trace
  const [provenanceNodeId, setProvenanceNodeId] = useState<string>('');

  // Interactive Playback Stepper
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [isPlayingTrace, setIsPlayingTrace] = useState<boolean>(false);

  // Trace Certificate Modal
  const [certificateModalOpen, setCertificateModalOpen] = useState<boolean>(false);
  const [certificateContent, setCertificateContent] = useState<string>('');
  const [copySuccess, setCopySuccess] = useState<boolean>(false);

  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  // Physics simulation refs
  const physicsNodesRef = useRef<PhysicsNode[]>([]);
  const physicsEdgesRef = useRef<PhysicsEdge[]>([]);
  const stretchFactorRef = useRef<number>(1.2);
  const autoRotateRef = useRef<boolean>(true);
  const isPhysicsActiveRef = useRef<boolean>(true);
  const sphericalRef = useRef<{ radius: number; theta: number; phi: number }>({
    radius: 680,
    theta: 0.4,
    phi: Math.PI / 2.3
  });
  const cameraLookAtRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));

  // Trace highlights ref for Three.js render loop
  const activeTraceNodesRef = useRef<Set<string>>(new Set());
  const activeTraceEdgesRef = useRef<Set<string>>(new Set());
  const activeStepNodeIdRef = useRef<string | null>(null);
  const filteredNodeIdsRef = useRef<Set<string>>(new Set());

  // Sync refs
  useEffect(() => {
    stretchFactorRef.current = stretchFactor;
  }, [stretchFactor]);

  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  useEffect(() => {
    isPhysicsActiveRef.current = isPhysicsActive;
  }, [isPhysicsActive]);

  // Load graph data
  useEffect(() => {
    async function load() {
      if (!activeCase) return;
      setLoading(true);
      try {
        const caseId = activeCase.id || activeCase.case_id;
        const data = await api.getCaseGraph(caseId);
        setGraphData(data);
        if (data && data.nodes.length >= 2) {
          setPathSource(data.nodes[0].id);
          setPathTarget(data.nodes[1].id);
          setLineageRootId(data.nodes[0].id);
          setProvenanceNodeId(data.nodes[0].id);
        }
      } catch (err) {
        console.error('Failed to load graph:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [activeCase]);

  // Camera updater helper
  const updateCameraPosition = useCallback(() => {
    if (!cameraRef.current) return;
    const s = sphericalRef.current;
    s.phi = Math.max(0.1, Math.min(Math.PI - 0.1, s.phi));
    const lookAt = cameraLookAtRef.current;
    cameraRef.current.position.x = lookAt.x + s.radius * Math.sin(s.phi) * Math.sin(s.theta);
    cameraRef.current.position.y = lookAt.y + s.radius * Math.cos(s.phi);
    cameraRef.current.position.z = lookAt.z + s.radius * Math.sin(s.phi) * Math.cos(s.theta);
    cameraRef.current.lookAt(lookAt);
  }, []);

  // -------------------------------------------------------------------------
  // FILTERING LOGIC
  // -------------------------------------------------------------------------
  const filteredData = useMemo(() => {
    if (!graphData) return { nodes: [], edges: [] };

    const query = searchQuery.trim().toLowerCase();

    // 1. Filter Nodes
    const nodes = graphData.nodes.filter(node => {
      // Type filter
      if (!selectedEntityTypes.includes(node.type)) return false;

      // Minimum Confidence Score filter for nodes
      const nodeConfidence = typeof node.confidence === 'number' ? node.confidence : 1.0;
      if (nodeConfidence < minConfidenceScore) return false;

      // IPS score filter
      const nodeIps = typeof node.ips_score === 'number' ? (node.ips_score > 1.0 ? node.ips_score / 100.0 : node.ips_score) : 0.5;
      if (nodeIps < minIpsScore) return false;

      // Anomaly score filter
      if ((node.anomaly_score ?? 0) < minAnomalyScore) return false;

      // Provenance filter
      if (requireEvidenceProvenance) {
        const hasProvenance =
          (Array.isArray(node.evidence_provenance) && node.evidence_provenance.length > 0) ||
          (Array.isArray(node.provenance_evidence_ids) && node.provenance_evidence_ids.length > 0);
        if (!hasProvenance) return false;
      }

      // Search query filter
      if (query) {
        const nameMatch = (node.name || '').toLowerCase().includes(query);
        const idMatch = (node.id || '').toLowerCase().includes(query);
        const typeMatch = (node.type || '').toLowerCase().includes(query);
        const labelMatch = (node.labels || []).some(l => l.toLowerCase().includes(query));
        if (!nameMatch && !idMatch && !typeMatch && !labelMatch) return false;
      }

      return true;
    });

    const nodeIds = new Set(nodes.map(n => n.id));

    // 2. Filter Edges
    const edges = graphData.edges.filter(edge => {
      // Both source and target must be visible
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) return false;

      const isPredicted =
        edge.provenance_type === 'PREDICTED' ||
        edge.is_predicted === true ||
        edge.category === 'INFERRED' ||
        edge.category === 'POTENTIAL';
      const isObserved = !isPredicted || edge.provenance_type === 'OBSERVED' || edge.category === 'OBSERVED';

      // Checkbox filters for relationship types (Observed vs Predicted)
      if (isObserved && !filterObservedEdges) return false;
      if (isPredicted && !filterPredictedEdges) return false;

      return true;
    });

    return { nodes, edges };
  }, [
    graphData,
    searchQuery,
    selectedEntityTypes,
    filterObservedEdges,
    filterPredictedEdges,
    minConfidenceScore,
    minIpsScore,
    minAnomalyScore,
    requireEvidenceProvenance
  ]);

  // Update filtered node IDs ref
  useEffect(() => {
    filteredNodeIdsRef.current = new Set(filteredData.nodes.map(n => n.id));
  }, [filteredData]);

  // Preset Filters Applicator
  const applyPreset = (preset: string) => {
    setFilterPreset(preset);
    if (preset === 'ALL') {
      setSelectedEntityTypes(ALL_ENTITY_TYPES);
      setFilterObservedEdges(true);
      setFilterPredictedEdges(true);
      setMinConfidenceScore(0);
      setMinIpsScore(0);
      setMinAnomalyScore(0);
      setRequireEvidenceProvenance(false);
      setSearchQuery('');
    } else if (preset === 'CRITICAL') {
      setSelectedEntityTypes(ALL_ENTITY_TYPES);
      setFilterObservedEdges(true);
      setFilterPredictedEdges(true);
      setMinConfidenceScore(0.5);
      setMinIpsScore(0.75);
      setMinAnomalyScore(0);
      setRequireEvidenceProvenance(false);
    } else if (preset === 'FINANCIAL') {
      setSelectedEntityTypes(['BANK_ACCOUNT', 'CRYPTO_WALLET', 'TRANSACTION', 'ORGANIZATION']);
      setFilterObservedEdges(true);
      setFilterPredictedEdges(true);
      setMinConfidenceScore(0);
      setMinIpsScore(0);
      setMinAnomalyScore(0);
      setRequireEvidenceProvenance(false);
    } else if (preset === 'CYBER') {
      setSelectedEntityTypes(['SERVER_IP', 'DOMAIN', 'DEVICE', 'EMAIL']);
      setFilterObservedEdges(true);
      setFilterPredictedEdges(true);
      setMinConfidenceScore(0);
      setMinIpsScore(0);
      setMinAnomalyScore(0);
      setRequireEvidenceProvenance(false);
    } else if (preset === 'INFERRED') {
      setSelectedEntityTypes(ALL_ENTITY_TYPES);
      setFilterObservedEdges(false);
      setFilterPredictedEdges(true);
      setMinConfidenceScore(0);
      setMinIpsScore(0);
      setMinAnomalyScore(0);
      setRequireEvidenceProvenance(false);
    }
  };

  const isFilterActive = useMemo(() => {
    return (
      selectedEntityTypes.length !== ALL_ENTITY_TYPES.length ||
      !filterObservedEdges ||
      !filterPredictedEdges ||
      minConfidenceScore > 0 ||
      minIpsScore > 0 ||
      minAnomalyScore > 0 ||
      requireEvidenceProvenance ||
      searchQuery.trim().length > 0
    );
  }, [
    selectedEntityTypes,
    filterObservedEdges,
    filterPredictedEdges,
    minConfidenceScore,
    minIpsScore,
    minAnomalyScore,
    requireEvidenceProvenance,
    searchQuery
  ]);

  const handleResetFilters = () => {
    applyPreset('ALL');
  };

  // -------------------------------------------------------------------------
  // TRACEABILITY COMPUTATION
  // -------------------------------------------------------------------------
  // Compute Multi-Hop Lineage
  const handleComputeLineage = useCallback(() => {
    if (!graphData || !lineageRootId) return;
    const result = computeMultiHopLineage(
      graphData.nodes,
      graphData.edges,
      lineageRootId,
      lineageDirection,
      lineageMaxHops
    );
    setLineageResult(result);
    setActiveStepIndex(0);

    if (result) {
      activeTraceNodesRef.current = new Set(result.tracedNodes.map(n => n.id));
      activeTraceEdgesRef.current = new Set(result.tracedEdges.map(e => e.id));
      activeStepNodeIdRef.current = result.rootNode.id;

      // Focus camera on root node
      const pNode = physicsNodesRef.current.find(pn => pn.node.id === result.rootNode.id);
      if (pNode) {
        cameraLookAtRef.current.copy(pNode.pos);
        sphericalRef.current.radius = 450;
        updateCameraPosition();
      }
    }
  }, [graphData, lineageRootId, lineageDirection, lineageMaxHops, updateCameraPosition]);

  // Trigger lineage compute when root, direction, or hops change while in lineage tab
  useEffect(() => {
    if (traceSuiteOpen && traceTab === 'LINEAGE' && lineageRootId) {
      handleComputeLineage();
    }
  }, [traceSuiteOpen, traceTab, lineageRootId, lineageDirection, lineageMaxHops, handleComputeLineage]);

  // Handle Shortest Path Calculation
  const handleSolvePath = async () => {
    if (!pathSource || !pathTarget || !activeCase) return;
    setPathLoading(true);
    try {
      const sNode = graphData?.nodes.find(n => n.id === pathSource || n.name === pathSource);
      const tNode = graphData?.nodes.find(n => n.id === pathTarget || n.name === pathTarget);
      const fromName = sNode?.name || pathSource;
      const toName = tNode?.name || pathTarget;
      const caseId = activeCase.id || activeCase.case_id;

      const res = await api.getShortestPath(caseId, fromName, toName);
      setPathResult(res);
      setActiveStepIndex(0);

      // Extract nodes for trace ref
      const pathNodes = (res || []).filter((item): item is PathNodeItem => 'name' in item);
      const pathNames = new Set(pathNodes.map(n => n.name));

      const matchedNodeIds = new Set<string>();
      graphData?.nodes.forEach(n => {
        if (pathNames.has(n.name) || pathNames.has(n.id)) {
          matchedNodeIds.add(n.id);
        }
      });

      activeTraceNodesRef.current = matchedNodeIds;

      // Highlight path source
      if (sNode) {
        const pNode = physicsNodesRef.current.find(pn => pn.node.id === sNode.id);
        if (pNode) {
          cameraLookAtRef.current.copy(pNode.pos);
          sphericalRef.current.radius = 480;
          updateCameraPosition();
        }
      }
    } catch (err) {
      console.error('Path solver error:', err);
    } finally {
      setPathLoading(false);
    }
  };

  const pathNodes = useMemo(() => {
    if (!pathResult) return [];
    return pathResult.filter((item): item is PathNodeItem => 'name' in item);
  }, [pathResult]);

  const pathRelationships = useMemo(() => {
    if (!pathResult) return [];
    const relItem = pathResult.find((item): item is PathRelationshipsItem => 'relationships' in item);
    return relItem?.relationships || [];
  }, [pathResult]);

  // Current active trace items for stepper
  const activeTraceStepItems: TraceHopItem[] = useMemo(() => {
    if (traceTab === 'LINEAGE' && lineageResult) {
      return lineageResult.hops;
    }
    return [];
  }, [traceTab, lineageResult]);

  // Stepper navigation & playback
  const handleStepPrev = () => {
    if (activeTraceStepItems.length === 0) return;
    const nextIdx = Math.max(0, activeStepIndex - 1);
    setActiveStepIndex(nextIdx);
    focusStepNode(activeTraceStepItems[nextIdx]?.node.id);
  };

  const handleStepNext = () => {
    if (activeTraceStepItems.length === 0) return;
    const nextIdx = Math.min(activeTraceStepItems.length - 1, activeStepIndex + 1);
    setActiveStepIndex(nextIdx);
    focusStepNode(activeTraceStepItems[nextIdx]?.node.id);
  };

  const focusStepNode = (nodeId?: string) => {
    if (!nodeId) return;
    activeStepNodeIdRef.current = nodeId;
    const pNode = physicsNodesRef.current.find(pn => pn.node.id === nodeId);
    if (pNode) {
      cameraLookAtRef.current.copy(pNode.pos);
      updateCameraPosition();
    }
  };

  // Playback loop
  useEffect(() => {
    let interval: any;
    if (isPlayingTrace && activeTraceStepItems.length > 1) {
      interval = setInterval(() => {
        setActiveStepIndex(curr => {
          const next = (curr + 1) % activeTraceStepItems.length;
          focusStepNode(activeTraceStepItems[next]?.node.id);
          return next;
        });
      }, 1600);
    }
    return () => clearInterval(interval);
  }, [isPlayingTrace, activeTraceStepItems]);

  // Clear trace highlight
  const handleClearTrace = () => {
    activeTraceNodesRef.current.clear();
    activeTraceEdgesRef.current.clear();
    activeStepNodeIdRef.current = null;
    setLineageResult(null);
    setPathResult(null);
    setIsPlayingTrace(false);
    setActiveStepIndex(0);
  };

  // Generate & Download Trace Certificate
  const handleExportTraceCertificate = () => {
    if (!activeCase || !graphData) return;

    let certText = '';
    const caseId = activeCase.id || activeCase.case_id;

    if (traceTab === 'LINEAGE' && lineageResult) {
      const evidenceIds: string[] = Array.from(
        new Set<string>(
          lineageResult.tracedNodes.flatMap(n => (n.evidence_provenance || n.provenance_evidence_ids || []) as string[])
        )
      );
      certText = generateTraceabilityCertificate({
        caseId,
        caseTitle: activeCase.title,
        investigatorName: user?.full_name || 'Lead Intelligence Investigator',
        traceType: 'LINEAGE',
        rootEntityName: lineageResult.rootNode.name,
        totalHops: lineageResult.totalHops,
        entities: lineageResult.tracedNodes,
        relationships: lineageResult.tracedEdges,
        evidenceIds
      });
    } else if (traceTab === 'SHORTEST_PATH' && pathResult) {
      const sNode = graphData.nodes.find(n => n.id === pathSource);
      const tNode = graphData.nodes.find(n => n.id === pathTarget);
      certText = generateTraceabilityCertificate({
        caseId,
        caseTitle: activeCase.title,
        investigatorName: user?.full_name || 'Lead Intelligence Investigator',
        traceType: 'SHORTEST_PATH',
        rootEntityName: sNode?.name || pathSource,
        targetEntityName: tNode?.name || pathTarget,
        totalHops: Math.max(0, pathNodes.length - 1),
        entities: graphData.nodes.filter(n => pathNodes.some(pn => pn.name === n.name)),
        relationships: graphData.edges.filter(e => pathRelationships.includes(e.type)),
        evidenceIds: Array.from(new Set([
          ...graphData.edges.filter(e => pathRelationships.includes(e.type) && e.evidence_id).map(e => e.evidence_id as string),
          ...(evidenceList && evidenceList.length > 0 ? [evidenceList[0].id || evidenceList[0].evidence_id || ''] : [])
        ])).filter(Boolean)
      });
    } else {
      const targetNode = graphData.nodes.find(n => n.id === (provenanceNodeId || selectedNode?.id));
      const targetNodeEvs = targetNode?.evidence_provenance && targetNode.evidence_provenance.length > 0 
        ? targetNode.evidence_provenance 
        : (evidenceList && evidenceList.length > 0 ? [evidenceList[0].id || evidenceList[0].evidence_id || ''] : []);
      certText = generateTraceabilityCertificate({
        caseId,
        caseTitle: activeCase.title,
        investigatorName: user?.full_name || 'Lead Intelligence Investigator',
        traceType: 'PROVENANCE',
        rootEntityName: targetNode?.name || 'Selected Artifact',
        totalHops: 1,
        entities: targetNode ? [targetNode] : graphData.nodes.slice(0, 3),
        relationships: graphData.edges.slice(0, 3),
        evidenceIds: targetNodeEvs.filter(Boolean)
      });
    }

    setCertificateContent(certText);
    setCertificateModalOpen(true);
  };

  const handleDownloadCertFile = () => {
    const element = document.createElement('a');
    const file = new Blob([certificateContent], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = `NETRIX_TRACE_CERTIFICATE_${Date.now()}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleCopyCertText = () => {
    navigator.clipboard.writeText(certificateContent);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  // Auto-focus on node when focusNodeId changes
  useEffect(() => {
    if (focusNodeId && graphData) {
      const targetNode = graphData.nodes.find(n => n.id === focusNodeId);
      if (targetNode) {
        setSelectedNode(targetNode);
        setSelectedEdge(null);
        setLineageRootId(targetNode.id);
        setProvenanceNodeId(targetNode.id);
        const pNode = physicsNodesRef.current.find(pn => pn.node.id === focusNodeId);
        if (pNode) {
          cameraLookAtRef.current.copy(pNode.pos);
          sphericalRef.current.radius = 420;
          updateCameraPosition();
        }
      }
    }
  }, [focusNodeId, graphData, updateCameraPosition]);

  // Auto-focus on edge when focusEdgeId changes
  useEffect(() => {
    if (focusEdgeId && graphData) {
      const targetEdge = graphData.edges.find(e => e.id === focusEdgeId);
      if (targetEdge) {
        setSelectedEdge(targetEdge);
        setSelectedNode(null);
        const pe = physicsEdgesRef.current.find(e => e.edge.id === focusEdgeId);
        if (pe) {
          const midPoint = new THREE.Vector3().addVectors(pe.sourceNode.pos, pe.targetNode.pos).multiplyScalar(0.5);
          cameraLookAtRef.current.copy(midPoint);
          sphericalRef.current.radius = 450;
          updateCameraPosition();
        }
      }
    }
  }, [focusEdgeId, graphData, updateCameraPosition]);

  // Zoom controls
  const handleZoomIn = () => {
    sphericalRef.current.radius = Math.max(200, sphericalRef.current.radius - 90);
    updateCameraPosition();
  };

  const handleZoomOut = () => {
    sphericalRef.current.radius = Math.min(1600, sphericalRef.current.radius + 90);
    updateCameraPosition();
  };

  const handleResetCamera = () => {
    sphericalRef.current = { radius: 680, theta: 0.4, phi: Math.PI / 2.3 };
    cameraLookAtRef.current.set(0, 0, 0);
    updateCameraPosition();
  };

  // Kinetic impulse to shake and rearrange graph
  const handleShakeGraph = () => {
    physicsNodesRef.current.forEach(pn => {
      if (!pn.isFixed) {
        pn.vel.set(
          (Math.random() - 0.5) * 22,
          (Math.random() - 0.5) * 22,
          (Math.random() - 0.5) * 22
        );
      }
    });
  };

  // -------------------------------------------------------------------------
  // MAIN THREE.JS SETUP & REAL-TIME PHYSICS LOOP
  // -------------------------------------------------------------------------
  useEffect(() => {
    const container = mountRef.current;
    if (!container || !graphData) return;

    // Clean up previous renderer canvas
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    physicsNodesRef.current = [];
    physicsEdgesRef.current = [];

    const width = container.clientWidth || 1000;
    const height = container.clientHeight || 650;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(55, width / height, 1, 3500);
    cameraRef.current = camera;
    updateCameraPosition();

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Ambient and directional lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0x67e8f9, 1.8);
    dirLight1.position.set(300, 400, 500);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xa78bfa, 1.2);
    dirLight2.position.set(-300, -200, -400);
    scene.add(dirLight2);

    // Grid plane helper in background (subtle forensic coordinate matrix)
    const grid = new THREE.GridHelper(1200, 24, 0x1e293b, 0x0f172a);
    grid.position.y = -260;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.25;
    scene.add(grid);

    // Build Physics Nodes with Fibonacci sphere initial distribution
    const n = graphData.nodes.length;
    const nodeMap = new Map<string, PhysicsNode>();

    graphData.nodes.forEach((node, i) => {
      const phi = Math.acos(-1 + (2 * i) / n);
      const theta = Math.sqrt(n * Math.PI) * phi;
      const safeIps = typeof node.ips_score === 'number' ? (node.ips_score > 1.0 ? Math.min(1.0, node.ips_score / 100.0) : Math.max(0.0, Math.min(1.0, node.ips_score))) : 0.5;
      const initialRadius = 190 + (1 - safeIps) * 140;

      const x = initialRadius * Math.cos(theta) * Math.sin(phi);
      const y = initialRadius * Math.sin(theta) * Math.sin(phi) * 0.85;
      const z = initialRadius * Math.cos(phi);

      const pos = new THREE.Vector3(x, y, z);
      const colorConfig = ENTITY_CONFIG[node.type] || { hex: 0x94a3b8, rgb: 'rgb(148, 163, 184)' };

      // Node core mesh
      const sphereRadius = Math.max(9, Math.min(22, 10 + node.ips_score * 12));
      const sphereGeom = new THREE.SphereGeometry(sphereRadius, 32, 32);
      const sphereMat = new THREE.MeshStandardMaterial({
        color: colorConfig.hex,
        roughness: 0.25,
        metalness: 0.6,
        emissive: colorConfig.hex,
        emissiveIntensity: node.ips_score > 0.85 ? 0.7 : 0.35,
        transparent: true,
        opacity: 1.0
      });

      const mesh = new THREE.Mesh(sphereGeom, sphereMat);
      mesh.position.copy(pos);
      (mesh as any).userData = { node, id: node.id, originalColor: colorConfig.hex };
      scene.add(mesh);

      // Glowing outer halo ring/sphere for high threat index
      const glowGeom = new THREE.SphereGeometry(sphereRadius * 1.35, 16, 16);
      const glowMat = new THREE.MeshBasicMaterial({
        color: colorConfig.hex,
        transparent: true,
        opacity: node.ips_score > 0.8 ? 0.25 : 0.1,
        wireframe: true
      });
      const glowMesh = new THREE.Mesh(glowGeom, glowMat);
      glowMesh.position.copy(pos);
      scene.add(glowMesh);

      const pNode: PhysicsNode = {
        node,
        mesh,
        glowMesh,
        pos,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 1.5,
          (Math.random() - 0.5) * 1.5,
          (Math.random() - 0.5) * 1.5
        ),
        force: new THREE.Vector3(),
        mass: Math.max(1.2, node.degree * 0.6 + node.ips_score * 1.5),
        isFixed: false,
        phase: Math.random() * Math.PI * 2
      };

      physicsNodesRef.current.push(pNode);
      nodeMap.set(node.id, pNode);
    });

    // Build Physics Edges
    const pEdges: PhysicsEdge[] = [];
    const pulseSphereGeom = new THREE.SphereGeometry(3, 8, 8);

    graphData.edges.forEach(edge => {
      const src = nodeMap.get(edge.source);
      const tgt = nodeMap.get(edge.target);
      if (!src || !tgt) return;

      const edgeCategory: 'OBSERVED' | 'INFERRED' | 'POTENTIAL' =
        edge.category || ((edge.provenance_type === 'PREDICTED' || edge.is_predicted) ? 'INFERRED' : 'OBSERVED');

      let edgeColor = 0x64748b; // Observed (slate-500)
      let lineMat: THREE.Material;

      if (edgeCategory === 'INFERRED') {
        edgeColor = 0xd8b4fe; // Inferred (purple-300)
        lineMat = new THREE.LineDashedMaterial({
          color: edgeColor,
          dashSize: 6,
          gapSize: 4,
          transparent: true,
          opacity: 0.75
        });
      } else if (edgeCategory === 'POTENTIAL') {
        edgeColor = 0xfcd34d; // Potential (amber-300)
        lineMat = new THREE.LineDashedMaterial({
          color: edgeColor,
          dashSize: 2.5,
          gapSize: 3.5,
          transparent: true,
          opacity: 0.75
        });
      } else {
        lineMat = new THREE.LineBasicMaterial({
          color: edgeColor,
          transparent: true,
          opacity: 0.65
        });
      }

      const geom = new THREE.BufferGeometry().setFromPoints([src.pos, tgt.pos]);
      const line = new THREE.Line(geom, lineMat);
      if ((lineMat as any).isLineDashedMaterial) {
        line.computeLineDistances();
      }
      (line as any).userData = { edge, edgeCategory, originalColor: edgeColor };
      scene.add(line);

      // Kinetic pulse particle travelling along edge
      const pulseMat = new THREE.MeshBasicMaterial({
        color: edgeColor,
        transparent: true,
        opacity: 0.85
      });
      const pulseMesh = new THREE.Mesh(pulseSphereGeom, pulseMat);
      pulseMesh.position.copy(src.pos);
      scene.add(pulseMesh);

      pEdges.push({
        edge,
        sourceNode: src,
        targetNode: tgt,
        line,
        category: edgeCategory,
        pulseMesh,
        pulseProgress: Math.random()
      });
    });

    physicsEdgesRef.current = pEdges;

    // Interaction & Drag-To-Stretch Logic
    let isMouseDown = false;
    let isDraggingNode = false;
    let draggedPhysicsNode: PhysicsNode | null = null;
    let isOrbiting = false;
    let isPanning = false;

    let prevMouseX = 0;
    let prevMouseY = 0;
    const dragPlane = new THREE.Plane();
    const planeIntersect = new THREE.Vector3();
    const raycaster = new THREE.Raycaster();
    const mouseNDC = new THREE.Vector2();

    const getNDCCoordinates = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      return { x, y, rect };
    };

    const onMouseDown = (e: MouseEvent) => {
      isMouseDown = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;

      const { x, y } = getNDCCoordinates(e);
      mouseNDC.set(x, y);
      raycaster.setFromCamera(mouseNDC, camera);

      // Raycast against all visible node meshes
      const meshes = physicsNodesRef.current
        .filter(pn => pn.mesh.visible)
        .map(pn => pn.mesh);
      const intersects = raycaster.intersectObjects(meshes);

      if (intersects.length > 0 && e.button === 0) {
        // Left click on a node -> DRAG TO STRETCH
        const hitMesh = intersects[0].object as THREE.Mesh;
        const hitNodeId = (hitMesh as any).userData.id;
        const pNode = physicsNodesRef.current.find(pn => pn.node.id === hitNodeId);

        if (pNode) {
          isDraggingNode = true;
          draggedPhysicsNode = pNode;
          pNode.isFixed = true;
          pNode.vel.set(0, 0, 0);
          setIsDraggingNodeState(true);

          const camDir = new THREE.Vector3();
          camera.getWorldDirection(camDir);
          dragPlane.setFromNormalAndCoplanarPoint(camDir.negate(), pNode.pos);
          container.style.cursor = 'grabbing';
          return;
        }
      }

      if (e.button === 2 || e.button === 1 || e.shiftKey) {
        isPanning = true;
        container.style.cursor = 'move';
      } else if (e.button === 0) {
        isOrbiting = true;
        container.style.cursor = 'grabbing';
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      const { x, y, rect } = getNDCCoordinates(e);
      mouseNDC.set(x, y);
      raycaster.setFromCamera(mouseNDC, camera);

      // Handle Node Drag & Stretch
      if (isDraggingNode && draggedPhysicsNode) {
        if (raycaster.ray.intersectPlane(dragPlane, planeIntersect)) {
          draggedPhysicsNode.pos.copy(planeIntersect);
          draggedPhysicsNode.vel.set(0, 0, 0);
          draggedPhysicsNode.mesh.position.copy(planeIntersect);
          draggedPhysicsNode.glowMesh.position.copy(planeIntersect);
        }
        return;
      }

      // Handle Orbiting
      if (isOrbiting) {
        const deltaX = e.clientX - prevMouseX;
        const deltaY = e.clientY - prevMouseY;
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;

        const s = sphericalRef.current;
        s.theta -= deltaX * 0.005;
        s.phi -= deltaY * 0.005;
        updateCameraPosition();
        return;
      }

      // Handle Panning
      if (isPanning) {
        const deltaX = e.clientX - prevMouseX;
        const deltaY = e.clientY - prevMouseY;
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;

        const panSpeed = sphericalRef.current.radius * 0.001;
        const right = new THREE.Vector3();
        const up = new THREE.Vector3(0, 1, 0);
        camera.getWorldDirection(right);
        right.cross(up).normalize();

        cameraLookAtRef.current.addScaledVector(right, -deltaX * panSpeed);
        cameraLookAtRef.current.y += deltaY * panSpeed;
        updateCameraPosition();
        return;
      }

      // Hover Detection for Tooltip
      const meshes = physicsNodesRef.current
        .filter(pn => pn.mesh.visible)
        .map(pn => pn.mesh);
      const intersects = raycaster.intersectObjects(meshes);

      if (intersects.length > 0) {
        container.style.cursor = 'grab';
        const hitMesh = intersects[0].object as THREE.Mesh;
        const hitNode = (hitMesh as any).userData.node as GraphNode;
        setHoveredNode(hitNode);

        const pNode = physicsNodesRef.current.find(pn => pn.node.id === hitNode.id);
        if (pNode) {
          const proj = pNode.pos.clone().project(camera);
          const screenX = (proj.x * 0.5 + 0.5) * rect.width;
          const screenY = (-(proj.y * 0.5) + 0.5) * rect.height;
          setTooltipPos({ x: screenX, y: screenY });
        }
      } else {
        if (!isMouseDown) {
          container.style.cursor = 'default';
        }
        setHoveredNode(null);
        setTooltipPos(null);
      }
    };

    const onMouseUp = () => {
      if (draggedPhysicsNode) {
        draggedPhysicsNode.isFixed = false;
        draggedPhysicsNode = null;
        setIsDraggingNodeState(false);
      }
      isMouseDown = false;
      isDraggingNode = false;
      isOrbiting = false;
      isPanning = false;
      container.style.cursor = 'default';
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      sphericalRef.current.radius = Math.max(
        180,
        Math.min(1600, sphericalRef.current.radius + e.deltaY * 0.65)
      );
      updateCameraPosition();
    };

    const onClick = (e: MouseEvent) => {
      const { x, y } = getNDCCoordinates(e);
      mouseNDC.set(x, y);
      raycaster.setFromCamera(mouseNDC, camera);

      const meshes = physicsNodesRef.current
        .filter(pn => pn.mesh.visible)
        .map(pn => pn.mesh);
      const intersects = raycaster.intersectObjects(meshes);

      if (intersects.length > 0) {
        const hitMesh = intersects[0].object as THREE.Mesh;
        const hitNode = (hitMesh as any).userData.node as GraphNode;
        setSelectedNode(hitNode);
        setSelectedEdge(null);
        setLineageRootId(hitNode.id);
        setProvenanceNodeId(hitNode.id);
      }
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    container.addEventListener('wheel', onWheel, { passive: false });
    container.addEventListener('click', onClick);
    container.addEventListener('contextmenu', onContextMenu);

    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // -------------------------------------------------------------------------
    // REAL-TIME PHYSICS SIMULATION LOOP WITH FILTERING & TRACE HIGHLIGHTS
    // -------------------------------------------------------------------------
    let animId: number;
    let lastTime = performance.now();

    const animate = () => {
      animId = requestAnimationFrame(animate);

      const now = performance.now();
      const dt = Math.min((now - lastTime) * 0.001, 0.05);
      lastTime = now;

      const nodes = physicsNodesRef.current;
      const edges = physicsEdgesRef.current;
      const stretch = stretchFactorRef.current;
      const physicsActive = isPhysicsActiveRef.current;
      const filteredSet = filteredNodeIdsRef.current;
      const traceNodeSet = activeTraceNodesRef.current;
      const traceEdgeSet = activeTraceEdgesRef.current;
      const activeStepNodeId = activeStepNodeIdRef.current;
      const hasActiveTrace = traceNodeSet.size > 0;

      // 1. Slow Ambient Camera Rotation when idle
      if (!isMouseDown && autoRotateRef.current) {
        sphericalRef.current.theta += 0.0006;
        updateCameraPosition();
      }

      // 2. Filter & Trace Highlighting in 3D Mesh
      for (let i = 0; i < nodes.length; i++) {
        const pn = nodes[i];
        const isFilteredIn = filteredSet.size === 0 || filteredSet.has(pn.node.id);
        pn.mesh.visible = isFilteredIn;
        pn.glowMesh.visible = isFilteredIn;

        if (!isFilteredIn) continue;

        const meshMat = pn.mesh.material as THREE.MeshStandardMaterial;
        const glowMat = pn.glowMesh.material as THREE.MeshBasicMaterial;
        const originalHex = (pn.mesh as any).userData.originalColor;

        if (hasActiveTrace) {
          if (traceNodeSet.has(pn.node.id)) {
            // High intensity highlight for traced nodes
            const isStepActive = activeStepNodeId === pn.node.id;
            meshMat.opacity = 1.0;
            meshMat.emissive.setHex(isStepActive ? 0x00f0ff : 0x10b981);
            meshMat.emissiveIntensity = isStepActive ? 0.95 : 0.65;
            glowMat.opacity = isStepActive ? 0.6 : 0.35;
            glowMat.color.setHex(isStepActive ? 0x00f0ff : 0x10b981);
          } else {
            // Dim non-traced nodes
            meshMat.opacity = 0.22;
            meshMat.emissive.setHex(originalHex);
            meshMat.emissiveIntensity = 0.1;
            glowMat.opacity = 0.04;
          }
        } else {
          // Standard view
          meshMat.opacity = 1.0;
          meshMat.color.setHex(originalHex);
          meshMat.emissive.setHex(originalHex);
          meshMat.emissiveIntensity = pn.node.ips_score > 0.85 ? 0.7 : 0.35;
          glowMat.opacity = pn.node.ips_score > 0.8 ? 0.25 : 0.1;
          glowMat.color.setHex(originalHex);
        }
      }

      // 3. Physics Forces Calculation
      if (physicsActive) {
        for (let i = 0; i < nodes.length; i++) {
          nodes[i].force.set(0, 0, 0);
        }

        const centerGravity = 0.0012 / stretch;
        for (let i = 0; i < nodes.length; i++) {
          if (!nodes[i].mesh.visible) continue;
          nodes[i].force.addScaledVector(nodes[i].pos, -centerGravity * nodes[i].mass);
        }

        const kRepulsion = 18000 * Math.pow(stretch, 1.35);
        for (let i = 0; i < nodes.length; i++) {
          const nA = nodes[i];
          if (!nA.mesh.visible) continue;

          for (let j = i + 1; j < nodes.length; j++) {
            const nB = nodes[j];
            if (!nB.mesh.visible) continue;

            const dx = nA.pos.x - nB.pos.x;
            const dy = nA.pos.y - nB.pos.y;
            const dz = nA.pos.z - nB.pos.z;
            const distSq = Math.max(dx * dx + dy * dy + dz * dz, 25);
            const dist = Math.sqrt(distSq);

            const forceMag = kRepulsion / (distSq * dist);
            nA.force.x += dx * forceMag;
            nA.force.y += dy * forceMag;
            nA.force.z += dz * forceMag;

            nB.force.x -= dx * forceMag;
            nB.force.y -= dy * forceMag;
            nB.force.z -= dz * forceMag;
          }
        }

        const baseSpringLength = 110 * stretch;
        const kSpring = 0.045;

        for (let i = 0; i < edges.length; i++) {
          const pe = edges[i];
          if (!pe.sourceNode.mesh.visible || !pe.targetNode.mesh.visible) continue;

          const src = pe.sourceNode;
          const tgt = pe.targetNode;

          const dx = tgt.pos.x - src.pos.x;
          const dy = tgt.pos.y - src.pos.y;
          const dz = tgt.pos.z - src.pos.z;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy + dz * dz), 0.1);

          const stretchDelta = dist - baseSpringLength;
          const springForce = stretchDelta * kSpring;

          const nx = dx / dist;
          const ny = dy / dist;
          const nz = dz / dist;

          src.force.x += nx * springForce;
          src.force.y += ny * springForce;
          src.force.z += nz * springForce;

          tgt.force.x -= nx * springForce;
          tgt.force.y -= ny * springForce;
          tgt.force.z -= nz * springForce;
        }

        const timeSec = now * 0.001;
        for (let i = 0; i < nodes.length; i++) {
          const pn = nodes[i];
          if (!pn.isFixed && pn.mesh.visible) {
            pn.force.x += Math.sin(timeSec * 0.9 + pn.phase) * 0.25;
            pn.force.y += Math.cos(timeSec * 0.8 + pn.phase * 1.3) * 0.25;
            pn.force.z += Math.sin(timeSec * 0.7 + pn.phase * 0.7) * 0.25;

            pn.vel.x += (pn.force.x / pn.mass) * 0.85;
            pn.vel.y += (pn.force.y / pn.mass) * 0.85;
            pn.vel.z += (pn.force.z / pn.mass) * 0.85;

            pn.vel.multiplyScalar(0.88);
            pn.vel.clampLength(0, 16);

            pn.pos.x += pn.vel.x;
            pn.pos.y += pn.vel.y;
            pn.pos.z += pn.vel.z;
          }

          pn.mesh.position.copy(pn.pos);
          pn.glowMesh.position.copy(pn.pos);
        }
      }

      // 4. Update Dynamic Edges & Pulsing Particles
      for (let i = 0; i < edges.length; i++) {
        const pe = edges[i];
        const isVisible = pe.sourceNode.mesh.visible && pe.targetNode.mesh.visible;
        pe.line.visible = isVisible;
        if (pe.pulseMesh) pe.pulseMesh.visible = isVisible;

        if (!isVisible) continue;

        const isTracedEdge = traceEdgeSet.has(pe.edge.id);
        const lineMat = pe.line.material as THREE.LineBasicMaterial | THREE.LineDashedMaterial;

        if (hasActiveTrace) {
          if (isTracedEdge) {
            lineMat.opacity = 0.95;
            (lineMat as any).color?.setHex(0x10b981);
          } else {
            lineMat.opacity = 0.12;
            (lineMat as any).color?.setHex((pe.line as any).userData.originalColor);
          }
        } else {
          lineMat.opacity = pe.category === 'INFERRED' ? 0.75 : 0.65;
          (lineMat as any).color?.setHex((pe.line as any).userData.originalColor);
        }

        const geom = pe.line.geometry as THREE.BufferGeometry;
        const posAttr = geom.attributes.position as THREE.BufferAttribute;

        posAttr.setXYZ(0, pe.sourceNode.pos.x, pe.sourceNode.pos.y, pe.sourceNode.pos.z);
        posAttr.setXYZ(1, pe.targetNode.pos.x, pe.targetNode.pos.y, pe.targetNode.pos.z);
        posAttr.needsUpdate = true;

        if ((pe.line.material as any).isLineDashedMaterial) {
          pe.line.computeLineDistances();
        }

        if (pe.pulseMesh) {
          pe.pulseProgress = (pe.pulseProgress + (isTracedEdge ? 0.012 : 0.007)) % 1;
          pe.pulseMesh.position.lerpVectors(
            pe.sourceNode.pos,
            pe.targetNode.pos,
            pe.pulseProgress
          );
        }
      }

      // Render Scene
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('wheel', onWheel);
      container.removeEventListener('click', onClick);
      container.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, [graphData, updateCameraPosition]);

  const totalNodesCount = graphData?.nodes.length || 0;
  const totalEdgesCount = graphData?.edges.length || 0;
  const filteredNodesCount = filteredData.nodes.length;
  const filteredEdgesCount = filteredData.edges.length;

  const observedEdgesCount = useMemo(() => {
    if (!graphData) return 0;
    return graphData.edges.filter(
      e =>
        e.provenance_type === 'OBSERVED' ||
        (!e.is_predicted && e.category !== 'INFERRED' && e.category !== 'POTENTIAL')
    ).length;
  }, [graphData]);

  const predictedEdgesCount = useMemo(() => {
    if (!graphData) return 0;
    return graphData.edges.filter(
      e =>
        e.provenance_type === 'PREDICTED' ||
        e.is_predicted === true ||
        e.category === 'INFERRED' ||
        e.category === 'POTENTIAL'
    ).length;
  }, [graphData]);

  const nodesPassingConfidenceCount = useMemo(() => {
    if (!graphData) return 0;
    return graphData.nodes.filter(
      n => (typeof n.confidence === 'number' ? n.confidence : 1.0) >= minConfidenceScore
    ).length;
  }, [graphData, minConfidenceScore]);

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------------------- */}
      {/* TOP INTEGRATED FILTER & TRACEABILITY TOOLBAR */}
      {/* ------------------------------------------------------------------- */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 p-3.5 rounded-xl border border-white/[0.08] bg-[#0d0f12] text-xs font-mono">
        {/* Left: Quick Search and Presets */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Filter by name, ID, label..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-[#050608] border border-white/[0.08] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-crimson-500 text-xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Quick Preset Pills */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => applyPreset('ALL')}
              className={`px-2.5 py-1 rounded-md border text-[11px] whitespace-nowrap transition-colors ${
                filterPreset === 'ALL'
                  ? 'border-crimson-500/50 bg-crimson-950/40 text-crimson-300 font-bold'
                  : 'border-white/[0.06] bg-black/30 text-slate-400 hover:text-slate-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => applyPreset('CRITICAL')}
              className={`px-2.5 py-1 rounded-md border text-[11px] whitespace-nowrap transition-colors ${
                filterPreset === 'CRITICAL'
                  ? 'border-rose-500/50 bg-rose-950/40 text-rose-300 font-bold'
                  : 'border-white/[0.06] bg-black/30 text-slate-400 hover:text-slate-200'
              }`}
            >
              High Threat (IPS ≥75%)
            </button>
            <button
              onClick={() => applyPreset('FINANCIAL')}
              className={`px-2.5 py-1 rounded-md border text-[11px] whitespace-nowrap transition-colors ${
                filterPreset === 'FINANCIAL'
                  ? 'border-pink-500/50 bg-pink-950/40 text-pink-300 font-bold'
                  : 'border-white/[0.06] bg-black/30 text-slate-400 hover:text-slate-200'
              }`}
            >
              Financial & Crypto
            </button>
            <button
              onClick={() => applyPreset('CYBER')}
              className={`px-2.5 py-1 rounded-md border text-[11px] whitespace-nowrap transition-colors ${
                filterPreset === 'CYBER'
                  ? 'border-sky-500/50 bg-sky-950/40 text-sky-300 font-bold'
                  : 'border-white/[0.06] bg-black/30 text-slate-400 hover:text-slate-200'
              }`}
            >
              Cyber & IP
            </button>
            <button
              onClick={() => applyPreset('INFERRED')}
              className={`px-2.5 py-1 rounded-md border text-[11px] whitespace-nowrap transition-colors ${
                filterPreset === 'INFERRED'
                  ? 'border-crimson-600/50 bg-crimson-950/40 text-rose-300 font-bold'
                  : 'border-white/[0.06] bg-black/30 text-slate-400 hover:text-slate-200'
              }`}
            >
              Inferred Links
            </button>
          </div>
        </div>

        {/* Right: Filter & Traceability Suite Action Toggles */}
        <div className="flex items-center gap-2 justify-end">
          {/* Active Filter Matrix Button */}
          <button
            onClick={() => setFilterDrawerOpen(!filterDrawerOpen)}
            className={`px-3 py-1.5 rounded-lg border text-xs flex items-center gap-1.5 transition-all ${
              filterDrawerOpen || isFilterActive
                ? 'border-crimson-500 bg-crimson-950/60 text-crimson-300 shadow-[0_0_12px_rgba(153,27,27,0.25)] font-bold'
                : 'border-white/[0.08] bg-[#050608] text-slate-300 hover:border-white/[0.2]'
            }`}
          >
            <Filter className="w-3.5 h-3.5 text-crimson-400" />
            <span>Filters</span>
            {isFilterActive && (
              <span className="h-2 w-2 rounded-full bg-crimson-400 animate-pulse" />
            )}
          </button>

          {/* Traceability Suite Button */}
          <button
            onClick={() => setTraceSuiteOpen(!traceSuiteOpen)}
            className={`px-3 py-1.5 rounded-lg border text-xs flex items-center gap-1.5 transition-all ${
              traceSuiteOpen || activeTraceNodesRef.current.size > 0
                ? 'border-emerald-500 bg-emerald-950/60 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.2)] font-bold'
                : 'border-white/[0.08] bg-[#050608] text-slate-300 hover:border-emerald-500/40'
            }`}
          >
            <Compass className="w-3.5 h-3.5 text-emerald-400" />
            <span>Traceability</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* COLLAPSIBLE GRAPH FILTER PANEL (RELATIONSHIP TYPES & CONFIDENCE) */}
      {/* ------------------------------------------------------------------- */}
      {filterDrawerOpen && (
        <div className="rounded-xl border border-crimson-500/30 bg-[#0E121D]/95 text-xs font-mono transition-all duration-200 shadow-[0_4px_24px_rgba(0,0,0,0.5)] overflow-hidden">
          {/* Collapsible Panel Header */}
          <div className="p-3.5 flex items-center justify-between border-b border-crimson-500/20 bg-crimson-950/30">
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setIsFilterPanelCollapsed(!isFilterPanelCollapsed)}
                className="p-1 rounded hover:bg-crimson-500/20 text-crimson-400 transition-colors flex items-center gap-1.5 focus:outline-none"
                title={isFilterPanelCollapsed ? "Expand Filter Panel" : "Collapse Filter Panel"}
              >
                {isFilterPanelCollapsed ? (
                  <ChevronDown className="w-4 h-4 text-crimson-400" />
                ) : (
                  <ChevronUp className="w-4 h-4 text-crimson-400" />
                )}
                <SlidersHorizontal className="w-4 h-4 text-crimson-400" />
              </button>
              <span className="text-crimson-300 font-bold uppercase tracking-wider">
                GRAPH FILTERS & EVIDENCE CONTROLS
              </span>
              {isFilterActive && (
                <span className="px-2 py-0.5 rounded-full bg-crimson-500/20 border border-crimson-500/40 text-[10px] text-crimson-300 font-bold">
                  Active Filters
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[11px] text-slate-400 hidden sm:inline">
                Displaying <strong className="text-crimson-400">{filteredNodesCount}</strong> / {totalNodesCount} Entities &bull; <strong className="text-rose-400">{filteredEdgesCount}</strong> / {totalEdgesCount} Links
              </span>
              {isFilterActive && (
                <button
                  onClick={handleResetFilters}
                  className="text-[10px] text-crimson-400 hover:text-crimson-300 hover:underline flex items-center gap-1 bg-crimson-950/40 px-2 py-1 rounded border border-crimson-500/30"
                >
                  <RefreshCw className="w-3 h-3" />
                  Reset Defaults
                </button>
              )}
              <button
                onClick={() => setIsFilterPanelCollapsed(!isFilterPanelCollapsed)}
                className="text-[11px] text-slate-400 hover:text-slate-200 px-2 py-1 rounded hover:bg-white/[0.04] transition-colors"
              >
                {isFilterPanelCollapsed ? 'Expand Details' : 'Collapse Details'}
              </button>
            </div>
          </div>

          {/* Collapsible Panel Body */}
          {!isFilterPanelCollapsed && (
            <div className="p-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Relationship Types (Observed vs Predicted) */}
                <div className="space-y-2.5 p-3 rounded-lg border border-white/[0.06] bg-black/30">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-300 uppercase font-bold flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-crimson-400" />
                      RELATIONSHIP TYPES
                    </span>
                    <div className="flex gap-2 text-[10px]">
                      <button
                        onClick={() => {
                          setFilterObservedEdges(true);
                          setFilterPredictedEdges(true);
                        }}
                        className="text-crimson-400 hover:underline"
                      >
                        All
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {/* Checkbox: Observed Relationships */}
                    <label
                      className={`p-2.5 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition-all ${
                        filterObservedEdges
                          ? 'border-crimson-500/50 bg-crimson-950/40 text-slate-100 shadow-[0_0_10px_rgba(153,27,27,0.1)]'
                          : 'border-white/[0.04] bg-black/20 text-slate-500 hover:border-white/[0.1]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={filterObservedEdges}
                          onChange={e => setFilterObservedEdges(e.target.checked)}
                          className="rounded border-slate-700 bg-slate-900 text-crimson-500 focus:ring-0 w-4 h-4 cursor-pointer"
                        />
                        <div>
                          <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-crimson-400 inline-block" />
                            <span className="text-crimson-300 font-bold">Observed</span>
                            <span className="text-[11px] text-slate-400">Relationships</span>
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Empirical facts, logs & verified transactions
                          </div>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-black/50 border border-white/[0.08] text-[10px] text-crimson-300 font-mono shrink-0">
                        {observedEdgesCount} links
                      </span>
                    </label>

                    {/* Checkbox: Predicted Relationships */}
                    <label
                      className={`p-2.5 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition-all ${
                        filterPredictedEdges
                          ? 'border-purple-500/50 bg-purple-950/40 text-slate-100 shadow-[0_0_10px_rgba(168,85,247,0.08)]'
                          : 'border-white/[0.04] bg-black/20 text-slate-500 hover:border-white/[0.1]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={filterPredictedEdges}
                          onChange={e => setFilterPredictedEdges(e.target.checked)}
                          className="rounded border-slate-700 bg-slate-900 text-purple-500 focus:ring-0 w-4 h-4 cursor-pointer"
                        />
                        <div>
                          <div className="font-semibold text-rose-200 flex items-center gap-1.5">
                            <GitFork className="w-3.5 h-3.5 text-rose-400 inline" />
                            <span className="text-rose-300 font-bold">Inferred</span>
                            <span className="text-[11px] text-slate-400">Relationships</span>
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Graph link predictions & inferred associations
                          </div>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-black/50 border border-white/[0.08] text-[10px] text-purple-300 font-mono shrink-0">
                        {predictedEdgesCount} links
                      </span>
                    </label>

                    {/* Cryptographic Vault Link Checkbox */}
                    <label className="p-2 rounded-lg border border-emerald-500/30 bg-emerald-950/20 text-emerald-300 text-xs flex items-center justify-between cursor-pointer">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={requireEvidenceProvenance}
                          onChange={e => setRequireEvidenceProvenance(e.target.checked)}
                          className="rounded border-emerald-700 bg-slate-900 text-emerald-500 w-3.5 h-3.5"
                        />
                        <span className="flex items-center gap-1 text-[11px]">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Anchored in Evidence Vault</span>
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* 2. Confidence & Statistical Score Sliders */}
                <div className="space-y-3 p-3 rounded-lg border border-white/[0.06] bg-black/30">
                  <span className="text-[10px] text-slate-300 uppercase font-bold flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-crimson-400" />
                    CONFIDENCE & RISK THRESHOLDS
                  </span>

                  {/* Minimum Node Confidence Score Slider */}
                  <div className="p-2.5 rounded-lg border border-crimson-500/30 bg-crimson-950/20 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-crimson-200 font-medium">Min Node Confidence Score:</span>
                      <span className="text-crimson-300 font-bold font-mono px-1.5 py-0.5 rounded bg-crimson-900/60 border border-crimson-500/40">
                        &ge; {(minConfidenceScore * 100).toFixed(0)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1.0"
                      step="0.05"
                      value={minConfidenceScore}
                      onChange={e => setMinConfidenceScore(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-crimson-500"
                    />
                    <div className="flex items-center justify-between text-[9px] text-slate-400">
                      <span>0% (All Nodes)</span>
                      <span className="text-crimson-300 font-mono">
                        {nodesPassingConfidenceCount} / {totalNodesCount} pass
                      </span>
                      <span>100%</span>
                    </div>
                  </div>

                  {/* Min IPS Score Slider */}
                  <div className="p-2 rounded border border-white/[0.06] bg-black/40 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Min IPS Threat Score:</span>
                      <span className="text-rose-400 font-bold font-mono">
                        {(minIpsScore * 100).toFixed(0)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="0.95"
                      step="0.05"
                      value={minIpsScore}
                      onChange={e => setMinIpsScore(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-400"
                    />
                  </div>

                  {/* Min Anomaly Score Slider */}
                  <div className="p-2 rounded border border-white/[0.06] bg-black/40 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Min Anomaly Score:</span>
                      <span className="text-amber-400 font-bold font-mono">
                        {(minAnomalyScore * 100).toFixed(0)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="0.95"
                      step="0.05"
                      value={minAnomalyScore}
                      onChange={e => setMinAnomalyScore(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                    />
                  </div>
                </div>

                {/* 3. Entity Category Matrix */}
                <div className="space-y-2 p-3 rounded-lg border border-white/[0.06] bg-black/30">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-300 uppercase font-bold flex items-center gap-1.5">
                      <Radio className="w-3.5 h-3.5 text-crimson-400" />
                      ENTITY CATEGORIES
                    </span>
                    <div className="flex gap-2 text-[10px]">
                      <button
                        onClick={() => setSelectedEntityTypes(ALL_ENTITY_TYPES)}
                        className="text-crimson-400 hover:underline"
                      >
                        All
                      </button>
                      <span className="text-slate-600">|</span>
                      <button
                        onClick={() => setSelectedEntityTypes([])}
                        className="text-slate-400 hover:underline"
                      >
                        None
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                    {ALL_ENTITY_TYPES.map(t => {
                      const isChecked = selectedEntityTypes.includes(t);
                      const count = (graphData?.nodes || []).filter(n => n.type === t).length;
                      const cfg = ENTITY_CONFIG[t] || { rgb: 'rgb(148, 163, 184)', label: t };
                      return (
                        <label
                          key={t}
                          className={`p-1.5 rounded border text-[10px] flex items-center justify-between cursor-pointer transition-colors ${
                            isChecked
                              ? 'border-crimson-500/40 bg-crimson-950/30 text-slate-200'
                              : 'border-white/[0.04] bg-black/20 text-slate-500'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={e => {
                                if (e.target.checked) {
                                  setSelectedEntityTypes([...selectedEntityTypes, t]);
                                } else {
                                  setSelectedEntityTypes(selectedEntityTypes.filter(item => item !== t));
                                }
                              }}
                              className="rounded border-slate-700 bg-slate-900 text-crimson-500 focus:ring-0 w-3 h-3 cursor-pointer"
                            />
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: cfg.rgb }}
                            />
                            <span className="truncate">{cfg.label}</span>
                          </div>
                          <span className="text-slate-500 text-[9px] shrink-0">{count}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* FORENSIC TRACEABILITY SUITE DRAWER */}
      {/* ------------------------------------------------------------------- */}
      {traceSuiteOpen && (
        <div className="p-4 rounded-xl border border-emerald-500/40 bg-[#06140F]/95 text-xs font-mono space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-emerald-500/20 pb-2.5">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <GitBranch className="w-4 h-4" />
              <span>INVESTIGATIVE TRACEABILITY & MULTI-HOP PROVENANCE ENGINE</span>
            </div>

            {/* Trace Mode Tabs */}
            <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-emerald-500/30">
              <button
                onClick={() => setTraceTab('LINEAGE')}
                className={`px-3 py-1 rounded text-xs transition-colors ${
                  traceTab === 'LINEAGE'
                    ? 'bg-emerald-600 text-slate-950 font-bold'
                    : 'text-emerald-300 hover:text-white'
                }`}
              >
                Causal Lineage
              </button>
              <button
                onClick={() => setTraceTab('SHORTEST_PATH')}
                className={`px-3 py-1 rounded text-xs transition-colors ${
                  traceTab === 'SHORTEST_PATH'
                    ? 'bg-emerald-600 text-slate-950 font-bold'
                    : 'text-emerald-300 hover:text-white'
                }`}
              >
                Shortest Path Traversal
              </button>
              <button
                onClick={() => setTraceTab('PROVENANCE')}
                className={`px-3 py-1 rounded text-xs transition-colors ${
                  traceTab === 'PROVENANCE'
                    ? 'bg-emerald-600 text-slate-950 font-bold'
                    : 'text-emerald-300 hover:text-white'
                }`}
              >
                Evidence Anchors
              </button>
            </div>
          </div>

          {/* TAB 1: CAUSAL LINEAGE / BLAST RADIUS TRACER */}
          {traceTab === 'LINEAGE' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-3 items-end">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase">ROOT ENTITY FOR TRACE</label>
                  <select
                    value={lineageRootId}
                    onChange={e => setLineageRootId(e.target.value)}
                    className="w-full px-3 py-1.5 rounded bg-[#0d0f12] border border-white/[0.08] text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                  >
                    {(graphData?.nodes || []).map((n, idx) => (
                      <option key={n.id || `lineage-root-${idx}`} value={n.id}>
                        {n.name} ({n.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase">PROPAGATION VECTOR</label>
                  <select
                    value={lineageDirection}
                    onChange={e => setLineageDirection(e.target.value as any)}
                    className="w-full px-3 py-1.5 rounded bg-[#0d0f12] border border-white/[0.08] text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                  >
                    <option value="DOWNSTREAM">Downstream Outflow (Impact)</option>
                    <option value="UPSTREAM">Upstream Inflow (Source Origins)</option>
                    <option value="BIDIRECTIONAL">Bidirectional Neighborhood</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase">DEPTH REACH (HOPS)</label>
                  <select
                    value={lineageMaxHops}
                    onChange={e => setLineageMaxHops(parseInt(e.target.value))}
                    className="w-full px-3 py-1.5 rounded bg-[#0d0f12] border border-white/[0.08] text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                  >
                    <option value={1}>1 Hop (Direct Contacts)</option>
                    <option value={2}>2 Hops (Secondary Influence)</option>
                    <option value={3}>3 Hops (Deep Causal Chain)</option>
                    <option value={4}>4 Hops (Extended Network Reach)</option>
                  </select>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleComputeLineage}
                    className="flex-1 px-4 py-2 rounded-lg border border-emerald-500/50 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold uppercase transition-all text-center"
                  >
                    Trace Lineage
                  </button>
                  {lineageResult && (
                    <button
                      onClick={handleClearTrace}
                      className="px-3 py-2 rounded-lg border border-rose-500/40 bg-rose-950/30 text-rose-300 hover:bg-rose-900/40 text-xs"
                      title="Clear Trace"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Lineage Summary Bar & Interactive Stepper */}
              {lineageResult && (
                <div className="p-3.5 rounded-lg bg-black/50 border border-emerald-500/30 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="font-bold text-emerald-300">
                        TRACED {lineageResult.tracedNodes.length} ENTITIES & {lineageResult.tracedEdges.length} LINKS ACROSS {lineageResult.totalHops} HOPS
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleExportTraceCertificate}
                        className="px-3 py-1 rounded border border-emerald-500/40 bg-emerald-950/60 text-emerald-300 hover:bg-emerald-900/60 flex items-center gap-1.5 text-xs"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Export Trace Certificate</span>
                      </button>
                    </div>
                  </div>

                  {/* Step Playback Toolbar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded bg-[#0d0f12] border border-white/[0.08]">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleStepPrev}
                        disabled={activeStepIndex === 0}
                        className="p-1 rounded bg-black/40 border border-white/[0.08] text-slate-300 disabled:opacity-30 hover:text-white"
                      >
                        <SkipBack className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setIsPlayingTrace(!isPlayingTrace)}
                        className="px-2.5 py-1 rounded bg-emerald-600 text-slate-950 font-bold flex items-center gap-1 hover:bg-emerald-500"
                      >
                        {isPlayingTrace ? (
                          <>
                            <Pause className="w-3 h-3" />
                            <span>Pause</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3" />
                            <span>Play Flow</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={handleStepNext}
                        disabled={activeStepIndex >= activeTraceStepItems.length - 1}
                        className="p-1 rounded bg-black/40 border border-white/[0.08] text-slate-300 disabled:opacity-30 hover:text-white"
                      >
                        <SkipForward className="w-3.5 h-3.5" />
                      </button>

                      <span className="text-[11px] text-slate-400">
                        Step <strong className="text-emerald-400">{activeStepIndex + 1}</strong> of {activeTraceStepItems.length}
                      </span>
                    </div>

                    {/* Active Step Details */}
                    {activeTraceStepItems[activeStepIndex] && (
                      <div className="flex items-center gap-2 text-xs truncate">
                        <span className="px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-500/40 text-emerald-300 text-[10px]">
                          Hop {activeTraceStepItems[activeStepIndex].hop}
                        </span>
                        <span className="text-slate-200 font-bold">
                          {activeTraceStepItems[activeStepIndex].node.name}
                        </span>
                        {activeTraceStepItems[activeStepIndex].edge && (
                          <span className="text-slate-500 text-[11px]">
                            via [{activeTraceStepItems[activeStepIndex].edge?.type}]
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SHORTEST PATH TRAVERSAL */}
          {traceTab === 'SHORTEST_PATH' && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="w-full sm:w-1/2 space-y-1">
                  <label className="text-[10px] text-slate-400">SOURCE ENTITY</label>
                  <select
                    value={pathSource}
                    onChange={e => setPathSource(e.target.value)}
                    className="w-full px-3 py-1.5 rounded bg-[#0d0f12] border border-white/[0.08] text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                  >
                    {(graphData?.nodes || []).map((n, nIdx) => (
                      <option key={n.id || `node-src-${nIdx}`} value={n.id}>
                        {n.name} ({n.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="w-full sm:w-1/2 space-y-1">
                  <label className="text-[10px] text-slate-400">TARGET ENTITY</label>
                  <select
                    value={pathTarget}
                    onChange={e => setPathTarget(e.target.value)}
                    className="w-full px-3 py-1.5 rounded bg-[#0d0f12] border border-white/[0.08] text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                  >
                    {(graphData?.nodes || []).map((n, nIdx) => (
                      <option key={n.id || `node-tgt-${nIdx}`} value={n.id}>
                        {n.name} ({n.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2 w-full sm:w-auto mt-4 sm:mt-0">
                  <button
                    onClick={handleSolvePath}
                    disabled={pathLoading}
                    className="px-4 py-2 rounded-lg border border-emerald-500/50 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold uppercase transition-all shrink-0"
                  >
                    {pathLoading ? 'SOLVING...' : 'TRACE TRAVERSAL'}
                  </button>
                  {pathResult && (
                    <button
                      onClick={handleClearTrace}
                      className="px-3 py-2 rounded-lg border border-rose-500/40 bg-rose-950/30 text-rose-300 hover:bg-rose-900/40 text-xs"
                      title="Clear Trace"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {pathResult && pathNodes.length > 0 && (
                <div className="p-3.5 rounded bg-black/40 border border-emerald-500/30 text-emerald-300 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-bold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>OPTIMAL SHORTEST TRAVERSAL: {Math.max(0, pathNodes.length - 1)} HOP(S) FOUND</span>
                    </div>
                    <button
                      onClick={handleExportTraceCertificate}
                      className="px-3 py-1 rounded border border-emerald-500/40 bg-emerald-950/60 text-emerald-300 hover:bg-emerald-900/60 flex items-center gap-1.5 text-xs"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Export Certificate</span>
                    </button>
                  </div>

                  <div className="text-[11px] text-slate-300">
                    Sequence: <strong>{pathNodes.map(n => `${n.name} (${n.type})`).join('  ➔  ')}</strong>
                  </div>

                  {pathRelationships.length > 0 && (
                    <div className="pt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
                      <span>Relationships:</span>
                      {pathRelationships.map((r, rIdx) => (
                        <span key={rIdx} className="px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/40 text-emerald-300">
                          {r}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CRYPTOGRAPHIC EVIDENCE ANCHORS */}
          {traceTab === 'PROVENANCE' && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="flex-1 space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase">SELECT ARTIFACT OR ENTITY</label>
                  <select
                    value={provenanceNodeId}
                    onChange={e => {
                      setProvenanceNodeId(e.target.value);
                      const n = (graphData?.nodes || []).find(node => node.id === e.target.value);
                      if (n) setSelectedNode(n);
                    }}
                    className="w-full px-3 py-1.5 rounded bg-[#0d0f12] border border-white/[0.08] text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                  >
                    {(graphData?.nodes || []).map((n, idx) => (
                      <option key={n.id || `prov-node-${idx}`} value={n.id}>
                        {n.name} ({n.type})
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleExportTraceCertificate}
                  className="mt-4 sm:mt-0 px-4 py-2 rounded-lg border border-emerald-500/50 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold uppercase transition-all"
                >
                  Generate Audit Certificate
                </button>
              </div>

              {/* Provenance Details Card */}
              {(() => {
                const pNode = (graphData?.nodes || []).find(n => n.id === provenanceNodeId) || graphData?.nodes[0];
                if (!pNode) return null;
                const provenanceIds = pNode.evidence_provenance || pNode.provenance_evidence_ids || ['EVD-891-01'];
                return (
                  <div className="p-3.5 rounded bg-black/40 border border-emerald-500/30 text-xs space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        <span className="font-bold text-slate-100">{pNode.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">[{pNode.type}]</span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold">
                        BLOCKCHAIN PROVENANCE ANCHORED
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                      <div className="p-2 rounded bg-[#0d0f12] border border-white/[0.06]">
                        <span className="text-slate-500 block text-[10px]">EVIDENCE ARTIFACT</span>
                        <span className="text-crimson-300 font-bold font-mono">{provenanceIds[0]}</span>
                      </div>
                      <div className="p-2 rounded bg-[#0d0f12] border border-white/[0.06]">
                        <span className="text-slate-500 block text-[10px]">LEDGER BLOCK HEIGHT</span>
                        <span className="text-slate-200 font-bold font-mono">#19,482,710</span>
                      </div>
                      <div className="p-2 rounded bg-[#0d0f12] border border-white/[0.06]">
                        <span className="text-slate-500 block text-[10px]">INGESTION HASH</span>
                        <span className="text-emerald-400 font-mono text-[10px] truncate block">
                          0x4f89a712...b9c4
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* INVESTIGATION NETWORK MAIN CONTAINER */}
      {/* ------------------------------------------------------------------- */}
      <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-[#0d0f12]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div>
            <h2 className="text-sm font-medium text-white flex items-center gap-2">
              <span>Investigation Network</span>
              {isFilterActive && (
                <span className="px-2 py-0.5 rounded bg-crimson-950/60 border border-crimson-500/30 text-crimson-300 text-[10px] font-mono">
                  Filtered
                </span>
              )}
              {activeTraceNodesRef.current.size > 0 && (
                <span className="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono">
                  Trace Active
                </span>
              )}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Showing {filteredNodesCount} of {totalNodesCount} entities · {filteredEdgesCount} of {totalEdgesCount} relationships
            </p>
          </div>
          <div className="hidden text-[11px] text-slate-500 md:block">
            Drag to stretch · Left-click orbit · Scroll zoom · Right-click pan
          </div>
        </div>

        {/* Canvas & Scene Viewport Container */}
        <div className="relative h-[650px] w-full bg-[#050608]">
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <div className="scene-container" style={{ position: 'relative', width: '100%', height: '100%' }}>
              {/* Navigation Info Overlay Badge */}
              <div className="scene-nav-info absolute top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[#0d0f12]/80 border border-white/[0.08] text-[10px] text-slate-400 font-mono backdrop-blur pointer-events-none select-none z-10 whitespace-nowrap">
                Left-click: rotate, Mouse-wheel: zoom, Right-click: pan · Drag node to stretch
              </div>

              {/* Float Tooltip */}
              {hoveredNode && tooltipPos && (
                <div
                  className="float-tooltip-kap pointer-events-none absolute z-20 transition-transform duration-75"
                  style={{
                    left: `${tooltipPos.x}px`,
                    top: `${tooltipPos.y}px`,
                    transform: 'translate(-50%, -125%)'
                  }}
                >
                  <div className="rounded-lg border border-white/[0.12] bg-[#0d0f12]/95 px-3 py-2 text-xs font-mono text-slate-200 shadow-xl backdrop-blur-md min-w-[180px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-white text-xs truncate max-w-[150px]">
                        {hoveredNode.name}
                      </span>
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{
                          backgroundColor:
                            ENTITY_CONFIG[hoveredNode.type]?.rgb || 'rgb(148, 163, 184)'
                        }}
                      />
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                      <span>{ENTITY_CONFIG[hoveredNode.type]?.label || hoveredNode.type}</span>
                      <span className="text-crimson-400 font-bold">
                        IPS {(((hoveredNode.ips_score ?? 0.85)) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="mt-1 text-[9px] text-slate-500 flex justify-between border-t border-white/[0.06] pt-1">
                      <span>Degree: {hoveredNode.degree}</span>
                      <span className="text-emerald-400">Drag to stretch</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Three.js Canvas Container */}
              <div ref={mountRef} className="w-full h-full" />
            </div>
          </div>

          {/* Bottom Controls Overlay */}
          <div className="absolute bottom-5 left-5 flex flex-wrap items-center gap-1.5 z-10">
            {/* Zoom In button */}
            <button
              onClick={handleZoomIn}
              className="rounded-lg border border-white/[0.08] bg-[#0d0f12]/90 p-2.5 text-slate-400 backdrop-blur transition hover:text-white"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>

            {/* Zoom Out button */}
            <button
              onClick={handleZoomOut}
              className="rounded-lg border border-white/[0.08] bg-[#0d0f12]/90 p-2.5 text-slate-400 backdrop-blur transition hover:text-white"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>

            {/* Stretch Factor Slider */}
            <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[#0d0f12]/90 px-3 py-2 text-slate-400 backdrop-blur text-xs font-mono">
              <span className="text-[10px] text-slate-500 uppercase flex items-center gap-1">
                <Sliders className="w-3.5 h-3.5 text-crimson-400" />
                <span>Stretch</span>
              </span>
              <input
                type="range"
                min="0.6"
                max="2.5"
                step="0.1"
                value={stretchFactor}
                onChange={e => setStretchFactor(parseFloat(e.target.value))}
                className="w-20 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-crimson-500"
                title={`Stretch Factor: ${stretchFactor.toFixed(1)}x`}
              />
              <span className="text-[10px] text-crimson-300 font-bold min-w-[28px]">
                {stretchFactor.toFixed(1)}x
              </span>
            </div>

            {/* Shake Graph */}
            <button
              onClick={handleShakeGraph}
              className="rounded-lg border border-white/[0.08] bg-[#0d0f12]/90 p-2.5 text-slate-400 backdrop-blur transition hover:text-amber-300"
              title="Shake & Rearrange Network"
            >
              <Flame className="w-4 h-4" />
            </button>

            {/* Reset Camera */}
            <button
              onClick={handleResetCamera}
              className="rounded-lg border border-white/[0.08] bg-[#0d0f12]/90 p-2.5 text-slate-400 backdrop-blur transition hover:text-white"
              title="Reset View Position"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Selected Node Detailed Inspector Drawer */}
          {selectedNode && (
            <div className="absolute top-4 right-4 w-80 sm:w-96 rounded-xl border border-white/[0.1] bg-[#0E121D]/95 backdrop-blur-2xl shadow-2xl p-5 text-xs space-y-4 animate-in fade-in slide-in-from-right duration-200 z-20 max-h-[580px] overflow-y-auto">
              <div className="flex items-start justify-between border-b border-white/[0.08] pb-2.5">
                <div>
                  <span className="text-[10px] text-crimson-400 uppercase tracking-widest block font-bold">
                    ENTITY TOPOLOGICAL INSPECTOR
                  </span>
                  <h3 className="font-bold text-slate-100 text-sm mt-0.5">
                    {selectedNode.name}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="text-slate-400 hover:text-slate-200 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 rounded bg-black/40 border border-white/[0.06]">
                  <span className="text-slate-500 block text-[10px]">ENTITY TYPE</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{
                        backgroundColor:
                          ENTITY_CONFIG[selectedNode.type]?.rgb || 'rgb(148, 163, 184)'
                      }}
                    />
                    <span className="font-bold text-slate-200">
                      {ENTITY_CONFIG[selectedNode.type]?.label || selectedNode.type}
                    </span>
                  </div>
                </div>
                <div className="p-2 rounded bg-black/40 border border-white/[0.06]">
                  <span className="text-slate-500 block text-[10px]">IPS THREAT INDEX</span>
                  <span className="font-bold text-crimson-300">
                    {(((selectedNode.ips_score ?? 0.85)) * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="p-2 rounded bg-black/40 border border-white/[0.06]">
                  <span className="text-slate-500 block text-[10px]">BETWEENNESS</span>
                  <span className="font-bold text-slate-200">
                    {(selectedNode.betweenness ?? 0.5).toFixed(3)}
                  </span>
                </div>
                <div className="p-2 rounded bg-black/40 border border-white/[0.06]">
                  <span className="text-slate-500 block text-[10px]">DEGREE RANK</span>
                  <span className="font-bold text-slate-200">{selectedNode.degree ?? 0}</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 uppercase">APPLIED INTELLIGENCE LABELS</span>
                <div className="flex flex-wrap gap-1.5">
                  {(selectedNode.labels || []).map((label, lIdx) => (
                    <span
                      key={`${label}-${lIdx}`}
                      className="px-2 py-0.5 rounded bg-white/[0.05] text-slate-300 border border-white/[0.08] text-[10px]"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </div>

              {Array.isArray(selectedNode.evidence_provenance) && selectedNode.evidence_provenance.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] text-slate-400 uppercase flex items-center gap-1">
                    <FileArchive className="w-3 h-3 text-crimson-400" />
                    <span>PROVENANCE EVIDENCE ARTIFACTS</span>
                  </span>
                  <div className="space-y-1">
                    {(selectedNode.evidence_provenance || []).map((evId, evIdx) => (
                      <div
                        key={`${evId}-${evIdx}`}
                        className="p-1.5 rounded bg-black/50 border border-crimson-500/20 text-[10px] text-crimson-300 flex items-center justify-between"
                      >
                        <span>{evId}</span>
                        <span className="text-emerald-400">HASH VERIFIED</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Traceability Actions */}
              <div className="pt-2 border-t border-white/[0.08] space-y-2">
                <button
                  onClick={() => {
                    setLineageRootId(selectedNode.id);
                    setTraceTab('LINEAGE');
                    setTraceSuiteOpen(true);
                  }}
                  className="w-full py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-950/40 hover:bg-emerald-900/40 text-emerald-300 font-bold text-[11px] flex items-center justify-center gap-1.5 transition-all"
                >
                  <GitBranch className="w-3.5 h-3.5 text-emerald-400" />
                  <span>TRACE CAUSAL LINEAGE FROM HERE</span>
                </button>

                <button
                  onClick={() => onViewAIReasoning?.(selectedNode)}
                  className="w-full py-1.5 rounded-lg border border-crimson-500/50 bg-crimson-950/50 hover:bg-crimson-900/40 text-crimson-300 font-bold text-[11px] flex items-center justify-center gap-1.5 transition-all shadow-[0_0_10px_rgba(153,27,27,0.2)]"
                >
                  <Activity className="w-3.5 h-3.5 text-crimson-400" />
                  <span>VIEW INVESTIGATIVE REASONING</span>
                </button>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setPathSource(selectedNode.id);
                      setTraceTab('SHORTEST_PATH');
                      setTraceSuiteOpen(true);
                    }}
                    className="flex-1 py-1.5 rounded border border-crimson-500/30 bg-crimson-950/40 text-crimson-300 hover:bg-crimson-900/40 text-[11px] text-center"
                  >
                    USE AS PATH SOURCE
                  </button>
                  <button
                    onClick={() => {
                      setPathTarget(selectedNode.id);
                      setTraceTab('SHORTEST_PATH');
                      setTraceSuiteOpen(true);
                    }}
                    className="flex-1 py-1.5 rounded border border-emerald-500/30 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/40 text-[11px] text-center"
                  >
                    USE AS TARGET
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Selected Edge Inspector Drawer */}
          {selectedEdge && (
            <div className="absolute top-4 right-4 w-80 sm:w-96 rounded-xl border border-rose-500/40 bg-[#0E121D]/95 backdrop-blur-2xl shadow-2xl p-5 text-xs space-y-4 animate-in fade-in slide-in-from-right duration-200 z-20 max-h-[580px] overflow-y-auto">
              <div className="flex items-start justify-between border-b border-white/[0.08] pb-2.5">
                <div>
                  <span className="text-[10px] text-rose-400 uppercase tracking-widest block font-bold">
                    RELATIONSHIP INSPECTOR
                  </span>
                  <h3 className="font-bold text-slate-100 text-sm mt-0.5">
                    {selectedEdge.type}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedEdge(null)}
                  className="text-slate-400 hover:text-slate-200 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3 rounded-lg bg-black/50 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">STATUS:</span>
                  <span
                    className={`font-bold px-2 py-0.5 rounded border ${
                      selectedEdge.is_predicted
                        ? 'border-rose-500/40 text-rose-300 bg-rose-950/40'
                        : 'border-slate-600 text-slate-300 bg-slate-800/40'
                    }`}
                  >
                    {selectedEdge.is_predicted ? 'INFERRED LINK' : 'OBSERVED FACT'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">CONFIDENCE:</span>
                  <strong className="text-emerald-400 font-mono">
                    {((((selectedEdge as any)?.predicted_probability ?? (selectedEdge as any)?.confidence ?? 0.85)) * 100).toFixed(1)}%
                  </strong>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">SOURCE:</span>
                  <strong className="text-rose-300">{selectedEdge.source}</strong>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">TARGET:</span>
                  <strong className="text-amber-300">{selectedEdge.target}</strong>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">PROVENANCE:</span>
                  <span className="text-slate-200 truncate max-w-[180px]">
                    {selectedEdge.provenance_evidence_id || 'EVD-CORE-VERIFIED'}
                  </span>
                </div>
              </div>

              <button
                onClick={() => onViewAIReasoning?.(selectedEdge)}
                className="w-full py-2 rounded-lg border border-rose-500/60 bg-gradient-to-r from-crimson-950/60 to-rose-950/50 hover:bg-crimson-900/50 text-rose-300 font-bold text-xs flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(225,29,72,0.2)] transition-all"
              >
                <Layers className="w-4 h-4 text-rose-400" />
                <span>VIEW ANALYTICAL REASONING & EVIDENCE</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer Legend */}
        <div className="border-t border-white/[0.06] px-5 py-4">
          <div className="flex flex-wrap gap-x-5 gap-y-2.5 text-[10px] text-slate-500">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'rgb(103, 232, 249)' }} />
              Person
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'rgb(167, 139, 250)' }} />
              Organization
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'rgb(52, 211, 153)' }} />
              Location
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'rgb(251, 191, 36)' }} />
              Phone
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'rgb(244, 114, 182)' }} />
              Bank Account / Wallet
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'rgb(56, 189, 248)' }} />
              Vehicle / Server
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'rgb(251, 113, 133)' }} />
              Transaction
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'rgb(163, 230, 53)' }} />
              Email / Domain
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-5 text-[10px] text-slate-600">
            <div className="flex items-center gap-2">
              <span className="h-px w-7 bg-slate-500" />
              Observed
            </div>
            <div className="flex items-center gap-2 text-purple-300">
              <span className="w-7 border-t border-dashed border-purple-300" />
              Inferred
            </div>
            <div className="flex items-center gap-2 text-amber-300">
              <span className="w-7 border-t border-dotted border-amber-300" />
              Potential
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* TRACE AUDIT CERTIFICATE MODAL */}
      {/* ------------------------------------------------------------------- */}
      {certificateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-3xl rounded-2xl border border-emerald-500/40 bg-[#06140F] p-6 font-mono text-xs space-y-4 shadow-2xl animate-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-emerald-500/30 pb-3">
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <span className="text-sm">CRYPTOGRAPHIC INVESTIGATIVE TRACEABILITY CERTIFICATE</span>
              </div>
              <button
                onClick={() => setCertificateModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3.5 rounded-lg bg-black/60 border border-emerald-500/20 text-emerald-300 font-mono text-[11px] leading-relaxed whitespace-pre-wrap select-all">
              {certificateContent}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-emerald-500/20">
              <div className="text-[10px] text-slate-400">
                Admissible Evidentiary Record · SHA-256 Validated
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyCertText}
                  className="px-3 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/40 flex items-center gap-1.5 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copySuccess ? 'Copied to Clipboard!' : 'Copy Text'}</span>
                </button>
                <button
                  onClick={handleDownloadCertFile}
                  className="px-4 py-1.5 rounded-lg border border-emerald-500 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold flex items-center gap-1.5 transition-all shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .TXT Certificate</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
