import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface AdminNavItem {
  to: string;
  label: string;
  end?: boolean;
}

const ADMIN_NAV: AdminNavItem[] = [
  { to: '/admin', label: '概览', end: true },
  { to: '/admin/study', label: '内容治理' },
  { to: '/admin/study/reviews', label: '审核队列' },
  { to: '/admin/users', label: '用户管理' },
  { to: '/admin/settings', label: '系统设置' },
];

const NAV_BASE =
  'block rounded-md px-3 py-2 text-[13px] transition-ui';
const NAV_INACTIVE = 'text-mute hover:bg-panel hover:text-ink';
const NAV_ACTIVE = 'bg-mark-soft text-mark font-medium';

export function AdminLayout() {
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur-sm">
        <div className="max-w-[1280px] mx-auto h-14 px-4 md:px-6 flex items-center gap-3">
          <Link
            to="/admin"
            className="flex items-center gap-2 shrink-0"
            aria-label="成公管理后台"
          >
            <span className="grid place-items-center w-8 h-8 rounded-md bg-mark text-white font-bold text-[14px]">
              管
            </span>
            <span className="font-semibold text-[16px] text-ink">
              成公管理
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <Link
              to="/app"
              className="hidden sm:inline-flex items-center text-[13px] text-mute hover:text-ink px-2.5 py-1.5 rounded-md hover:bg-panel transition-ui"
            >
              返回学习工作台
            </Link>
            {user?.username && (
              <span className="hidden md:inline-flex text-[12px] text-mute">
                {user.username}
              </span>
            )}
            <button
              type="button"
              className="md:hidden grid place-items-center w-9 h-9 rounded-md text-ink hover:bg-panel transition-ui"
              aria-label={mobileOpen ? '关闭管理导航' : '打开管理导航'}
              aria-expanded={mobileOpen}
              aria-controls="admin-mobile-nav"
              onClick={() => setMobileOpen((open) => !open)}
            >
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                aria-hidden="true"
              >
                {mobileOpen ? (
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                ) : (
                  <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {mobileOpen && (
          <nav
            id="admin-mobile-nav"
            className="md:hidden border-t border-line bg-paper"
            aria-label="管理端导航"
          >
            <div className="px-4 py-2 flex flex-col gap-1">
              {ADMIN_NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `${NAV_BASE} ${isActive ? NAV_ACTIVE : NAV_INACTIVE}`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
              <Link
                to="/app"
                onClick={() => setMobileOpen(false)}
                className={`${NAV_BASE} ${NAV_INACTIVE}`}
              >
                返回学习工作台
              </Link>
            </div>
          </nav>
        )}
      </header>

      <div className="max-w-[1280px] mx-auto px-4 md:px-6 py-5 md:py-7 md:grid md:grid-cols-[220px_minmax(0,1fr)] md:gap-7">
        <aside className="hidden md:block">
          <nav
            className="sticky top-[78px] rounded-lg border border-line bg-paper p-2"
            aria-label="管理端导航"
          >
            {ADMIN_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `${NAV_BASE} ${isActive ? NAV_ACTIVE : NAV_INACTIVE}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main id="main-content" className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;
