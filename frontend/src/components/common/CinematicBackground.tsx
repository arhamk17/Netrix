import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface Props {
  interactive?: boolean;
}

export const CinematicBackground: React.FC<Props> = ({ interactive = true }) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Check prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x04060a, 0.002);

    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      1,
      2000
    );
    camera.position.z = 700;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    container.appendChild(renderer.domElement);

    // Forensic Particle Network
    const particleCount = 280;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    const colorCrimson = new THREE.Color(0xdc2626);
    const colorBurgundy = new THREE.Color(0x881337);
    const colorSlate = new THREE.Color(0x64748b);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 1400;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 1000;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 800;

      const mixedColor = i % 3 === 0 ? colorCrimson : i % 3 === 1 ? colorBurgundy : colorSlate;
      colors[i * 3] = mixedColor.r;
      colors[i * 3 + 1] = mixedColor.g;
      colors[i * 3 + 2] = mixedColor.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Particle sprite
    const pMaterial = new THREE.PointsMaterial({
      size: 4.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending
    });

    const particles = new THREE.Points(geometry, pMaterial);
    scene.add(particles);

    // Dynamic Connections Line Segment
    const maxConnections = 300;
    const linePositions = new Float32Array(maxConnections * 2 * 3);
    const lineColors = new Float32Array(maxConnections * 2 * 3);

    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3).setUsage(THREE.DynamicDrawUsage));
    lineGeometry.setAttribute('color', new THREE.BufferAttribute(lineColors, 3).setUsage(THREE.DynamicDrawUsage));

    const lineMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.25,
      blending: THREE.AdditiveBlending
    });

    const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
    scene.add(lines);

    // Mouse reactivity
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      if (!interactive) return;
      mouseX = (e.clientX - window.innerWidth / 2) * 0.3;
      mouseY = (e.clientY - window.innerHeight / 2) * 0.3;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    // Handle Resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    // Animation Loop
    let animationFrameId: number;
    let lastTime = performance.now();
    const startTime = performance.now();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const now = performance.now();
      const delta = (now - lastTime) / 1000;
      lastTime = now;
      const time = (now - startTime) / 1000;

      targetX += (mouseX - targetX) * 0.05;
      targetY += (mouseY - targetY) * 0.05;

      camera.position.x = targetX;
      camera.position.y = -targetY;
      camera.lookAt(scene.position);

      if (!prefersReducedMotion) {
        particles.rotation.y = time * 0.03;
        particles.rotation.x = time * 0.015;
        lines.rotation.y = time * 0.03;
        lines.rotation.x = time * 0.015;
      }

      // Compute dynamic connecting lines
      const pos = geometry.attributes.position.array as Float32Array;
      let lineIndex = 0;
      const connectionDist = 180;

      for (let i = 0; i < 70; i++) {
        for (let j = i + 1; j < 70; j++) {
          const dx = pos[i * 3] - pos[j * 3];
          const dy = pos[i * 3 + 1] - pos[j * 3 + 1];
          const dz = pos[i * 3 + 2] - pos[j * 3 + 2];
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

          if (dist < connectionDist && lineIndex < maxConnections) {
            const alpha = (1 - dist / connectionDist) * 0.35;

            linePositions[lineIndex * 6] = pos[i * 3];
            linePositions[lineIndex * 6 + 1] = pos[i * 3 + 1];
            linePositions[lineIndex * 6 + 2] = pos[i * 3 + 2];

            linePositions[lineIndex * 6 + 3] = pos[j * 3];
            linePositions[lineIndex * 6 + 4] = pos[j * 3 + 1];
            linePositions[lineIndex * 6 + 5] = pos[j * 3 + 2];

            lineColors[lineIndex * 6] = 0.85 * alpha;
            lineColors[lineIndex * 6 + 1] = 0.1 * alpha;
            lineColors[lineIndex * 6 + 2] = 0.15 * alpha;

            lineColors[lineIndex * 6 + 3] = 0.45 * alpha;
            lineColors[lineIndex * 6 + 4] = 0.5 * alpha;
            lineColors[lineIndex * 6 + 5] = 0.6 * alpha;

            lineIndex++;
          }
        }
      }

      lineGeometry.setDrawRange(0, lineIndex * 2);
      lineGeometry.attributes.position.needsUpdate = true;
      lineGeometry.attributes.color.needsUpdate = true;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      geometry.dispose();
      lineGeometry.dispose();
      pMaterial.dispose();
      lineMaterial.dispose();
    };
  }, [interactive]);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#04060A]">
      <div ref={mountRef} className="absolute inset-0" />
      {/* Subtle Scanlines and vignette overlay */}
      <div className="absolute inset-0 forensic-scanlines opacity-40 pointer-events-none" />
      <div className="absolute inset-0 bg-radial-[at_50%_40%] from-transparent via-[#04060a]/40 to-[#04060a]/90 pointer-events-none" />
    </div>
  );
};
