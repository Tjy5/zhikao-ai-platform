/**
 * feedbackDisplay — shared helpers that turn a grading-feedback markdown string
 * (the backend's guaranteed 5-section contract) into short display strings for
 * feed rows / list rows. Used by the dashboard RecentFeed and the history list
 * so the two surfaces stay visually consistent.
 *
 * The markdown contract (writing-feedback-benchmark.json `required_sections`):
 *   # 写作反馈结果
 *   ## 任务类型判断   → first sentence describes the task (best row title)
 *   ## 综合评价       → narrative critique (best row excerpt)
 *   ## 亮点 / ## 改进建议 / ## 参考优化
 *
 * `content` in a history SUMMARY is the feedback markdown, NOT the user's
 * original writing (types/api.ts). These helpers only read the feedback.
 */

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  // Slice by code units; all our content is BMP (CJK + ASCII) so this is safe.
  return value.slice(0, max) + '…';
}

/**
 * Extract a short row title from the feedback markdown. Prefers the first
 * clause of the 任务类型判断 section; falls back to the first non-heading
 * line; finally "申论批阅记录".
 */
export function extractFeedTitle(
  content: string | null | undefined,
  max = 24
): string {
  if (!content) return '申论批阅记录';
  const stripped = content.replace(/^#\s*写作反馈结果\s*\n?/i, '');
  const sectionMatch = stripped.match(
    /##\s*任务类型判断\s*\n([\s\S]*?)(?=\n##\s|$)/i
  );
  const body = sectionMatch?.[1]?.trim();
  if (!body) {
    const firstLine = stripped
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .find(Boolean);
    return firstLine ? truncate(firstLine, max) : '申论批阅记录';
  }
  // First clause: up to the first Chinese/fullwidth sentence terminator.
  const firstClause = body.split(/[，。；,;]/)[0]?.trim();
  return firstClause ? truncate(firstClause, max) : '申论批阅记录';
}

/**
 * Extract a single-line excerpt for a feed/list row. Prefers the 综合评价
 * section's first sentence; falls back to the first non-heading paragraph.
 */
export function extractFeedExcerpt(
  content: string | null | undefined,
  max = 60
): string {
  if (!content) return '';
  const stripped = content.replace(/^#\s*写作反馈结果\s*\n?/i, '');
  const sectionMatch = stripped.match(
    /##\s*综合评价\s*\n([\s\S]*?)(?=\n##\s|$)/i
  );
  const body = sectionMatch?.[1]?.trim();
  const source = body ?? stripped;
  // Collapse newlines + list markers into one flat line, take first chunk.
  const flat = source
    .replace(/^[-*+]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
  return flat ? truncate(flat, max) : '';
}

/**
 * Fallback excerpt that strips common markdown when section parsing isn't
 * needed (kept for any caller that wants a raw one-liner). Not used by the
 * dashboard, but available for list rows that prefer a plainer excerpt.
 */
export function makePlainExcerpt(markdown: string, max = 60): string {
  if (!markdown) return '';
  const stripped = markdown
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^>\s?/gm, '')
    .replace(/^\s*[-+*]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/\n+/g, ' ')
    .trim();
  return stripped.length <= max ? stripped : stripped.slice(0, max) + '…';
}
