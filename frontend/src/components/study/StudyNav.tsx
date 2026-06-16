import { Link } from 'react-router-dom';
import { SECTION_LABELS, SECTION_ORDER } from '../../app/study/baseline';
import type { OutlinePoint } from '../../app/study/sectionOutline';
import type { SectionKey } from '../../types/api';

/**
 * StudyNav — the two-level in-page learning navigation rail for `/app/study`
 * (design.md §6). Lists the 9 modules in learning order; the active module
 * expands to its knowledge points so a learner can jump to a specific point
 * inside the module.
 *
 * Reused in two surfaces (no markup duplication):
 *  - desktop persistent rail (sticky under the CommandBar);
 *  - mobile slide-in drawer.
 *
 * Behavior:
 *  - Module nav = `<Link>` (real navigation — the URL changes to
 *    `/app/study/:sectionKey`, which drives the focused reader).
 *  - Point nav = `<button>` (in-page scroll only, no URL change — design.md §1
 *    decision 4: keep the route surface simple).
 *
 * Token discipline (quality-guidelines / design.md §11):
 *  - Labels are informational → `text-mute`, active → `text-ink`.
 *  - The mono ordinal is decorative (a real 1..9 sequence, not 01-02-03 eyebrow)
 *    → `text-faint` + `aria-hidden`.
 *  - Active accent = `mark` (vermilion) — reserved for nav/pin/accent; CTA
 *    color `oxblood` is NOT used here.
 *  - Visible focus comes from the global `:focus-visible` ring (globals.css).
 */
export interface StudyNavProps {
  /** Currently focused module key (drives the expanded point list). */
  active: SectionKey;
  /** Active knowledge-point index inside the active module (or null). */
  activePoint: number | null;
  /** Outline for the active module (its knowledge points). */
  points: OutlinePoint[];
  /** Called when the learner picks a knowledge point (scrolls to its anchor). */
  onSelectPoint: (index: number) => void;
}

export function StudyNav({
  active,
  activePoint,
  points,
  onSelectPoint,
}: StudyNavProps) {
  return (
    <nav aria-label="申论学习模块" className="text-[13px]">
      <ol className="space-y-0.5">
        {SECTION_ORDER.map((key, i) => {
          const isActive = key === active;
          const label = SECTION_LABELS[key];
          return (
            <li key={key}>
              <Link
                to={`/app/study/${key}`}
                aria-current={isActive ? 'page' : undefined}
                className={[
                  'group flex items-center gap-2.5 rounded-md px-3 py-2 transition-ui',
                  isActive
                    ? 'bg-panel text-ink'
                    : 'text-mute hover:bg-panel/60 hover:text-ink',
                ].join(' ')}
              >
                {/* Active left bar — mark (vermilion). Inactive: a faint slot
                    keeps the label column aligned so rows don't shift on
                    activation. */}
                <span
                  aria-hidden="true"
                  className={[
                    'w-[3px] h-4 rounded-full shrink-0 transition-ui',
                    isActive ? 'bg-mark' : 'bg-transparent',
                  ].join(' ')}
                />
                {/* Decorative real-sequence ordinal; aria-hidden so AT only
                    hears the label. */}
                <span
                  aria-hidden="true"
                  className="font-mono text-faint text-[11px] tabular-nums w-4 text-right shrink-0"
                >
                  {i + 1}
                </span>
                <span className="min-w-0 truncate">{label}</span>
              </Link>

              {isActive && points.length > 0 && (
                <ul
                  className="mt-1 ml-[22px] mb-2 space-y-0.5 border-l border-line pl-2"
                  aria-label={`${label} 知识点`}
                >
                  {points.map((p, pi) => {
                    const isPointActive = activePoint === pi;
                    return (
                      <li key={pi}>
                        <button
                          type="button"
                          onClick={() => onSelectPoint(pi)}
                          aria-current={isPointActive ? 'true' : undefined}
                          className={[
                            'flex w-full items-start gap-2 rounded-md px-2.5 py-1.5 text-left transition-ui',
                            isPointActive
                              ? 'text-ink'
                              : 'text-mute hover:text-ink hover:bg-panel/60',
                          ].join(' ')}
                        >
                          {/* Active point dot — mark; inactive slot keeps the
                              label column aligned. */}
                          <span
                            aria-hidden="true"
                            className={[
                              'mt-[7px] w-1.5 h-1.5 rounded-full shrink-0 transition-ui',
                              isPointActive ? 'bg-mark' : 'bg-faint',
                            ].join(' ')}
                          />
                          <span className="min-w-0 line-clamp-2 leading-snug">
                            {p.label}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default StudyNav;
