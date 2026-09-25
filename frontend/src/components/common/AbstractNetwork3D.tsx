import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { motion } from 'framer-motion';

export const AbstractNetwork3D: React.FC<{ className?: string }> = ({ className = 'w-full h-full' }) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 300;
    const height = container.clientHeight || 300;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 9);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Group of network nodes
    const group = new THREE.Group();
    scene.add(group);

    // Nodes positions (icosahedron vertices)
    const icosa = new THREE.IcosahedronGeometry(2.4, 0);
    const posAttr = icosa.attributes.position;
    const vertexCount = posAttr.count;

    const sphereGeo = new THREE.SphereGeometry(0.1, 16, 16);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x0D0D0D });
    const burgundyMat = new THREE.MeshBasicMaterial({ color: 0x6E1827 });

    const nodePositions: THREE.Vector3[] = [];

    for (let i = 0; i < vertexCount; i++) {
      const v = new THREE.Vector3(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
      nodePositions.push(v);

      const isSpecial = i === 2 || i === 7;
      const mesh = new THREE.Mesh(sphereGeo, isSpecial ? burgundyMat : coreMat);
      mesh.position.copy(v);
      group.add(mesh);
    }

    // Edges
    const wireframeGeo = new THREE.WireframeGeometry(icosa);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x1C1B1A,
      transparent: true,
      opacity: 0.2
    });
    const line = new THREE.LineSegments(wireframeGeo, lineMat);
    group.add(line);

    // One highlighted burgundy edge
    const p1 = nodePositions[2] || new THREE.Vector3();
    const p2 = nodePositions[7] || new THREE.Vector3();
    const specialGeo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
    const specialMat = new THREE.LineBasicMaterial({
      color: 0x6E1827,
      linewidth: 2,
      transparent: true,
      opacity: 0.95
    });
    const specialLine = new THREE.Line(specialGeo, specialMat);
    group.add(specialLine);

    // Subtle outer ring
    const ringGeo = new THREE.RingGeometry(3.1, 3.12, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x6E1827,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    group.add(ring);

    let reqId = 0;
    const animate = () => {
      reqId = requestAnimationFrame(animate);
      group.rotation.y += 0.005;
      group.rotation.x += 0.002;
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(reqId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <motion.div
      ref={mountRef}
      whileHover={{
        scale: 1.02,
        filter: [
          'drop-shadow(0 0 10px rgba(110, 24, 39, 0.35))',
          'drop-shadow(0 0 20px rgba(110, 24, 39, 0.6))',
          'drop-shadow(0 0 10px rgba(110, 24, 39, 0.35))'
        ]
      }}
      transition={{
        scale: { type: 'spring', damping: 20, stiffness: 300 },
        filter: { duration: 2, repeat: Infinity, ease: 'easeInOut' }
      }}
      className={`cursor-pointer ${className}`}
    />
  );
};
