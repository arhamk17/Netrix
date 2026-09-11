import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface Props {
  onScrollProgress?: number;
  interactive?: boolean;
}

export const HeroVisualSphere: React.FC<Props> = ({ onScrollProgress = 0, interactive = true }) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobile = window.innerWidth < 768;

    // Scene setup
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050507, 0.0018);

    const camera = new THREE.PerspectiveCamera(
      48,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 8.5);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: !isMobile,
      powerPreference: 'high-performance'
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.2 : 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    container.appendChild(renderer.domElement);

    // Root Group for Mouse Parallax & Scroll Depth
    const mainGroup = new THREE.Group();
    scene.add(mainGroup);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x1a050b, 1.8);
    scene.add(ambientLight);

    const crimsonPointLight = new THREE.PointLight(0xe6003c, 4.5, 30);
    crimsonPointLight.position.set(2, 3, 5);
    scene.add(crimsonPointLight);

    const secondaryRimLight = new THREE.PointLight(0x800020, 2.5, 25);
    secondaryRimLight.position.set(-4, -2, 3);
    scene.add(secondaryRimLight);

    const coreLight = new THREE.PointLight(0xff2a5f, 3.0, 10);
    coreLight.position.set(0, 0, 0);
    mainGroup.add(coreLight);

    // 1. MORPHING CRIMSON INTELLIGENCE SPHERE
    const sphereRadius = isMobile ? 1.8 : 2.2;
    const detail = isMobile ? 36 : 56;
    const sphereGeometry = new THREE.IcosahedronGeometry(sphereRadius, detail);
    
    // Store original positions for vertex displacement
    const originalPos = sphereGeometry.attributes.position.clone();
    sphereGeometry.userData = { originalPos };

    // Custom wireframe/holographic shader-like material with crimson glow
    const sphereMaterial = new THREE.MeshStandardMaterial({
      color: 0xe6003c,
      emissive: 0x8a0024,
      emissiveIntensity: 0.85,
      roughness: 0.25,
      metalness: 0.85,
      wireframe: true,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending
    });

    const intelligenceSphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    mainGroup.add(intelligenceSphere);

    // 2. INNER GLOWING INFERENCE CORE
    const coreGeometry = new THREE.SphereGeometry(sphereRadius * 0.45, 32, 32);
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0044,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending
    });
    const inferenceCore = new THREE.Mesh(coreGeometry, coreMaterial);
    mainGroup.add(inferenceCore);

    // Inner wireframe lattice
    const latticeGeo = new THREE.IcosahedronGeometry(sphereRadius * 0.75, 2);
    const latticeMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      wireframe: true,
      transparent: true,
      opacity: 0.25,
      blending: THREE.AdditiveBlending
    });
    const innerLattice = new THREE.Mesh(latticeGeo, latticeMat);
    mainGroup.add(innerLattice);

    // 3. ORBITAL DATA RINGS
    const ringsGroup = new THREE.Group();
    mainGroup.add(ringsGroup);

    const createOrbitalRing = (radius: number, tiltX: number, tiltY: number, colorHex: number) => {
      const ringGeo = new THREE.TorusGeometry(radius, 0.012, 16, 100);
      const ringMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.45,
        blending: THREE.AdditiveBlending
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = tiltX;
      ring.rotation.y = tiltY;
      return ring;
    };

    const ring1 = createOrbitalRing(sphereRadius * 1.35, Math.PI / 3, Math.PI / 6, 0xe6003c);
    const ring2 = createOrbitalRing(sphereRadius * 1.55, -Math.PI / 4, Math.PI / 4, 0x00f0ff);
    const ring3 = createOrbitalRing(sphereRadius * 1.75, Math.PI / 2.2, -Math.PI / 5, 0xff3366);
    ringsGroup.add(ring1);
    ringsGroup.add(ring2);
    ringsGroup.add(ring3);

    // 4. FLOATING GRAPH NODES & PARTICLES
    const nodeCount = isMobile ? 45 : 85;
    const nodePositions: THREE.Vector3[] = [];
    const nodesGroup = new THREE.Group();
    mainGroup.add(nodesGroup);

    const nodeGeo = new THREE.SphereGeometry(0.045, 8, 8);
    const nodeMatObserved = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.85
    });
    const nodeMatPredicted = new THREE.MeshBasicMaterial({
      color: 0xff0044,
      transparent: true,
      opacity: 0.95
    });

    for (let i = 0; i < nodeCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const dist = sphereRadius * (1.1 + Math.random() * 0.9);
      const pos = new THREE.Vector3(
        dist * Math.sin(phi) * Math.cos(theta),
        dist * Math.sin(phi) * Math.sin(theta),
        dist * Math.cos(phi)
      );
      nodePositions.push(pos);

      const nodeMesh = new THREE.Mesh(nodeGeo, i % 3 === 0 ? nodeMatObserved : nodeMatPredicted);
      nodeMesh.position.copy(pos);
      nodesGroup.add(nodeMesh);
    }

    // 5. CONNECTIONS (GRAPH EDGES AROUND SPHERE)
    const lineCount = isMobile ? 35 : 70;
    const linePositions = new Float32Array(lineCount * 2 * 3);
    const lineColors = new Float32Array(lineCount * 2 * 3);

    let lIdx = 0;
    for (let i = 0; i < lineCount; i++) {
      const idxA = Math.floor(Math.random() * nodeCount);
      let idxB = Math.floor(Math.random() * nodeCount);
      if (idxA === idxB) idxB = (idxB + 1) % nodeCount;

      const pA = nodePositions[idxA];
      const pB = nodePositions[idxB];

      linePositions[lIdx * 3] = pA.x;
      linePositions[lIdx * 3 + 1] = pA.y;
      linePositions[lIdx * 3 + 2] = pA.z;

      linePositions[(lIdx + 1) * 3] = pB.x;
      linePositions[(lIdx + 1) * 3 + 1] = pB.y;
      linePositions[(lIdx + 1) * 3 + 2] = pB.z;

      const isPredicted = i % 2 === 0;
      const c = isPredicted ? new THREE.Color(0xe6003c) : new THREE.Color(0x00f0ff);

      lineColors[lIdx * 3] = c.r;
      lineColors[lIdx * 3 + 1] = c.g;
      lineColors[lIdx * 3 + 2] = c.b;

      lineColors[(lIdx + 1) * 3] = c.r;
      lineColors[(lIdx + 1) * 3 + 1] = c.g;
      lineColors[(lIdx + 1) * 3 + 2] = c.b;

      lIdx += 2;
    }

    const linesGeometry = new THREE.BufferGeometry();
    linesGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    linesGeometry.setAttribute('color', new THREE.BufferAttribute(lineColors, 3));

    const linesMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending
    });
    const networkLines = new THREE.LineSegments(linesGeometry, linesMaterial);
    mainGroup.add(networkLines);

    // 6. VOLUMETRIC AMBIENT CLOUD PARTICLES
    const cloudParticleCount = isMobile ? 120 : 260;
    const cloudGeo = new THREE.BufferGeometry();
    const cloudPos = new Float32Array(cloudParticleCount * 3);
    const cloudColors = new Float32Array(cloudParticleCount * 3);

    for (let i = 0; i < cloudParticleCount; i++) {
      cloudPos[i * 3] = (Math.random() - 0.5) * 16;
      cloudPos[i * 3 + 1] = (Math.random() - 0.5) * 14;
      cloudPos[i * 3 + 2] = (Math.random() - 0.5) * 12;

      const c = i % 3 === 0 ? new THREE.Color(0xe6003c) : i % 3 === 1 ? new THREE.Color(0xff2a5f) : new THREE.Color(0x00f0ff);
      cloudColors[i * 3] = c.r;
      cloudColors[i * 3 + 1] = c.g;
      cloudColors[i * 3 + 2] = c.b;
    }

    cloudGeo.setAttribute('position', new THREE.BufferAttribute(cloudPos, 3));
    cloudGeo.setAttribute('color', new THREE.BufferAttribute(cloudColors, 3));

    const cloudMaterial = new THREE.PointsMaterial({
      size: 0.04,
      vertexColors: true,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending
    });
    const cloudParticles = new THREE.Points(cloudGeo, cloudMaterial);
    scene.add(cloudParticles);

    // Mouse Tracking & Parallax
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      if (!interactive) return;
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      mouseX = x * 1.8;
      mouseY = y * 1.8;
    };

    window.addEventListener('mousemove', handleMouseMove);

    // Resize handler
    const handleResize = () => {
      if (!container) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // Animation Loop
    let animationFrameId: number;
    let lastTime = performance.now();
    const startTime = performance.now();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const now = performance.now();
      const delta = (now - lastTime) / 1000;
      lastTime = now;
      const elapsedTime = (now - startTime) / 1000;

      // Smooth mouse interpolation
      targetX += (mouseX - targetX) * 0.05;
      targetY += (mouseY - targetY) * 0.05;

      // Parallax rotation & light following
      mainGroup.rotation.y = elapsedTime * 0.12 + targetX * 0.45;
      mainGroup.rotation.x = Math.sin(elapsedTime * 0.1) * 0.1 - targetY * 0.35;

      crimsonPointLight.position.x = 2 + targetX * 3;
      crimsonPointLight.position.y = 3 - targetY * 3;

      // Continuous vertex morphing on the intelligence sphere
      if (!prefersReducedMotion) {
        const positions = sphereGeometry.attributes.position;
        const orig = sphereGeometry.userData.originalPos;
        const count = positions.count;

        for (let i = 0; i < count; i++) {
          const ox = orig.getX(i);
          const oy = orig.getY(i);
          const oz = orig.getZ(i);

          // Multi-frequency wave displacement
          const wave =
            Math.sin(ox * 2.2 + elapsedTime * 1.8) *
            Math.cos(oy * 2.4 + elapsedTime * 1.4) *
            Math.sin(oz * 2.0 + elapsedTime * 1.6);

          const factor = 1 + wave * 0.085;
          positions.setXYZ(i, ox * factor, oy * factor, oz * factor);
        }
        positions.needsUpdate = true;
      }

      // Orbital rings rotation
      ring1.rotation.z += 0.006;
      ring2.rotation.z -= 0.008;
      ring3.rotation.x += 0.005;

      // Pulse the inference core
      const pulse = 1 + Math.sin(elapsedTime * 2.8) * 0.09;
      inferenceCore.scale.set(pulse, pulse, pulse);
      innerLattice.rotation.y -= 0.004;

      // Ambient cloud drift
      cloudParticles.rotation.y = elapsedTime * 0.015;

      // Scroll depth response
      const scrollDepth = onScrollProgress || 0;
      mainGroup.position.z = -scrollDepth * 4;
      mainGroup.position.y = -scrollDepth * 1.5;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      resizeObserver.disconnect();
      cancelAnimationFrame(animationFrameId);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      sphereGeometry.dispose();
      sphereMaterial.dispose();
      coreGeometry.dispose();
      coreMaterial.dispose();
      latticeGeo.dispose();
      latticeMat.dispose();
      linesGeometry.dispose();
      linesMaterial.dispose();
      cloudGeo.dispose();
      cloudMaterial.dispose();
    };
  }, [interactive, onScrollProgress]);

  return (
    <div
      ref={mountRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-0"
      style={{ overflow: 'hidden' }}
    />
  );
};
