import { createContext, useContext } from 'react';
import type {
  WritingAISettingsResponse,
  WritingAISettingsUpdate,
  ProviderModelsResponse,
  ProviderTestResponse,
  WritingAIModelDiscoveryRequest,
} from '../types/api';
import type { AppError } from '../types/domain';

/**
 * SettingsContext — cached AI (writing) settings. design.md §7.
 *
 * design.md §7: the SettingsContext caches AI config with a 5-min TTL, refreshed
 * on PUT. Consumers (AppLayout → CommandBar, dashboard stat bar, SettingsConsole)
 * read `settings` / `isLoading` and call `ensureSettings()` to lazily load on
 * first need; mutations (update/test) refresh the cache so every surface stays in
 * sync.
 */
export interface SettingsContextValue {
  settings: WritingAISettingsResponse | null;
  isLoading: boolean;
  error: AppError | null;
  /** Lazily load settings if not cached / stale (5-min TTL). Idempotent + dedupes in-flight fetches. */
  ensureSettings: () => void;
  /** Force-refresh from the server, ignoring cache. Returns the fresh settings. */
  refreshSettings: () => Promise<WritingAISettingsResponse>;
  /** PUT settings; updates the cache with the returned value. Returns fresh settings. */
  updateSettings: (data: WritingAISettingsUpdate) => Promise<WritingAISettingsResponse>;
  /** POST test; then refreshes the cache (test mutates last_test_* server-side). Returns the test result. */
  testConnection: () => Promise<ProviderTestResponse>;
  /** POST models (discovery). Does not touch the settings cache. Returns the result. */
  discoverModels: (data?: WritingAIModelDiscoveryRequest) => Promise<ProviderModelsResponse>;
}

export const SettingsContext = createContext<SettingsContextValue | undefined>(
  undefined
);

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

export default useSettings;
