import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, ShieldAlert, Cpu, Zap, Wifi, Database, Radio, Layers } from 'lucide-react';

interface AnimatedCounterProps {
  value: number;
  decimals?: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  decimals = 0,
  duration = 1000,
  prefix = '',
  suffix = '',
  className = ''
}) => {
  const [displayValue, setDisplayValue] = useState<number>(value);
  const prevValueRef = useRef<number>(value);

  useEffect(() => {
    const startVal = prevValueRef.current;
    const endVal = value;
    const startTime = performance.now();

    const updateCounter = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out quad
      const eased = 1 - (1 - progress) * (1 - progress);
      const current = startVal + (endVal - startVal) * eased;
      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(updateCounter);
      } else {
        prevValueRef.current = endVal;
      }
    };

    const animId = requestAnimationFrame(updateCounter);
    return () => cancelAnimationFrame(animId);
  }, [value, duration]);

  return (
    <span className={`tabular-nums font-mono transition-colors ${className}`}>
      {prefix}
      {displayValue.toFixed(decimals)}
      {suffix}
    </span>
  );
};

export const LivePulseBeacon: React.FC<{
  color?: 'crimson' | 'emerald' | 'rose' | 'amber' | 'slate';
  size?: 'xs' | 'sm' | 'md';
  pulseSpeed?: 'fast' | 'normal' | 'slow';
}> = ({ color = 'crimson', size = 'sm', pulseSpeed = 'normal' }) => {
  const colorMap = {
    crimson: { bg: 'bg-red-600', ring: 'bg-red-600/30', border: 'border-red-600' },
    emerald: { bg: 'bg-emerald-500', ring: 'bg-emerald-500/30', border: 'border-emerald-500' },
    rose: { bg: 'bg-rose-500', ring: 'bg-rose-500/30', border: 'border-rose-500' },
    amber: { bg: 'bg-amber-500', ring: 'bg-amber-500/30', border: 'border-amber-500' },
    slate: { bg: 'bg-slate-400', ring: 'bg-slate-400/30', border: 'border-slate-400' }
  };

  const sizeMap = {
    xs: { dot: 'w-1.5 h-1.5', ring: 'w-3.5 h-3.5' },
    sm: { dot: 'w-2 h-2', ring: 'w-5 h-5' },
    md: { dot: 'w-2.5 h-2.5', ring: 'w-6 h-6' }
  };

  const dur = pulseSpeed === 'fast' ? 1 : pulseSpeed === 'slow' ? 2.4 : 1.6;
  const cfg = colorMap[color] || colorMap.crimson;
  const sz = sizeMap[size];

  return (
    <div className="relative inline-flex items-center justify-center shrink-0">
      <motion.span
        animate={{ scale: [1, 2.2, 1], opacity: [0.7, 0, 0.7] }}
        transition={{ duration: dur, repeat: Infinity, ease: 'easeInOut' }}
        className={`absolute rounded-full ${sz.ring} ${cfg.ring}`}
      />
      <span className={`relative rounded-full ${sz.dot} ${cfg.bg} shadow-[0_0_8px_currentColor]`} />
    </div>
  );
};

export const DynamicWaveform: React.FC<{
  height?: number;
  width?: number;
  color?: string;
  pointsCount?: number;
}> = ({ height = 24, width = 120, color = '#dc2626', pointsCount = 14 }) => {
  const [points, setPoints] = useState<number[]>(() =>
    Array.from({ length: pointsCount }, () => 0.3 + Math.random() * 0.4)
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setPoints(prev => {
        const next = [...prev.slice(1), 0.2 + Math.random() * 0.65];
        return next;
      });
    }, 400);
    return () => clearInterval(interval);
  }, [pointsCount]);

  const step = width / (points.length - 1);
  const pathD = points.reduce((acc, p, i) => {
    const x = i * step;
    const y = height - p * height;
    return i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
  }, '');

  return (
    <div className="relative inline-block overflow-hidden" style={{ width, height }}>
      <svg width={width} height={height} className="overflow-visible">
        <defs>
          <linearGradient id={`wave-grad-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path
          d={`${pathD} L ${width} ${height} L 0 ${height} Z`}
          fill={`url(#wave-grad-${color})`}
          className="transition-all duration-300 ease-out"
        />
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-all duration-300 ease-out"
        />
      </svg>
    </div>
  );
};

export const LiveTelemetryTicker: React.FC = () => {
  const [tps, setTps] = useState<number>(142.8);
  const [latency, setLatency] = useState<number>(18.4);
  const [activeInferences, setActiveInferences] = useState<number>(37);
  const [enclaveVerified, setEnclaveVerified] = useState<number>(184920);
  const [systemLoad, setSystemLoad] = useState<number>(42.1);

  useEffect(() => {
    const timer = setInterval(() => {
      setTps(prev => Math.max(80, +(prev + (Math.random() - 0.48) * 12).toFixed(1)));
      setLatency(prev => Math.max(12, +(prev + (Math.random() - 0.5) * 2.2).toFixed(1)));
      setActiveInferences(prev => Math.max(15, Math.floor(prev + (Math.random() - 0.49) * 4)));
      setEnclaveVerified(prev => prev + Math.floor(1 + Math.random() * 3));
      setSystemLoad(prev => Math.max(20, Math.min(95, +(prev + (Math.random() - 0.5) * 4).toFixed(1))));
    }, 1800);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-full bg-[#020508]/80 border-y border-white/[0.06] backdrop-blur-md px-3 sm:px-6 py-1 text-[11px] font-mono text-slate-300 overflow-x-auto select-none">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 min-w-[760px]">
        {/* Stream Live Indicator */}
        <div className="flex items-center gap-2 shrink-0">
          <LivePulseBeacon color="emerald" size="xs" />
          <span className="text-emerald-400 font-bold uppercase tracking-wider text-[10px]">
            SYSTEM TELEMETRY ONLINE
          </span>
        </div>

        {/* Telemetry Items */}
        <div className="flex items-center gap-6 text-slate-400">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-rose-400" />
            <span>PROCESSING:</span>
            <AnimatedCounter value={tps} decimals={1} suffix=" tx/s" className="text-rose-300 font-bold" />
          </div>

          <div className="flex items-center gap-1.5">
            <Radio className="w-3 h-3 text-slate-400" />
            <span>ANALYSIS LATENCY:</span>
            <AnimatedCounter value={latency} decimals={1} suffix=" ms" className="text-slate-200 font-bold" />
          </div>

          <div className="flex items-center gap-1.5">
            <Cpu className="w-3 h-3 text-amber-400" />
            <span>SYSTEM LOAD:</span>
            <AnimatedCounter value={systemLoad} decimals={1} suffix="%" className="text-amber-300 font-bold" />
            <DynamicWaveform width={48} height={14} color="#f59e0b" pointsCount={6} />
          </div>

          <div className="flex items-center gap-1.5">
            <Layers className="w-3 h-3 text-rose-400" />
            <span>ACTIVE ANALYSES:</span>
            <AnimatedCounter value={activeInferences} className="text-rose-300 font-bold" />
          </div>

          <div className="flex items-center gap-1.5">
            <Database className="w-3 h-3 text-emerald-400" />
            <span>VERIFIED RECORDS:</span>
            <AnimatedCounter value={enclaveVerified} className="text-emerald-300 font-bold" />
          </div>
        </div>
      </div>
    </div>
  );
};
