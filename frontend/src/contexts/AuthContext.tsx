import { useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import authService from '../services/authService';
import { AuthContext } from '../hooks/useAuth';
import type { AuthContextValue, AuthState } from '../hooks/useAuth';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>(() => {
    // Lazily compute the initial auth state. If there is no stored token we
    // can short-circuit to "not loading" without a synchronous setState in the
    // mount effect (avoids react-hooks/set-state-in-effect). When a token is
    // present we keep isLoading=true until the mount effect verifies it.
    const token = localStorage.getItem('token');
    return {
      user: null,
      token,
      isAuthenticated: false,
      isLoading: !!token,
    };
  });

  const login = useCallback(async (usernameOrEmail: string, password: string, rememberMe: boolean = true) => {
    const response = await authService.login({
      username_or_email: usernameOrEmail,
      password,
    });

    // Store token
    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem('token', response.access_token);
    localStorage.setItem('token', response.access_token); // Always use localStorage for now

    // Fetch user info
    const user = await authService.me();

    setState({
      user,
      token: response.access_token,
      isAuthenticated: true,
      isLoading: false,
    });
  }, []);

  const register = useCallback(async (username: string, email: string, password: string) => {
    // Register returns user, but we need to login to get token
    await authService.register({
      username,
      email,
      password,
    });

    // Auto-login after successful registration
    await login(email, password);
  }, [login]);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });
  }, []);

  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      // Initial state already reflects "no token, not loading"; nothing to do.
      return;
    }

    try {
      const user = await authService.me();
      setState({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch {
      // Token invalid or expired
      localStorage.removeItem('token');
      setState({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  }, []);

  // Check auth on mount. The async verify logic is inlined directly in the
  // effect body so the linter can see every setState happens after an `await`
  // (asynchronous), not synchronously during the effect run.
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      // Initial state already reflects "no token, not loading"; nothing to do.
      return;
    }

    let isMounted = true;
    void (async () => {
      try {
        const user = await authService.me();
        if (!isMounted) return;
        setState({
          user,
          token,
          isAuthenticated: true,
          isLoading: false,
        });
      } catch {
        if (!isMounted) return;
        // Token invalid or expired
        localStorage.removeItem('token');
        setState({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const value: AuthContextValue = {
    ...state,
    login,
    register,
    logout,
    checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
