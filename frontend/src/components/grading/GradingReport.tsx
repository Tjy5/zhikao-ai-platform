import { useState } from 'react';
import { Pin } from '../ui/Pin';
import { StageTrace } from './StageTrace';
import { StructuredReport } from './StructuredReport';
import type { StructuredPayload } from './StructuredReport';
import {
  parseFeedback,
  SECTION_LABELS,
  type FeedbackSection,
  type SectionKind,
} from '../../utils/parseFeedback';

/**
 * GradingReport — the default 5-section structured report. design.md §10.6.
 *
 * Renders the backend's guaranteed 5 markdown sections (任务类型判断 / 综合评价 /
 * 亮点 / 改进建议 / 参考优化) as styled blocks via `parseFeedback`, NEVER as a
 * raw markdown blob. Unrecognized sections land in a neutral `extra` fallback
 * row so no AI content is lost. When parsing yields nothing usable, a single
 * safe fallback block renders the raw markdown.
 *
 * NO inline redline / strikethrough / wavy underline (design lock — unreliable
 * on dynamic CJK markdown). Review marks are limited to Pin numbers and ＋
 * bullets on the structured report, not on the essay text.
 *
 * The opt-in `StructuredReport` (radar + excerpts) renders ONLY when a real
 * structured payload is passed; today the backend never produces one
 * (WritingPromptBuilder forbids JSON), so it stays dormant — no fake data.
 */
export interface GradingReportMeta {
  /** ISO timestamp of completion (rendered as mono). */
  time?: string;
  /** Model id (mono). Omit when unknown — never fake a model name. */
  model?: string;
  /** Client-measured grading duration in ms. */
  durationMs?: number;
}

interface GradingReportProps {
  markdown: string;
  meta?: GradingReportMeta;
  /** Opt-in structured payload; rendered above the 5-section report when present. */
  structured?: StructuredPayload | null;
  /** "用此题再练一次" CTA handler. */
  onPracticeAgain?: () => void;
  className?: string;
}

const MIN_CONTENT_CHARS = 320;

