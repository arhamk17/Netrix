import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
import { AccessRestricted } from './components/AccessRestricted';
import { canAccessTab } from './utils/rbac';
import { Case, Entity, PredictionEngineResult } from './types';
import { apiClient, getAuthToken } from './api/client';

// Lazy-load platform & secondary modules to isolate heavy libraries (Three.js, Recharts, jsPDF) from Auth
const Home = lazy(() => import('./pages/Home').then(m => ({ default: m.Home })));
const AppShell = lazy(() => import('./components/AppShell').then(m => ({ default: m.AppShell })));
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Cases = lazy(() => import('./pages/Cases').then(m => ({ default: m.Cases })));
const EvidencePage = lazy(() => import('./pages/Evidence').then(m => ({ default: m.EvidencePage })));
const KnowledgeGraphPage = lazy(() => import('./pages/KnowledgeGraphPage').then(m => ({ default: m.KnowledgeGraphPage })));
const PredictionCenter = lazy(() => import('./pages/PredictionCenter').then(m => ({ default: m.PredictionCenter })));
const Leads = lazy(() => import('./pages/Leads').then(m => ({ default: m.Leads })));
const EntityExplorer = lazy(() => import('./pages/EntityExplorer').then(m => ({ default: m.EntityExplorer })));
const Timeline = lazy(() => import('./pages/Timeline').then(m => ({ default: m.Timeline })));
const VerificationPage = lazy(() => import('./pages/VerificationPage').then(m => ({ default: m.VerificationPage })));
const Analytics = lazy(() => import('./pages/Analytics').then(m => ({ default: m.Analytics })));
const Administration = lazy(() => import('./pages/Administration').then(m => ({ default: m.Administration })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then(m => ({ default: m.ProfilePage })));
const SystemInitializer = lazy(() => import('./components/SystemInitializer').then(m => ({ default: m.SystemInitializer })));
const GlobalSearchModal = lazy(() => import('./components/GlobalSearchModal').then(m => ({ default: m.GlobalSearchModal })));
const EntityInspectorDrawer = lazy(() => import('./components/EntityInspectorDrawer').then(m => ({ default: m.EntityInspectorDrawer })));
const TrackConnectionDrawer = lazy(() => import('./components/TrackConnectionDrawer').then(m => ({ default: m.TrackConnectionDrawer })));

export default function App() {
  const getInitialView = (): 'home' | 'login' | 'platform' => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.toLowerCase();
      const path = window.location.pathname.toLowerCase();
      const search = window.location.search.toLowerCase();
      if (hash === '#login' || path === '/login' || search.includes('login') || search.includes('auth')) {
        return 'login';
      }
      if (hash === '#platform' && getAuthToken()) {
        return 'platform';
      }
    }
    return 'home';
  };

  const [currentView, setCurrentView] = useState<'home' | 'login' | 'platform'>(getInitialView);
  const { isAuthenticated, user, login: authLogin, logout: authLogout } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isInitializing, setIsInitializing] = useState<boolean>(false);

  // Active Case Context loaded directly from backend, initialized from cache for instant rendering
  const [activeCase, setActiveCase] = useState<Case | null>(() => {
    try {
      const saved = localStorage.getItem('netrix_active_case');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const handleSetActiveCase = (newCase: Case | null) => {
    setActiveCase(newCase);
    try {
      if (newCase) {
        localStorage.setItem('netrix_active_case', JSON.stringify(newCase));
      } else {
        localStorage.removeItem('netrix_active_case');
      }
    } catch {}
  };

  // Global Drawers & Modals
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [inspectedEntity, setInspectedEntity] = useState<Entity | null>(null);
  const [trackedPrediction, setTrackedPrediction] = useState<PredictionEngineResult | null>(null);
  const [targetEvidenceName, setTargetEvidenceName] = useState<string | undefined>(undefined);
  const [targetVerificationId, setTargetVerificationId] = useState<string | undefined>(undefined);

  // Synchronize URL hash with navigation without full reload
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleHash = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash === '#login') {
        setCurrentView('login');
      } else if (hash === '#home') {
        setCurrentView('home');
      } else if (hash === '#platform' && isAuthenticated) {
        setCurrentView('platform');
      }
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [isAuthenticated]);

  // Load real active case from backend ONLY when authenticated AND inside the platform
  useEffect(() => {
    if (isAuthenticated && currentView === 'platform') {
      apiClient.cases.list()
        .then(casesList => {
          if (casesList && casesList.length > 0) {
            setActiveCase(prev => {
              const matched = prev ? (casesList.find(c => c.id === prev.id) || casesList[0]) : casesList[0];
              try {
                localStorage.setItem('netrix_active_case', JSON.stringify(matched));
              } catch {}
              return matched;
            });
          }
        })
        .catch(err => {
          console.warn('[NETRIX APP] Failed to load case repository:', err);
        });
    }
  }, [isAuthenticated, currentView]);

  useEffect(() => {
    // Keyboard shortcut for Command+K search modal
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLogout = () => {
    authLogout();
    setCurrentView('home');
    if (typeof window !== 'undefined') window.location.hash = '#home';
  };

  // 1. PUBLIC HOMEPAGE (Cinematic 3D experience)
  if (currentView === 'home') {
    return (
      <Suspense fallback={<div className="min-h-screen bg-[#F7F5F0]" />}>
        <Home
          onEnterPlatform={() => {
            if (isAuthenticated) {
              setIsInitializing(true);
              setCurrentView('platform');
              if (typeof window !== 'undefined') window.location.hash = '#platform';
            } else {
              setCurrentView('login');
              if (typeof window !== 'undefined') window.location.hash = '#login';
            }
          }}
        />
      </Suspense>
    );
  }

  // 2. AUTHENTICATION GATEWAY
  if (currentView === 'login' || !isAuthenticated) {
    return (
      <Login
        onLoginSuccess={(token, user) => {
          authLogin(token, user);
          setIsInitializing(true);
          setCurrentView('platform');
          setActiveTab('dashboard');
          if (typeof window !== 'undefined') window.location.hash = '#platform';
        }}
        onBackToHome={() => {
          setCurrentView('home');
          if (typeof window !== 'undefined') window.location.hash = '#home';
        }}
      />
    );
  }

  // 3. FULL-SCREEN SYSTEM INITIALIZATION SEQUENCE
  if (isInitializing) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-[#F7F5F0]" />}>
        <SystemInitializer
          onComplete={() => setIsInitializing(false)}
          targetDestinationName={activeTab.replace('_', ' ')}
        />
      </Suspense>
    );
  }

  // Helper to resolve entity by ID for drawer inspection
  const handleSelectEntityById = async (entityId: string) => {
    try {
      const graph = await apiClient.graph.getGraphData(activeCase?.id);
      const match = graph.nodes.find(n => n.id === entityId || n.label === entityId);
      if (match) {
        setInspectedEntity(match);
      }
    } catch (err) {
      console.error('Error fetching entity details:', err);
    }
  };

  // Routing render with RBAC Authorization Guard
  const renderCurrentModule = () => {
    const currentRole = user?.role || 'investigator';
    const isPermitted = canAccessTab(currentRole, activeTab);

    if (!isPermitted) {
      const reqRole = activeTab === 'admin' ? 'admin' : activeTab === 'evidence' ? 'investigator' : 'analyst';
      return (
        <AccessRestricted
          currentRole={currentRole}
          requiredRole={reqRole}
          resourceName={activeTab.toUpperCase()}
          onReturnToDashboard={() => setActiveTab('dashboard')}
        />
      );
    }

    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard
            activeCase={activeCase}
            onNavigate={(tab) => setActiveTab(tab)}
            onTrackConnection={(pred) => setTrackedPrediction(pred)}
          />
        );

      case 'cases':
        return (
          <Cases
            activeCase={activeCase}
            onSelectActiveCase={handleSetActiveCase}
            onNavigateToModule={(mod) => setActiveTab(mod)}
          />
        );

      case 'evidence':
        return (
          <EvidencePage
            activeCase={activeCase}
            selectedEvidenceName={targetEvidenceName}
            onNavigateToVerification={(id) => {
              setTargetVerificationId(id);
              setActiveTab('verification');
            }}
            onNavigateToGraph={() => setActiveTab('graph')}
          />
        );

      case 'graph':
        return (
          <KnowledgeGraphPage
            activeCase={activeCase}
            onNavigateToPage={(p) => setActiveTab(p)}
            onSelectEntity={(ent) => setInspectedEntity(ent)}
          />
        );

      case 'predictions':
        return (
          <PredictionCenter
            activeCase={activeCase}
            onNavigateToGraph={() => setActiveTab('graph')}
            onNavigateToEvidence={(evName) => {
              setTargetEvidenceName(evName);
              setActiveTab('evidence');
            }}
            onNavigateToLead={() => setActiveTab('leads')}
            onTrackConnection={(pred) => setTrackedPrediction(pred)}
            onSelectEntity={handleSelectEntityById}
          />
        );

      case 'leads':
        return (
          <Leads
            activeCase={activeCase}
            onNavigateToGraph={() => setActiveTab('graph')}
            onNavigateToEvidence={(evName) => {
              setTargetEvidenceName(evName);
              setActiveTab('evidence');
            }}
            onTrackConnection={(pred) => setTrackedPrediction(pred)}
            onSelectEntity={handleSelectEntityById}
          />
        );

      case 'entities':
        return (
          <EntityExplorer
            activeCase={activeCase}
            onSelectEntity={(ent) => setInspectedEntity(ent)}
            onNavigateToGraph={() => setActiveTab('graph')}
          />
        );

      case 'timeline':
        return (
          <Timeline
            activeCase={activeCase}
            onNavigateToGraph={() => setActiveTab('graph')}
            onNavigateToEvidence={(evName) => {
              setTargetEvidenceName(evName);
              setActiveTab('evidence');
            }}
            onSelectEntity={handleSelectEntityById}
          />
        );

      case 'verification':
        return (
          <VerificationPage
            initialEvidenceId={targetVerificationId}
            onNavigateToEvidence={(evName) => {
              setTargetEvidenceName(evName);
              setActiveTab('evidence');
            }}
          />
        );

      case 'analytics':
        return <Analytics activeCase={activeCase} />;

      case 'admin':
        return <Administration />;

      case 'profile':
        return <ProfilePage onNavigateToTab={(tab) => setActiveTab(tab)} />;

      default:
        return (
          <Dashboard
            activeCase={activeCase}
            onNavigate={(tab) => setActiveTab(tab)}
            onTrackConnection={(pred) => setTrackedPrediction(pred)}
          />
        );
    }
  };

  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F7F5F0]" />}>
      <AppShell
        currentTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          // Clear temporary deep links
          setTargetEvidenceName(undefined);
          setTargetVerificationId(undefined);
        }}
        activeCase={activeCase}
        onOpenSearch={() => setIsSearchOpen(true)}
        onLogout={handleLogout}
      >
        {renderCurrentModule()}

        {/* Global Search Modal */}
        {isSearchOpen && (
          <GlobalSearchModal
            isOpen={isSearchOpen}
            onClose={() => setIsSearchOpen(false)}
            onSelectEntity={(ent) => {
              setIsSearchOpen(false);
              setInspectedEntity(ent);
            }}
            onSelectEvidence={(ev) => {
              setIsSearchOpen(false);
              setTargetEvidenceName(ev.name);
              setActiveTab('evidence');
            }}
            onSelectLead={() => {
              setIsSearchOpen(false);
              setActiveTab('leads');
            }}
          />
        )}

        {/* Entity Inspector Drawer */}
        {inspectedEntity && (
          <EntityInspectorDrawer
            entity={inspectedEntity}
            onClose={() => setInspectedEntity(null)}
            onOpenInGraph={() => {
              setInspectedEntity(null);
              setActiveTab('graph');
            }}
            onViewEvidence={(evName) => {
              setInspectedEntity(null);
              setTargetEvidenceName(evName);
              setActiveTab('evidence');
            }}
          />
        )}

        {/* "How to Track the Connection" Drawer */}
        {trackedPrediction && (
          <TrackConnectionDrawer
            prediction={trackedPrediction}
            onClose={() => setTrackedPrediction(null)}
            onOpenInGraph={() => {
              setTrackedPrediction(null);
              setActiveTab('graph');
            }}
            onViewEvidence={(evName) => {
              setTrackedPrediction(null);
              setTargetEvidenceName(evName);
              setActiveTab('evidence');
            }}
            onSelectEntity={(entId) => {
              handleSelectEntityById(entId);
            }}
            onOpenTimeline={() => {
              setTrackedPrediction(null);
              setActiveTab('timeline');
            }}
          />
        )}
      </AppShell>
    </Suspense>
  );
}