import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

/**
 * CommandBar — 成公 dark top command bar. design.md §5 / §10.3.
 *
 * Two variants:
 *  - `app`:    inline nav (概览 / 申论写作台 / 批改历史 / AI 配置 — NO 进步轨迹),
 *              AI-ready indicator (when `aiReady`/`modelName` provided), user
 *              avatar, and the 新建批改 oxblood CTA. Mobile collapses to a
 *              hamburger disclosure.
 *  - `public`: wordmark + 登录 link + 免费开始 oxblood CTA (no nav / avatar).
 *
 * The wordmark tile 「成」 is pure-sans bold on a vermilion (mark) tile — never
 * serif. Navigation lives in the top bar; there is no left sidebar.
 */
interface CommandBarProps {
  variant?: 'app' | 'public';
  /** When true, shows the green AI-ready dot. Phase 3/6 wires this from settings. */
  aiReady?: boolean;
  /** Model id shown next to the ready dot (mono). */
  modelName?: string;
}

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
}

const APP_NAV: NavItem[] = [
  { to: '/app', label: '概览', end: true },
  { to: '/app/writing', label: '申论写作台' },
  { to: '/app/history', label: '批改历史' },
  { to: '/app/settings', label: 'AI 配置' },
];

const NAV_BASE =
  'px-2.5 py-1.5 rounded-md text-[13px] transition-ui';
const NAV_INACTIVE = 'text-shell-mute hover:bg-shell-2 hover:text-white';
const NAV_ACTIVE = 'bg-shell-2 text-white font-medium';

function Wordmark() {
  return (
    <Link
      to="/"
      className="flex items-center gap-2 shrink-0"
      aria-label="成公 首页"
    >
      <span className="grid place-items-center w-8 h-8 rounded-md bg-mark text-white font-bold text-[15px] tracking-tight">
        成
      </span>
      <span className="font-semibold text-[17px] tracking-tight text-shell-txt">
        成公
      </span>
    </Link>
  );
}

export function CommandBar({
  variant = 'app',
  aiReady,
  modelName,
}: CommandBarProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const avatarInitial = user?.username?.[0] ?? null;

  if (variant === 'public') {
    return (
      <header className="bg-shell text-shell-txt sticky top-0 z-20 border-b border-shell-line">
        <div className="max-w-[1180px] mx-auto h-14 flex items-center gap-3 px-4 md:px-6">
          <Wordmark />
          <div className="ml-auto flex items-center gap-2">
            <Link
              to="/login"
              className={`${NAV_BASE} ${NAV_INACTIVE} text-shell-txt/90 hover:text-white`}
            >
              登录
            </Link>
            <Link
              to="/register"
              className="inline-flex items-center gap-1.5 text-[13px] font-medium bg-oxblood text-white px-3 py-1.5 rounded-md hover:bg-oxblood-ink transition-ui"
            >
              免费开始
            </Link>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="bg-shell text-shell-txt sticky top-0 z-20 border-b border-shell-line">
      <div className="max-w-[1180px] mx-auto h-14 flex items-center gap-3 px-4 md:px-6">
        <Wordmark />

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 ml-3" aria-label="主导航">
          {APP_NAV.map((item) => (
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

        <div className="ml-auto flex items-center gap-3">
          {/* AI readiness (opt-in; wired by Phase 3/6 settings context) */}
          {typeof aiReady === 'boolean' && (
            <div className="hidden lg:flex items-center gap-2 text-[12px]">
              <span
                className={`w-2 h-2 rounded-full ${aiReady ? 'bg-ok' : 'bg-warn'}`}
                aria-hidden="true"
              />
              <span className="text-shell-mute">
                {aiReady ? 'AI 已就绪' : 'AI 未配置'}
                {modelName ? ` · ${modelName}` : ''}
              </span>
            </div>
          )}

          {avatarInitial && (
            <Link
              to="/app/settings"
              aria-label={user?.username ? `账户：${user.username}` : '账户'}
              className="hidden sm:grid place-items-center w-7 h-7 rounded-full bg-mark text-white text-[12px] font-semibold"
            >
              {avatarInitial}
            </Link>
          )}

          <button
            type="button"
            onClick={() => navigate('/app/writing')}
            className="hidden sm:inline-flex items-center gap-1.5 text-[13px] font-medium bg-oxblood text-white px-3 py-1.5 rounded-md hover:bg-oxblood-ink transition-ui"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            新建批改
          </button>

          {/* Mobile hamburger */}
          <button
            type="button"
            className="md:hidden grid place-items-center w-9 h-9 rounded-md hover:bg-shell-2 transition-ui"
            aria-label={mobileOpen ? '关闭菜单' : '打开菜单'}
            aria-expanded={mobileOpen}
            aria-controls="commandbar-mobile-nav"
            onClick={() => setMobileOpen((open) => !open)}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
              {mobileOpen ? (
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              ) : (
                <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile nav disclosure */}
      {mobileOpen && (
        <nav
          id="commandbar-mobile-nav"
          className="md:hidden border-t border-shell-line bg-shell"
          aria-label="移动端导航"
        >
          <div className="max-w-[1180px] mx-auto px-4 py-2 flex flex-col gap-1">
            {APP_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `${NAV_BASE} ${isActive ? NAV_ACTIVE : NAV_INACTIVE} block`
                }
              >
                {item.label}
              </NavLink>
            ))}
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                navigate('/app/writing');
              }}
              className="mt-1 inline-flex items-center justify-center gap-1.5 text-[13px] font-medium bg-oxblood text-white px-3 py-2 rounded-md hover:bg-oxblood-ink transition-ui"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
              新建批改
            </button>
          </div>
        </nav>
      )}
    </header>
  );
}

export default CommandBar;
