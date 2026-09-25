import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Search,
  LogOut,
  ChevronDown,
  ChevronRight,
  Check,
  Sliders,
  ShieldCheck,
  ShieldAlert,
  Compass,
  User as UserIcon,
  Lock
} from 'lucide-react';
import { Case, User, UserRole } from '../types';
import { useAuth } from '../context/AuthContext';
import { ROLE_DETAILS, ROLE_PERMISSIONS } from '../utils/rbac';
import { FloatingGlassNav } from './FloatingGlassNav';
import { AiIntelligenceIndicator } from './AiIntelligenceIndicator';
import { AnimatedBackground } from './AnimatedBackground';
import { NetrixLogo } from './common/NetrixLogo';

const TAB_BREADCRUMB_LABELS: Record<string, string> = {
  dashboard: 'Investigation Overview',
  cases: 'Case Dossiers',
  evidence: 'Evidence Sources',
  graph: 'Investigative Network',
  predictions: 'Potential Connections',
  leads: 'Investigative Leads',
  entities: 'People & Records',
  timeline: 'Activity Timeline',
  verification: 'Evidence Verification',
  analytics: 'Investigation Metrics',
  admin: 'Administration',
  profile: 'Profile & Security'
};

interface AppShellProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  activeCase: Case | null;
  onOpenSearch: () => void;
  onLogout: () => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  currentTab,
  onSelectTab,
  activeCase,
  onOpenSearch,
  onLogout,
  children
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const { user, role } = useAuth();
  const currentRole = (user?.role || role || 'investigator') as UserRole;
  const currentRoleMeta = ROLE_DETAILS[currentRole] || ROLE_DETAILS.investigator;
  const isAdmin = currentRole === 'admin';

  // Close profile dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute User Initials
  const getInitials = (name?: string, email?: string) => {
    if (name) {
      const parts = name.split(' ');
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      return name.substring(0, 2).toUpperCase();
    }
    if (email) return email.substring(0, 2).toUpperCase();
    return 'OP';
  };

  const initials = getInitials(user?.name, user?.email);

  return (
    <div className="min-h-screen bg-[#F7F5F0] text-[#121110] flex flex-col antialiased selection:bg-[#6E1827] selection:text-white relative overflow-x-hidden">
      {/* Persistent Living Animated Background System */}
      <AnimatedBackground context={currentTab} />

      {/* Floating Glassmorphic Navigation Component */}
      <FloatingGlassNav
        currentTab={currentTab}
        onSelectTab={onSelectTab}
        onOpenSearch={onOpenSearch}
      />

      {/* Top Application Bar (Glassmorphic) */}
      <header
        className="h-16 sticky top-0 z-40 px-4 sm:px-8 flex items-center justify-between transition-all duration-200"
        style={{
          background: 'rgba(255, 255, 255, 0.78)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderBottom: '1px solid rgba(226, 221, 213, 0.65)'
        }}
      >
        {/* Left: Brand + Case Pill */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => onSelectTab('dashboard')}
            className="flex items-center gap-3 text-left focus:outline-none group cursor-pointer"
            title="Return to NETRIX Overview"
          >
            <NetrixLogo size="sm" variant="horizontal" glow={true} showSubtext={false} />
          </button>

          {/* Active Case Context Pill */}
          <div className="hidden md:flex items-center gap-2 pl-3 border-l border-black/10">
            <button
              onClick={() => onSelectTab('cases')}
              className="flex items-center gap-2 px-3 py-1 bg-white/70 hover:bg-white border border-black/10 hover:border-[#6E1827]/30 rounded-full text-xs font-mono shadow-xs transition-colors cursor-pointer group"
              title="Click to view all cases or switch active case"
            >
              <span className={`w-2 h-2 rounded-full ${activeCase ? 'bg-emerald-600 animate-pulse' : 'bg-amber-500'}`} />
              <span className="text-[9px] text-[#6B6760] uppercase font-bold tracking-wider">CASE</span>
              <span className="font-semibold text-[#121110] max-w-[220px] truncate group-hover:text-[#6E1827] transition-colors">
                {activeCase?.name || 'Select Active Case'}
              </span>
            </button>
          </div>
        </div>

        {/* Center: AI Intelligence Circular Indicator */}
        <div className="hidden lg:flex items-center">
          <AiIntelligenceIndicator
            state={currentTab === 'predictions' ? 'ANALYZING' : 'READY'}
            size="sm"
            onClick={() => onSelectTab('predictions')}
          />
        </div>

        {/* Right: Quick Search, Persona Avatar */}
        <div className="flex items-center gap-3">
          {/* Quick Circular Search Button */}
          <button
            onClick={onOpenSearch}
            className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 bg-white/70 hover:bg-white border border-black/5 rounded-full text-xs font-mono text-[#6B6760] hover:text-[#121110] shadow-xs transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search entities, leads...</span>
            <kbd className="px-1.5 py-0.2 bg-[#F7F5F0] border border-black/10 rounded-full text-[9px] text-[#121110]">
              ⌘K
            </kbd>
          </button>

          {/* User Profile Menu with Circular Avatar */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className="flex items-center gap-2.5 p-1 sm:pl-1 sm:pr-3 rounded-full border border-black/5 hover:border-black/15 bg-white/70 hover:bg-white transition-all text-left group shadow-xs"
              aria-label="User profile menu"
            >
              {/* Circular Avatar */}
              <div className="w-8 h-8 rounded-full bg-[#121110] text-white flex items-center justify-center text-xs font-mono font-medium shadow-sm group-hover:scale-105 transition-transform">
                {initials}
              </div>

              {/* Identity & Role Badge */}
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-xs font-medium text-[#121110] leading-tight">
                  {user?.name || user?.username || 'Officer'}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[8px] font-mono font-bold tracking-wider uppercase px-1.5 py-0.2 rounded-full ${currentRoleMeta.badgeColor}`}>
                    {currentRoleMeta.label}
                  </span>
                </div>
              </div>

              <ChevronDown className="w-3.5 h-3.5 text-[#6B6760] group-hover:text-[#121110] transition-colors" />
            </button>

            {/* Profile Dropdown Drawer (Glassmorphic) */}
            {profileDropdownOpen && (
              <div
                className="absolute right-0 mt-2 w-72 rounded-3xl p-4 z-50 animate-fade-in space-y-3 font-mono text-xs shadow-xl"
                style={{
                  background: 'rgba(255, 255, 255, 0.88)',
                  backdropFilter: 'blur(25px) saturate(180%)',
                  WebkitBackdropFilter: 'blur(25px) saturate(180%)',
                  border: '1px solid rgba(255, 255, 255, 0.65)'
                }}
              >
                {/* Header User Card */}
                <div className="border-b border-black/5 pb-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-[#6E1827] uppercase font-bold tracking-wider">
                      SECURITY PROFILE
                    </span>
                    <span className="text-[9px] text-emerald-800 bg-emerald-50 px-2 py-0.2 border border-emerald-200 rounded-full font-semibold">
                      ● {user?.status ? user.status.toUpperCase() : 'ACTIVE'}
                    </span>
                  </div>
                  <div className="font-medium text-sm text-[#121110] font-sans">
                    {user?.name || user?.username}
                  </div>
                  <div className="text-[11px] text-[#6B6760] truncate">{user?.email}</div>
                  <div className="text-[10px] text-[#6B6760] pt-1">
                    Dept: {user?.department || 'Criminal Network Division'}
                  </div>
                </div>

                {/* Profile Quick Link */}
                <button
                  onClick={() => {
                    onSelectTab('profile');
                    setProfileDropdownOpen(false);
                  }}
                  className="w-full py-2 px-3 bg-[#121110] hover:bg-[#262524] text-white text-xs rounded-xl flex items-center justify-between transition-colors font-medium cursor-pointer shadow-2xs"
                >
                  <span className="flex items-center gap-1.5">
                    <UserIcon className="w-3.5 h-3.5 text-white" />
                    <span>My Clearance Profile</span>
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono">ACTIVE</span>
                </button>

                {/* Role Details */}
                <div className="p-2.5 bg-white/70 border border-black/5 rounded-2xl space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-[#6B6760]">CLEARANCE:</span>
                    <span className="font-bold text-[#6E1827] uppercase">
                      {currentRoleMeta.label}
                    </span>
                  </div>
                  <p className="text-[10px] font-sans text-[#6B6760] leading-tight">
                    {currentRoleMeta.description}
                  </p>
                </div>

                {/* Clearance Enforcement Badge */}
                <div className="p-2.5 bg-[#F7F5F0] border border-[#E2DDD5] rounded-2xl flex items-center gap-2 text-[10px] text-[#6B6760] font-sans">
                  <Lock className="w-3.5 h-3.5 shrink-0 text-[#6E1827]" />
                  <span>Role clearance is enforced via cryptographic session tokens.</span>
                </div>

                {/* Admin Quick Link */}
                {isAdmin && (
                  <button
                    onClick={() => {
                      onSelectTab('admin');
                      setProfileDropdownOpen(false);
                    }}
                    className="w-full py-2 px-3 bg-[#6E1827]/10 hover:bg-[#6E1827]/15 border border-[#6E1827]/25 text-[#6E1827] text-xs rounded-xl flex items-center justify-between transition-colors font-medium"
                  >
                    <span>Administration & Audit</span>
                    <Sliders className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Exit Session */}
                <div className="pt-2 border-t border-black/5">
                  <button
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      onLogout();
                    }}
                    className="w-full py-2 px-3 text-left text-xs text-[#6E1827] hover:bg-[#6E1827]/5 rounded-xl flex items-center justify-between transition-colors"
                  >
                    <span>Sign Out</span>
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Expansive Canvas (Full Width & Graceful Whitespace) */}
      <div className="flex-1 flex flex-col relative z-10">
        <main className={`flex-1 w-full mx-auto pb-28 relative z-10 ${
          currentTab === 'graph' 
            ? 'max-w-[1750px] px-3 sm:px-6 py-4' 
            : 'max-w-7xl p-4 sm:p-8 lg:p-10'
        }`}>
          {/* Subtle Text-Based Breadcrumb Navigation */}
          <nav aria-label="Breadcrumb" className="mb-4 sm:mb-6 flex items-center gap-2 text-xs font-mono text-[#6B6760]">
            <button
              onClick={() => onSelectTab('dashboard')}
              className="hover:text-[#121110] transition-colors cursor-pointer flex items-center gap-1 font-semibold text-[#121110]"
            >
              <span>NETRIX</span>
            </button>
            <ChevronRight className="w-3 h-3 text-[#E6E1D8]" />
            <button
              onClick={() => onSelectTab('cases')}
              className="hover:text-[#6E1827] transition-colors cursor-pointer flex items-center gap-1 font-medium text-[#6E1827]"
            >
              <span>{activeCase?.name || 'Operation Sea Serpent'}</span>
            </button>
            {currentTab !== 'dashboard' && (
              <>
                <ChevronRight className="w-3 h-3 text-[#E6E1D8]" />
                <span className="text-[#121110] font-bold uppercase tracking-wider text-[11px]">
                  {TAB_BREADCRUMB_LABELS[currentTab] || currentTab.toUpperCase()}
                </span>
              </>
            )}
          </nav>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentTab}
              initial={{ opacity: 0, scale: 0.998, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.998, y: -4 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

