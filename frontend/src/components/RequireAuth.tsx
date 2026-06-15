import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface RequireAuthProps {
  children: ReactNode;
}

/**
 * Guards protected `/app/*` routes. design.md §6.
 *
 * - Loading (verifying token): centered spinner.
 * - Unauthenticated: redirect to `/login?from=<current-path>` so login can
 *   return the user here. Mechanism matches `ApiClientSync` (401 handler).
 * - Authenticated: render children (the AppLayout shell).
 */
export function RequireAuth({ children }: RequireAuthProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-paper"
        role="status"
        aria-live="polite"
      >
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-solid border-line border-t-mark" />
          <p className="mt-3 text-[13px] text-mute">正在验证登录状态…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    const fromPath = location.pathname + location.search;
    return (
      <Navigate to={`/login?from=${encodeURIComponent(fromPath)}`} replace />
    );
  }

  return <>{children}</>;
}

export default RequireAuth;
