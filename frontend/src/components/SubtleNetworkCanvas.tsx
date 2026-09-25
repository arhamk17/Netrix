import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  label: string;
  isKeyNode?: boolean;
}

interface Edge {
  source: number;
  target: number;
  opacity: number;
  targetOpacity: number;
  speed: number;
}

export const SubtleNetworkCanvas: React.FC<{ className?: string }> = ({ className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || 500);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 500);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };

    window.addEventListener('resize', handleResize);

    // Initial minimal set of nodes
    const nodeLabels = [
      'MARCUS_V',
      'ROTTERDAM_B4',
      'ESCROW_TRUST',
      'CARGO_SERPENT',
      'OFFSHORE_ACC',
      'ENCRYPTED_RELAY',
      'CUSTOMS_LOG',
      'BERTH_CONDUIT'
    ];

    const nodes: Node[] = nodeLabels.map((label, i) => {
      const angle = (i / nodeLabels.length) * Math.PI * 2;
      const dist = Math.min(width, height) * 0.28 + (Math.random() * 40 - 20);
      return {
        x: width / 2 + Math.cos(angle) * dist,
        y: height / 2 + Math.sin(angle) * dist,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        radius: i === 0 || i === 2 ? 4.5 : 3,
        label,
        isKeyNode: i === 0 || i === 2
      };
    });

    // Dynamic edges that gradually connect and disconnect
    const edges: Edge[] = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        if (Math.random() < 0.45) {
          edges.push({
            source: i,
            target: j,
            opacity: 0,
            targetOpacity: Math.random() * 0.5 + 0.15,
            speed: 0.003 + Math.random() * 0.005
          });
        }
      }
    }

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Static single-pass render for users with reduced motion preferences
    if (prefersReducedMotion) {
      ctx.clearRect(0, 0, width, height);
      edges.forEach((edge) => {
        const n1 = nodes[edge.source];
        const n2 = nodes[edge.target];
        if (!n1 || !n2) return;
        ctx.beginPath();
        ctx.moveTo(n1.x, n1.y);
        ctx.lineTo(n2.x, n2.y);
        const isCrimson = edge.source === 0 || edge.target === 0;
        ctx.strokeStyle = isCrimson ? 'rgba(110, 24, 39, 0.4)' : 'rgba(18, 17, 16, 0.15)';
        ctx.lineWidth = isCrimson ? 1.0 : 0.6;
        ctx.stroke();
      });
      nodes.forEach((node) => {
        if (node.isKeyNode) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius + 3, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(110, 24, 39, 0.3)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = node.isKeyNode ? '#6E1827' : '#121110';
        ctx.fill();
        ctx.font = '8px monospace';
        ctx.fillStyle = node.isKeyNode ? '#6E1827' : '#77736F';
        ctx.fillText(node.label, node.x + 8, node.y + 3);
      });
      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }

    let cycleTime = 0;
    let isPaused = false;
    let lastTime = 0;
    const FRAME_INTERVAL = 1000 / 40; // Silky smooth 40fps, saves 40% CPU/GPU cycles

    const handleVisibility = () => {
      if (document.hidden) {
        isPaused = true;
        cancelAnimationFrame(animationFrameId);
      } else {
        isPaused = false;
        lastTime = performance.now();
        animationFrameId = requestAnimationFrame(render);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    const render = (time: number) => {
      if (isPaused) return;

      animationFrameId = requestAnimationFrame(render);

      const elapsed = time - lastTime;
      if (elapsed < FRAME_INTERVAL) return;
      lastTime = time - (elapsed % FRAME_INTERVAL);

      ctx.clearRect(0, 0, width, height);
      cycleTime += 0.015;

      // Slowly drift nodes inside bounds
      nodes.forEach((node) => {
        node.x += node.vx;
        node.y += node.vy;

        // Soft bounce at boundaries
        const pad = 36;
        if (node.x < pad || node.x > width - pad) node.vx *= -1;
        if (node.y < pad || node.y > height - pad) node.vy *= -1;
      });

      // Periodically switch edge target opacities so relationships gradually form and fade
      if (Math.floor(cycleTime * 10) % 80 === 0) {
        const randomEdge = edges[Math.floor(Math.random() * edges.length)];
        if (randomEdge) {
          randomEdge.targetOpacity = randomEdge.targetOpacity > 0.1 ? 0 : Math.random() * 0.55 + 0.2;
        }
      }

      // Draw Edges (Connection Lines forming)
      edges.forEach((edge) => {
        edge.opacity += (edge.targetOpacity - edge.opacity) * 0.03;

        if (edge.opacity > 0.01) {
          const n1 = nodes[edge.source];
          const n2 = nodes[edge.target];
          if (!n1 || !n2) return;

          ctx.beginPath();
          ctx.moveTo(n1.x, n1.y);
          ctx.lineTo(n2.x, n2.y);

          // Subtle burgundy or dark charcoal line
          const isCrimson = edge.source === 0 || edge.target === 0;
          if (isCrimson) {
            ctx.strokeStyle = `rgba(110, 24, 39, ${edge.opacity * 0.7})`;
            ctx.lineWidth = 1.2;
          } else {
            ctx.strokeStyle = `rgba(13, 13, 13, ${edge.opacity * 0.35})`;
            ctx.lineWidth = 0.8;
          }
          ctx.stroke();

          // Subtle moving signal dot along key conduits
          if (isCrimson && edge.opacity > 0.2) {
            const progress = (Math.sin(cycleTime * 2 + edge.source) + 1) / 2;
            const dotX = n1.x + (n2.x - n1.x) * progress;
            const dotY = n1.y + (n2.y - n1.y) * progress;
            ctx.beginPath();
            ctx.arc(dotX, dotY, 1.8, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(110, 24, 39, 0.75)';
            ctx.fill();
          }
        }
      });

      // Draw Nodes
      nodes.forEach((node) => {
        // Node outer subtle ring if key node
        if (node.isKeyNode) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius + 4, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(110, 24, 39, 0.35)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // Core dot
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = node.isKeyNode ? '#6E1827' : '#0D0D0D';
        ctx.fill();

        // Monospace micro label
        ctx.font = '8px monospace';
        ctx.fillStyle = node.isKeyNode ? '#6E1827' : '#77736F';
        ctx.fillText(node.label, node.x + 8, node.y + 3);
      });
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return (
    <div className={`relative w-full h-full flex items-center justify-center overflow-hidden ${className}`}>
      <motion.canvas
        ref={canvasRef}
        whileHover={{
          scale: 1.02,
          filter: [
            'drop-shadow(0 0 8px rgba(110, 24, 39, 0.3))',
            'drop-shadow(0 0 18px rgba(110, 24, 39, 0.55))',
            'drop-shadow(0 0 8px rgba(110, 24, 39, 0.3))'
          ]
        }}
        transition={{
          scale: { type: 'spring', damping: 20, stiffness: 300 },
          filter: { duration: 2, repeat: Infinity, ease: 'easeInOut' }
        }}
        className="w-full h-full block cursor-pointer"
      />
    </div>
  );
};
