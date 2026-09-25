import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, UserRole } from '../types';
import { apiClient, getAuthToken, setAuthToken, clearAuthToken } from '../api/client';

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  role: UserRole | '';
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  user: null,
  token: null,
  role: '',
  isLoading: true,
  login: () => {},
  logout: () => {},
  refreshUser: async () => {}
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setTokenState] = useState<string | null>(() => getAuthToken());
  const [user, setUser] = useState<User | null>(() => {
    try {
      const savedUser = typeof window !== 'undefined' ? localStorage.getItem('netrix_user') : null;
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = useCallback(async () => {
    const currentToken = getAuthToken();
    if (!currentToken) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    try {
      const me = await apiClient.auth.getCurrentUser();
      setUser(me);
    } catch (err) {
      console.warn('[NETRIX AUTH] Session verification failed, logging out:', err);
      clearAuthToken();
      setTokenState(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();

    // Listen for unauthorized 401 event dispatched by API client
    const handleUnauthorized = () => {
      clearAuthToken();
      setTokenState(null);
      setUser(null);
    };

    window.addEventListener('netrix:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('netrix:unauthorized', handleUnauthorized);
  }, [refreshUser]);

  const login = (newToken: string, newUser: User) => {
    setAuthToken(newToken);
    setTokenState(newToken);
    setUser(newUser);
  };

  const logout = () => {
    apiClient.auth.logout();
    clearAuthToken();
    setTokenState(null);
    setUser(null);
  };

  const isAuthenticated = Boolean(token && user);
  const role = (user?.role || '') as UserRole | '';

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        token,
        role,
        isLoading,
        login,
        logout,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
