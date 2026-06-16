import { useContext } from 'react';
import type { ReactNode } from 'react';
import { Pin } from '../ui/Pin';
import { SECTION_META } from '../../app/study/baseline';
import { pointIdFor } from '../../app/study/sectionOutline';
import {
  SectionAnchorContext,
  type SectionAnchorContextValue,
} from './SectionAnchorContext';
import type {
  KnowledgeCard,
  ReviewRule,
  QuestionGuide,
  FormatRow,
  EssayRule,
  Pitfall,
  TrainingWeek,
  TrainingPlanContent,
} from '../../app/study/baseline';
import type { SectionKey } from '../../types/api';

/**
 * SectionView — the reusable read renderer for one study section. Dispatches by
 * `section_key` to the same body markup child-1 shipped (byte-identical tokens
 * + §12 layout), but reads from the `content` prop instead of a module
 * constant. Used by:
 *  - `app/study/page.tsx` for the live read page (API or baseline content);
 *  - `RevisionHistory` / `AdminReviewQueue` to render a read-only snapshot.
 *
 * `actions` is an optional slot rendered top-right of the section head
 * (edit / history buttons on the live page; empty for snapshots).
 *
 * `anchorIdPrefix` — when set, every body item renders a stable `id` on its
 * top-level element via `pointIdFor(prefix, i)`, so the `/app/study` rail +
 * scroll-spy can target it. **Snapshots MUST NOT pass this prop** (they pass
 * none) — without a prefix the ids are suppressed, keeping snapshot markup
 * id-unique even when multiple revisions of one section render side by side
 * (see design.md §5 — this is the load-bearing snapshot-safety decision).
 *
 * Robustness: unknown / malformed `content` falls back to a read-only JSON
 * block (design.md §5) — never throws.
 */

// ----------------------------------------------------------------------------
// Inline SVG icons — design.md §2 (no icon library). currentColor, aria-hidden.
// ----------------------------------------------------------------------------

