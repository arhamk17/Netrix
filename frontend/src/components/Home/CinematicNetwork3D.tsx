import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface StoryStage {
  id: number;
  title: string;
  phase: string;
  description: string;
}

const STORY_STAGES: StoryStage[] = [
  {
    id: 0,
    title: 'Fragmented Evidence',
    phase: '01 / DISCONNECTED DATA',
    description: 'Evidence records, phone logs, and financial registries exist as isolated, disconnected fragments.'
  },
  {
    id: 1,
    title: 'Network Synthesis',
    phase: '02 / RELATIONAL GRAPH',
    description: 'Entity extraction constructs known operational structures across people, accounts, and maritime routes.'
  },
  {
    id: 2,
    title: 'Hidden Relationship Detected',
    phase: '03 / LOCAL ML PREDICTION',
    description: 'Local GNN link predictor detects an unobserved collusion conduit between Marcus Vance and Customs Officer Miller.'
  }
];

interface NodeData {
  id: string;
  name: string;
  type: 'person' | 'organization' | 'phone' | 'vehicle' | 'location' | 'event';
  initialPos: THREE.Vector3;
  networkPos: THREE.Vector3;
  mesh?: THREE.Group;
  color: number;
  radius: number;
}

export const CinematicNetwork3D: React.FC<{
  onExploreClick?: () => void;
  onEnterClick?: () => void;
}> = ({ onExploreClick, onEnterClick }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [activeStage, setActiveStage] = useState<number>(0);
  const [selectedNode, setSelectedNode] = useState<{ name: string; type: string; details: string } | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);

  // References for animation
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const nodesRef = useRef<NodeData[]>([]);
  const lineMeshesRef = useRef<THREE.Line[]>([]);
  const hiddenLineMeshRef = useRef<THREE.LineSegments | null>(null);
  const hiddenPulserMeshRef = useRef<THREE.Mesh | null>(null);
  const animFrameIdRef = useRef<number>(0);
  const stageProgressRef = useRef<number>(0);
  const targetStageRef = useRef<number>(0);

  useEffect(() => {
    targetStageRef.current = activeStage;
  }, [activeStage]);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setActiveStage(prev => (prev + 1) % 3);
    }, 6000);
    return () => clearInterval(interval);
  }, [isPlaying]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xF7F5F1);
    scene.fog = new THREE.FogExp2(0xF7F5F1, 0.022);
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 4, 24);
    cameraRef.current = camera;

    // WebGL Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxDistance = 45;
    controls.minDistance = 8;
    controls.enablePan = false;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.45;
    controlsRef.current = controls;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight1.position.set(10, 20, 15);
    scene.add(dirLight1);

    const rimLight = new THREE.DirectionalLight(0x6E1827, 0.9);
    rimLight.position.set(-15, -10, -10);
    scene.add(rimLight);

    // Grid Floor
    const gridHelper = new THREE.GridHelper(50, 40, 0xDAD6CC, 0xE7E4DC);
    gridHelper.position.y = -7.5;
    scene.add(gridHelper);

    // Define Network Nodes
    const rawNodes: NodeData[] = [
      {
        id: 'vance',
        name: 'Marcus Vance',
        type: 'person',
        color: 0x0D0D0D,
        radius: 0.85,
        initialPos: new THREE.Vector3(-14, 5, 4),
        networkPos: new THREE.Vector3(-4.2, 1.8, 0.5)
      },
      {
        id: 'miller',
        name: 'David Miller (Customs)',
        type: 'person',
        color: 0x1C1B1A,
        radius: 0.75,
        initialPos: new THREE.Vector3(13, -4, -6),
        networkPos: new THREE.Vector3(4.5, -1.2, 1.2)
      },
      {
        id: 'rostova',
        name: 'Elena Rostova',
        type: 'person',
        color: 0x1C1B1A,
        radius: 0.72,
        initialPos: new THREE.Vector3(-8, 9, -10),
        networkPos: new THREE.Vector3(-2.5, 4.2, -2.5)
      },
      {
        id: 'drake',
        name: 'Julian Drake',
        type: 'person',
        color: 0x2A2927,
        radius: 0.68,
        initialPos: new THREE.Vector3(9, 6, 8),
        networkPos: new THREE.Vector3(1.2, 2.4, 1.8)
      },
      {
        id: 'vance_holdings',
        name: 'Vance Holdings Ltd',
        type: 'organization',
        color: 0x431019,
        radius: 0.8,
        initialPos: new THREE.Vector3(-12, -7, 6),
        networkPos: new THREE.Vector3(-5.5, -1.5, -1.0)
      },
      {
        id: 'apex_shipping',
        name: 'Apex Shipping Corp',
        type: 'organization',
        color: 0x33312E,
        radius: 0.7,
        initialPos: new THREE.Vector3(3, -9, 9),
        networkPos: new THREE.Vector3(-0.5, -3.2, 0.8)
      },
      {
        id: 'vessel',
        name: 'M/V Sea Serpent',
        type: 'vehicle',
        color: 0x4A4742,
        radius: 0.65,
        initialPos: new THREE.Vector3(11, 2, -12),
        networkPos: new THREE.Vector3(3.2, -3.5, -0.8)
      },
      {
        id: 'burner',
        name: 'Vance Satellite Handset',
        type: 'phone',
        color: 0x6E1827,
        radius: 0.55,
        initialPos: new THREE.Vector3(-6, -6, -11),
        networkPos: new THREE.Vector3(-1.8, 0.6, 3.2)
      },
      {
        id: 'rotterdam',
        name: 'Rotterdam Port Terminal',
        type: 'location',
        color: 0x5C5852,
        radius: 0.6,
        initialPos: new THREE.Vector3(6, 8, -5),
        networkPos: new THREE.Vector3(2.8, 0.5, -2.2)
      },
      {
        id: 'bypass_event',
        name: 'Container #S-9102 Override',
        type: 'event',
        color: 0x6E1827,
        radius: 0.62,
        initialPos: new THREE.Vector3(14, 7, 7),
        networkPos: new THREE.Vector3(5.2, 1.6, -0.5)
      }
    ];

    // Sphere Geometry & Material template
    const sphereGeo = new THREE.SphereGeometry(1, 32, 32);
    const ringGeo = new THREE.RingGeometry(1.2, 1.28, 36);

    rawNodes.forEach(node => {
      const group = new THREE.Group();

      // Main core sphere
      const mat = new THREE.MeshStandardMaterial({
        color: node.color,
        roughness: 0.28,
        metalness: 0.2,
      });
      const core = new THREE.Mesh(sphereGeo, mat);
      core.scale.setScalar(node.radius);
      group.add(core);

      // Subtle architectural orbit ring
      const ringMat = new THREE.MeshBasicMaterial({
        color: node.color === 0x6E1827 ? 0x6E1827 : 0x77736F,
        transparent: true,
        opacity: 0.28,
        side: THREE.DoubleSide
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.scale.setScalar(node.radius);
      ring.rotation.x = Math.PI / 2;
      group.add(ring);

      group.position.copy(node.initialPos);
      group.userData = { id: node.id, name: node.name, type: node.type };
      scene.add(group);
      node.mesh = group;
    });

    nodesRef.current = rawNodes;

    // Standard edges (known relationships)
    const edgePairs: [string, string][] = [
      ['vance', 'vance_holdings'],
      ['vance', 'apex_shipping'],
      ['vance', 'burner'],
      ['burner', 'drake'],
      ['drake', 'rotterdam'],
      ['apex_shipping', 'vessel'],
      ['vessel', 'bypass_event'],
      ['miller', 'bypass_event'],
      ['rostova', 'vance'],
      ['rostova', 'rotterdam'],
      ['drake', 'miller']
    ];

    const standardLineMaterial = new THREE.LineBasicMaterial({
      color: 0x1C1B1A,
      transparent: true,
      opacity: 0.22,
      linewidth: 1
    });

    const lineMeshes: THREE.Line[] = [];
    edgePairs.forEach(() => {
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(),
        new THREE.Vector3()
      ]);
      const line = new THREE.Line(lineGeo, standardLineMaterial);
      scene.add(line);
      lineMeshes.push(line);
    });
    lineMeshesRef.current = lineMeshes;

    // HIDDEN CONNECTION: Marcus Vance <--> David Miller (Customs Officer)
    // Model-predicted relationship: Dashed glowing burgundy
    const hiddenLineMaterial = new THREE.LineDashedMaterial({
      color: 0x6E1827,
      linewidth: 2,
      scale: 1,
      dashSize: 0.4,
      gapSize: 0.25,
      transparent: true,
      opacity: 0.0
    });

    const hiddenLineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3()
    ]);
    const hiddenLine = new THREE.LineSegments(hiddenLineGeo, hiddenLineMaterial);
    scene.add(hiddenLine);
    hiddenLineMeshRef.current = hiddenLine;

    // Pulse bead traveling along hidden link
    const beadGeo = new THREE.SphereGeometry(0.18, 16, 16);
    const beadMat = new THREE.MeshBasicMaterial({
      color: 0x6E1827,
      transparent: true,
      opacity: 0.0
    });
    const pulser = new THREE.Mesh(beadGeo, beadMat);
    scene.add(pulser);
    hiddenPulserMeshRef.current = pulser;

    // Raycasting for interactive click
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerDown = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const meshes = rawNodes.map(n => n.mesh).filter(Boolean) as THREE.Group[];
      const intersects = raycaster.intersectObjects(meshes, true);

      if (intersects.length > 0) {
        let parent = intersects[0].object.parent;
        while (parent && !parent.userData?.id && parent.parent) {
          parent = parent.parent;
        }
        if (parent && parent.userData?.name) {
          setSelectedNode({
            name: parent.userData.name,
            type: parent.userData.type.toUpperCase(),
            details: `Identified entity in Operation Sea Serpent network. Select to inspect connections.`
          });
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);

    // Resize Handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Render loop timer
    let lastTime = performance.now();
    const startTime = performance.now();

    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      const now = performance.now();
      const delta = Math.min((now - lastTime) / 1000, 0.1);
      const elapsed = (now - startTime) / 1000;
      lastTime = now;

      // Smooth interpolation toward target stage
      const currentTarget = targetStageRef.current;
      stageProgressRef.current = THREE.MathUtils.lerp(stageProgressRef.current, currentTarget, delta * 2.8);
      const t = stageProgressRef.current;

      // Calculate node positions based on stage progress:
      // t in [0, 1]: transition from initialPos to networkPos
      // t in [1, 2]: network formed, hidden link revealed
      const posRatio = Math.min(Math.max(t, 0), 1);

      rawNodes.forEach((node, idx) => {
        if (!node.mesh) return;

        // Base lerp
        const currentPos = new THREE.Vector3().lerpVectors(node.initialPos, node.networkPos, posRatio);

        // Subtle organic float
        currentPos.y += Math.sin(elapsed * 1.2 + idx * 0.8) * 0.12;
        currentPos.x += Math.cos(elapsed * 0.9 + idx * 0.5) * 0.08;

        node.mesh.position.copy(currentPos);

        // Slow spin of rings
        const ring = node.mesh.children[1];
        if (ring) {
          ring.rotation.z += delta * 0.3;
        }
      });

      // Update standard edges
      edgePairs.forEach((pair, idx) => {
        const nA = rawNodes.find(n => n.id === pair[0]);
        const nB = rawNodes.find(n => n.id === pair[1]);
        const line = lineMeshes[idx];

        if (nA?.mesh && nB?.mesh && line) {
          const positions = line.geometry.attributes.position.array as Float32Array;
          positions[0] = nA.mesh.position.x;
          positions[1] = nA.mesh.position.y;
          positions[2] = nA.mesh.position.z;

          positions[3] = nB.mesh.position.x;
          positions[4] = nB.mesh.position.y;
          positions[5] = nB.mesh.position.z;

          line.geometry.attributes.position.needsUpdate = true;

          // Fade in edges as stage progresses from 0 to 1
          const lineMat = line.material as THREE.LineBasicMaterial;
          lineMat.opacity = THREE.MathUtils.clamp((t - 0.2) * 0.38, 0, 0.35);
        }
      });

      // Update Hidden Connection: Vance <-> Miller
      const vanceNode = rawNodes.find(n => n.id === 'vance');
      const millerNode = rawNodes.find(n => n.id === 'miller');

      if (vanceNode?.mesh && millerNode?.mesh && hiddenLine) {
        const positions = hiddenLine.geometry.attributes.position.array as Float32Array;
        positions[0] = vanceNode.mesh.position.x;
        positions[1] = vanceNode.mesh.position.y;
        positions[2] = vanceNode.mesh.position.z;

        positions[3] = millerNode.mesh.position.x;
        positions[4] = millerNode.mesh.position.y;
        positions[5] = millerNode.mesh.position.z;

        hiddenLine.geometry.attributes.position.needsUpdate = true;
        hiddenLine.computeLineDistances();

        const hiddenMat = hiddenLine.material as THREE.LineDashedMaterial;
        // Fade in from stage 1 to 2
        const hiddenAlpha = THREE.MathUtils.clamp((t - 1.1) * 1.3, 0, 1);
        hiddenMat.opacity = hiddenAlpha * 0.95;

        // Pulser bead movement
        if (pulser) {
          const beadMat = pulser.material as THREE.MeshBasicMaterial;
          beadMat.opacity = hiddenAlpha * 0.9;
          if (hiddenAlpha > 0.05) {
            const beadProgress = (elapsed * 0.8) % 1;
            pulser.position.lerpVectors(vanceNode.mesh.position, millerNode.mesh.position, beadProgress);
          }
        }
      }

      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animFrameIdRef.current);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full min-h-[640px] select-none overflow-hidden bg-[#F7F5F1]">
      {/* 3D WebGL Canvas Viewport */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Subtle Grid Ambient Overlay */}
      <div className="absolute inset-0 pointer-events-none bg-grain opacity-50" />

      {/* Narrative Progress Indicator (Top Right) */}
      <div className="absolute top-24 right-6 sm:right-10 z-10 max-w-xs pointer-events-none">
        <div className="bg-white/85 backdrop-blur-md border border-[#0D0D0D]/10 p-4 rounded-sm shadow-sm space-y-2">
          <div className="flex items-center justify-between text-[11px] font-mono tracking-wider text-[#6E1827]">
            <span>{STORY_STAGES[activeStage].phase}</span>
            <span className="text-[#77736F]">STAGE {activeStage + 1}/3</span>
          </div>
          <h4 className="text-sm font-semibold text-[#0D0D0D] tracking-tight">
            {STORY_STAGES[activeStage].title}
          </h4>
          <p className="text-xs text-[#77736F] leading-relaxed">
            {STORY_STAGES[activeStage].description}
          </p>
        </div>
      </div>

      {/* Interactive Node Selection Inspection Callout */}
      {selectedNode && (
        <div className="absolute top-24 left-6 sm:left-10 z-10 max-w-sm pointer-events-auto">
          <div className="bg-white/95 backdrop-blur-md border border-[#0D0D0D]/12 p-4 rounded-sm shadow-md space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono tracking-widest text-[#6E1827] uppercase">
                {selectedNode.type}
              </span>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-[#77736F] hover:text-[#0D0D0D] text-xs font-mono px-1"
              >
                ✕
              </button>
            </div>
            <h4 className="text-base font-semibold text-[#0D0D0D] tracking-tight">
              {selectedNode.name}
            </h4>
            <p className="text-xs text-[#77736F] leading-relaxed">
              {selectedNode.details}
            </p>
            <div className="pt-2 flex items-center gap-2">
              <button
                onClick={onExploreClick}
                className="px-3 py-1.5 bg-[#0D0D0D] text-white text-[11px] font-mono tracking-wide rounded-sm hover:bg-neutral-800 transition-colors"
              >
                Focus in Knowledge Graph →
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
