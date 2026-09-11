import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Layers,
  LayoutDashboard,
  BrainCircuit,
  Share2,
  FolderLock,
  FileArchive,
  Fingerprint,
  History,
  Compass,
  GitMerge,
  Cpu,
  BarChart3,
  X,
  Search,
  ChevronRight,
  ShieldCheck,
  Activity,
  UserCheck,
  Lock
} from 'lucide-react';
import { NetrixLogo } from './NetrixLogo';
import { useAuth } from '../../context/AuthContext';
import type { TabType } from './Sidebar';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
}

export interface NavModule {
  id: TabType;
  label: string;
  code: string;
  category: 'CORE' | 'AI_GRAPH' | 'EVIDENCE' | 'ANALYTICS';
  desc: string;
  icon: React.ElementType;
  badge?: string;
}

export const MODULE_REGISTRY: NavModule[] = [
  {
    id: 'hero',
    label: 'Cinematic Showcase',
    code: '00',
    category: 'CORE',
    desc: 'Platform overview & 3D criminal network intelligence visualization',
    icon: Layers,
    badge: 'SHOWCASE'
  },
  {
    id: 'command',
    label: 'Command Center',
    code: '01',
    category: 'CORE',
    desc: 'Operational command, active investigations & risk signals',
    icon: LayoutDashboard,
    badge: 'LIVE'
  },
  {
    id: 'intelligence',
    label: 'Network Intelligence Engine',
    code: '02',
    category: 'AI_GRAPH',
    desc: 'Autonomous intelligence core, link prediction & anomaly detection',
    icon: BrainCircuit,
    badge: 'ML CORE'
  },
  {
    id: 'graph',
    label: '3D Knowledge Graph',
    code: '03',
    category: 'AI_GRAPH',
    desc: 'Entity relationships, observed connections & predicted links',
    icon: Share2,
    badge: '3D WEBGL'
  },
  {
    id: 'temporal',
    label: 'Temporal Intelligence',
    code: '07',
    category: 'AI_GRAPH',
    desc: 'Timeline sequences, communication bursts & temporal patterns',
    icon: History
  },
  {
    id: 'cases',
    label: 'Case Management',
    code: '04',
    category: 'CORE',
    desc: 'Active criminal investigations, suspect dossiers & intelligence records',
    icon: FolderLock
  },
  {
    id: 'evidence',
    label: 'Evidence Vault',
    code: '05',
    category: 'EVIDENCE',
    desc: 'Investigative evidence, source documents & chain of custody',
    icon: FileArchive,
    badge: 'CUSTODY'
  },
  {
    id: 'integrity',
    label: 'Evidence Integrity',
    code: '06',
    category: 'EVIDENCE',
    desc: 'SHA-256 hash verification & immutable provenance records',
    icon: Fingerprint,
    badge: 'SHA-256'
  },
  {
    id: 'leads',
    label: 'Investigative Leads',
    code: '08',
    category: 'ANALYTICS',
    desc: 'Hypothesis leads ranked with evidentiary priority',
    icon: Compass,
    badge: 'LEADS'
  },
  {
    id: 'explain',
    label: 'Explainability & Attribution',
    code: '09',
    category: 'ANALYTICS',
    desc: 'Multi-hop intelligence attribution & signal reasoning graphs',
    icon: GitMerge
  },
  {
    id: 'models',
    label: 'Model Performance',
    code: '10',
    category: 'ANALYTICS',
    desc: 'GNN link prediction, anomaly detection accuracy & benchmarks',
    icon: Cpu
  },
  {
    id: 'analytics',
    label: 'Network Analytics',
    code: '11',
    category: 'ANALYTICS',
    desc: 'Centrality metrics, community clusters & threat network analysis',
    icon: BarChart3
  },
  {
    id: 'profile',
    label: 'Investigator Profiles',
    code: '12',
    category: 'CORE',
    desc: 'Investigator clearance, activity audit & team access tiers',
    icon: UserCheck,
    badge: 'ROLES'
  }
];