function formatMeta(meta?: GradingReportMeta): string | null {
  if (!meta) return null;
  const parts: string[] = [];
  if (meta.time) {
    const d = new Date(meta.time);
    if (!Number.isNaN(d.getTime())) {
      // Compact zh-CN timestamp like "2026-06-14 21:48".
      const pad = (n: number) => String(n).padStart(2, '0');
      parts.push(
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
          d.getHours()
        )}:${pad(d.getMinutes())}`
      );
    }
  }
  if (meta.model) parts.push(meta.model);
  if (meta.durationMs && meta.durationMs > 0) {
    const seconds = meta.durationMs / 1000;
    parts.push(`${seconds.toFixed(1)}s`);
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

function SectionLabel({
  kind,
  children,
}: {
  kind: SectionKind;
  children: string;
}) {
  // 亮点 uses the green (ok) accent; every other section uses oxblood.
  const color = kind === 'highlights' ? 'text-ok' : 'text-oxblood';
  return (
    <div className={`text-[11px] font-semibold tracking-[0.02em] ${color}`}>
      {children}
    </div>
  );
}

/** Render one known section in its canonical visual treatment. */
function SectionBlock({ section }: { section: FeedbackSection }) {
  const { kind, body, items } = section;
  const label = SECTION_LABELS[kind as Exclude<SectionKind, 'extra'>];

  // reference: highlighted panel-background block.
  if (kind === 'reference') {
    return (
      <section className="px-5 md:px-6 py-4 bg-panel/50">
        <SectionLabel kind={kind}>{label}</SectionLabel>
        {body ? (
          <p className="mt-2 text-[14px] md:text-[14.5px] text-ink leading-[1.9]">
            {body}
          </p>
        ) : (
          <p className="mt-2 text-[13px] text-faint">（本段缺失）</p>
        )}
      </section>
    );
  }

  // highlights: ＋ (ok) list when items exist, else prose.
  if (kind === 'highlights') {
    return (
      <section className="px-5 md:px-6 py-4">
        <SectionLabel kind={kind}>{label}</SectionLabel>
        {items.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-1.5 text-[14px] text-ink">
            {items.map((item, i) => (
              <li key={i} className="flex gap-2 leading-relaxed">
                <span className="text-ok mt-0.5 shrink-0" aria-hidden="true">
                  ＋
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : body ? (
          <p className="mt-2 text-[14px] text-ink leading-[1.85]">{body}</p>
        ) : (
          <p className="mt-2 text-[13px] text-faint">（本段缺失）</p>
        )}
      </section>
    );
  }

  // suggestions: Pin-numbered list when items exist, else prose.
  if (kind === 'suggestions') {
    return (
      <section className="px-5 md:px-6 py-4">
        <SectionLabel kind={kind}>{label}</SectionLabel>
        {items.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-2 text-[14px]">
            {items.map((item, i) => (
              <li key={i} className="flex gap-2.5 leading-relaxed">
                <Pin className="shrink-0 mt-0.5">{i + 1}</Pin>
                <span className="text-ink">{item}</span>
              </li>
            ))}
          </ul>
        ) : body ? (
          <p className="mt-2 text-[14px] text-ink leading-[1.85]">{body}</p>
        ) : (
          <p className="mt-2 text-[13px] text-faint">（本段缺失）</p>
        )}
      </section>
    );
  }

  // type / overview: prose paragraph.
  return (
    <section className="px-5 md:px-6 py-4">
      <SectionLabel kind={kind}>{label}</SectionLabel>
      {body ? (
        <p
          className={`mt-2 text-[14px] text-ink ${
            kind === 'overview' ? 'leading-[1.85]' : 'leading-relaxed'
          }`}
        >
          {body}
        </p>
      ) : (
        <p className="mt-2 text-[13px] text-faint">（本段缺失）</p>
      )}
    </section>
  );
}

export function GradingReport({
  markdown,
  meta,
  structured,
  onPracticeAgain,
  className = '',
}: GradingReportProps) {
  const parsed = parseFeedback(markdown);
  const metaText = formatMeta(meta);
  const [copied, setCopied] = useState(false);

  const orderedKnown: FeedbackSection[] = [];
  for (const kind of [
    'type',
    'overview',
    'highlights',
    'suggestions',
    'reference',
  ] as SectionKind[]) {
    const section = parsed[kind as keyof typeof parsed] as
      | FeedbackSection
      | undefined;
    if (section) orderedKnown.push(section);
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be unavailable; silently ignore — the report stays on
      // screen so the user can still read it.
    }
  };

  const handleExport = () => {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const stamp = meta?.time
      ? new Date(meta.time).toISOString().slice(0, 10)
      : '批阅';
    a.download = `成公批阅-${stamp}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <h2 className="text-[19px] font-semibold tracking-tight text-ink">
          本次批阅
        </h2>
        <Pin tone="mark" aria-label="批阅完成">
          <svg
            className="w-3 h-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            aria-hidden="true"
          >
            <path
              d="M5 13l4 4L19 7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Pin>
        <span className="text-[13px] text-ink font-medium">批阅完成</span>
        {metaText && (
          <span className="ml-auto font-mono text-[11px] text-faint">
            {metaText}
          </span>
        )}
      </div>

      {/* Completed StageTrace (design.md §10.6: 置顶). */}
      <div className="rounded-lg border border-line bg-panel/50 px-4 py-3 mb-4">
        <StageTrace activeStep={2} complete />
      </div>

      {/* Opt-in structured report — dormant unless a real payload exists. */}
      {structured && (
        <div className="mb-4">
          <StructuredReport payload={structured} />
        </div>
      )}

      {/* 5-section report (the default signature). */}
      {orderedKnown.length > 0 || parsed.extra.length > 0 ? (
        <div className="rounded-lg border border-line bg-paper overflow-hidden divide-y divide-line">
          {orderedKnown.map((section) => (
            <SectionBlock key={section.kind} section={section} />
          ))}
          {parsed.extra.map((section, i) => (
            <section key={`extra-${i}`} className="px-5 md:px-6 py-4">
              <div className="text-[11px] font-semibold tracking-[0.02em] text-mute">
                {section.title}
              </div>
              <p className="mt-2 text-[14px] text-ink leading-[1.85] whitespace-pre-wrap">
                {section.body}
              </p>
            </section>
          ))}
        </div>
      ) : (
        // Total fallback: nothing parsed. Show raw content so the user isn't
        // left looking at an empty report. design.md §9.6 (no crash).
        <div className="rounded-lg border border-line bg-paper px-5 md:px-6 py-5">
          <div className="text-[11px] font-semibold tracking-[0.02em] text-mute mb-2">
            批阅内容
          </div>
          <p className="text-[14px] text-ink leading-[1.85] whitespace-pre-wrap">
            {parsed.raw.trim() || markdown.trim()}
          </p>
        </div>
      )}

      {/* Action row */}
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <button
          type="button"
          onClick={handleCopy}
          className="text-[12.5px] text-mute hover:text-ink px-2.5 py-1.5 rounded-md hover:bg-panel transition-ui"
        >
          {copied ? '已复制' : '复制报告'}
        </button>
        <button
          type="button"
          onClick={handleExport}
          className="text-[12.5px] text-mute hover:text-ink px-2.5 py-1.5 rounded-md hover:bg-panel transition-ui"
        >
          导出 Markdown
        </button>
        {onPracticeAgain && (
          <button
            type="button"
            onClick={onPracticeAgain}
            className="ml-auto inline-flex items-center gap-1.5 text-[13px] font-medium bg-oxblood text-white px-3 py-1.5 rounded-md hover:bg-oxblood-ink transition-ui"
          >
            用此题再练一次
          </button>
        )}
      </div>

      {markdown.trim().length < MIN_CONTENT_CHARS && (
        <p className="mt-3 text-[11.5px] text-faint leading-relaxed">
          本次批阅内容较短，仅供参考。
        </p>
      )}
    </div>
  );
}

export default GradingReport;
