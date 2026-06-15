import { useCallback, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import settingsService from '../services/settingsService';
import { SettingsContext } from '../hooks/useSettings';
import type { SettingsContextValue } from '../hooks/useSettings';
import type {
  WritingAISettingsResponse,
  WritingAISettingsUpdate,
  ProviderModelsResponse,
  ProviderTestResponse,
  WritingAIModelDiscoveryRequest,
} from '../types/api';
import { AppError, ErrorType } from '../types/domain';

interface SettingsProviderProps {
  children: ReactNode;
}

/** Cache TTL — design.md §7 says 5 minutes. */
const SETTINGS_TTL_MS = 5 * 60 * 1000;

/**
 * SettingsProvider — caches AI (writing) settings with a 5-min TTL.
 *
 * design.md §7: GET settings on first need, cache, refresh on PUT. A consumer
 * (AppLayout / dashboard / SettingsConsole) calls `ensureSettings()` once on
 * mount; it is idempotent and dedupes concurrent in-flight fetches via
 * `inFlightRef`. After `updateSettings` (PUT) or `testConnection` (POST test,
 * which mutates `last_test_*` server-side) the cache is refreshed so every
 * surface (CommandBar readiness dot, dashboard stat bar, settings status block)
 * stays consistent.
 *
 * The provider is mounted high in the tree (inside <BrowserRouter>, under
 * <AuthProvider>) so all `/app/*` routes share one source of truth. Public
 * routes never call `ensureSettings()`, so an unauthenticated user does not
 * trigger a 401 round-trip here.
 */
export function SettingsProvider({ children }: SettingsProviderProps) {
  const [settings, setSettings] = useState<WritingAISettingsResponse | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  const fetchedAtRef = useRef<number | null>(null);
  // Dedupe concurrent ensureSettings() calls: while a fetch is in flight,
  // additional ensureSettings() calls are no-ops.
  const inFlightRef = useRef<Promise<WritingAISettingsResponse> | null>(null);

  const isFresh = useCallback(() => {
    return (
      fetchedAtRef.current !== null &&
      Date.now() - fetchedAtRef.current < SETTINGS_TTL_MS
    );
  }, []);

  /**
   * Core fetch. Dedupes in-flight requests by storing the promise in a ref so
   * two consumers mounting simultaneously share one network call.
   */
  const doFetch = useCallback(async (): Promise<WritingAISettingsResponse> => {
    if (inFlightRef.current) {
      return inFlightRef.current;
    }
    const promise = (async () => {
      setIsLoading(true);
      try {
        const next = await settingsService.getSettings();
        setSettings(next);
        setError(null);
        fetchedAtRef.current = Date.now();
        return next;
      } catch (err) {
        const appError =
          err instanceof AppError
            ? err
            : new AppError(ErrorType.UNKNOWN, '加载 AI 配置失败', {
                originalError: err,
              });
        setError(appError);
        throw appError;
      } finally {
        setIsLoading(false);
        inFlightRef.current = null;
      }
    })();
    inFlightRef.current = promise;
    return promise;
  }, []);

  /**
   * Lazily load settings if the cache is empty or stale. Idempotent. Intended
   * for `useEffect` mounts in CommandBar / dashboard / SettingsConsole. Errors
   * are captured into `error` state (not re-thrown) so a transient load failure
   * does not crash consumers that only want to read cached state.
   */
  const ensureSettings = useCallback(() => {
    if (settings !== null && isFresh()) return;
    if (inFlightRef.current) return;
    void doFetch().catch(() => {
      // Already captured into `error` state; swallow the rejection so the
      // fire-and-forget caller (useEffect) doesn't log an unhandled rejection.
    });
  }, [settings, isFresh, doFetch]);

  /** Force-refresh from the server, ignoring cache. */
  const refreshSettings = useCallback(async (): Promise<WritingAISettingsResponse> => {
    return doFetch();
  }, [doFetch]);

  /**
   * PUT settings; replace cache with the returned value (fresh TTL). We do NOT
   * call `doFetch` here because the PUT response already is the authoritative
   * new state — a second GET would race and possibly show stale data.
   */
  const updateSettings = useCallback(
    async (
      data: WritingAISettingsUpdate
    ): Promise<WritingAISettingsResponse> => {
      const updated = await settingsService.updateSettings(data);
      setSettings(updated);
      setError(null);
      fetchedAtRef.current = Date.now();
      return updated;
    },
    []
  );

  /**
   * POST test; then refresh the cache so `last_test_*` reflects the new run.
   * Returns the raw test result so the caller can show success/failure detail
   * (including `last_failure_classification`) without an extra GET.
   */
  const testConnection = useCallback(async (): Promise<ProviderTestResponse> => {
    const result = await settingsService.testConnection();
    // The test endpoint mutates `last_test_status` / `last_tested_at` /
    // `last_failure_classification` server-side. Refresh so the status block and
    // CommandBar readiness reflect it. `refreshSettings` may reject (e.g. 401
    // during the race); we surface the test result regardless.
    try {
      await doFetch();
    } catch {
      // Swallow — the test result itself is the caller's primary signal; the
      // cache refresh is best-effort.
    }
    return result;
  }, [doFetch]);

  /** POST models (discovery). Does not affect the settings cache. */
  const discoverModels = useCallback(
    async (
      data?: WritingAIModelDiscoveryRequest
    ): Promise<ProviderModelsResponse> => {
      return settingsService.discoverModels(data);
    },
    []
  );

  const value: SettingsContextValue = {
    settings,
    isLoading,
    error,
    ensureSettings,
    refreshSettings,
    updateSettings,
    testConnection,
    discoverModels,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export default SettingsProvider;
