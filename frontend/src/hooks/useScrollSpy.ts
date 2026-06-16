import { useEffect, useState } from 'react';

/**
 * useScrollSpy — returns the index of the topmost-visible entry among `ids`, or
 * `null`. Built for the `/app/study` focused reader: observe the active module's
 * knowledge-point anchors and highlight the one currently sitting under the sticky
 * CommandBar.
 *
 * - root: viewport; `rootMargin` biases detection to the band just below the top
 *   bar so the "active" point is the one the reader is actually looking at, not
 *   any point merely visible lower on the page.
 * - resilient: missing elements are skipped; empty `ids` or `enabled=false` → null.
 * - the observer is rebuilt when `ids` changes (i.e. when the active module or its
 *   content changes); cleaned up on unmount.
 *
 * Caller contract: pass a STABLE `ids` reference (memoized) or the observer
 * needlessly rebuilds every render.
 *
 * Lint note: `react-hooks/set-state-in-effect` forbids a synchronous `setState`
 * inside an effect body. This hook keeps the observer callback (an external
 * system update) as the ONLY place it calls `setActive`. Empty / disabled / out-
 * of-range conditions are resolved as a derived return value at the bottom, so no
 * synchronous setState is ever needed to "reset" — the stored `active` simply
 * becomes invisible while inputs are invalid, and is naturally stale-safe because
 * the observer re-establishes the truth on its first callback.
 */
export function useScrollSpy(ids: string[], enabled: boolean): number | null {
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled || ids.length === 0) return;

    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    if (elements.length === 0) return;

    const visible = new Map<number, IntersectionObserverEntry>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const idx = elements.indexOf(entry.target as HTMLElement);
          if (idx === -1) continue;
          if (entry.isIntersecting) visible.set(idx, entry);
          else visible.delete(idx);
        }
        if (visible.size === 0) return;
        // Active = the smallest index currently in the detection band (topmost).
        const top = Math.min(...visible.keys());
        setActive((prev) => (prev === top ? prev : top));
      },
      {
        root: null,
        // Top ~30% of the viewport counts as the "active" band; tune with the
        // real CommandBar height (implement.md step 7) if needed.
        rootMargin: '0px 0px -70% 0px',
        threshold: 0,
      }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [ids, enabled]);

  // Derived: while the spy is disabled / empty, or the stored index no longer
  // maps to the current `ids`, surface null. This replaces the lint-forbidden
  // "reset state in an effect" pattern with a pure projection of `active`.
  if (!enabled || ids.length === 0) return null;
  if (active !== null && active >= ids.length) return null;
  return active;
}
