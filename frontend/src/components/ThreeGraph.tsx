import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { motion } from 'framer-motion';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Entity, Relationship, GraphData, EntityType } from '../types';

// Subtle, sophisticated color system for different node types
const NODE_COLORS: Record<EntityType, number> = {
  person:       0x1C1B1A,
  organization: 0x262422,
  phone:        0x2D2A28,
  vehicle:      0x1C1B1A,
  location:     0x383532,
  case:         0x1C1B1A,
  event:        0x262422,
  other:        0x4A4743
};

const HIGHLIGHT_COLOR    = 0x6E1827;
const HIGHLIGHT_EMISSIVE = 0x4E101B;

interface ThreeGraphProps {
  data: GraphData;
  onNodeSelect: (node: Entity | null) => void;
  onRelationshipSelect: (rel: Relationship | null) => void;
  selectedNode: Entity | null;
  selectedRelationship: Relationship | null;
  filterTypes: EntityType[];
  filterRelTypes: string[];
  searchTerm: string;
  shortestPathQuery: { sourceId: string; targetId: string } | null;
  isolateNodeId: string | null;
  resetLayoutTrigger?: number;
  fitScreenTrigger?: number;
  focusNodeId?: string | null;
  highlightPredictedConnections?: boolean;
  expandNeighborsNodeId?: string | null;
}

// Stable refs shared across effects
interface SceneRefs {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  nodeGroup: THREE.Group;
  linkGroup: THREE.Group;
  nodeMeshes: THREE.Mesh[];
  linkMeshes: THREE.Line[];
  nodeIndexById: Map<string, number>;
  linkMeta: Array<{ sId: string; tId: string; isPredicted: boolean }>;
  linkMapByNode: Map<string, number[]>;
  activeNodes: Entity[];
  activeLinks: Relationship[];
  targetCameraPos: THREE.Vector3 | null;
  targetCameraLookAt: THREE.Vector3 | null;
  isLerpingCamera: boolean;
}

