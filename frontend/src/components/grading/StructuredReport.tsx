import type { ReactNode } from 'react';
import { Pin } from '../ui/Pin';

/**
 * StructuredReport — opt-in structured-scoring view. design.md §10.7 / §9.
 *
 * DORMANT BY CONTRACT: the AI system prompt (WritingPromptBuilder) FORBIDS JSON
 * output, so the backend's grading response is always markdown only — it NEVER
 * carries `dimensions[]` / `annotations[]` / `overall`. Until a Phase-2 backend
 * change adds structured JSON output, this component must NOT render and must
 * NOT be fed fake/hardcoded scores. `GradingReport` gates it behind a
 * truthiness check on the structured payload; if absent, only the default
 * 5-section markdown report shows.
 *
 * The shapes below are the agreed future contract; they are intentionally
 * narrower than "anything goes" so the backend has a target to implement
 * against.
 */

export interface RadarDimension {
  name: string;
  score: number;
  max: number;
}

export interface ExcerptAnnotation {
  /** The quoted span from the user's original writing. */
  quote: string;
  /** Which dimension this annotation targets (e.g. "论据"). */
  dimension?: string;
  /** Optional inline score for this annotation (e.g. 6 out of 10). */
  score?: number;
  max?: number;
  /** The reviewer's comment on this excerpt. */
  comment: string;
}

export interface StructuredPayload {
  overall: number;
  overallMax?: number;
  dimensions: RadarDimension[];
  annotations?: ExcerptAnnotation[];
}

interface StructuredReportProps {
  payload: StructuredPayload | null | undefined;
}

/**
 * RadarChart — SVG n-axis radar (diamond for 4 axes). design.md §10.7.
 *
 * Grid = concentric polygons; data = a `mark`-tinted polygon. Axis labels sit
 * just outside each vertex. The overall score is rendered large in oxblood.
 *
 * Pure SVG, no charting lib. Scales to any number of dimensions ≥ 3; the
 * design target is 4 (论点 / 论据 / 结构 / 语言).
 */