export const ModuleDrawer: React.FC<Props> = ({
  isOpen,
  onClose,
  activeTab,
  onSelectTab
}) => {
  const { isAuthenticated } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const categories = [
    { id: 'ALL', label: 'All Modules' },
    { id: 'CORE', label: 'Core Operations' },
    { id: 'AI_GRAPH', label: 'Graph Intelligence' },
    { id: 'EVIDENCE', label: 'Evidence & Integrity' },
    { id: 'ANALYTICS', label: 'Analytics & Leads' }
  ];

  const filteredModules = MODULE_REGISTRY.filter(module => {
    const matchesSearch =
      module.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      module.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
      module.code.includes(searchQuery);

    const matchesCategory =
      selectedCategory === 'ALL' || module.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Dark Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 cursor-pointer"
          />

          {/* Sliding Side Drawer */}
          <motion.div
            initial={{ x: '-100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '-100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="fixed top-0 left-0 bottom-0 w-full sm:w-[420px] max-w-[92vw] bg-[#000000] border-r border-[#6D001A]/35 text-white z-50 flex flex-col shadow-[0_0_60px_rgba(0,0,0,0.95),0_0_30px_rgba(109,0,26,0.15)] overflow-hidden"
          >
            {/* Top Accent Line in Burgundy */}
            <div className="h-1 w-full bg-gradient-to-r from-[#6D001A] via-[#8B0024] to-[#6D001A]" />

            {/* Drawer Header */}
            <div className="p-5 border-b border-white/[0.08] flex items-center justify-between bg-[#050508]">
              <div className="flex items-center gap-3">
                <NetrixLogo variant="horizontal" glow={true} className="w-[125px]" />
                <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded border border-[#6D001A]/60 bg-[#6D001A]/20 text-white">
                  MODULES
                </span>
              </div>

              <button
                onClick={onClose}
                className="w-8 h-8 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-[#6D001A]/30 hover:border-[#6D001A] text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
                title="Close Drawer (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search and Category Filters */}
            <div className="p-4 border-b border-white/[0.06] bg-[#020204] space-y-3">
              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filter operational modules..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] focus:border-[#6D001A] focus:bg-[#6D001A]/10 text-xs font-mono text-white placeholder-slate-500 outline-none transition-all"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-mono tracking-wider whitespace-nowrap transition-all cursor-pointer ${
                      selectedCategory === cat.id
                        ? 'bg-[#6D001A] text-white font-semibold shadow-[0_0_12px_rgba(109,0,26,0.5)]'
                        : 'bg-white/[0.03] text-slate-400 hover:text-white hover:bg-white/[0.06] border border-white/[0.04]'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Module Items List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest px-2 pb-1 flex items-center justify-between">
                <span>ACTIVE PLATFORM SUITE</span>
                <span>{filteredModules.length} OF {MODULE_REGISTRY.length}</span>
              </div>

              {filteredModules.length === 0 ? (
                <div className="py-12 text-center text-slate-500 font-mono text-xs">
                  No modules match your query.
                </div>
              ) : (
                filteredModules.map((module) => {
                  const Icon = module.icon;
                  const isActive = activeTab === module.id;

                  return (
                    <button
                      key={module.id}
                      onClick={() => {
                        onSelectTab(module.id);
                        onClose();
                      }}
                      className={`w-full text-left p-3 rounded-xl border transition-all duration-200 group flex items-start gap-3 cursor-pointer ${
                        isActive
                          ? 'bg-gradient-to-r from-[#6D001A]/60 via-[#4A0011]/50 to-black border-[#6D001A] shadow-[0_0_20px_rgba(109,0,26,0.3)]'
                          : 'bg-white/[0.02] hover:bg-white/[0.05] border-white/[0.06] hover:border-white/20'
                      }`}
                    >
                      {/* Icon Container */}
                      <div
                        className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 transition-all ${
                          isActive
                            ? 'bg-[#6D001A] border-[#8B0024] text-white shadow-[0_0_12px_rgba(109,0,26,0.6)]'
                            : 'bg-white/[0.04] border-white/[0.08] text-slate-400 group-hover:text-white group-hover:border-white/20'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-slate-500">
                              {module.code}
                            </span>
                            <span
                              className={`text-xs font-tech font-bold uppercase tracking-wider ${
                                isActive ? 'text-white' : 'text-slate-200 group-hover:text-white'
                              }`}
                            >
                              {module.label}
                            </span>
                          </div>

                          {module.badge && (
                            <span
                              className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase shrink-0 ${
                                isActive
                                  ? 'border-white/30 bg-white/10 text-white'
                                  : 'border-[#6D001A]/60 bg-[#6D001A]/20 text-rose-300'
                              }`}
                            >
                              {module.badge}
                            </span>
                          )}

                          {!isAuthenticated && module.id !== 'hero' && (
                            <span className="flex items-center gap-1 text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border border-amber-500/40 bg-amber-500/10 text-amber-300 uppercase shrink-0">
                              <Lock className="w-2.5 h-2.5" />
                              <span>LOCKED</span>
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5 font-sans">
                          {module.desc}
                        </p>
                      </div>

                      <ChevronRight
                        className={`w-4 h-4 shrink-0 mt-2.5 transition-transform ${
                          isActive
                            ? 'text-white translate-x-0.5'
                            : 'text-slate-600 group-hover:text-slate-300 group-hover:translate-x-0.5'
                        }`}
                      />
                    </button>
                  );
                })
              )}
            </div>

            {/* Drawer Footer Status */}
            <div className="p-4 border-t border-white/[0.08] bg-[#030305] text-[11px] font-mono text-slate-400 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_#10B981]" />
                <span className="text-slate-300 font-semibold uppercase">
                  SYSTEM ONLINE
                </span>
              </div>
              <span className="text-[10px] text-slate-500">
                ESC TO CLOSE
              </span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
