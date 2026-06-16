import type { SectionKey } from '../../types/api';

/**
 * sectionOutline — derive a flat, ordered list of knowledge points for one study
 * section off its `content_json`, so the `/app/study` rail can render a two-level
 * outline with no backend change. This mirrors exactly what `SectionView`'s body
 * renderers iterate, so the rail labels and the rendered items never drift.
 *
 * Index alignment is load-bearing: the i-th outline point MUST correspond to the
 * i-th anchored item SectionView renders, because both share `pointIdFor(prefix, i)`.
 * Therefore each branch emits exactly one point per item SectionView iterates
 * (raw array for `study-route` steps; `isRecord`-filtered for the rest), using a
 * `（未命名）` fallback rather than dropping items so indices never shift.
 *
 * `content` is `unknown` (API-sourced); every branch narrows defensively and a
 * malformed shape simply yields `[]` (the rail then shows only the module row).
 */

export interface OutlinePoint {
  label: string;
}

// ---- runtime narrowing (deliberately tiny; mirror SectionView's guards) ----

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}
function str(x: unknown): string | undefined {
  return typeof x === 'string' ? x : undefined;
}
function asRecords(x: unknown): Record<string, unknown>[] {
  return Array.isArray(x) ? (x.filter(isRecord) as Record<string, unknown>[]) : [];
}

export function sectionOutline(key: SectionKey, content: unknown): OutlinePoint[] {
  switch (key) {
    // study-route: StudyRouteBody iterates the RAW steps array (StepGrid over
    // unfiltered steps), so mirror that — index over the raw array, not filtered.
    case 'study-route': {
      if (!isRecord(content)) return [];
      const steps = Array.isArray(content.steps) ? content.steps : [];
      return steps.map((s) => ({
        label: (isRecord(s) && str(s.label)) || '（未命名）',
      }));
    }
    // Five array sections whose item label lives on `.title`; their bodies all
    // `.filter(isRecord)` then index, so `asRecords` matches.
    case 'exam-scan':
    case 'material-moves':
    case 'review-rules':
    case 'essay-rules':
    case 'question-guides':
      return asRecords(content).map((r) => ({ label: str(r.title) || '（未命名）' }));
    case 'format-matrix':
      return asRecords(content).map((r) => ({ label: str(r.genre) || '（未命名）' }));
    case 'pitfalls':
      // `issue` is a long sentence; prefix a stable short ordinal so the rail row
      // stays scannable even after CSS clamps the sentence tail.
      return asRecords(content).map((p, i) => ({
        label: str(p.issue) ? `误区 ${i + 1}：${str(p.issue)}` : `误区 ${i + 1}`,
      }));
    case 'training-plan': {
      if (!isRecord(content)) return [];
      // weeks only (the review block is read as part of the module, not a nav point).
      return asRecords(content.weeks).map((w) => ({
        label: str(w.title) || '（未命名）',
      }));
    }
    default:
      return [];
  }
}

/**
 * Stable anchor id for the i-th knowledge point of a section rendered with
 * `anchorIdPrefix`. `SectionView` renders exactly this id when the same prefix is
 * passed (SectionAnchorContext → `pointId`); the rail computes the same id to
 * scroll-spy / jump-to. Snapshots never pass a prefix, so they never render these
 * ids (keeping snapshot markup id-unique even when multiple revisions render).
 */
export function pointIdFor(prefix: string, i: number): string {
  return `${prefix}-pt-${i}`;
}