function RadarChart({
  dimensions,
  overall,
  overallMax = 10,
}: {
  dimensions: RadarDimension[];
  overall: number;
  overallMax?: number;
}) {
  const size = 200;
  const center = size / 2;
  const radius = 72;
  const n = dimensions.length;

  // Vertex angle for each axis (start at top, go clockwise).
  const angleFor = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;

  const pointAt = (i: number, fraction: number) => {
    const a = angleFor(i);
    return {
      x: center + Math.cos(a) * radius * fraction,
      y: center + Math.sin(a) * radius * fraction,
    };
  };

  const toPolygonPoints = (fractions: number[]) =>
    fractions
      .map((f, i) => {
        const p = pointAt(i, f);
        return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      })
      .join(' ');

  const gridRings = [0.33, 0.66, 1];
  const dataFractions = dimensions.map((d) =>
    d.max > 0 ? Math.max(0, Math.min(1, d.score / d.max)) : 0
  );

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-baseline justify-between w-full mb-1">
        <span className="text-[11px] font-medium text-faint">综合</span>
        <span className="text-[26px] font-semibold text-oxblood leading-none">
          {overall.toFixed(1)}
          <span className="text-[13px] text-faint font-normal">
            /{overallMax}
          </span>
        </span>
      </div>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="w-full max-w-[190px]"
        role="img"
        aria-label={`维度雷达：${dimensions
          .map((d) => `${d.name} ${d.score}/${d.max}`)
          .join('、')}`}
      >
        {/* Concentric grid polygons. */}
        <g stroke="oklch(0.90 0.006 240)" fill="none" strokeWidth={1}>
          {gridRings.map((f) => (
            <polygon key={f} points={toPolygonPoints(Array(n).fill(f))} />
          ))}
        </g>
        {/* Axis spokes. */}
        <g stroke="oklch(0.86 0.008 240)" strokeWidth={1}>
          {dimensions.map((_, i) => {
            const p = pointAt(i, 1);
            return (
              <line key={i} x1={center} y1={center} x2={p.x} y2={p.y} />
            );
          })}
        </g>
        {/* Data polygon. */}
        <polygon
          points={toPolygonPoints(dataFractions)}
          fill="oklch(0.56 0.17 32 / 0.18)"
          stroke="oklch(0.56 0.17 32)"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {/* Axis labels (outside each vertex). */}
        <g
          fontSize={10}
          fontFamily="Inter,'Noto Sans SC',sans-serif"
          fill="oklch(0.47 0.014 262)"
        >
          {dimensions.map((d, i) => {
            const labelPoint = pointAt(i, 1.22);
            const anchor =
              Math.abs(labelPoint.x - center) < 4
                ? 'middle'
                : labelPoint.x > center
                ? 'start'
                : 'end';
            return (
              <text
                key={d.name}
                x={labelPoint.x}
                y={labelPoint.y}
                textAnchor={anchor}
                dominantBaseline="middle"
              >
                {d.name} {d.score}
              </text>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

/**
 * ExcerptCard — one annotation row. design.md §10.7.
 * Pin + dimension chip (mark-soft bg) + excerpt box (mark-soft, FULL border —
 * NOT a left color stripe) + reviewer comment.
 */
function ExcerptCard({
  index,
  annotation,
}: {
  index: number;
  annotation: ExcerptAnnotation;
}) {
  return (
    <article className="flex gap-3 px-5 py-4">
      <Pin className="shrink-0 mt-0.5">{index}</Pin>
      <div className="flex-1 min-w-0">
        {annotation.dimension && (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-mark-soft text-mark">
              {annotation.dimension}
              {typeof annotation.score === 'number' && (
                <>
                  {' '}
                  · {annotation.score}
                  {annotation.max ? `/${annotation.max}` : ''}
                </>
              )}
            </span>
          </div>
        )}
        {annotation.quote && (
          <div className="mb-2 rounded-md border border-mark/30 bg-mark-soft/60 px-2.5 py-2 text-[13.5px] text-ink leading-relaxed">
            {annotation.quote}
          </div>
        )}
        <p className="text-[13px] text-mute leading-relaxed">
          {annotation.comment}
        </p>
      </div>
    </article>
  );
}

/**
 * StructuredReport — renders ONLY when a real structured payload exists.
 * Returns null otherwise (the default 5-section report is the fallback).
 */
export function StructuredReport({ payload }: StructuredReportProps) {
  if (
    !payload ||
    typeof payload.overall !== 'number' ||
    !Array.isArray(payload.dimensions) ||
    payload.dimensions.length === 0
  ) {
    // Dormant. Never fake data here.
    return null;
  }

  return (
    <section aria-label="结构化评分">
      {/* Opt-in divider so users know this is the structured-scoring view. */}
      <div className="flex items-center gap-3 mb-4">
        <div className="h-px flex-1 bg-line" />
        <span className="text-[11px] font-mono text-faint">
          结构化评分视图
        </span>
        <div className="h-px flex-1 bg-line" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-4">
        {/* Excerpt annotations. */}
        <div className="rounded-lg border border-line bg-paper overflow-hidden divide-y divide-line">
          {payload.annotations && payload.annotations.length > 0 ? (
            payload.annotations.map((annotation, i) => (
              <ExcerptCard
                key={i}
                index={i + 1}
                annotation={annotation}
              />
            ))
          ) : (
            <div className="px-5 py-6 text-[12.5px] text-faint leading-relaxed">
              本次未返回逐条摘录批注。
            </div>
          )}
        </div>
        {/* Radar. */}
        <aside className="rounded-lg border border-line bg-paper p-4 flex flex-col">
          <RadarChart
            dimensions={payload.dimensions}
            overall={payload.overall}
            overallMax={payload.overallMax}
          />
        </aside>
      </div>
    </section>
  );
}

export default StructuredReport;

/** Convenience wrapper for callers that want a typed nothing. */
export function NoStructuredPayload(): ReactNode {
  return null;
}
