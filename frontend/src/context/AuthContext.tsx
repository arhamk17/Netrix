import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User, Case } from '../types';
import { api, setAuthToken, clearAuthToken } from '../services/api';

interface ServiceStatus {
  backend: 'ONLINE' | 'OFFLINE';
  neo4j: 'CONNECTED' | 'DISCONNECTED';
  blockchain: 'SYNCED' | 'STANDBY';
  celery: 'IDLE' | 'PROCESSING';
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  currentCaseId: string;
  setCurrentCaseId: (id: string) => void;
  cases: Case[];
  activeCase: Case | undefined;
  serviceStatus: ServiceStatus;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshCases: () => Promise<void>;
  aiConsoleOpen: boolean;
  setAiConsoleOpen: (open: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('netrix_user');
      if (!saved || saved === 'undefined' || saved === 'null') {
        return null;
      }
      return JSON.parse(saved);
    } catch (e) {
      console.warn('[NETRIX Auth] Failed to parse saved user from storage:', e);
      try {
        localStorage.removeItem('netrix_user');
      } catch {}
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [cases, setCases] = useState<Case[]>([]);
  const [currentCaseId, setCurrentCaseId] = useState<string>('');
  const [aiConsoleOpen, setAiConsoleOpen] = useState<boolean>(false);
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus>({
    backend: 'ONLINE',
    neo4j: 'CONNECTED',
    blockchain: 'SYNCED',
    celery: 'IDLE'
  });

  const refreshCases = useCallback(async () => {
    try {
      const data = await api.getCases();
      setCases(data);
      if (data.length > 0) {
        if (!currentCaseId || !data.some(c => c.id === currentCaseId || c.case_id === currentCaseId)) {
          setCurrentCaseId(data[0].id || data[0].case_id || '');
        }
      }
    } catch (err) {
      console.error('Failed to load cases:', err);
    }
  }, [currentCaseId]);

  const logout = useCallback(() => {
    // 1. Clear tokens and cached user/session items from storage
    clearAuthToken();
    try {
      localStorage.removeItem('netrix_access_token');
      localStorage.removeItem('netrix_user');
      localStorage.removeItem('netrix_search_history');
      localStorage.removeItem('netrix_recent_searches');
      sessionStorage.clear();
    } catch (e) {
      console.warn('[NETRIX Auth] Failed to clear browser storage:', e);
    }

    // 2. Clear all in-memory context state
    setUser(null);
    setCases([]);
    setCurrentCaseId('');
    setAiConsoleOpen(false);

    // 3. Broadcast logout event for all active subscribers and components
    try {
      window.dispatchEvent(new CustomEvent('netrix:logout'));
      window.dispatchEvent(new Event('storage'));
    } catch {}
  }, []);

  // Check auth on mount
  useEffect(() => {
    async function initAuth() {
      try {
        const token = localStorage.getItem('netrix_access_token');
        if (token && token !== 'undefined' && token !== 'null') {
          try {
            const currentUser = await api.getCurrentUser();
            if (currentUser && currentUser.id) {
              setUser(currentUser);
              localStorage.setItem('netrix_user', JSON.stringify(currentUser));
              await refreshCases();
            } else {
              clearAuthToken();
              setUser(null);
            }
          } catch {
            clearAuthToken();
            setUser(null);
          }
        } else {
          // If no token, user is unauthenticated
          setUser(null);
        }
      } catch (err) {
        console.warn('[NETRIX Auth] Storage initialization error:', err);
      } finally {
        setIsLoading(false);
      }
    }

    initAuth();

    // Listen for unauthorized 401 events
    const handleUnauthorized = () => {
      logout();
    };
    window.addEventListener('netrix:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('netrix:unauthorized', handleUnauthorized);
  }, [refreshCases, logout]);

  const login = async (username: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await api.login(username, password);
      if (res && res.access_token) {
        setAuthToken(res.access_token);
        if (res.user) {
          setUser(res.user);
          localStorage.setItem('netrix_user', JSON.stringify(res.user));
        }
        await refreshCases();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const activeCase = cases.find(c => (c.id === currentCaseId) || (c.case_id === currentCaseId)) || cases[0];

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        currentCaseId,
        setCurrentCaseId,
        cases,
        activeCase,
        serviceStatus,
        login,
        logout,
        refreshCases,
        aiConsoleOpen,
        setAiConsoleOpen
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
