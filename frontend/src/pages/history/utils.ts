import { sanitizeText } from '../../utils';
import type { HistoryItem, HistoryScoreDetail } from './types';

export const HISTORY_LIST_LIMIT = 50;

export const jsonSanitizer = (_key: string, value: unknown) => value;

export const niceDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleString() : '';

export function getHistoryContentPreview(
  content?: string,
  maxLength = 120
) {
  if (!content) return '';
  const compact = content.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) {
    return compact;
  }
  return `${compact.slice(0, maxLength)}…`;
}

const toNumber = (value: unknown, defaultValue = 0) => {
  const parsed = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : defaultValue;
};

export function normalizeDetails(
  details: unknown
): HistoryScoreDetail[] | undefined {
  if (!details) return undefined;
  const record = details as Record<string, unknown>;
  const detailsArray = Array.isArray(details)
    ? details
    : Array.isArray(record?.data)
      ? record.data
      : Array.isArray(record?.items)
        ? record.items
        : Array.isArray(record?.scoreDetails)
          ? record.scoreDetails
          : Array.isArray(record?.score_details)
            ? record.score_details
            : undefined;

  if (!detailsArray) return undefined;

  const mapped = (detailsArray as unknown[])
    .map(detail => {
      const item = (detail as Record<string, unknown>) || {};
      return {
        item: String(item.item ?? item.name ?? item.title ?? ''),
        fullScore: toNumber(
          item.fullScore ?? item.full_score ?? item.full ?? item.max ?? 100,
          100
        ),
        actualScore: toNumber(
          item.actualScore ??
            item.actual_score ??
            item.score ??
            item.value ??
            0,
          0
        ),
        description: String(item.description ?? item.desc ?? item.detail ?? ''),
      };
    })
    .filter(detail => detail.item);

  return mapped.length ? mapped : undefined;
}

export function formatHistoryRichText(
  value: string,
  paragraphClass = 'mb-2',
  strongClass = 'text-primary font-semibold'
) {
  return sanitizeText(value)
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\n\n+/g, `</p><p class="${paragraphClass} mt-2">`)
    .replace(/\n/g, '<br/>')
    .replace(/\*\*(.*?)\*\*/g, `<strong class="${strongClass}">$1</strong>`)
    .replace(/^/, `<p class="${paragraphClass}">`)
    .replace(/$/, '</p>');
}

export function filterHistoryItems(
  items: HistoryItem[],
  query: string,
  typeFilter: string,
  qtypeFilter: string
) {
  const normalizedQuery = query.trim().toLowerCase();
  return items.filter(item => {
    const itemType = (item.type || '').toLowerCase();
    const itemTaskType = (item.taskType || '').toLowerCase();
    const itemId = (item.id || '').toLowerCase();
    const itemContent = (item.content || '').toLowerCase();
    const byType = typeFilter === 'all' || itemType === typeFilter;
    const byTaskType =
      qtypeFilter === 'all' || itemTaskType === qtypeFilter;
    const byQuery =
      !normalizedQuery ||
      itemType.includes(normalizedQuery) ||
      itemTaskType.includes(normalizedQuery) ||
      itemId.includes(normalizedQuery) ||
      itemContent.includes(normalizedQuery);
    return byType && byTaskType && byQuery;
  });
}

export function getHistoryFilterOptions(
  items: HistoryItem[],
  key: 'type' | 'taskType'
) {
  return Array.from(
    new Set(items.map(item => (item[key] || '').toLowerCase()).filter(Boolean))
  );
}
