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
