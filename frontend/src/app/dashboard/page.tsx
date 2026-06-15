import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useSettings } from '../../hooks/useSettings';
import { Button } from '../../components/ui/Button';
import { Pin } from '../../components/ui/Pin';
import { EmptyState } from '../../components/ui/EmptyState';
import { SkeletonList } from '../../components/ui/Skeleton';
import writingService from '../../services/writingService';
import type { HistorySummary } from '../../types/api';
import { AppError, ErrorType } from '../../types/domain';
import { formatRelativeTime, formatRelativeTimeShort, isWithinDay } from '../../utils/formatRelativeTime';
import { extractFeedTitle, extractFeedExcerpt } from '../../utils/feedbackDisplay';

/**
 * /app index — OverviewDashboard. design.md §10.8 + Phase 3.
 *
 * Composition:
 *  - Greeting + coaching next-step (one line).
 *  - Primary action banner: 去写作台 (+ 继续上一篇 when there is history).
 *  - INLINE stat strip (本周 / 累计 / 上次) — explicitly NOT big-number cards.
 *    Hidden when there is no history (empty-state guides to writing instead).
 *  - RecentFeed: 5 most-recent grading rows with Pin (relative time), taskType
 *    mono chip, feedback-derived title + first-line excerpt, 复盘 → link.
 *  - Empty state: when no history, single CTA to /app/writing.
 *
 * All stats / feed rows are aggregated CLIENT-SIDE from GET /history
 * (writingService.getHistory). Backend returns up to 50 newest items by
 * default, so 累计 is annotated "仅最近 50 条".
 */
interface DashboardState {
  phase: 'loading' | 'ready' | 'error';
  items: HistorySummary[];
  errorMessage: string | null;
}

interface DashboardStats {
  thisWeek: number;
  cumulative: number;
  /** True when the backend's 50-row default likely truncated the real total. */
  cumulativePartial: boolean;
  lastTime: string | null;
}

