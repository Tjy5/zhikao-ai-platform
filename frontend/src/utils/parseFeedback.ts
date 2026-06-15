/**
 * parseFeedback — 5-section structured-report parser. design.md §9.
 *
 * Backend contract (writing-feedback-benchmark.json `required_sections`): the
 * grading markdown ALWAYS contains 5 `## ` sections in a fixed order:
 *
 *   任务类型判断  →  type
 *   综合评价      →  overview
 *   亮点          →  highlights
 *   改进建议      →  suggestions
 *   参考优化      →  reference
 *
 * The AI system prompt (WritingPromptBuilder) forbids JSON output, so the
 * response is always markdown prose (+ optional list items in 亮点 / 改进建议).
 *
 * Robustness rules (design.md §9.6): empty / missing / truncated / short /
 * malformed input MUST degrade to safe fallbacks — NEVER throw. Each known
 * section is independently optional; unrecognized sections land in `extra`.
 */

export type SectionKind =
  | 'type'
  | 'overview'
  | 'highlights'
  | 'suggestions'
  | 'reference'
  | 'extra';

export interface FeedbackSection {
  /** Canonical kind, or 'extra' for unrecognized sections. */
  kind: SectionKind;
  /** Original heading text from the markdown (`## 任务类型判断`). */
  title: string;
  /** Raw body (trimmed). Prose sections render this directly. */
  body: string;
  /** Extracted list items for 亮点 / 改进建议 (may be empty for prose). */
  items: string[];
}

export interface ParsedFeedback {
  type?: FeedbackSection;
  overview?: FeedbackSection;
  highlights?: FeedbackSection;
  suggestions?: FeedbackSection;
  reference?: FeedbackSection;
  /** Unrecognized sections, in document order. */
  extra: FeedbackSection[];
  /** True when no `## ` sections were found at all (truncated / garbage). */
  unparsed: boolean;
  /** The original markdown (after H1 strip), kept for the fallback renderer. */
  raw: string;
}

/**
 * Canonical rendering order for the 5 known sections. design.md §10.6 renders
 * them in this sequence regardless of document order.
 */
export const SECTION_ORDER: SectionKind[] = [
  'type',
  'overview',
  'highlights',
  'suggestions',
  'reference',
];

/** Human label for each canonical kind (matches the benchmark section names). */
export const SECTION_LABELS: Record<
  Exclude<SectionKind, 'extra'>,
  string
> = {
  type: '任务类型判断',
  overview: '综合评价',
  highlights: '亮点',
  suggestions: '改进建议',
  reference: '参考优化',
};

/**
 * Strip the leading `# 写作反馈结果` document title (the benchmark always starts
 * with it). Anything before the first `## ` that isn't this title is also
 * dropped so section splitting starts clean.
 */
function stripDocumentTitle(markdown: string): string {
  return markdown.replace(/^#\s*写作反馈结果\s*\n?/i, '');
}

/**
 * Split markdown into `{ title, body }` sections at every `## ` heading.
 * Lines before the first heading are ignored. A section's body runs until the
 * next `## ` (or end of document). `### ` and deeper are kept IN the body so
 * nothing is lost.
 */
function splitSections(text: string): { title: string; body: string }[] {
  const lines = text.split('\n');
  const sections: { title: string; body: string }[] = [];
  let current: { title: string; body: string } | null = null;

  for (const line of lines) {
    // Only split on level-2 headings (## ). Deeper headings (###) stay in body.
    const match = line.match(/^##\s+(.+?)\s*$/);
    if (match) {
      if (current) sections.push(current);
      current = { title: match[1], body: '' };
    } else if (current) {
      current.body += (current.body ? '\n' : '') + line;
    }
  }
  if (current) sections.push(current);
  return sections;
}

/**
 * Normalize a heading to a canonical kind. Tolerates whitespace, fullwidth
 * punctuation, and shorthand variants (e.g. "任务类型" for "任务类型判断").
 * Ordering matters: more specific labels are checked before substrings to
 * avoid mis-classification.
 */
function classifyTitle(title: string): SectionKind {
  // Collapse all whitespace and lowercase (safe for CJK — no case change).
  const t = title.replace(/\s+/g, '');

  if (t.includes('任务类型') || t.includes('题型判断') || t === '任务判断') {
    return 'type';
  }
  if (t.includes('综合评价') || t.includes('总体评价') || t === '评价') {
    return 'overview';
  }
  if (t.includes('亮点') || t.includes('优点') || t.includes('长处')) {
    return 'highlights';
  }
  // Check "改进建议" / "改进" / "建议" — must come AFTER highlights so
  // "亮点与建议" style headings don't get swallowed. We treat pure "建议" as
  // suggestions only when it clearly means improvement suggestions.
  if (t.includes('改进') || t.includes('修改建议') || t === '建议') {
    return 'suggestions';
  }
  if (t.includes('参考') || t.includes('范文') || t.includes('优化')) {
    return 'reference';
  }
  return 'extra';
}

/**
 * Extract list items (`- `, `* `, `+ `, or `1. ` / `1、`) from a section body.
 * Non-list lines are ignored here (the caller keeps `body` for prose fallback).
 * Returns an empty array when the section is prose-only.
 */
function extractItems(body: string): string[] {
  const items: string[] = [];
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (!line) continue;

    // Unordered: - / * / + followed by whitespace.
    const bullet = line.match(/^[-*+]\s+(.+)$/);
    if (bullet) {
      items.push(bullet[1].trim());
      continue;
    }
    // Ordered: 1. / 1、 / 1) followed by whitespace.
    const numbered = line.match(/^\d+[.、)]\s+(.+)$/);
    if (numbered) {
      items.push(numbered[1].trim());
      continue;
    }
  }
  return items;
}

function trimBody(body: string): string {
  return body.replace(/\s+\n/g, '\n').trim();
}

/**
 * Parse grading markdown into structured sections. Never throws — on any error
 * returns `{ extra: [], unparsed: true, raw }` so the caller can render a safe
 * fallback block.
 */
export function parseFeedback(markdown: string | null | undefined): ParsedFeedback {
  const empty: ParsedFeedback = { extra: [], unparsed: true, raw: '' };

  if (!markdown || typeof markdown !== 'string' || !markdown.trim()) {
    return empty;
  }

  let text: string;
  try {
    text = stripDocumentTitle(markdown);
  } catch {
    return { ...empty, raw: markdown };
  }

  let sections: { title: string; body: string }[];
  try {
    sections = splitSections(text);
  } catch {
    return { ...empty, raw: text };
  }

  if (sections.length === 0) {
    // No `## ` headings found — possibly truncated or non-markdown. Keep raw so
    // the fallback renderer can show something rather than an empty report.
    return { ...empty, raw: text };
  }

  const result: ParsedFeedback = { extra: [], unparsed: false, raw: text };

  for (const section of sections) {
    const kind = classifyTitle(section.title);
    const body = trimBody(section.body);
    const items =
      kind === 'highlights' || kind === 'suggestions' ? extractItems(body) : [];

    const parsed: FeedbackSection = {
      kind,
      title: section.title.trim(),
      body,
      items,
    };

    if (kind === 'extra') {
      result.extra.push(parsed);
    } else if (result[kind]) {
      // Duplicate heading (AI hiccup) — keep the first, demote the rest to extra
      // so no content is lost.
      result.extra.push(parsed);
    } else {
      result[kind] = parsed;
    }
  }

  return result;
}

export default parseFeedback;
