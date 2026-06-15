import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface RequireAdminProps {
  children: ReactNode;
}

/**
 * Guards `/admin/*` routes after RequireAuth has verified the session.
 * Backend RBAC remains authoritative; this guard only protects the client shell.
 */
export function RequireAdmin({ children }: RequireAdminProps) {
  const { isAdmin, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-paper"
        role="status"
        aria-live="polite"
      >
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-solid border-line border-t-mark" />
          <p className="mt-3 text-[13px] text-mute">正在验证管理员权限…</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
}

export default RequireAdmin;
