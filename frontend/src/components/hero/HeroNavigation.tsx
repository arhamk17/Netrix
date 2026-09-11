import React from 'react';
import {
  Shield,
  Radio,
  BrainCircuit,
  Layers,
  Share2,
  Clock,
  Briefcase,
  Database,
  Lock,
  LogOut,
  User as UserIcon,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { NetrixLogo } from '../common/NetrixLogo';

interface Props {
  activeSection?: string;
  onNavigateSection?: (sectionId: string) => void;
  onOpenAuthModal?: () => void;
}

export const HeroNavigation: React.FC<Props> = ({
  activeSection = 'hero',
  onNavigateSection,
  onOpenAuthModal
}) => {
  const { user, isAuthenticated, logout, setAiConsoleOpen } = useAuth();

  const navItems = [
    { id: 'command', label: 'COMMAND CENTER' },
    { id: 'cases', label: 'CASES' },
    { id: 'evidence', label: 'EVIDENCE' },
    { id: 'intelligence', label: 'INTELLIGENCE' },
    { id: 'graph', label: 'KNOWLEDGE GRAPH' },
    { id: 'timeline', label: 'TIMELINE' }
  ];

  return (
    <header className="sticky top-3 sm:top-4 z-50 mx-auto w-[calc(100%-1.5rem)] sm:w-[calc(100%-2.5rem)] max-w-7xl transition-all duration-300">
      <div className="relative rounded-2xl border border-white/[0.12] bg-[#070B16]/80 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.65),0_0_30px_rgba(230,0,60,0.06)] px-4 sm:px-6 py-2.5 flex items-center justify-between before:absolute before:inset-x-8 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/25 before:to-transparent">
        {/* LEFT: NETRIX Logo */}
        <div
          onClick={() => onNavigateSection?.('hero')}
          className="flex items-center cursor-pointer group hover:opacity-90 transition-opacity"
        >
          <NetrixLogo
            variant="horizontal"
            glow={true}
            className="w-[120px] sm:w-[145px]"
          />
        </div>

        {/* CENTER: Operational Modules Navigation */}
        <nav className="hidden md:flex items-center gap-1 lg:gap-1.5 bg-black/20 p-1 rounded-xl border border-white/[0.06]">
          {navItems.map(item => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigateSection?.(item.id)}
                className={`px-3 py-1.5 rounded-lg font-tech text-[11px] uppercase tracking-[0.14em] font-medium transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'text-slate-100 bg-[#E6003C]/20 border border-[#E6003C]/50 shadow-[0_0_12px_rgba(230,0,60,0.25)]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* RIGHT: [ ASK NETRIX ] & Account / Auth Enclave */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* ASK NETRIX Button */}
          <button
            onClick={() => setAiConsoleOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[#E6003C]/40 bg-gradient-to-r from-[#E6003C]/20 to-[#800020]/20 hover:border-[#E6003C] text-rose-300 hover:text-white font-tech font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_16px_rgba(230,0,60,0.25)] cursor-pointer"
          >
            <BrainCircuit className="w-3.5 h-3.5 text-[#FF2A5F]" />
            <span className="hidden sm:inline">ASK NETRIX</span>
          </button>

          {/* Authenticated user badge or Enclave Login trigger */}
          {isAuthenticated && user ? (
            <div className="flex items-center gap-2 pl-2 border-l border-white/[0.08]">
              <div className="text-right hidden xl:block">
                <span className="text-xs font-medium text-slate-200 block leading-tight">
                  {user.full_name}
                </span>
                <span className="text-[9px] font-mono text-slate-400 block">
                  {user.badge_number || 'BADGE-01'} // {(user.department || 'CRIMINAL INTEL').slice(0, 18)}
                </span>
              </div>

              <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded-lg border border-red-900/40 bg-red-950/30 text-rose-300">
                {user.role}
              </span>

              <button
                onClick={() => {
                  logout();
                  onNavigateSection?.('hero');
                }}
                title="Terminate Session"
                className="p-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:border-rose-500/50 hover:text-rose-400 text-slate-400 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuthModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/[0.2] text-slate-200 font-tech text-xs uppercase tracking-wider transition-all cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5 text-[#FF2A5F]" />
              <span className="hidden sm:inline">AUTHENTICATE</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
