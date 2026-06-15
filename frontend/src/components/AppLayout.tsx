import { useEffect, useMemo } from 'react';
import { Outlet } from 'react-router-dom';
import { CommandBar } from './CommandBar';
import { useSettings } from '../hooks/useSettings';

/**
 * Authenticated workspace shell. Renders the dark top CommandBar and the main
 * content region. design.md §5/§6 — all `/app/*` routes share this shell.
 *
 * Wires SettingsContext into the CommandBar so the AI-ready indicator + model
 * name reflect the live (cached) settings: green dot when a key is configured,
 * amber when not (design.md §7 / Phase 3 wiring completion).
 */
export function AppLayout() {
  const { settings, isLoading, ensureSettings } = useSettings();

  // Lazy-load settings on first workspace mount (5-min TTL inside the context
  // dedupes subsequent calls). This is the single load trigger shared by the
  // CommandBar and the dashboard stat bar.
  useEffect(() => {
    ensureSettings();
  }, [ensureSettings]);

  // AI is "ready" when a provider key is configured. The model_name defaults to
  // a server property even pre-config, so has_api_key is the decisive signal —
  // but we still require a model_name so a half-configured state (key but no
  // model) shows honestly as not-ready.
  const { aiReady, modelName } = useMemo(() => {
    const hasKey = !!settings?.has_api_key;
    const model = settings?.model_name;
    return {
      aiReady: hasKey && !!model,
      modelName: model || undefined,
    };
  }, [settings]);

  return (
    <div className="min-h-screen bg-paper">
      <CommandBar
        variant="app"
        // Pass the indicator once we have *any* settings response (ready or not),
        // so the dot shows the honest state. While the initial load is in flight
        // we leave it hidden to avoid a misleading "未配置" flash for users who
        // actually have a key.
        aiReady={isLoading && !settings ? undefined : aiReady}
        modelName={modelName}
      />
      <main id="main-content" className="max-w-[1100px] w-full mx-auto px-4 md:px-8 py-6 md:py-8">
        <Outlet />
      </main>
    </div>
  );
}

export default AppLayout;
