import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldAlert,
  Search,
  LogOut,
  ChevronDown,
  Clock,
  LayoutGrid,
  FolderLock,
  BrainCircuit,
  User,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import type { TabType } from './Sidebar';
import { NetrixLogo } from './NetrixLogo';
import { MODULE_REGISTRY } from './ModuleDrawer';
import { ForensicAvatar } from '../profile/ForensicAvatar';

interface Props {
  onOpenSearch?: () => void;
  onNavigateTab?: (tab: TabType) => void;
  onOpenMenu?: () => void;
  onOpenAuthModal?: () => void;
  activeTab?: TabType;
}

export const Navbar: React.FC<Props> = ({
  onOpenSearch,
  onNavigateTab,
  onOpenMenu,
  onOpenAuthModal,
  activeTab = 'command'
}) => {
  const { user, logout, cases, currentCaseId, setCurrentCaseId, activeCase, isAuthenticated } = useAuth();
  const [utcTime, setUtcTime] = useState<string>('');
  const [caseDropdownOpen, setCaseDropdownOpen] = useState<boolean>(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState<boolean>(false);
  const caseDropdownRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  // UTC clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setUtcTime(
        now.toUTCString().replace('GMT', 'UTC').split(' ').slice(1, 5).join(' ')
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (caseDropdownRef.current && !caseDropdownRef.current.contains(e.target as Node)) {
        setCaseDropdownOpen(false);
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Find active module metadata
  const currentModule = MODULE_REGISTRY.find((m) => m.id === activeTab) || MODULE_REGISTRY[1];

  // Determine display label for the active case
  const activeCaseDisplayNumber =
    activeCase?.case_number ||
    (currentCaseId && currentCaseId.length > 18
      ? `CASE-${currentCaseId.slice(0, 8).toUpperCase()}`
      : currentCaseId) ||
    'NO CASE SELECTED';

  // Determine if user is currently inside an operational dashboard view
  const isDashboard = isAuthenticated && activeTab !== 'hero';

  return (
    <header className="sticky top-2 sm:top-3 z-40 mx-auto w-[calc(100%-1.25rem)] sm:w-[calc(100%-2rem)] max-w-7xl transition-all duration-300">
      <div className="relative rounded-2xl border border-white/[0.1] bg-[#000000]/90 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_30px_rgba(109,0,26,0.12)] px-3.5 sm:px-5 py-2.5 flex items-center justify-between select-none before:absolute before:inset-x-8 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[#6D001A]/60 before:to-transparent">
        {/* LEFT: Official Logo & Modules Drawer Trigger (Dashboard only) */}
        <div className="flex items-center gap-2.5 sm:gap-4">
          {/* Official Brand Logo */}
          <div
            onClick={() => onNavigateTab?.('hero')}
            className="cursor-pointer hover:opacity-90 transition-opacity flex items-center shrink-0"
            title="Go to NETRIX Home"
          >
            <NetrixLogo
              variant="horizontal"
              glow={true}
              className="w-[115px] sm:w-[140px]"
            />
          </div>

          {isDashboard && (
            <>
              <div className="hidden sm:block h-5 w-px bg-white/10" />

              {/* MENU / MODULES Drawer Button */}
              <button
                onClick={onOpenMenu}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-[#6D001A]/30 hover:border-[#6D001A] text-white transition-all cursor-pointer shadow-sm group"
                title="Open Operational Modules Drawer (M)"
              >
                <LayoutGrid className="w-4 h-4 text-white group-hover:rotate-90 transition-transform duration-200" />
                <span className="font-tech text-xs tracking-wider uppercase font-bold">
                  MODULES
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#6D001A] text-white font-semibold hidden md:inline">
                  12
                </span>
              </button>

              {/* Active Module Indicator Badge (Desktop) */}
              <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs font-mono text-slate-300">
                <span className="w-1.5 h-1.5 rounded-full bg-[#6D001A] shadow-[0_0_6px_#FF1A4D]" />
                <span className="text-[10px] text-slate-500">{currentModule.code}</span>
                <span className="font-semibold text-white truncate max-w-[140px] uppercase font-tech">
                  {currentModule.label}
                </span>
              </div>
            </>
          )}
        </div>

        {/* RIGHT: Actions, Case Selector, AI Core & Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Dashboard Controls: Case Selector, Intelligence Engine, Global Search (Dashboard only) */}
          {isDashboard && (
            <>
              {/* Active Case Selector Dropdown */}
              <div className="relative" ref={caseDropdownRef}>
                <button
                  onClick={() => setCaseDropdownOpen(!caseDropdownOpen)}
                  className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20 text-xs font-mono text-white transition-all cursor-pointer whitespace-nowrap"
                  title={`Active Case: ${activeCase?.title || activeCaseDisplayNumber}`}
                >
                  <FolderLock className="w-3.5 h-3.5 text-red-500 shrink-0" />
                  <span className="font-bold text-slate-200 hidden sm:inline whitespace-nowrap truncate max-w-[150px]">
                    {activeCaseDisplayNumber}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${
                      caseDropdownOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {caseDropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-white/10 bg-[#050508] p-2 shadow-2xl z-50 font-mono text-xs text-slate-200 backdrop-blur-xl">
                    <div className="px-2.5 py-1.5 border-b border-white/[0.08] text-[10px] uppercase tracking-wider text-slate-500 flex justify-between items-center">
                      <span>SELECT ACTIVE CASE</span>
                      <span className="text-white font-bold">{cases.length} AVAILABLE</span>
                    </div>

                    <div className="py-1 max-h-56 overflow-y-auto space-y-1">
                      {(cases || []).map((c) => {
                        const caseIdentifier = c.id || c.case_id || '';
                        const isSelected = caseIdentifier === currentCaseId || c.case_id === currentCaseId || c.id === currentCaseId;
                        const displayNum = c.case_number || (c.id && c.id.length > 18 ? `CASE-${c.id.slice(0, 8).toUpperCase()}` : c.case_id || c.id);
                        return (
                          <button
                            key={caseIdentifier || c.title}
                            onClick={() => {
                              setCurrentCaseId(caseIdentifier);
                              setCaseDropdownOpen(false);
                            }}
                            className={`w-full text-left px-2.5 py-2 rounded-lg flex items-center justify-between transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-[#6D001A]/50 border border-[#6D001A] text-white'
                                : 'hover:bg-white/[0.05] text-slate-300'
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <div className="font-bold text-white flex items-center gap-1.5">
                                <span className="truncate">{displayNum}</span>
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/10 text-slate-300 uppercase shrink-0">
                                  {c.priority || c.status}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                                {c.title}
                              </div>
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-white shrink-0 ml-1" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Intelligence Direct Button */}
              <button
                onClick={() => onNavigateTab?.('intelligence')}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-mono font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'intelligence'
                    ? 'border-[#6D001A] bg-[#6D001A] text-white shadow-[0_0_15px_rgba(109,0,26,0.6)]'
                    : 'border-white/10 bg-white/[0.03] hover:border-[#6D001A]/60 hover:bg-[#6D001A]/20 text-slate-300 hover:text-white'
                }`}
                title="Open Investigative Intelligence Engine"
              >
                <BrainCircuit className="w-3.5 h-3.5 text-white animate-pulse shrink-0" />
                <span className="hidden md:inline">INTELLIGENCE</span>
              </button>

              {/* Global Search Button */}
              <button
                onClick={onOpenSearch}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20 text-slate-400 hover:text-white text-xs font-mono transition-all cursor-pointer whitespace-nowrap"
                title="Global Search (⌘K)"
              >
                <Search className="w-3.5 h-3.5 shrink-0" />
                <kbd className="hidden md:inline px-1 py-0.2 rounded bg-white/10 text-[9px] text-slate-400 font-sans">
                  ⌘K
                </kbd>
              </button>
            </>
          )}

          {/* Quick "ENTER DASHBOARD" button on Home page if logged in */}
          {isAuthenticated && activeTab === 'hero' && (
            <button
              onClick={() => onNavigateTab?.('command')}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-[#6D001A] bg-gradient-to-r from-[#6D001A] to-[#8B0024] hover:opacity-95 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(109,0,26,0.4)] cursor-pointer"
            >
              <span>ENTER DASHBOARD</span>
            </button>
          )}

          {/* User Auth or Enclave Profile */}
          {isAuthenticated && user ? (
            <div className="relative" ref={userDropdownRef}>
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-[#6D001A]/50 bg-[#6D001A]/20 hover:bg-[#6D001A]/40 text-white text-xs font-mono font-semibold transition-all cursor-pointer whitespace-nowrap"
                title="User Profile & System Status"
              >
                <ForensicAvatar
                  role={user.role}
                  name={user.full_name || user.username}
                  size="xs"
                  showBadge={false}
                  showStatus={true}
                  statusOnline={true}
                />
                <span className="hidden sm:inline max-w-[140px] md:max-w-[170px] truncate text-slate-200 whitespace-nowrap">
                  {user.full_name || user.username}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
              </button>

              {userDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-white/10 bg-[#050508] p-3.5 shadow-2xl z-50 font-mono text-xs text-slate-200 backdrop-blur-xl space-y-3">
                  <div className="border-b border-white/[0.08] pb-3 flex items-center gap-3">
                    <ForensicAvatar
                      role={user.role}
                      name={user.full_name || user.username}
                      size="sm"
                      showBadge={false}
                      showStatus={true}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-white truncate">{user.full_name || user.username}</div>
                      <div className="text-[11px] text-slate-400 truncate">{user.email}</div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className="text-[9px] px-2 py-0.5 rounded border border-[#6D001A] bg-[#6D001A]/30 text-rose-300 font-bold uppercase">
                          {user.role}
                        </span>
                        <span className="text-[9px] text-slate-500 font-mono">
                          {user.badge_number}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-400 space-y-1">
                    <div className="flex items-center justify-between">
                      <span>SYSTEM STATUS</span>
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                        ONLINE
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>TIME (UTC)</span>
                      <span className="text-slate-300">{utcTime}</span>
                    </div>
                  </div>

                  <div className="pt-1 space-y-1.5">
                    <button
                      onClick={() => {
                        setUserDropdownOpen(false);
                        onNavigateTab?.('profile');
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-white/[0.06] hover:bg-[#6D001A]/40 border border-white/10 hover:border-[#6D001A] text-white text-xs font-bold transition-all cursor-pointer"
                    >
                      <User className="w-3.5 h-3.5 text-rose-300" />
                      <span>VIEW USER PROFILE</span>
                    </button>

                    <button
                      onClick={() => {
                        setUserDropdownOpen(false);
                        logout();
                        onNavigateTab?.('hero');
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-rose-950/40 hover:bg-rose-950/80 border border-rose-800/40 text-rose-300 font-bold transition-all cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>LOG OUT</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={onOpenAuthModal}
              className="flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-xl border border-[#6D001A] bg-gradient-to-r from-[#6D001A] to-[#8B0024] hover:opacity-95 text-white text-xs font-mono font-bold tracking-wider uppercase transition-all shadow-[0_0_15px_rgba(109,0,26,0.5)] cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>SIGN IN</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
