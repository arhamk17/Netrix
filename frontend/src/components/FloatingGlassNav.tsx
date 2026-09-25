import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Briefcase,
  FileText,
  Network,
  Cpu,
  Lightbulb,
  Users,
  Clock,
  ShieldCheck,
  ShieldAlert,
  ChevronRight,
  X,
  Search,
  Sliders,
  Sparkles,
  Command,
  Compass
} from 'lucide-react';
import { UserRole } from '../types';
import { useAuth } from '../context/AuthContext';
import { ROLE_PERMISSIONS } from '../utils/rbac';

interface FloatingGlassNavProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenSearch: () => void;
}

export const FloatingGlassNav: React.FC<FloatingGlassNavProps> = ({
  currentTab,
  onSelectTab,
  onOpenSearch
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { user } = useAuth();
  const currentRole = (user?.role || 'investigator') as UserRole;
  const isAdmin = currentRole === 'admin';

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const allNavItems = [
    { id: 'dashboard', label: 'Overview', desc: 'Case metrics & recent activity', icon: LayoutDashboard },
    { id: 'cases', label: 'Cases', desc: 'Active investigative dossiers', icon: Briefcase },
    { id: 'evidence', label: 'Evidence', desc: 'Police reports, call records & files', icon: FileText },
    { id: 'graph', label: 'Investigative Network', desc: 'Interactive 3D network of connections', icon: Network },
    { id: 'predictions', label: 'Potential Connections', desc: 'Analysis of potential hidden links', icon: Cpu, badge: 'Analysis' },
    { id: 'leads', label: 'Investigative Leads', desc: 'Unusual activity & network leads', icon: Lightbulb },
    { id: 'entities', label: 'People & Records', desc: 'Persons, organizations, vehicles', icon: Users },
    { id: 'timeline', label: 'Timeline', desc: 'Chronological activity sequence', icon: Clock },
    { id: 'verification', label: 'Evidence Verification', desc: 'Integrity verification & records', icon: ShieldCheck }
  ];

  const permittedTabs = ROLE_PERMISSIONS[currentRole] || [];
  const primaryNavItems = allNavItems.filter(item => permittedTabs.includes(item.id));

  // Current active item metadata
  const currentItem = allNavItems.find(i => i.id === currentTab) || (currentTab === 'admin' ? {
    id: 'admin',
    label: 'Administration',
    icon: ShieldAlert
  } : allNavItems[0]);

  const CurrentIcon = currentItem.icon;

  const handleSelect = (id: string) => {
    onSelectTab(id);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="fixed bottom-6 left-6 z-50 select-none">
      {/* ========================================================================= */}
      {/* 1. COMPACT FLOATING GLASS PILL (COLLAPSED STATE)                           */}
      {/* ========================================================================= */}
      <AnimatePresence mode="wait">
        {!isOpen && (
          <motion.div
            key="compact-pill"
            initial={{ scale: 0.92, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 10 }}
            transition={{ type: 'spring', damping: 24, stiffness: 320 }}
            className="flex items-center gap-2 p-1.5 rounded-full bg-white/70 backdrop-blur-lg border border-black/10 shadow-lg"
          >
            {/* Primary trigger button */}
            <button
              onClick={() => setIsOpen(true)}
              className="flex items-center gap-2.5 pl-3 pr-4 py-2 rounded-full bg-white/60 hover:bg-white text-[#121110] transition-all duration-200 border border-black/5 hover:border-black/10 hover:shadow-sm group focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#6E1827]"
              aria-label="Open navigation menu"
              title="Click to open glassmorphic navigation"
            >
              {/* Circular Monogram Icon */}
              <div className="w-7 h-7 rounded-full bg-[#121110] text-white flex items-center justify-center shrink-0 group-hover:bg-[#6E1827] transition-colors duration-200">
                <CurrentIcon className="w-3.5 h-3.5" />
              </div>

              {/* Module Name */}
              <div className="flex flex-col text-left">
                <span className="text-xs font-mono font-bold tracking-tight text-[#121110]">
                  {currentItem.label}
                </span>
                <span className="text-[9px] font-mono text-[#6B6760] tracking-wider uppercase">
                  Menu · Press ⌘
                </span>
              </div>

              <ChevronRight className="w-3.5 h-3.5 text-[#6B6760] group-hover:translate-x-0.5 transition-transform" />
            </button>

            {/* Quick Circular Search Button */}
            <button
              onClick={onOpenSearch}
              className="w-10 h-10 rounded-full bg-white/60 hover:bg-white text-[#121110] hover:text-[#6E1827] flex items-center justify-center transition-all duration-200 border border-black/5 hover:border-black/10 hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#6E1827]"
              title="Global search (⌘K)"
              aria-label="Search"
            >
              <Search className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 2. EXPANDED FLOATING GLASS NAVIGATION CARD                                 */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isOpen && (
          <motion.nav
            key="expanded-nav"
            initial={{ scale: 0.88, opacity: 0, y: 15, filter: 'blur(10px)' }}
            animate={{ scale: 1, opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ scale: 0.9, opacity: 0, y: 15, filter: 'blur(8px)' }}
            transition={{ type: 'spring', damping: 25, stiffness: 280 }}
            className="w-80 sm:w-96 rounded-3xl p-4 sm:p-5 flex flex-col space-y-4 bg-white/70 backdrop-blur-lg border border-black/10 shadow-xl"
          >
            {/* Header: Title + Close circular button */}
            <div className="flex items-center justify-between pb-3 border-b border-black/5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg overflow-hidden bg-white/95 border border-[#6E1827]/25 shadow-xs shrink-0 p-0.5">
                  <img src="/LOGONETRIX.png" alt="NETRIX" className="w-full h-full object-contain" />
                </div>
                <div>
                  <div className="text-sm font-serif font-normal text-[#121110] tracking-tight">
                    Intelligence Modules
                  </div>
                  <div className="text-[10px] font-mono text-[#6B6760] tracking-wider uppercase">
                    NETRIX · CLEARANCE LEVEL {isAdmin ? '4' : '3'}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full bg-white/70 hover:bg-[#FAF1F2] hover:text-[#6E1827] text-[#6B6760] flex items-center justify-center border border-black/5 transition-all duration-200"
                aria-label="Close navigation"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Nav Items List */}
            <div className="space-y-1 max-h-[58vh] overflow-y-auto pr-1 -mr-1">
              {primaryNavItems.map((item, idx) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;

                return (
                  <motion.button
                    key={item.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.025, duration: 0.2 }}
                    onClick={() => handleSelect(item.id)}
                    className={`w-full group flex items-center gap-3 p-2.5 rounded-2xl text-left transition-all duration-200 ${
                      isActive
                        ? 'bg-[#6E1827] text-white shadow-md shadow-[#6E1827]/20 font-medium'
                        : 'bg-white/40 hover:bg-white/80 text-[#121110] border border-transparent hover:border-black/5'
                    }`}
                  >
                    {/* Circular Icon Container */}
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105 ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-white text-[#121110] group-hover:text-[#6E1827] shadow-sm'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>

                    {/* Text block */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-semibold tracking-tight truncate">
                          {item.label}
                        </span>
                        {item.badge && (
                          <span
                            className={`text-[8px] font-mono px-1.5 py-0.2 rounded-full uppercase font-bold tracking-wider ${
                              isActive ? 'bg-white text-[#6E1827]' : 'bg-[#6E1827]/10 text-[#6E1827]'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <p
                        className={`text-[10px] font-sans truncate ${
                          isActive ? 'text-white/80' : 'text-[#6B6760]'
                        }`}
                      >
                        {item.desc}
                      </p>
                    </div>

                    {isActive && (
                      <div className="w-1.5 h-1.5 rounded-full bg-white shrink-0 mr-1" />
                    )}
                  </motion.button>
                );
              })}

              {/* ADMIN SPECIAL CONSOLE */}
              {isAdmin && (
                <div className="pt-2 border-t border-black/5">
                  <div className="px-2 py-1 text-[9px] font-mono tracking-widest text-[#6E1827] uppercase font-bold">
                    GOVERNANCE & AUDIT
                  </div>
                  <motion.button
                    onClick={() => handleSelect('admin')}
                    className={`w-full group flex items-center gap-3 p-2.5 rounded-2xl text-left transition-all duration-200 ${
                      currentTab === 'admin'
                        ? 'bg-[#121110] text-white shadow-md font-medium'
                        : 'bg-[#FAF1F2]/60 hover:bg-[#FAF1F2] text-[#6E1827] border border-[#6E1827]/15'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                        currentTab === 'admin'
                          ? 'bg-white/20 text-white'
                          : 'bg-white text-[#6E1827] shadow-sm'
                      }`}
                    >
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-mono font-semibold truncate flex items-center gap-1.5">
                        <span>Administration & Audit</span>
                        <span className="text-[8px] bg-[#6E1827]/15 text-[#6E1827] px-1 rounded-full">
                          LEVEL 4
                        </span>
                      </div>
                      <p
                        className={`text-[10px] font-sans truncate ${
                          currentTab === 'admin' ? 'text-white/80' : 'text-[#6B6760]'
                        }`}
                      >
                        Audit logs, RBAC & system mutations
                      </p>
                    </div>
                  </motion.button>
                </div>
              )}
            </div>

            {/* Footer with Search & Shortcuts */}
            <div className="pt-2 border-t border-black/5 flex items-center justify-between text-[11px] font-mono text-[#6B6760]">
              <button
                onClick={() => {
                  setIsOpen(false);
                  onOpenSearch();
                }}
                className="flex items-center gap-1.5 text-xs text-[#121110] hover:text-[#6E1827] transition-colors"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Quick Search</span>
                <kbd className="px-1.5 py-0.5 rounded-full bg-white border border-black/10 text-[9px]">
                  ⌘K
                </kbd>
              </button>

              <span className="text-[10px] text-[#6B6760]">Esc to close</span>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </div>
  );
};
