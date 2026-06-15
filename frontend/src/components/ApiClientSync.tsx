import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/apiClient';
import { useAuth } from '../hooks/useAuth';

/**
 * Bridge between the singleton `apiClient` (non-React) and the router/auth
 * contexts. On a 401, the apiClient invokes the handler registered here, which
 * clears auth state and navigates to `/login?from=<current-path>` — no
 * `window.location` hard jump (design.md §7/§8).
 *
 * Rendered inside <BrowserRouter> (for useNavigate) and under <AuthProvider>.
 */
const PUBLIC_PATHS = new Set(['/', '/login', '/register']);

export function ApiClientSync() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  useEffect(() => {
    apiClient.setUnauthorizedHandler(() => {
      const currentPath = window.location.pathname + window.location.search;
      logout();
      // Avoid redirect loops on public routes.
      const target = PUBLIC_PATHS.has(window.location.pathname)
        ? '/login'
        : `/login?from=${encodeURIComponent(currentPath)}`;
      navigate(target, { replace: true });
    });
    return () => {
      apiClient.setUnauthorizedHandler(null);
    };
  }, [navigate, logout]);

  return null;
}

export default ApiClientSync;
