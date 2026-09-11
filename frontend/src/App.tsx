import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CinematicBackground } from './components/common/CinematicBackground';
import { Navbar } from './components/common/Navbar';
import { ModuleDrawer } from './components/common/ModuleDrawer';
import type { TabType } from './components/common/Sidebar';
import { GlobalSearchModal } from './components/common/GlobalSearchModal';
import { EnclaveAuthModal } from './components/hero/EnclaveAuthModal';
import { CommandCenter } from './components/command/CommandCenter';
import { CaseManagement } from './components/cases/CaseManagement';
import { EvidenceVault } from './components/evidence/EvidenceVault';
import { IntegrityVerification } from './components/integrity/IntegrityVerification';
import { KnowledgeGraph } from './components/graph/KnowledgeGraph';
import { TemporalIntelligence } from './components/temporal/TemporalIntelligence';
import { AnalyticsView } from './components/analytics/AnalyticsView';
import { InvestigativeLeads } from './components/leads/InvestigativeLeads';
import { ExplainabilityView } from './components/explain/ExplainabilityView';
import { ModelPerformance } from './components/models/ModelPerformance';
import { AIIntelligenceEngine } from './components/intelligence/AIIntelligenceEngine';
import { CinematicPlatformShowcase } from './components/hero/CinematicPlatformShowcase';
import { CinematicLoadingScreen } from './components/common/CinematicLoadingScreen';
import { ProfileSection } from './components/profile/ProfileSection';
import type { InvestigativeLead } from './types';