function CheckOk({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      aria-hidden="true"
    >
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AlertMark({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path
        d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ----------------------------------------------------------------------------
// Local display helpers — ported verbatim from child-1 page.tsx.
// ----------------------------------------------------------------------------

function SecLabel({
  children,
  tone = 'oxblood',
}: {
  children: ReactNode;
  tone?: 'oxblood' | 'ok' | 'mark' | 'mute';
}) {
  const toneClass = {
    oxblood: 'text-oxblood',
    ok: 'text-ok',
    mark: 'text-mark',
    mute: 'text-mute',
  }[tone];
  return (
    <div className={`text-[11px] font-semibold tracking-[0.02em] ${toneClass}`}>
      {children}
    </div>
  );
}

/**
 * Divider grid — gap-px on a bg-line grid draws 1px dividers between cells
 * (design.md §12 — only for REAL sequences, never visually-similar cards).
 *
 * `idFor` — when supplied, each cell `<div>` gets `id={idFor(i)}` so the
 * `/app/study` rail / scroll-spy can target the i-th knowledge point. The live
 * page passes it (via `SectionAnchorContext`); snapshots do not, so no ids are
 * ever rendered there.
 */
function StepGrid<T>({
  items,
  cols = 'md:grid-cols-2 lg:grid-cols-4',
  render,
  idFor,
}: {
  items: readonly T[];
  cols?: string;
  render: (item: T, index: number) => ReactNode;
  idFor?: (index: number) => string;
}) {
  return (
    <div
      className={`grid grid-cols-1 ${cols} gap-px bg-line rounded-xl overflow-hidden border border-line`}
    >
      {items.map((item, i) => (
        <div key={i} id={idFor?.(i)} className="bg-paper p-5">
          {render(item, i)}
        </div>
      ))}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Runtime narrowing helpers — content is `unknown` from the API.
// ----------------------------------------------------------------------------

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}
function isStringArray(x: unknown): x is string[] {
  return Array.isArray(x) && x.every((v) => typeof v === 'string');
}
function asStringArray(x: unknown): string[] {
  return isStringArray(x) ? x : [];
}

/** Read-only JSON fallback for malformed / unknown content shapes. */
function JsonFallback({ content }: { content: unknown }) {
  let pretty: string;
  try {
    pretty =
      content === undefined
        ? '（无内容）'
        : JSON.stringify(content, null, 2);
  } catch {
    pretty = '（内容无法序列化）';
  }
  return (
    <pre className="rounded-lg border border-line bg-panel p-4 overflow-x-auto text-[12px] font-mono text-mute leading-relaxed whitespace-pre-wrap">
      {pretty}
    </pre>
  );
}

// ----------------------------------------------------------------------------
// Body renderers — ported from child-1 page.tsx, data source = content prop.
// Each guards its shape; falls back to JsonFallback if malformed.
// ----------------------------------------------------------------------------

function StudyRouteBody({ content }: { content: unknown }) {
  const { pointId } = useContext(SectionAnchorContext);
  if (!isRecord(content)) return <JsonFallback content={content} />;
  const steps = Array.isArray(content.steps) ? content.steps : [];
  return (
    <StepGrid
      items={steps}
      cols="md:grid-cols-3 lg:grid-cols-5"
      idFor={pointId}
      render={(step: unknown, i) => {
        const s = isRecord(step) ? step : {};
        const label = typeof s.label === 'string' ? s.label : '';
        const desc = typeof s.desc === 'string' ? s.desc : '';
        return (
          <>
            <div className="flex items-center gap-2 mb-2">
              <Pin>{i + 1}</Pin>
              <span className="text-[13.5px] font-semibold text-ink">{label}</span>
            </div>
            <p className="text-[12.5px] text-mute leading-relaxed">{desc}</p>
          </>
        );
      }}
    />
  );
}

function KnowledgeCardsBody({
  content,
}: {
  content: unknown;
}) {
  const { pointId } = useContext(SectionAnchorContext);
  if (!Array.isArray(content)) return <JsonFallback content={content} />;
  const cards = content.filter(isRecord) as unknown as KnowledgeCard[];
  return (
    <StepGrid
      items={cards}
      idFor={pointId}
      render={(card, i) => {
        const eyebrow = typeof card.eyebrow === 'string' ? card.eyebrow : '';
        const title = typeof card.title === 'string' ? card.title : '';
        const summary = typeof card.summary === 'string' ? card.summary : '';
        const points = asStringArray(card.points);
        return (
          <>
            <div className="flex items-center gap-2 mb-3">
              <Pin>{i + 1}</Pin>
              <SecLabel tone="mute">{eyebrow}</SecLabel>
            </div>
            <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
            <p className="mt-2 text-[13px] text-mute leading-relaxed">{summary}</p>
            <ul className="mt-4 space-y-1.5 text-[12.5px] text-ink">
              {points.map((p) => (
                <li key={p} className="flex gap-2 leading-relaxed">
                  <span
                    className="mt-[7px] w-1 h-1 rounded-full bg-faint shrink-0"
                    aria-hidden="true"
                  />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </>
        );
      }}
    />
  );
}

function ReviewRulesBody({ content }: { content: unknown }) {
  const { pointId } = useContext(SectionAnchorContext);
  if (!Array.isArray(content)) return <JsonFallback content={content} />;
  const rules = content.filter(isRecord) as unknown as ReviewRule[];
  return (
    <ol className="space-y-5">
      {rules.map((rule, i) => {
        const title = typeof rule.title === 'string' ? rule.title : '';
        const cue = typeof rule.cue === 'string' ? rule.cue : '';
        const detail = typeof rule.detail === 'string' ? rule.detail : '';
        return (
          <li key={title || i} id={pointId?.(i)} className="flex gap-4">
            <Pin className="mt-1 shrink-0">{i + 1}</Pin>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <h3 className="text-[17px] font-semibold text-ink">{title}</h3>
                <span className="text-[12px] text-mute font-mono">{cue}</span>
              </div>
              <p className="mt-1.5 text-[14px] text-mute leading-[1.8] max-w-[70ch]">
                {detail}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function QuestionGuidesBody({ content }: { content: unknown }) {
  const { pointId } = useContext(SectionAnchorContext);
  if (!Array.isArray(content)) return <JsonFallback content={content} />;
  const guides = content.filter(isRecord) as unknown as QuestionGuide[];
  return (
    <div className="space-y-5">
      {guides.map((guide, gi) => {
        const badge = typeof guide.badge === 'string' ? guide.badge : '';
        const title = typeof guide.title === 'string' ? guide.title : '';
        const principle =
          typeof guide.principle === 'string' ? guide.principle : '';
        const method = asStringArray(guide.method);
        const variants = asStringArray(guide.variants);
        const mistakes = asStringArray(guide.mistakes);
        return (
          <article
            key={title || gi}
            id={pointId?.(gi)}
            className="rounded-xl border border-line bg-paper p-5 md:p-6"
          >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <SecLabel>{badge}</SecLabel>
              <h3 className="text-[20px] md:text-[22px] font-semibold tracking-tight text-ink">
                {title}
              </h3>
            </div>
            <p className="mt-2 text-[14px] text-mute leading-[1.8] max-w-[70ch]">
              {principle}
            </p>
            <div className="mt-5 grid md:grid-cols-3 gap-px bg-line rounded-lg overflow-hidden border border-line">
              <div className="bg-paper p-4">
                <SecLabel tone="mute">作答方法</SecLabel>
                <ul className="mt-2.5 space-y-2 text-[12.5px] text-mute leading-relaxed">
                  {method.map((m) => (
                    <li key={m} className="flex gap-2">
                      <span
                        className="mt-[7px] w-1 h-1 rounded-full bg-faint shrink-0"
                        aria-hidden="true"
                      />
                      <span>{m}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-paper p-4">
                <SecLabel tone="mute">变形题处理</SecLabel>
                <ul className="mt-2.5 space-y-2 text-[12.5px] text-mute leading-relaxed">
                  {variants.map((v) => (
                    <li key={v} className="flex gap-2">
                      <span
                        className="mt-[7px] w-1 h-1 rounded-full bg-faint shrink-0"
                        aria-hidden="true"
                      />
                      <span>{v}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-paper p-4">
                <SecLabel tone="mark">高频误区</SecLabel>
                <ul className="mt-2.5 space-y-2 text-[12.5px] text-ink leading-relaxed">
                  {mistakes.map((m) => (
                    <li key={m} className="flex gap-2">
                      <AlertMark className="mt-0.5 w-3.5 h-3.5 text-mark shrink-0" />
                      <span>{m}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function FormatMatrixBody({ content }: { content: unknown }) {
  const { pointId } = useContext(SectionAnchorContext);
  if (!Array.isArray(content)) return <JsonFallback content={content} />;
  const rows = content.filter(isRecord) as unknown as FormatRow[];
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="min-w-[880px] w-full border-collapse text-left">
        <thead className="bg-panel">
          <tr>
            <th className="px-4 py-3 text-[12px] font-mono font-semibold text-mute border-b border-line w-[24%]">
              常见文种
            </th>
            <th className="px-4 py-3 text-[12px] font-mono font-semibold text-mute border-b border-line w-[22%]">
              推荐格式
            </th>
            <th className="px-4 py-3 text-[12px] font-mono font-semibold text-mute border-b border-line w-[28%]">
              正文重点
            </th>
            <th className="px-4 py-3 text-[12px] font-mono font-semibold text-mute border-b border-line w-[26%]">
              避坑
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const genre = typeof row.genre === 'string' ? row.genre : '';
            const format = typeof row.format === 'string' ? row.format : '';
            const body = typeof row.body === 'string' ? row.body : '';
            const caution = typeof row.caution === 'string' ? row.caution : '';
            return (
              <tr key={genre || i} id={pointId?.(i)} className="border-b border-line last:border-b-0">
                <td className="px-4 py-3.5 text-[13px] text-ink align-top">{genre}</td>
                <td className="px-4 py-3.5 text-[13px] text-ink align-top">{format}</td>
                <td className="px-4 py-3.5 text-[13px] text-mute leading-relaxed align-top">
                  {body}
                </td>
                <td className="px-4 py-3.5 text-[13px] text-mute leading-relaxed align-top">
                  {caution}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EssayRulesBody({ content }: { content: unknown }) {
  const { pointId } = useContext(SectionAnchorContext);
  if (!Array.isArray(content)) return <JsonFallback content={content} />;
  const rules = content.filter(isRecord) as unknown as EssayRule[];
  return (
    <StepGrid
      items={rules}
      idFor={pointId}
      render={(rule, i) => {
        const title = typeof rule.title === 'string' ? rule.title : '';
        const detail = typeof rule.detail === 'string' ? rule.detail : '';
        const checks = asStringArray(rule.checks);
        return (
          <>
            <div className="flex items-center gap-2 mb-3">
              <Pin>{i + 1}</Pin>
              <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
            </div>
            <p className="text-[13px] text-mute leading-relaxed">{detail}</p>
            <ul className="mt-4 space-y-1.5 text-[12.5px] text-ink">
              {checks.map((c) => (
                <li key={c} className="flex gap-2 leading-relaxed">
                  <CheckOk className="mt-0.5 w-3.5 h-3.5 text-ok shrink-0" />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </>
        );
      }}
    />
  );
}

function PitfallsBody({ content }: { content: unknown }) {
  const { pointId } = useContext(SectionAnchorContext);
  if (!Array.isArray(content)) return <JsonFallback content={content} />;
  const items = content.filter(isRecord) as unknown as Pitfall[];
  return (
    <ul className="grid md:grid-cols-2 gap-px bg-line rounded-xl overflow-hidden border border-line">
      {items.map((item, i) => {
        const issue = typeof item.issue === 'string' ? item.issue : '';
        const correction =
          typeof item.correction === 'string' ? item.correction : '';
        return (
          <li key={issue || i} id={pointId?.(i)} className="bg-paper p-4 md:p-5">
            <div className="flex gap-2.5">
              <AlertMark className="mt-0.5 w-4 h-4 text-mark shrink-0" />
              <h3 className="text-[13.5px] font-medium text-ink leading-relaxed">
                {issue}
              </h3>
            </div>
            <p className="mt-2 pl-[26px] text-[12.5px] text-mute leading-relaxed">
              {correction}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

function TrainingPlanBody({ content }: { content: unknown }) {
  const { pointId } = useContext(SectionAnchorContext);
  if (!isRecord(content)) return <JsonFallback content={content} />;
  const c = content as Partial<TrainingPlanContent>;
  const weeks = Array.isArray(c.weeks)
    ? (c.weeks.filter(isRecord) as unknown as TrainingWeek[])
    : [];
  const review = isRecord(c.review)
    ? (c.review as { title?: unknown; paragraphs?: unknown })
    : null;
  const reviewTitle =
    review && typeof review.title === 'string' ? review.title : '';
  const reviewParas = review ? asStringArray(review.paragraphs) : [];
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,340px)]">
      <StepGrid
        items={weeks}
        idFor={pointId}
        render={(week, i) => {
          const w =
            typeof week.week === 'string' ? week.week : '';
          const title = typeof week.title === 'string' ? week.title : '';
          const focus = typeof week.focus === 'string' ? week.focus : '';
          const tasks = asStringArray(week.tasks);
          return (
            <>
              <div className="flex items-center gap-2 mb-2">
                <Pin>{i + 1}</Pin>
                <span className="text-[11px] font-mono text-mute">{w}</span>
              </div>
              <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
              <p className="mt-2 text-[13px] text-mute leading-relaxed">{focus}</p>
              <ul className="mt-3 space-y-1.5 text-[12.5px] text-ink">
                {tasks.map((t) => (
                  <li key={t} className="flex gap-2 leading-relaxed">
                    <CheckOk className="mt-0.5 w-3.5 h-3.5 text-ok shrink-0" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </>
          );
        }}
      />

      {review && (
        <aside className="bg-panel rounded-xl border border-line p-5 md:p-6">
          <SecLabel tone="mark">考前复盘口径</SecLabel>
          <h3 className="mt-2 text-[18px] font-semibold tracking-tight text-ink leading-tight">
            {reviewTitle}
          </h3>
          {/* Render all but the last paragraph in the main block; the last in a
              bordered closing block (matches child-1 baseline layout for 3
              paragraphs; generalizes to N). */}
          <div className="mt-4 space-y-3 text-[13.5px] text-mute leading-[1.85]">
            {reviewParas.slice(0, Math.max(0, reviewParas.length - 1)).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          {reviewParas.length > 0 && (
            <div className="mt-5 pt-4 border-t border-line text-[13.5px] text-mute leading-[1.85]">
              {reviewParas[reviewParas.length - 1]}
            </div>
          )}
        </aside>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// SectionView — head (chrome) + optional actions + body.
// ----------------------------------------------------------------------------

export interface SectionViewProps {
  sectionKey: SectionKey;
  content: unknown;
  /** Optional toolbar rendered top-right of the section head (edit/history). */
  actions?: ReactNode;
  /** Skip the static SectionHead chrome (snapshot may render its own header). */
  hideHead?: boolean;
  /**
   * When set, each body item renders `id={pointIdFor(prefix, i)}` so the
   * `/app/study` rail + scroll-spy can target it. Snapshots MUST NOT pass this
   * (the default `undefined` suppresses all ids → duplicate-id-safe).
   */
  anchorIdPrefix?: string;
}

export function SectionView({
  sectionKey,
  content,
  actions,
  hideHead = false,
  anchorIdPrefix,
}: SectionViewProps) {
  const meta = SECTION_META[sectionKey];

  // Provide an id resolver only when a prefix is passed. The formula lives in
  // `pointIdFor` (single source of truth — the rail imports the same helper, so
  // rail click → scroll target always matches the rendered id).
  const anchorValue: SectionAnchorContextValue = anchorIdPrefix
    ? { pointId: (i: number) => pointIdFor(anchorIdPrefix, i) }
    : { pointId: undefined };

  // study-route's desc is data-driven off `content.lead` (baseline lead === the
  // static desc, so byte-identical for fallback). Other sections use chrome.
  const desc =
    sectionKey === 'study-route' && isRecord(content) && typeof content.lead === 'string'
      ? (content.lead as string)
      : meta.desc;

  const renderBody = () => {
    switch (sectionKey) {
      case 'study-route':
        return <StudyRouteBody content={content} />;
      case 'exam-scan':
      case 'material-moves':
        return <KnowledgeCardsBody content={content} />;
      case 'review-rules':
        return <ReviewRulesBody content={content} />;
      case 'question-guides':
        return <QuestionGuidesBody content={content} />;
      case 'format-matrix':
        return <FormatMatrixBody content={content} />;
      case 'essay-rules':
        return <EssayRulesBody content={content} />;
      case 'pitfalls':
        return <PitfallsBody content={content} />;
      case 'training-plan':
        return <TrainingPlanBody content={content} />;
      default:
        return <JsonFallback content={content} />;
    }
  };

  return (
    <SectionAnchorContext.Provider value={anchorValue}>
      <section aria-labelledby={meta.headId}>
        {hideHead ? null : (
          <div className="mb-6 md:mb-8 flex items-start justify-between gap-4 flex-wrap">
            <div className="max-w-[70ch]">
              <SecLabel>{meta.eyebrow}</SecLabel>
              <h2
                id={meta.headId}
                className="mt-2 text-[22px] md:text-[26px] font-semibold tracking-tight text-ink leading-tight"
              >
                {meta.title}
              </h2>
              <p className="mt-2.5 text-[14px] text-mute leading-[1.75]">{desc}</p>
            </div>
            {actions ? (
              <div className="flex items-center gap-2 shrink-0 mt-1">{actions}</div>
            ) : null}
          </div>
        )}
        {renderBody()}
      </section>
    </SectionAnchorContext.Provider>
  );
}

export default SectionView;
