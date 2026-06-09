import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  clearStoredAuthToken,
  getStoredAuthToken,
  saveStoredAuthToken,
} from '../services/authSession';
import type {
  AuthLoginPayload,
  AuthRegisterPayload,
  AuthUser,
} from '../types/auth';
import { authApi } from '../utils/apiClient';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  login: (payload: AuthLoginPayload) => Promise<AuthUser>;
  register: (payload: AuthRegisterPayload) => Promise<AuthUser>;
  logout: () => void;
  refreshCurrentUser: () => Promise<AuthUser | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  const refreshCurrentUser = useCallback(async () => {
    const token = getStoredAuthToken();
    if (!token) {
      setUser(null);
      setStatus('unauthenticated');
      return null;
    }

    setStatus('loading');
    try {
      const currentUser = await authApi.me();
      setUser(currentUser);
      setStatus('authenticated');
      return currentUser;
    } catch {
      clearStoredAuthToken();
      setUser(null);
      setStatus('unauthenticated');
      return null;
    }
  }, []);

  useEffect(() => {
    void refreshCurrentUser();
  }, [refreshCurrentUser]);

  const login = useCallback(async (payload: AuthLoginPayload) => {
    setStatus('loading');
    try {
      const token = await authApi.login(payload);
      saveStoredAuthToken(token);
      const currentUser = await authApi.me();
      setUser(currentUser);
      setStatus('authenticated');
      return currentUser;
    } catch (error) {
      clearStoredAuthToken();
      setUser(null);
      setStatus('unauthenticated');
      throw error;
    }
  }, []);

  const register = useCallback(
    async (payload: AuthRegisterPayload) => {
      await authApi.register(payload);
      return login({
        username_or_email: payload.username,
        password: payload.password,
      });
    },
    [login]
  );

  const logout = useCallback(() => {
    authApi.logout();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      isAuthenticated: status === 'authenticated' && user !== null,
      login,
      register,
      logout,
      refreshCurrentUser,
    }),
    [login, logout, refreshCurrentUser, register, status, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export function useOptionalAuth(): AuthContextValue | null {
  return useContext(AuthContext);
}