const MainShell: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const [bootLoading, setBootLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<TabType>('hero');
  const [menuDrawerOpen, setMenuDrawerOpen] = useState<boolean>(false);
  const [searchOpen, setSearchOpen] = useState<boolean>(false);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);

  // Cross-module deep-linking state
  const [selectedEvidenceForIntegrity, setSelectedEvidenceForIntegrity] = useState<string>('EVD-891-01');
  const [selectedLeadForExplain, setSelectedLeadForExplain] = useState<InvestigativeLead | null>(null);
  const [focusGraphNodeId, setFocusGraphNodeId] = useState<string | null>(null);
  const [focusGraphEdgeId, setFocusGraphEdgeId] = useState<string | null>(null);

  // Reset all state and redirect to hero on unauthenticated / logout
  useEffect(() => {
    const handleLogoutPurge = () => {
      setActiveTab('hero');
      setMenuDrawerOpen(false);
      setSearchOpen(false);
      setAuthModalOpen(false);
      setFocusGraphNodeId(null);
      setFocusGraphEdgeId(null);
      setSelectedLeadForExplain(null);
      setSelectedEvidenceForIntegrity('EVD-891-01');
    };

    if (!isAuthenticated) {
      handleLogoutPurge();
    }

    window.addEventListener('netrix:logout', handleLogoutPurge);
    return () => window.removeEventListener('netrix:logout', handleLogoutPurge);
  }, [isAuthenticated]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle menu with 'm' or 'M' when not in input
      if (
        (e.key === 'm' || e.key === 'M') &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)
      ) {
        if (!isAuthenticated) {
          setAuthModalOpen(true);
        } else {
          setMenuDrawerOpen((prev) => !prev);
        }
      }
      // Open search with ⌘K / Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (!isAuthenticated) {
          setAuthModalOpen(true);
        } else {
          setSearchOpen(true);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuthenticated]);

  if (bootLoading || isLoading) {
    return (
      <CinematicLoadingScreen
        duration={2400}
        onComplete={() => setBootLoading(false)}
      />
    );
  }

  // Active tab strictly clamped to 'hero' if unauthenticated
  const effectiveTab: TabType = isAuthenticated ? activeTab : 'hero';

  // Navigation router helper with strict auth protection
  const handleNavigate = (tab: TabType, meta?: any) => {
    if (!isAuthenticated && tab !== 'hero') {
      setAuthModalOpen(true);
      return;
    }
    if (meta?.evidenceId) {
      setSelectedEvidenceForIntegrity(meta.evidenceId);
    }
    if (meta?.nodeId) {
      setFocusGraphNodeId(meta.nodeId);
    }
    if (meta?.edgeId) {
      setFocusGraphEdgeId(meta.edgeId);
    }
    setActiveTab(tab);
  };

  const handleInspectEvidence = (evidenceId: string) => {
    if (!isAuthenticated) {
      setAuthModalOpen(true);
      return;
    }
    setSelectedEvidenceForIntegrity(evidenceId);
    setActiveTab('integrity');
  };

  const handleExplainLead = (lead: InvestigativeLead) => {
    if (!isAuthenticated) {
      setAuthModalOpen(true);
      return;
    }
    setSelectedLeadForExplain(lead);
    setActiveTab('explain');
  };

  const handleInspectInGraph = (nodeId?: string, edgeId?: string) => {
    if (!isAuthenticated) {
      setAuthModalOpen(true);
      return;
    }
    setFocusGraphNodeId(nodeId || null);
    setFocusGraphEdgeId(edgeId || null);
    setActiveTab('graph');
  };

  const handleViewAIReasoning = (target: any) => {
    if (!isAuthenticated) {
      setAuthModalOpen(true);
      return;
    }
    if (target?.lead_id) {
      setSelectedLeadForExplain(target);
      setActiveTab('explain');
    } else {
      setActiveTab('intelligence');
    }
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col bg-[#000000] text-slate-100 overflow-x-hidden selection:bg-[#6D001A]/60 selection:text-white">
      {/* 3D Cinematic Interactive Background */}
      <CinematicBackground interactive={true} />

      {/* SINGLE UNIFIED TOP NAVBAR */}
      <Navbar
        onOpenSearch={() => {
          if (isAuthenticated) {
            setSearchOpen(true);
          } else {
            setAuthModalOpen(true);
          }
        }}
        onNavigateTab={handleNavigate}
        onOpenMenu={() => {
          setMenuDrawerOpen(true);
        }}
        onOpenAuthModal={() => setAuthModalOpen(true)}
        activeTab={effectiveTab}
      />



      {/* SLEEK ANIMATED MODULE DRAWER */}
      <ModuleDrawer
        isOpen={menuDrawerOpen}
        onClose={() => setMenuDrawerOpen(false)}
        activeTab={effectiveTab}
        onSelectTab={handleNavigate}
      />

      {/* OPERATIONAL VIEWPORT (FULL-WIDTH SPATIAL CANVAS WITH ANIMATED TRANSITIONS) */}
      <div className="relative z-10 flex-1 flex flex-col">
        <main
          className={`flex-1 min-w-0 w-full ${
            effectiveTab === 'hero'
              ? 'p-0'
              : 'p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto'
          }`}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={effectiveTab}
              initial={{ opacity: 0, y: 14, scale: 0.995 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.995 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              className="w-full"
            >
              {effectiveTab === 'hero' && (
                <CinematicPlatformShowcase
                  onEnterWorkspace={(targetTab) => handleNavigate(targetTab || 'command')}
                  onOpenAuthModal={() => setAuthModalOpen(true)}
                />
              )}
              {effectiveTab === 'command' && <CommandCenter onNavigate={handleNavigate} />}
              {(effectiveTab === 'intelligence' || effectiveTab === 'ai') && (
                <AIIntelligenceEngine
                  onInspectInGraph={handleInspectInGraph}
                  onExplainLead={handleExplainLead}
                  onInspectEvidence={handleInspectEvidence}
                />
              )}
              {effectiveTab === 'graph' && (
                <KnowledgeGraph
                  focusNodeId={focusGraphNodeId}
                  focusEdgeId={focusGraphEdgeId}
                  onViewAIReasoning={handleViewAIReasoning}
                />
              )}
              {effectiveTab === 'cases' && <CaseManagement />}
              {effectiveTab === 'evidence' && (
                <EvidenceVault onInspectIntegrity={handleInspectEvidence} />
              )}
              {effectiveTab === 'integrity' && (
                <IntegrityVerification initialEvidenceId={selectedEvidenceForIntegrity} />
              )}
              {effectiveTab === 'temporal' && <TemporalIntelligence />}
              {effectiveTab === 'leads' && (
                <InvestigativeLeads
                  onInspectEvidence={handleInspectEvidence}
                  onExplainLead={handleExplainLead}
                />
              )}
              {effectiveTab === 'explain' && (
                <ExplainabilityView
                  initialLead={selectedLeadForExplain}
                  onInspectEvidence={handleInspectEvidence}
                />
              )}
              {effectiveTab === 'models' && <ModelPerformance />}
              {effectiveTab === 'analytics' && <AnalyticsView />}
              {effectiveTab === 'profile' && <ProfileSection />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* GLOBAL MODALS */}
      <GlobalSearchModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        onNavigate={handleNavigate}
      />

      <EnclaveAuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={() => {
          setActiveTab('command');
        }}
      />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainShell />
    </AuthProvider>
  );
}