export const ThreeGraph: React.FC<ThreeGraphProps> = ({
  data,
  onNodeSelect,
  onRelationshipSelect,
  selectedNode,
  selectedRelationship,
  filterTypes,
  filterRelTypes,
  searchTerm,
  shortestPathQuery,
  isolateNodeId,
  resetLayoutTrigger = 0,
  fitScreenTrigger = 0,
  focusNodeId = null,
  highlightPredictedConnections = false,
  expandNeighborsNodeId = null
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);

  // Hover state (React-controlled for HTML tooltip)
  const [hoveredNode, setHoveredNode] = useState<Entity | null>(null);
  const hoveredNodeRef = useRef<Entity | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Persistent node positions across re-renders & updates
  const nodePositionsRef    = useRef<Record<string, THREE.Vector3>>({});
  const initialPositionsRef = useRef<Record<string, THREE.Vector3>>({});
  const currentCaseNodesKey = useRef<string>('');

  // Drag interaction state refs (kept in refs for high-frequency 60fps event handling)
  const activeDraggedMeshRef = useRef<THREE.Mesh | null>(null);
  const isDraggingRef        = useRef<boolean>(false);
  const hasMovedRef          = useRef<boolean>(false);
  const mouseDownPosRef      = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragPlaneRef         = useRef<THREE.Plane>(new THREE.Plane());
  const dragOffsetRef        = useRef<THREE.Vector3>(new THREE.Vector3());

  // Animation frame handle
  const animationFrameId = useRef<number | null>(null);

  // Stable scene refs accessible without remounting WebGL
  const sceneRefs = useRef<SceneRefs | null>(null);

  // Callbacks to access latest prop values inside stable event listeners
  const onNodeSelectRef         = useRef(onNodeSelect);
  const onRelationshipSelectRef = useRef(onRelationshipSelect);
  onNodeSelectRef.current         = onNodeSelect;
  onRelationshipSelectRef.current = onRelationshipSelect;

  // ─────────────────────────────────────────────────────────────────────────────
  // HELPER: Force-directed relaxation layout
  // ─────────────────────────────────────────────────────────────────────────────
  const runForceLayout = useCallback((
    activeNodes: Entity[],
    activeLinks: Relationship[],
    iterations: number
  ) => {
    const positions = nodePositionsRef.current;
    const k = 16;
    const repulsionConstant  = 160;
    const attractionConstant = 0.06;
    const gravityConstant    = 0.02;

    for (let step = 0; step < iterations; step++) {
      const forces: Record<string, THREE.Vector3> = {};
      activeNodes.forEach(n => { forces[n.id] = new THREE.Vector3(); });

      // Repulsion
      for (let i = 0; i < activeNodes.length; i++) {
        const n1  = activeNodes[i];
        const pos1 = positions[n1.id];
        if (!pos1) continue;
        for (let j = i + 1; j < activeNodes.length; j++) {
          const n2   = activeNodes[j];
          const pos2 = positions[n2.id];
          if (!pos2) continue;
          const delta = new THREE.Vector3().subVectors(pos1, pos2);
          const dist  = delta.length() || 0.1;
          if (dist < 45) {
            const f   = repulsionConstant / (dist * dist);
            const dir = delta.clone().normalize().multiplyScalar(f);
            forces[n1.id].add(dir);
            forces[n2.id].sub(dir);
          }
        }
      }

      // Attraction along links
      activeLinks.forEach(link => {
        const sId = typeof link.source === 'object' ? (link.source as any).id : link.source;
        const tId = typeof link.target === 'object' ? (link.target as any).id : link.target;
        const posS = positions[sId];
        const posT = positions[tId];
        if (posS && posT) {
          const delta = new THREE.Vector3().subVectors(posT, posS);
          const dist  = delta.length() || 0.1;
          const f     = (dist - k) * attractionConstant;
          const dir   = delta.clone().normalize().multiplyScalar(f);
          forces[sId].add(dir);
          forces[tId].sub(dir);
        }
      });

      // Center gravity
      activeNodes.forEach(node => {
        const pos = positions[node.id];
        if (pos) {
          const centerDelta = new THREE.Vector3(0, 8, 0).sub(pos);
          forces[node.id].add(centerDelta.multiplyScalar(gravityConstant));
          positions[node.id].add(forces[node.id].multiplyScalar(0.2));
        }
      });
    }
  }, []);

  // Helper to update connected link positions in real time
  const updateConnectedLinesForNode = useCallback((nodeId: string) => {
    const refs = sceneRefs.current;
    if (!refs) return;
    const { linkMapByNode, linkMeta, linkMeshes, nodeIndexById, nodeMeshes } = refs;
    const indices = linkMapByNode.get(nodeId);
    if (!indices) return;

    indices.forEach(lIdx => {
      const lMesh = linkMeshes[lIdx];
      if (!lMesh) return;
      const { sId, tId, isPredicted } = linkMeta[lIdx];
      const sIdx = nodeIndexById.get(sId);
      const tIdx = nodeIndexById.get(tId);
      if (sIdx !== undefined && tIdx !== undefined && nodeMeshes[sIdx] && nodeMeshes[tIdx]) {
        const sPos = nodeMeshes[sIdx].position;
        const tPos = nodeMeshes[tIdx].position;
        const posAttr = lMesh.geometry.attributes.position as THREE.BufferAttribute;
        if (posAttr) {
          posAttr.setXYZ(0, sPos.x, sPos.y, sPos.z);
          posAttr.setXYZ(1, tPos.x, tPos.y, tPos.z);
          posAttr.needsUpdate = true;
        }
        if (isPredicted) {
          lMesh.computeLineDistances();
        }
      }
    });
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // EFFECT 1 — MOUNT LIFECYCLE: Scene, Camera, WebGLRenderer, Controls, Animation Loop
  // Only created once on mount and cleanly disposed on unmount.
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const width  = containerRef.current.clientWidth  || 800;
    const height = containerRef.current.clientHeight || 500;

    // ── Scene & Camera ─────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#F7F5F1');

    const gridHelper = new THREE.GridHelper(120, 40, '#DAD6CC', '#E7E4DC');
    gridHelper.position.y = -15;
    scene.add(gridHelper);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 25, 75);

    // ── Renderer ───────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.style.outline     = 'none';

    // ── OrbitControls ──────────────────────────────────────────────────────────
    // Standard setup:
    // Left-click on canvas = rotate (when not dragging a node)
    // Right-click = pan
    // Scroll / wheel = zoom
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping      = true;
    controls.dampingFactor      = 0.08;
    controls.enableZoom         = true;
    controls.zoomSpeed          = 1.0;
    controls.enableRotate       = true;
    controls.rotateSpeed        = 0.8;
    controls.enablePan          = true;
    controls.panSpeed           = 0.8;
    controls.screenSpacePanning = true;
    controls.maxDistance        = 350;
    controls.minDistance        = 5;
    controls.target.set(0, 8, 0);
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN
    };

    // ── Lighting ───────────────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xFFFFFF, 0.9));
    const dirLight1 = new THREE.DirectionalLight(0xFFFFFF, 0.7);
    dirLight1.position.set(50, 100, 50);
    scene.add(dirLight1);
    const dirLight2 = new THREE.DirectionalLight(0xCBD5E1, 0.4);
    dirLight2.position.set(-50, -50, -50);
    scene.add(dirLight2);

    // Groups for nodes and links
    const nodeGroup = new THREE.Group();
    const linkGroup = new THREE.Group();
    scene.add(linkGroup);
    scene.add(nodeGroup);

    // Store refs
    sceneRefs.current = {
      scene, camera, renderer, controls,
      nodeGroup, linkGroup,
      nodeMeshes: [],
      linkMeshes: [],
      nodeIndexById: new Map(),
      linkMeta: [],
      linkMapByNode: new Map(),
      activeNodes: [],
      activeLinks: [],
      targetCameraPos: null,
      targetCameraLookAt: null,
      isLerpingCamera: false
    };

    // ── Interaction: Pointer Events with Drag & Pan Isolation ──────────────────
    const raycaster = new THREE.Raycaster();
    const mouse     = new THREE.Vector2();

    const updateMouseCoords = (cx: number, cy: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      mouse.x =  ((cx - rect.left) / rect.width)  * 2 - 1;
      mouse.y = -((cy - rect.top)  / rect.height) * 2 + 1;
    };

    const handlePointerDown = (event: PointerEvent) => {
      // Handle Left-click: check for node drag or selection
      if (event.button === 0) {
        updateMouseCoords(event.clientX, event.clientY);
        mouseDownPosRef.current = { x: event.clientX, y: event.clientY };
        hasMovedRef.current = false;
        isDraggingRef.current = false;
        activeDraggedMeshRef.current = null;

        const refs = sceneRefs.current;
        if (!refs) return;

        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(refs.nodeMeshes, false);

        if (hits.length > 0) {
          event.preventDefault();
          event.stopPropagation();

          // Immediately disable OrbitControls so left-drag moves the node, not camera
          controls.enabled = false;

          const hitMesh = hits[0].object as THREE.Mesh;
          activeDraggedMeshRef.current = hitMesh;
          isDraggingRef.current = true;

          try {
            renderer.domElement.setPointerCapture(event.pointerId);
          } catch {}

          // Create screen-parallel plane passing through the clicked node
          const planeNormal = camera.getWorldDirection(new THREE.Vector3()).negate();
          dragPlaneRef.current.setFromNormalAndCoplanarPoint(planeNormal, hitMesh.position);

          const ip = new THREE.Vector3();
          if (raycaster.ray.intersectPlane(dragPlaneRef.current, ip)) {
            dragOffsetRef.current.subVectors(hitMesh.position, ip);
          }
        }
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      updateMouseCoords(event.clientX, event.clientY);
      const refs = sceneRefs.current;
      if (!refs) return;

      // Node Dragging Mode
      if (activeDraggedMeshRef.current && (event.buttons & 1)) {
        const dist = Math.hypot(
          event.clientX - mouseDownPosRef.current.x,
          event.clientY - mouseDownPosRef.current.y
        );

        if (dist > 3) {
          hasMovedRef.current = true;
        }

        if (hasMovedRef.current) {
          controls.enabled = false;
          raycaster.setFromCamera(mouse, camera);
          const ip = new THREE.Vector3();

          if (raycaster.ray.intersectPlane(dragPlaneRef.current, ip)) {
            const newPos = ip.clone().add(dragOffsetRef.current);
            activeDraggedMeshRef.current.position.copy(newPos);
            const nodeId = activeDraggedMeshRef.current.userData.id as string;
            if (nodePositionsRef.current[nodeId]) {
              nodePositionsRef.current[nodeId].copy(newPos);
            }
            updateConnectedLinesForNode(nodeId);
          }

          renderer.domElement.style.cursor = 'grabbing';
          setHoveredNode(null);
          hoveredNodeRef.current = null;
          return;
        }
      }

      // Hover Inspection Mode (when not dragging)
      if (!isDraggingRef.current) {
        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(refs.nodeMeshes, false);
        if (hits.length > 0) {
          const nd = (hits[0].object as THREE.Mesh).userData.node as Entity;
          setHoveredNode(nd);
          hoveredNodeRef.current = nd;
          const rect = renderer.domElement.getBoundingClientRect();
          setTooltipPos({ x: event.clientX - rect.left + 15, y: event.clientY - rect.top - 20 });
          renderer.domElement.style.cursor = 'pointer';
        } else {
          setHoveredNode(null);
          hoveredNodeRef.current = null;
          renderer.domElement.style.cursor = 'grab';
        }
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      const dist = Math.hypot(
        event.clientX - mouseDownPosRef.current.x,
        event.clientY - mouseDownPosRef.current.y
      );

      controls.enabled = true;
      renderer.domElement.style.cursor = 'grab';

      // 1. If we were targeting a node
      if (activeDraggedMeshRef.current) {
        try {
          renderer.domElement.releasePointerCapture(event.pointerId);
        } catch {}

        const mesh = activeDraggedMeshRef.current;
        const nodeId = mesh.userData.id as string;
        const nodeData = mesh.userData.node as Entity;

        if (hasMovedRef.current) {
          // Drag finished: ensure position is permanently committed
          if (nodePositionsRef.current[nodeId]) {
            nodePositionsRef.current[nodeId].copy(mesh.position);
          }
          updateConnectedLinesForNode(nodeId);
        } else {
          // Clean Click on Node: SELECT & FOCUS
          onNodeSelectRef.current(nodeData);
          onRelationshipSelectRef.current(null);

          const targetPos = nodePositionsRef.current[nodeData.id];
          if (targetPos && sceneRefs.current) {
            sceneRefs.current.targetCameraPos    = new THREE.Vector3(targetPos.x, targetPos.y + 14, targetPos.z + 28);
            sceneRefs.current.targetCameraLookAt = targetPos.clone();
            sceneRefs.current.isLerpingCamera    = true;
          }
        }

        activeDraggedMeshRef.current = null;
        isDraggingRef.current = false;
        hasMovedRef.current = false;
        return;
      }

      // 2. Click on empty space or edge (not camera drag)
      if (event.button === 0 && dist <= 4) {
        const refs = sceneRefs.current;
        if (!refs) return;

        updateMouseCoords(event.clientX, event.clientY);
        raycaster.setFromCamera(mouse, camera);

        // Check if a relationship edge was clicked
        raycaster.params.Line = { threshold: 1.2 };
        const lineHits = raycaster.intersectObjects(refs.linkMeshes, false);
        if (lineHits.length > 0) {
          const rel = (lineHits[0].object as THREE.Line).userData.link as Relationship;
          onRelationshipSelectRef.current(rel);
          onNodeSelectRef.current(null);
          return;
        }

        // Empty canvas click: CLEAR SELECTION
        onNodeSelectRef.current(null);
        onRelationshipSelectRef.current(null);
      }

      activeDraggedMeshRef.current = null;
      isDraggingRef.current = false;
      hasMovedRef.current = false;
    };

    // Prevent context menu to allow smooth right-click drag pan
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const dom = renderer.domElement;
    dom.addEventListener('pointerdown', handlePointerDown);
    dom.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    dom.addEventListener('contextmenu', handleContextMenu);

    // ── Animation Loop ─────────────────────────────────────────────────────────
    const startTime = performance.now();
    const scaleVec  = new THREE.Vector3();

    const animate = () => {
      const time = (performance.now() - startTime) / 1000;
      const refs = sceneRefs.current;

      if (refs) {
        // Camera Glide Interpolation
        if (refs.isLerpingCamera && refs.targetCameraPos && refs.targetCameraLookAt) {
          camera.position.lerp(refs.targetCameraPos, 0.055);
          controls.target.lerp(refs.targetCameraLookAt, 0.055);
          if (camera.position.distanceTo(refs.targetCameraPos) < 0.15) {
            refs.isLerpingCamera = false;
          }
        }

        // Node Visual Updates & Subtle Living Motion
        refs.nodeMeshes.forEach((mesh, idx) => {
          const id = mesh.userData.id;
          // Skip micro-drift on actively dragged node to ensure 1:1 precision
          if (activeDraggedMeshRef.current?.userData.id !== id) {
            const origPos = nodePositionsRef.current[id];
            if (origPos) {
              mesh.position.set(
                origPos.x + Math.sin(time * 0.7 + idx * 1.4) * 0.04,
                origPos.y + Math.cos(time * 0.5 + idx * 1.1) * 0.04,
                origPos.z
              );
            }
          }

          const isHovered  = hoveredNodeRef.current?.id === id;
          const isSelected = mesh.userData._isSelected as boolean;
          let tScale = 1.0;
          if (isHovered)       tScale = Math.sin(time * 3.2) * 0.015 + 1.04;
          else if (isSelected) tScale = 1.24;
          scaleVec.set(tScale, tScale, tScale);
          mesh.scale.lerp(scaleVec, 0.15);
        });

        // Dynamic Edge Following in 60fps
        refs.linkMeshes.forEach((lMesh, lIdx) => {
          const { sId, tId, isPredicted } = refs.linkMeta[lIdx];
          const sIdx = refs.nodeIndexById.get(sId);
          const tIdx = refs.nodeIndexById.get(tId);
          if (sIdx !== undefined && tIdx !== undefined) {
            const sMesh = refs.nodeMeshes[sIdx];
            const tMesh = refs.nodeMeshes[tIdx];
            if (sMesh && tMesh) {
              const posAttr = lMesh.geometry.attributes.position as THREE.BufferAttribute;
              if (posAttr) {
                posAttr.setXYZ(0, sMesh.position.x, sMesh.position.y, sMesh.position.z);
                posAttr.setXYZ(1, tMesh.position.x, tMesh.position.y, tMesh.position.z);
                posAttr.needsUpdate = true;
              }
              if (isPredicted) {
                (lMesh.material as any).dashOffset = -time * 1.8;
                lMesh.computeLineDistances();
              }
            }
          }
        });

        controls.update();
        renderer.render(scene, camera);
      }

      animationFrameId.current = requestAnimationFrame(animate);
    };

    animate();

    // ── Resize Observer ────────────────────────────────────────────────────────
    const resizeObserver = new ResizeObserver(entries => {
      if (!entries.length) return;
      const { width: nW, height: nH } = entries[0].contentRect;
      camera.aspect = nW / (nH || 1);
      camera.updateProjectionMatrix();
      renderer.setSize(nW, nH || 500);
    });
    resizeObserver.observe(containerRef.current!);

    // ── Cleanup ────────────────────────────────────────────────────────────────
    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      resizeObserver.disconnect();
      dom.removeEventListener('pointerdown', handlePointerDown);
      dom.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      dom.removeEventListener('contextmenu', handleContextMenu);
      controls.dispose();
      renderer.dispose();
      gridHelper.dispose();
      sceneRefs.current = null;
    };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // EFFECT 2 — GRAPH GEOMETRY BUILDER: Rebuilds nodes/edges inside the existing scene
  // Node positions are PRESERVED across state updates. Initial force layout only
  // runs when a brand-new graph/case arrives or when "Reset" is triggered.
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs) return;

    const { nodeGroup, linkGroup } = refs;

    // Filter active nodes and edges
    const activeNodes = data.nodes.filter(n => filterTypes.includes(n.type));
    const activeNodeIds = new Set(activeNodes.map(n => n.id));
    const activeLinks = data.links.filter(l => {
      const sId = typeof l.source === 'object' ? (l.source as any).id : l.source;
      const tId = typeof l.target === 'object' ? (l.target as any).id : l.target;
      const relOk = filterRelTypes.length === 0 || filterRelTypes.includes(l.type);
      return relOk && activeNodeIds.has(sId) && activeNodeIds.has(tId);
    });

    // Detect case change or first load
    const caseKey = activeNodes.map(n => n.id).sort().join(',');
    const isNewCase = currentCaseNodesKey.current !== caseKey && currentCaseNodesKey.current !== '';

    if (isNewCase) {
      nodePositionsRef.current = {};
      initialPositionsRef.current = {};
    }
    currentCaseNodesKey.current = caseKey;

    // Clear stale positions of nodes no longer in graph
    Object.keys(nodePositionsRef.current).forEach(id => {
      if (!activeNodeIds.has(id)) delete nodePositionsRef.current[id];
    });

    // Assign fresh positions for new nodes
    let hasNewNodes = false;
    activeNodes.forEach(node => {
      if (!nodePositionsRef.current[node.id]) {
        hasNewNodes = true;
        nodePositionsRef.current[node.id] = new THREE.Vector3(
          (Math.random() - 0.5) * 44,
          (Math.random() - 0.5) * 32 + 8,
          (Math.random() - 0.5) * 44
        );
      }
    });

    // Run initial force layout only for brand-new nodes or when initial positions are empty
    if (hasNewNodes || Object.keys(initialPositionsRef.current).length === 0) {
      runForceLayout(activeNodes, activeLinks, 25);
      // Save pristine initial positions for "Reset"
      activeNodes.forEach(n => {
        if (nodePositionsRef.current[n.id]) {
          initialPositionsRef.current[n.id] = nodePositionsRef.current[n.id].clone();
        }
      });
    }

    // Blossom neighbors layout if requested
    if (expandNeighborsNodeId && nodePositionsRef.current[expandNeighborsNodeId]) {
      const centerPos = nodePositionsRef.current[expandNeighborsNodeId];
      const neighborIds = new Set<string>();
      activeLinks.forEach(l => {
        const sId = typeof l.source === 'object' ? (l.source as any).id : l.source;
        const tId = typeof l.target === 'object' ? (l.target as any).id : l.target;
        if (sId === expandNeighborsNodeId) neighborIds.add(tId);
        if (tId === expandNeighborsNodeId) neighborIds.add(sId);
      });
      const neighbors = Array.from(neighborIds).filter(id => id !== expandNeighborsNodeId);
      const total = neighbors.length;
      if (total > 0) {
        const radius = 22;
        neighbors.forEach((nId, idx) => {
          const angle = (idx / total) * Math.PI * 2;
          nodePositionsRef.current[nId] = new THREE.Vector3(
            centerPos.x + Math.cos(angle) * radius,
            centerPos.y + Math.sin(angle) * (radius * 0.5) + (idx % 2 === 0 ? 3 : -3),
            centerPos.z + Math.sin(angle) * (radius * 0.7)
          );
        });
      }
    }

    // Dispose old meshes and clear groups
    while (nodeGroup.children.length > 0) {
      const child = nodeGroup.children[0] as THREE.Mesh;
      nodeGroup.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else child.material.dispose();
      }
    }

    while (linkGroup.children.length > 0) {
      const child = linkGroup.children[0] as THREE.Line;
      linkGroup.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else child.material.dispose();
      }
    }

    // ── Build Node Meshes ──────────────────────────────────────────────────────
    const nodeMeshes: THREE.Mesh[] = [];
    const nodeIndexById = new Map<string, number>();
    const sharedNodeGeo = new THREE.SphereGeometry(1.6, 24, 24);

    activeNodes.forEach(node => {
      const pos = nodePositionsRef.current[node.id];
      if (!pos) return;

      const baseColor = NODE_COLORS[node.type] ?? 0x4A4743;
      const mat = new THREE.MeshStandardMaterial({
        color: baseColor,
        roughness: 0.25,
        metalness: 0.1,
        transparent: false,
        opacity: 1.0,
        emissive: new THREE.Color(0, 0, 0),
        emissiveIntensity: 0
      });

      const mesh = new THREE.Mesh(sharedNodeGeo, mat);
      mesh.position.copy(pos);
      mesh.userData = { node, id: node.id };

      const idx = nodeMeshes.length;
      nodeMeshes.push(mesh);
      nodeIndexById.set(node.id, idx);
      nodeGroup.add(mesh);
    });

    // ── Build Link Meshes ──────────────────────────────────────────────────────
    const linkMeshes: THREE.Line[] = [];
    const linkMeta: Array<{ sId: string; tId: string; isPredicted: boolean }> = [];
    const linkMapByNode = new Map<string, number[]>();

    activeLinks.forEach(link => {
      const sId = typeof link.source === 'object' ? (link.source as any).id : link.source;
      const tId = typeof link.target === 'object' ? (link.target as any).id : link.target;
      const posS = nodePositionsRef.current[sId];
      const posT = nodePositionsRef.current[tId];
      if (!posS || !posT) return;

      const points = [posS.clone(), posT.clone()];
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      let line: THREE.Line;

      if (link.isPredicted) {
        const mat = new THREE.LineDashedMaterial({
          color: 0x6E1827,
          dashSize: 1.8,
          gapSize: 0.6,
          transparent: true,
          opacity: 0.88
        });
        line = new THREE.Line(geo, mat);
        line.computeLineDistances();
      } else {
        const mat = new THREE.LineBasicMaterial({
          color: 0x1C1B1A,
          transparent: true,
          opacity: 0.28
        });
        line = new THREE.Line(geo, mat);
      }

      line.userData = { link, sId, tId };
      linkGroup.add(line);
      const lIdx = linkMeshes.length;
      linkMeshes.push(line);
      linkMeta.push({ sId, tId, isPredicted: !!link.isPredicted });

      if (!linkMapByNode.has(sId)) linkMapByNode.set(sId, []);
      if (!linkMapByNode.has(tId)) linkMapByNode.set(tId, []);
      linkMapByNode.get(sId)!.push(lIdx);
      linkMapByNode.get(tId)!.push(lIdx);
    });

    // Update scene refs
    refs.nodeMeshes = nodeMeshes;
    refs.linkMeshes = linkMeshes;
    refs.nodeIndexById = nodeIndexById;
    refs.linkMeta = linkMeta;
    refs.linkMapByNode = linkMapByNode;
    refs.activeNodes = activeNodes;
    refs.activeLinks = activeLinks;

  }, [data, filterTypes, filterRelTypes, expandNeighborsNodeId, runForceLayout]);

  // ─────────────────────────────────────────────────────────────────────────────
  // EFFECT 3 — VISUAL UPDATES (Selection, Highlights, Shortest Path, Isolate)
  // Direct material property updates in 60fps without recreating any scene meshes!
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs) return;

    const { nodeMeshes, linkMeshes, linkMeta, nodeIndexById, activeNodes, activeLinks } = refs;

    // Shortest path BFS
    const pathNodes = new Set<string>();
    const pathLinks = new Set<string>();
    if (shortestPathQuery) {
      const { sourceId, targetId } = shortestPathQuery;
      const adjMap: Record<string, Array<{ neighbor: string; linkId: string }>> = {};
      activeLinks.forEach(l => {
        const sId = typeof l.source === 'object' ? (l.source as any).id : l.source;
        const tId = typeof l.target === 'object' ? (l.target as any).id : l.target;
        if (!adjMap[sId]) adjMap[sId] = [];
        if (!adjMap[tId]) adjMap[tId] = [];
        adjMap[sId].push({ neighbor: tId, linkId: l.id });
        adjMap[tId].push({ neighbor: sId, linkId: l.id });
      });
      const queue: Array<{ id: string; path: string[]; links: string[] }> = [{ id: sourceId, path: [sourceId], links: [] }];
      const visited = new Set<string>([sourceId]);
      while (queue.length > 0) {
        const cur = queue.shift()!;
        if (cur.id === targetId) {
          cur.path.forEach(id => pathNodes.add(id));
          cur.links.forEach(id => pathLinks.add(id));
          break;
        }
        for (const { neighbor, linkId } of (adjMap[cur.id] || [])) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push({ id: neighbor, path: [...cur.path, neighbor], links: [...cur.links, linkId] });
          }
        }
      }
    }

    // Isolate set
    const isolatedNeighbors = new Set<string>();
    if (isolateNodeId) {
      isolatedNeighbors.add(isolateNodeId);
      activeLinks.forEach(l => {
        const sId = typeof l.source === 'object' ? (l.source as any).id : l.source;
        const tId = typeof l.target === 'object' ? (l.target as any).id : l.target;
        if (sId === isolateNodeId) isolatedNeighbors.add(tId);
        if (tId === isolateNodeId) isolatedNeighbors.add(sId);
      });
    }

    // Apply to node meshes
    activeNodes.forEach(node => {
      const idx = nodeIndexById.get(node.id);
      if (idx === undefined) return;
      const mesh = nodeMeshes[idx];
      if (!mesh) return;
      const mat = mesh.material as THREE.MeshStandardMaterial;

      const isSelected  = selectedNode?.id === node.id;
      const searchMatch = searchTerm ? node.label.toLowerCase().includes(searchTerm.toLowerCase()) : false;
      const inPath      = pathNodes.has(node.id);
      const inIsolate   = isolateNodeId ? isolatedNeighbors.has(node.id) : true;

      const isHighlighted = isSelected || searchMatch || inPath;
      let opacity = 1.0;

      if (shortestPathQuery && !inPath) opacity = 0.15;
      if (isolateNodeId && !inIsolate)  opacity = 0.15;

      mat.color.set(isHighlighted ? HIGHLIGHT_COLOR : (NODE_COLORS[node.type] ?? 0x4A4743));
      mat.emissive.set(isHighlighted ? HIGHLIGHT_EMISSIVE : 0);
      mat.emissiveIntensity = isHighlighted ? 0.3 : 0;
      mat.transparent = opacity < 1.0;
      mat.opacity     = opacity;
      mat.needsUpdate = true;

      mesh.userData._isSelected = isSelected;
    });

    // Apply to link meshes
    linkMeshes.forEach((lMesh, lIdx) => {
      const { sId, tId, isPredicted } = linkMeta[lIdx];
      const link = lMesh.userData.link as Relationship;

      let opacity   = 0.28;
      let colorHex  = 0x1C1B1A;
      let highlighted = false;

      if (shortestPathQuery) {
        if (pathLinks.has(link.id)) { highlighted = true; colorHex = 0x6E1827; opacity = 0.95; }
        else opacity = 0.05;
      }
      if (isolateNodeId) {
        if (sId === isolateNodeId || tId === isolateNodeId) { highlighted = true; colorHex = 0x0D0D0D; opacity = 0.85; }
        else opacity = 0.05;
      }
      if (selectedRelationship?.id === link.id) { highlighted = true; colorHex = 0x6E1827; opacity = 1.0; }

      const mat = lMesh.material as THREE.LineBasicMaterial | THREE.LineDashedMaterial;
      if (!isPredicted) {
        (mat as THREE.LineBasicMaterial).color.set(colorHex);
        mat.opacity = opacity;
        mat.transparent = opacity < 1.0;
        mat.needsUpdate = true;
      } else {
        mat.opacity = highlighted ? 1.0 : (highlightPredictedConnections ? 0.95 : 0.88);
        mat.transparent = true;
        mat.needsUpdate = true;
      }
    });

  }, [selectedNode, selectedRelationship, searchTerm, shortestPathQuery, isolateNodeId, highlightPredictedConnections]);

  // ─────────────────────────────────────────────────────────────────────────────
  // EFFECT 4 — CAMERA TRIGGERS (Fit Entire Graph, Reset, Focus Node, Search)
  // ─────────────────────────────────────────────────────────────────────────────
  // Fit Entire Graph: Computes bounding sphere/box of all nodes and smoothly frames them
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs || fitScreenTrigger <= 0) return;

    const { activeNodes, camera } = refs;
    if (activeNodes.length === 0) return;

    const box = new THREE.Box3();
    activeNodes.forEach(n => {
      const pos = nodePositionsRef.current[n.id];
      if (pos) box.expandByPoint(pos);
    });

    const center = new THREE.Vector3();
    box.getCenter(center);
    const size = new THREE.Vector3();
    box.getSize(size);

    const maxDim = Math.max(size.x, size.y, size.z, 20);
    const fovRad = camera.fov * (Math.PI / 180);
    let cameraDistance = Math.abs(maxDim / 2 / Math.tan(fovRad / 2));
    cameraDistance *= 1.35; // Add clean padding
    cameraDistance = Math.max(cameraDistance, 35);

    refs.targetCameraPos    = new THREE.Vector3(center.x, center.y + cameraDistance * 0.35, center.z + cameraDistance);
    refs.targetCameraLookAt = center.clone();
    refs.isLerpingCamera    = true;
  }, [fitScreenTrigger]);

  // Reset Graph: Restores all node positions to pristine initial layout and resets camera
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs || resetLayoutTrigger <= 0) return;

    const { activeNodes, nodeMeshes, nodeIndexById } = refs;

    activeNodes.forEach(node => {
      const initPos = initialPositionsRef.current[node.id];
      if (initPos && nodePositionsRef.current[node.id]) {
        nodePositionsRef.current[node.id].copy(initPos);
        const idx = nodeIndexById.get(node.id);
        if (idx !== undefined && nodeMeshes[idx]) {
          nodeMeshes[idx].position.copy(initPos);
        }
        updateConnectedLinesForNode(node.id);
      }
    });

    refs.targetCameraPos    = new THREE.Vector3(0, 25, 75);
    refs.targetCameraLookAt = new THREE.Vector3(0, 8, 0);
    refs.isLerpingCamera    = true;
  }, [resetLayoutTrigger, updateConnectedLinesForNode]);

  // Focus Node: Smooth camera glide to the selected entity
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs || !focusNodeId) return;
    const pos = nodePositionsRef.current[focusNodeId];
    if (pos) {
      refs.targetCameraPos    = new THREE.Vector3(pos.x, pos.y + 14, pos.z + 28);
      refs.targetCameraLookAt = pos.clone();
      refs.isLerpingCamera    = true;
    }
  }, [focusNodeId]);

  // Search Match: Smooth camera glide to matching node
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs || !searchTerm) return;
    const match = refs.activeNodes.find(n => n.label.toLowerCase().includes(searchTerm.toLowerCase()));
    if (match) {
      const pos = nodePositionsRef.current[match.id];
      if (pos) {
        refs.targetCameraPos    = new THREE.Vector3(pos.x, pos.y + 14, pos.z + 28);
        refs.targetCameraLookAt = pos.clone();
        refs.isLerpingCamera    = true;
      }
    }
  }, [searchTerm]);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-[#F7F5F0] overflow-hidden" id="three-graph-container">
      <canvas
        ref={canvasRef}
        className="w-full h-full block cursor-grab active:cursor-grabbing"
        id="three-graph-canvas"
        onContextMenu={(e) => e.preventDefault()}
      />

      {hoveredNode && !isDraggingRef.current && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{
            opacity: 1,
            scale: [1.02, 1.035, 1.02],
            boxShadow: [
              '0 4px 12px -2px rgba(18,17,16,0.08), 0 0 0 1px rgba(110,24,39,0.15)',
              '0 6px 18px -2px rgba(110,24,39,0.22), 0 0 0 2px rgba(110,24,39,0.25)',
              '0 4px 12px -2px rgba(18,17,16,0.08), 0 0 0 1px rgba(110,24,39,0.15)'
            ]
          }}
          transition={{
            scale:     { duration: 2.2, repeat: Infinity, ease: 'easeInOut' },
            boxShadow: { duration: 2.2, repeat: Infinity, ease: 'easeInOut' },
            opacity:   { duration: 0.15 }
          }}
          className="absolute z-50 pointer-events-none bg-white/95 backdrop-blur-md border border-[#E6E1D8] rounded-xl px-3.5 py-2.5 text-xs text-[#121110] shadow-lg max-w-xs"
          style={{ left: `${tooltipPos.x}px`, top: `${tooltipPos.y}px` }}
          id="graph-hover-tooltip"
        >
          <div className="font-semibold text-[#121110] border-b border-[#E6E1D8] pb-1.5 mb-1.5 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#6E1827] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#6E1827]" />
              </span>
              <span className="truncate">{hoveredNode.label}</span>
            </span>
            <span className="text-[9px] uppercase font-bold text-[#6E1827] bg-[#6E1827]/10 border border-[#6E1827]/20 px-1.5 py-0.5 rounded-sm">
              {hoveredNode.type}
            </span>
          </div>
          {Object.entries(hoveredNode.properties || {}).slice(0, 3).map(([key, value]) => (
            <div key={key} className="flex justify-between gap-4 text-[10px] text-[#6B6760] py-0.5 font-sans">
              <span className="font-mono text-[#8C877D] uppercase">{key}:</span>
              <span className="font-medium text-[#121110] truncate max-w-[120px]">{String(value)}</span>
            </div>
          ))}
          <div className="mt-1.5 pt-1.5 border-t border-[#E6E1D8] flex items-center justify-between text-[9px] font-mono text-[#6B6760]">
            <span>RISK SCORE: <span className="font-bold text-[#6E1827]">{Math.round(hoveredNode.riskScore > 1.0 ? hoveredNode.riskScore : hoveredNode.riskScore * 100)}%</span></span>
            <span>CENTRALITY: <span className="font-bold text-[#121110]">{hoveredNode.centrality.toFixed(2)}</span></span>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default ThreeGraph;
