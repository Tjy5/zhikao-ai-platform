import { createContext } from 'react';

/**
 * SectionAnchorContext — opt-in anchor-id plumbing for `SectionView`.
 *
 * The context carries an optional `pointId(i)` resolver. `SectionView` provides
 * it ONLY when the caller passes `anchorIdPrefix`; each body renderer reads it
 * and, when present, sets `id={pointId(i)}` on its top-level item element.
 *
 * Snapshot-safety (design.md §5): when no prefix is passed (every snapshot call
 * site — `RevisionHistory`, `AdminReviewQueue`, admin section page) `pointId`
 * is `undefined` → no ids rendered → no duplicate-id risk even when multiple
 * revisions of one section render side by side.
 *
 * Lives in its own module (not inside SectionView.tsx) because the
 * `react-refresh/only-export-components` rule forbids exporting a React context
 * from a file that also exports components — fast-refresh needs component-only
 * modules.
 */

export interface SectionAnchorContextValue {
  pointId?: (index: number) => string;
}

export const SectionAnchorContext = createContext<SectionAnchorContextValue>({
  pointId: undefined,
});
