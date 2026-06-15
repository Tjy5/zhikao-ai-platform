import { Outlet } from 'react-router-dom';
import { CommandBar } from './CommandBar';

/**
 * Authenticated workspace shell. Renders the dark top CommandBar and the main
 * content region. design.md §5/§6 — all `/app/*` routes share this shell.
 *
 * `aiReady` / `modelName` are not wired here yet; Phase 3/6 will pass them from
 * the SettingsContext so the CommandBar readiness indicator reflects live state.
 */
export function AppLayout() {
  return (
    <div className="min-h-screen bg-paper">
      <CommandBar variant="app" />
      <main id="main-content" className="max-w-[1100px] w-full mx-auto px-4 md:px-8 py-6 md:py-8">
        <Outlet />
      </main>
    </div>
  );
}

export default AppLayout;