function greetingPrefix() {
  const hour = new Date().getHours();
  if (hour < 6) return '夜深了';
  if (hour < 12) return '上午好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  return '晚上好';
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Aggregate stats from the history list (client-side). design.md §10.8.
 * `cumulative` is the list length; we mark it partial when the backend returned
 * the full default cap (50) since older records likely exist beyond it.
 */
function computeStats(items: HistorySummary[]): DashboardStats {
  const now = Date.now();
  const thisWeek = items.filter(
    (item) => now - new Date(item.timestamp).getTime() <= WEEK_MS
  ).length;
  const sorted = [...items].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  return {
    thisWeek,
    cumulative: items.length,
    // Backend default limit is 50 (HistoryService.list clamps 1..200, default 50).
    // If we got exactly 50 there are probably more — flag it.
    cumulativePartial: items.length >= 50,
    lastTime: sorted.length > 0 ? sorted[0].timestamp : null,
  };
}

// extractFeedTitle / extractFeedExcerpt live in utils/feedbackDisplay.ts and are
// shared with the history list so the two surfaces stay consistent.

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [state, setState] = useState<DashboardState>({
    phase: 'loading',
    items: [],
    errorMessage: null,
  });
  // Bumped by the retry button so the mount effect re-runs the fetch. The async
  // fetch logic is inlined directly in the effect body (matching AuthContext)
  // so the linter sees every setState happens after an `await`, not
  // synchronously during the effect run. Previously this effect had an empty
  // dep array, so the retry button (which only set phase='loading') never
  // actually re-fetched and the skeleton showed indefinitely.
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let isMounted = true;
    void (async () => {
      try {
        const response = await writingService.getHistory();
        if (!isMounted) return;
        setState({ phase: 'ready', items: response.items, errorMessage: null });
      } catch (error) {
        if (!isMounted) return;
        const message =
          error instanceof AppError && error.type === ErrorType.AUTH
            ? '登录已过期，请重新登录'
            : '无法加载最近批改，请稍后重试';
        setState({ phase: 'error', items: [], errorMessage: message });
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [retryCount]);

  const stats = useMemo(() => computeStats(state.items), [state.items]);
  const recent = useMemo(
    () =>
      [...state.items]
        .sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )
        .slice(0, 5),
    [state.items]
  );

  const hasHistory = state.phase === 'ready' && state.items.length > 0;
  const greetingName = user?.username ? `，${user.username}` : '';

  // AI readiness from SettingsContext (Phase 3 wiring completion). Honest at
  // every state: green dot + model name when a key is configured, amber when
  // not. While settings load (and we have history), we still show the bar but
  // with a neutral "加载中" state rather than a false "未配置".
  const aiReady = !!(settings && settings.has_api_key && settings.model_name);
  const aiLoading = !settings;

  return (
    <div className="space-y-6 md:space-y-7">
      {/* Greeting + coaching next-step */}
      <div>
        <h1 className="text-[24px] md:text-[28px] font-semibold tracking-tight text-ink">
          {greetingPrefix()}
          {greetingName}
        </h1>
        <p className="text-[13.5px] text-mute mt-1.5 leading-relaxed">
          {hasHistory
            ? '下一步：再练一篇申论，把上一篇的改进建议用上——诊断要深一层，对策要可落地。'
            : '下一步：去写作台写下第一篇申论作答，拿到结构化批阅报告。'}
        </p>
      </div>

      {/* Primary action banner */}
      <section className="rounded-xl border border-line bg-panel/60 p-5 md:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold text-ink">开始新一篇申论批改</div>
          <p className="text-[13px] text-mute mt-1 leading-relaxed">
            粘贴作答或直接写，AI 会给出任务类型判断、综合评价、亮点、改进建议与参考优化。
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasHistory && (
            <Button
              variant="outline"
              size="md"
              className="hidden sm:inline-flex"
              onClick={() => navigate('/app/history')}
            >
              继续上一篇
            </Button>
          )}
          <Button onClick={() => navigate('/app/writing')}>
            去写作台
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Button>
        </div>
      </section>

      {/* Inline stat strip — explicitly NOT big-number cards (design.md §10.8). */}
      {hasHistory && (
        <section
          className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[12.5px] text-mute pb-5 border-b border-line"
          aria-label="学习统计"
        >
          {/* AI readiness (Phase 3 wiring). Honest dot + label from SettingsContext. */}
          <span className="inline-flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${aiLoading ? 'bg-faint' : aiReady ? 'bg-ok' : 'bg-warn'}`}
              aria-hidden="true"
            />
            {aiLoading ? (
              'AI 状态加载中'
            ) : aiReady ? (
              <>
                AI 已就绪
                {settings?.model_name && (
                  <span className="font-mono text-faint">· {settings.model_name}</span>
                )}
              </>
            ) : (
              <Link
                to="/app/settings"
                className="text-warn hover:text-oxblood transition-ui underline-offset-2 hover:underline"
              >
                AI 未配置，去配置
              </Link>
            )}
          </span>
          <span className="text-faint" aria-hidden="true">·</span>
          <span>
            本周 <b className="text-ink font-semibold">{stats.thisWeek}</b> 篇
          </span>
          <span className="text-faint" aria-hidden="true">·</span>
          <span>
            累计 <b className="text-ink font-semibold">{stats.cumulative}</b> 篇
            {stats.cumulativePartial && (
              <span className="text-faint text-[11px] ml-1" title="后端只返回最近 50 条">
                （仅最近 50 条）
              </span>
            )}
          </span>
          {stats.lastTime && (
            <>
              <span className="text-faint" aria-hidden="true">·</span>
              <span>
                上次批改 <b className="text-ink font-semibold">{formatRelativeTime(stats.lastTime)}</b>
              </span>
            </>
          )}
        </section>
      )}

      {/* RecentFeed */}
      {state.phase === 'loading' ? (
        <section aria-label="最近批改" aria-busy="true">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[15px] font-semibold text-ink">最近批改</h2>
            <span className="text-[12.5px] text-faint">加载中…</span>
          </div>
          <SkeletonList rows={3} />
        </section>
      ) : state.phase === 'error' ? (
        <section aria-label="最近批改">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[15px] font-semibold text-ink">最近批改</h2>
          </div>
          <div
            role="alert"
            className="rounded-lg border border-mark/30 bg-mark-soft/60 p-4"
          >
            <p className="text-[13px] text-mark leading-relaxed">{state.errorMessage}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => {
                setState({ phase: 'loading', items: [], errorMessage: null });
                setRetryCount((c) => c + 1);
              }}
            >
              重试
            </Button>
          </div>
        </section>
      ) : !hasHistory ? (
        <section aria-label="最近批改">
          <EmptyState
            title="还没有批改记录"
            description="写下第一篇申论作答，拿到任务类型判断、亮点与改进建议——结构稳定，方便复盘。"
            action={
              <Button onClick={() => navigate('/app/writing')}>
                写下第一篇申论
              </Button>
            }
          />
        </section>
      ) : (
        <section aria-label="最近批改">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[15px] font-semibold text-ink">最近批改</h2>
            <Link
              to="/app/history"
              className="text-[12.5px] text-mute hover:text-ink transition-ui"
            >
              查看全部 →
            </Link>
          </div>
          <ul className="rounded-xl border border-line bg-paper overflow-hidden divide-y divide-line">
            {recent.map((item) => {
              const fresh = isWithinDay(item.timestamp);
              const title = extractFeedTitle(item.content);
              const excerpt = extractFeedExcerpt(item.content);
              return (
                <li
                  key={item.id}
                  className="flex items-start gap-3 px-4 md:px-5 py-3.5 hover:bg-panel/50 transition-ui"
                >
                  <Pin
                    tone={fresh ? 'mark' : 'ok'}
                    className="mt-0.5 shrink-0"
                  >
                    {formatRelativeTimeShort(item.timestamp)}
                  </Pin>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[13.5px] font-medium text-ink truncate">
                        {title}
                      </span>
                      {item.taskType && (
                        <span className="text-[10.5px] font-mono text-faint shrink-0">
                          {item.taskType}
                        </span>
                      )}
                    </div>
                    {excerpt && (
                      <p className="text-[12.5px] text-mute truncate">{excerpt}</p>
                    )}
                  </div>
                  <Link
                    to="/app/history"
                    className="shrink-0 text-[12.5px] text-oxblood hover:text-oxblood-ink font-medium px-2 py-1 rounded transition-ui"
                    aria-label={`复盘 ${title}`}
                  >
                    复盘 →
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
