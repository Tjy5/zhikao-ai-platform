import { useCallback, useEffect, useRef, useState } from 'react';
import { studyService } from '../services/studyService';
import { BASELINE_SECTIONS, SECTION_ORDER } from '../app/study/baseline';
import type { SectionKey } from '../types/api';

/**
 * useStudySections — API-first content source for the study read page, with a
 * packed-baseline fallback so the page is **never blank** (design.md §5).
 *
 * State machine (4-state, quality-guidelines):
 *  - `loading`  : first fetch in flight; page renders skeleton.
 *  - `ready`    : API responded; `sections` are API values (baseline fills any
 *                 key the response omitted, defensively — backend seeds all 9).
 *  - `fallback` : fetch failed OR response was empty; `sections` = the packed
 *                 baseline. The page still renders normally; edit / history /
 *                 review controls are HIDDEN (no API = no edits) and a small
 *                 mono "内容来自本地缓存" note is shown.
 *
 * `sections` is ALWAYS a fully-populated `Record<SectionKey, unknown>` — the
 * read page can render unconditionally off it regardless of phase. This is the
 * "never blank the page" guarantee.
 *
 * Retry: `reload()` bumps `reloadTick`, which re-fires the mount effect
 * (history-page `reloadTick` pattern).
 */
export type StudySectionsPhase = 'loading' | 'ready' | 'fallback';

export interface UseStudySectionsResult {
  phase: StudySectionsPhase;
  sections: Record<SectionKey, unknown>;
  /** Present only in fallback phase when the fetch failed (not empty). */
  error: string | null;
  reload: () => void;
}

export function useStudySections(): UseStudySectionsResult {
  const [phase, setPhase] = useState<StudySectionsPhase>('loading');
  // Always start from baseline so the first paint can render immediately if a
  // parent suspense boundary were to read `sections` before the effect resolves.
  const [sections, setSections] = useState<Record<SectionKey, unknown>>(
    BASELINE_SECTIONS
  );
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  // Stale-guard: ignore fetch results from a previous reload tick.
  const requestIdRef = useRef(0);

  const reload = useCallback(() => setReloadTick((t) => t + 1), []);

  useEffect(() => {
    const requestId = ++requestIdRef.current;

    let cancelled = false;
    void (async () => {
      // Clear any stale error from a prior fetch INSIDE the async body so the
      // eslint rule about synchronous setState in effect bodies doesn't fire.
      await Promise.resolve();
      setError(null);
      try {
        const response = await studyService.getSections();
        if (cancelled || requestId !== requestIdRef.current) return;

        const list = response?.sections;
        if (!Array.isArray(list) || list.length === 0) {
          // Empty (or malformed) response → baseline fallback, but NOT an error
          // (the API is reachable; it just has nothing yet).
          setSections(BASELINE_SECTIONS);
          setPhase('fallback');
          return;
        }

        // Merge: start from baseline, override with API sections present. This
        // keeps the page whole if the API ever omits a key, and makes API the
        // source of truth for present keys.
        const merged: Record<SectionKey, unknown> = { ...BASELINE_SECTIONS };
        for (const sec of list) {
          const key = sec?.section_key as SectionKey | undefined;
          if (key && (SECTION_ORDER as string[]).includes(key)) {
            merged[key] = sec.content_json;
          }
        }
        setSections(merged);
        setPhase('ready');
      } catch (err) {
        if (cancelled || requestId !== requestIdRef.current) return;
        // API failure → baseline fallback. The page keeps rendering; the user
        // just can't edit/review until the API is back. Do not surface the
        // error as a blocking alert — only the small mono note.
        setSections(BASELINE_SECTIONS);
        setError(err instanceof Error ? err.message : '无法连接服务器');
        setPhase('fallback');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reloadTick]);

  return { phase, sections, error, reload };
}

export default useStudySections;
