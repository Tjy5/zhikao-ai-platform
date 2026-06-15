import { createContext, useContext } from 'react';
import type { UserResponse } from '../types/api';

export interface AuthState {
  user: UserResponse | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface AuthContextValue extends AuthState {
  login: (usernameOrEmail: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (username: string, email: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  /**
   * Client-side admin gate: derived from `user.role === 'admin'`. Used to
   * conditionally render admin affordances (study edit / review queue / revert).
   * The backend `@PreAuthorize('hasRole("ADMIN")')` is the authoritative guard
   * — this flag only controls what UI the user *sees*, never what they can do.
   */
  isAdmin: boolean;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default useAuth;
