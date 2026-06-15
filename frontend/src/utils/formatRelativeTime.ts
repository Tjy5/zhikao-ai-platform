// Relative time formatting utility (Chinese labels)
// Matches the existing util style in validation.ts (plain exported functions, no classes).

/**
 * Format an ISO-8601 timestamp as a Chinese relative-time label.
 *
 * Rules:
 *   < 60s         -> 刚刚
 *   < 60m         -> X 分钟前
 *   < 24h         -> X 小时前
 *   < 7d          -> X 天前
 *   otherwise     -> toLocaleDateString('zh-CN')
 */
export function formatRelativeTime(timestamp: string, now: Date = new Date()): string {
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();

  // Future timestamps (clock skew or just-persisted records) fall through to "刚刚"
  if (diffMs < 0) {
    return '刚刚';
  }

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) {
    return '刚刚';
  }
  if (minutes < 60) {
    return `${minutes} 分钟前`;
  }
  if (hours < 24) {
    return `${hours} 小时前`;
  }
  if (days < 7) {
    return `${days} 天前`;
  }
  return then.toLocaleDateString('zh-CN');
}

/**
 * Compact relative-time label for the dashboard RecentFeed Pin (design.md §10.8,
 * matches direction-v3-dashboard.html: 2h / 1d / 3d style mono stamps).
 *
 * Rules:
 *   < 60s         -> 刚刚
 *   < 60m         -> Xm
 *   < 24h         -> Xh
 *   < 7d          -> Xd
 *   otherwise     -> M/D (zh-CN, no leading zeros)
 */
export function formatRelativeTimeShort(timestamp: string, now: Date = new Date()): string {
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();

  if (diffMs < 0) {
    return '刚刚';
  }

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return '刚刚';
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  // Compact zh-CN date like "6/14" (month/day, no leading zeros).
  return `${then.getMonth() + 1}/${then.getDate()}`;
}

/**
 * Whether a timestamp is within the last 24h. Used by the dashboard RecentFeed
 * to tint recent rows differently (mark Pin for fresh, ok Pin for settled).
 */
export function isWithinDay(timestamp: string, now: Date = new Date()): boolean {
  const then = new Date(timestamp);
  return now.getTime() - then.getTime() < 24 * 60 * 60 * 1000;
}
