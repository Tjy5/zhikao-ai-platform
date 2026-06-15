import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { writingService } from '../../services/writingService';
import { Button } from '../../components/ui/Button';
import { Pin } from '../../components/ui/Pin';
import { Toast, type ToastType } from '../../components/ui/Toast';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { GradingReport } from '../../components/grading/GradingReport';
import {
  formatRelativeTimeShort,
  isWithinDay,
} from '../../utils/formatRelativeTime';
import {
  extractFeedTitle,
  extractFeedExcerpt,
} from '../../utils/feedbackDisplay';
import { AppError, ErrorType } from '../../types/domain';
import type {
  HistorySummary,
  HistoryDetail,
  HistoryClearResponse,
} from '../../types/api';

/**
 * /app/history — HistoryView. design.md §10.9.
 *
 * Desktop: list / detail split (left ~2fr list, right ~3fr detail).
 * Mobile: stacked master-detail — selecting a row swaps the list out for the
 * detail panel; a back button returns to the list.
 *
 * Backend contract (HistoryService.java / types/api.ts):
 *  - list item `content` is the grading FEEDBACK markdown, NOT the raw essay.
 *  - `score` is structurally always null — never rendered.
 *  - detail `request.content` = raw essay; `response.content` = feedback.
 *  - Backend only stores SUCCESSFUL gradings, so there is NO success/fail
 *    filter (design.md §10.9).
 *
 * Robustness:
 *  - Stale-fetch guard: `detailRequestIdRef` bumps on every selection so a
 *    slow prior fetch can't overwrite a newer detail.
 *  - Debounced search (300ms) over feedback content.
 *  - Batch delete uses Promise.allSettled so one rejection doesn't discard the
 *    rest; we reconcile the list against the server afterwards.
 */

interface ToastState {
  show: boolean;
  message: string;
  type: ToastType;
}

type TimeRangeFilter = 'today' | 'week' | 'month' | 'all';

const TIME_RANGE_LABELS: Record<TimeRangeFilter, string> = {
  today: '今天',
  week: '本周',
  month: '本月',
  all: '全部',
};

const TYPE_LABELS: Record<string, string> = {
  grade: '同步批改',
  progressive: '渐进批改',
};

/** Map a thrown error to a friendly Chinese message, honoring auth/network. */
function friendlyMessage(error: unknown, fallback: string): string {
  if (error instanceof AppError) {
    if (error.type === ErrorType.AUTH) return '登录已过期，请重新登录';
    return error.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
}

export default function HistoryPage() {
  const navigate = useNavigate();

  // ----- List state -----
  const [items, setItems] = useState<HistorySummary[]>([]);
  const [listPhase, setListPhase] = useState<'loading' | 'ready' | 'error'>(
    'loading'
  );
  const [listError, setListError] = useState<string | null>(null);
  // Bumped by the retry button so the mount effect re-runs the fetch.
  const [reloadTick, setReloadTick] = useState(0);

  // ----- Detail state -----
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<HistoryDetail | null>(null);
  const [detailPhase, setDetailPhase] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    'idle'
  );
  const [detailError, setDetailError] = useState<string | null>(null);

  // ----- Controls -----
  const [searchInput, setSearchInput] = useState(''); // raw input (immediate)
  const [searchTerm, setSearchTerm] = useState(''); // debounced term
  const [timeRange, setTimeRange] = useState<TimeRangeFilter>('all');

  // ----- Multi-select + delete -----
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<
    | { kind: 'clear' }
    | { kind: 'batch' }
    | { kind: 'single'; id: string }
    | null
  >(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ----- Toast -----
  const [toast, setToast] = useState<ToastState>({
    show: false,
    message: '',
    type: 'info',
  });
  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    setToast({ show: true, message, type });
  }, []);

  // ----- Data loading -----
  const loadList = useCallback(async () => {
    try {
      setListPhase('loading');
      const response = await writingService.getHistory();
      setItems(response.items);
      setListError(null);
      setListPhase('ready');
    } catch (error) {
      setListError(friendlyMessage(error, '加载历史记录失败'));
      setListPhase('error');
    }
  }, []);

  useEffect(() => {
    // Initial + retry fetch. setState calls run after the first await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadList();
  }, [loadList, reloadTick]);

  // ----- Debounced search (300ms) -----
  useEffect(() => {
    const handle = setTimeout(() => setSearchTerm(searchInput.trim()), 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  // ----- Derived filtered list -----
  const filteredItems = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    ).getTime();
    const weekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    return items.filter((item) => {
      if (timeRange !== 'all') {
        const ts = new Date(item.timestamp).getTime();
        if (timeRange === 'today' && ts < startOfToday) return false;
        if (timeRange === 'week' && ts < weekAgo) return false;
        if (timeRange === 'month' && ts < monthStart) return false;
      }
      if (searchTerm) {
        const haystack = (item.content || '').toLowerCase();
        if (!haystack.includes(searchTerm.toLowerCase())) return false;
      }
      return true;
    });
  }, [items, timeRange, searchTerm]);

  // ----- Detail fetching with stale-guard -----
  const detailRequestIdRef = useRef(0);

  const selectItem = useCallback((id: string) => {
    setSelectedId(id);
    setDetailError(null);
    setDetailPhase('loading');
    setDetail(null);

    const requestId = ++detailRequestIdRef.current;
    writingService
      .getHistoryDetail(id)
      .then((data) => {
        if (requestId !== detailRequestIdRef.current) return; // stale
        setDetail(data);
        setDetailPhase('ready');
      })
      .catch((error) => {
        if (requestId !== detailRequestIdRef.current) return; // stale
        setDetailError(friendlyMessage(error, '加载详情失败'));
        setDetailPhase('error');
      });
  }, []);

  // ----- Copy -----
  const copyToClipboard = useCallback(
    async (text: string, successMessage: string) => {
      try {
        await navigator.clipboard.writeText(text);
        showToast(successMessage, 'success');
      } catch {
        showToast('复制失败，请手动选择文本复制', 'error');
      }
    },
    [showToast]
  );

  // ----- Multi-select helpers -----
  const toggleRowSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const allFilteredSelected =
    filteredItems.length > 0 &&
    filteredItems.every((item) => selectedIds.has(item.id));
  const someFilteredSelected = filteredItems.some((item) =>
    selectedIds.has(item.id)
  );

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (
        filteredItems.length > 0 &&
        filteredItems.every((item) => prev.has(item.id))
      ) {
        const next = new Set(prev);
        filteredItems.forEach((item) => next.delete(item.id));
        return next;
      }
      const next = new Set(prev);
      filteredItems.forEach((item) => next.add(item.id));
      return next;
    });
  }, [filteredItems]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // ----- Confirm handlers -----
  // Clear all history.
  const handleClearAll = useCallback(async () => {
    if (isDeleting) return; // guard against confirm double-click while in flight
    try {
      setIsDeleting(true);
      const result = await writingService.clearHistory();
      setItems([]);
      setSelectedIds(new Set());
      setSelectedId(null);
      setDetail(null);
      setDetailPhase('idle');
      setDetailError(null);
      setConfirm(null);
      showToast(`已清空 ${result.deleted} 条记录`, 'success');
    } catch (error) {
      showToast(friendlyMessage(error, '清空历史记录失败'), 'error');
    } finally {
      setIsDeleting(false);
    }
  }, [isDeleting, showToast]);

  // Batch delete selected ids (per-id DELETE; Promise.allSettled for partial).
  const handleBatchDelete = useCallback(async () => {
    if (isDeleting) return; // guard against confirm double-click while in flight
    const ids = [...selectedIds];
    if (ids.length === 0) {
      setConfirm(null);
      return;
    }
    try {
      setIsDeleting(true);
      const outcomes = await Promise.allSettled(
        ids.map((id) => writingService.deleteHistoryItem(id))
      );
      const succeeded = outcomes.filter(
        (o): o is PromiseFulfilledResult<HistoryClearResponse> =>
          o.status === 'fulfilled'
      ).length;
      const failed = ids.length - succeeded;

      if (selectedId && ids.includes(selectedId)) {
        setSelectedId(null);
        setDetail(null);
        setDetailPhase('idle');
        setDetailError(null);
      }
      setSelectedIds(new Set());
      setConfirm(null);
      await loadList();

      if (failed === 0) showToast(`已删除 ${succeeded} 条记录`, 'success');
      else if (succeeded === 0)
        showToast(`删除失败，请重试（${failed} 条记录）`, 'error');
      else
        showToast(
          `已删除 ${succeeded} 条记录，${failed} 条失败请重试`,
          'warning'
        );
    } catch (error) {
      showToast(friendlyMessage(error, '删除记录失败'), 'error');
      setSelectedIds(new Set());
      setConfirm(null);
      await loadList();
    } finally {
      setIsDeleting(false);
    }
  }, [isDeleting, selectedIds, selectedId, loadList, showToast]);

  // Single delete (from detail panel).
  const handleSingleDelete = useCallback(async () => {
    if (isDeleting) return; // guard against confirm double-click while in flight
    const id = selectedId;
    if (!id) {
      setConfirm(null);
      return;
    }
    try {
      setIsDeleting(true);
      await writingService.deleteHistoryItem(id);
      setSelectedIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setSelectedId(null);
      setDetail(null);
      setDetailPhase('idle');
      setDetailError(null);
      setConfirm(null);
      await loadList();
      showToast('已删除该记录', 'success');
    } catch (error) {
      showToast(friendlyMessage(error, '删除记录失败'), 'error');
      setConfirm(null);
      await loadList();
    } finally {
      setIsDeleting(false);
    }
  }, [isDeleting, selectedId, loadList, showToast]);

  const clearAllFilters = () => {
    setSearchInput('');
    setSearchTerm('');
    setTimeRange('all');
  };

  const hasAnyRecords = listPhase === 'ready' && items.length > 0;
  const hasFilterResults = filteredItems.length > 0;
  const selectedCount = selectedIds.size;
  const isMobileDetailOpen = !!selectedId;

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div>
        <h1 className="text-[24px] md:text-[28px] font-semibold tracking-tight text-ink">
          批改历史
        </h1>
        <p className="text-[13px] text-mute mt-1 leading-relaxed">
          按时间与关键词回看每一次批改，对照原文与结构化报告复盘改进。
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-6 items-start">
        {/* ===== LIST COLUMN ===== */}
        <div className={isMobileDetailOpen ? 'hidden lg:block' : 'block'}>
          {/* Controls */}
          <div className="rounded-lg border border-line bg-paper p-4 mb-4 space-y-3">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="搜索批改内容…"
                aria-label="搜索历史记录"
                className="w-full h-10 pl-9 pr-9 rounded-md border border-line bg-paper text-ink text-[13px] placeholder:text-faint focus:border-ink focus:outline-none transition-ui"
              />
              <svg
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-faint"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              {searchInput && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput('');
                    setSearchTerm('');
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-faint hover:text-ink transition-ui rounded"
                  aria-label="清除搜索"
                >
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              )}
            </div>

            {/* Time-range segmented control */}
            <div
              className="flex items-center gap-1 flex-wrap"
              role="group"
              aria-label="时间范围筛选"
            >
              {(Object.keys(TIME_RANGE_LABELS) as TimeRangeFilter[]).map(
                (key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTimeRange(key)}
                    className={`px-3 h-9 text-[12.5px] font-medium rounded-md transition-ui ${
                      timeRange === key
                        ? 'bg-shell text-white'
                        : 'bg-paper text-mute hover:text-ink border border-line'
                    }`}
                    aria-pressed={timeRange === key}
                  >
                    {TIME_RANGE_LABELS[key]}
                  </button>
                )
              )}
            </div>

            {/* Select-all + clear-all row */}
            {hasFilterResults && (
              <div className="flex items-center justify-between pt-2 border-t border-line">
                <label className="flex items-center gap-2 text-[12.5px] text-mute cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    ref={(el) => {
                      if (el)
                        el.indeterminate =
                          !allFilteredSelected && someFilteredSelected;
                    }}
                    onChange={toggleSelectAll}
                    aria-label="全选当前筛选结果"
                    className="w-4 h-4 rounded border-line text-mark focus:ring-mark cursor-pointer accent-mark"
                  />
                  全选
                </label>
                <button
                  type="button"
                  onClick={() => setConfirm({ kind: 'clear' })}
                  className="text-[12.5px] font-medium text-mark hover:brightness-95 transition-ui px-2 h-9 rounded"
                >
                  清空全部
                </button>
              </div>
            )}
          </div>

          {/* Selection toolbar */}
          {selectedCount > 0 && (
            <div className="rounded-lg border border-mark/30 bg-mark-soft/40 p-3 mb-4 flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[13px] text-ink font-medium">
                已选 {selectedCount} 项
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                >
                  取消选择
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setConfirm({ kind: 'batch' })}
                >
                  删除选中
                </Button>
              </div>
            </div>
          )}

          {/* List body */}
          {listPhase === 'loading' && (
            <div aria-busy="true" aria-label="加载历史记录中">
              <div className="rounded-lg border border-line bg-paper overflow-hidden divide-y divide-line">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 px-4 py-3.5"
                  >
                    <Skeleton className="h-5 w-8 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {listPhase === 'error' && (
            <div
              role="alert"
              className="rounded-lg border border-mark/30 bg-mark-soft/40 p-4"
            >
              <p className="text-[13px] text-mark leading-relaxed">
                {listError}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setReloadTick((t) => t + 1)}
              >
                重试
              </Button>
            </div>
          )}

          {listPhase === 'ready' && !hasAnyRecords && (
            <EmptyState
              title="还没有批改记录"
              description="写下第一篇申论作答，拿到任务类型判断、亮点与改进建议——记录会自动留在这里，方便复盘。"
              action={
                <Button onClick={() => navigate('/app/writing')}>
                  写下第一篇申论
                </Button>
              }
            />
          )}

          {listPhase === 'ready' &&
            hasAnyRecords &&
            !hasFilterResults && (
              <EmptyState
                title="没有匹配的记录"
                description="换个关键词或放宽时间范围试试。"
                action={
                  <Button variant="outline" size="sm" onClick={clearAllFilters}>
                    清除所有筛选
                  </Button>
                }
              />
            )}

          {listPhase === 'ready' && hasFilterResults && (
            <ul className="rounded-lg border border-line bg-paper overflow-hidden divide-y divide-line">
              {filteredItems.map((item) => {
                const isActive = item.id === selectedId;
                const isSelected = selectedIds.has(item.id);
                const fresh = isWithinDay(item.timestamp);
                const title = extractFeedTitle(item.content);
                const excerpt = extractFeedExcerpt(item.content);
                return (
                  <li
                    key={item.id}
                    className={`relative transition-ui ${
                      isActive
                        ? 'bg-mark-soft/40'
                        : 'hover:bg-panel/60'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => selectItem(item.id)}
                      aria-current={isActive ? 'true' : undefined}
                      className="w-full text-left flex items-start gap-3 px-4 py-3.5 pl-11"
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
                            <span className="text-[10.5px] font-mono text-mute shrink-0">
                              {item.taskType}
                            </span>
                          )}
                        </div>
                        {excerpt && (
                          <p className="text-[12.5px] text-mute truncate">
                            {excerpt}
                          </p>
                        )}
                      </div>
                    </button>
                    <label
                      htmlFor={`row-${item.id}`}
                      className="sr-only"
                    >
                      选择记录 {title}
                    </label>
                    <input
                      id={`row-${item.id}`}
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleRowSelection(item.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute left-3.5 top-5 w-4 h-4 rounded border-line text-mark focus:ring-mark cursor-pointer accent-mark"
                      aria-label={`选择记录 ${title}`}
                    />
                  </li>
                );
              })}
            </ul>
          )}

          {/* List footer note: cumulative is capped at 50 by the backend. */}
          {hasAnyRecords && (
            <p className="mt-3 text-[11px] font-mono text-mute">
              仅显示最近 50 条记录{searchTerm || timeRange !== 'all' ? '（筛选后）' : ''}。
            </p>
          )}
        </div>

        {/* ===== DETAIL COLUMN ===== */}
        <div className={isMobileDetailOpen ? 'block' : 'hidden lg:block'}>
          {/* Mobile back button */}
          {isMobileDetailOpen && (
            <button
              type="button"
              onClick={() => {
                setSelectedId(null);
                setDetail(null);
                setDetailPhase('idle');
                setDetailError(null);
              }}
              className="lg:hidden mb-3 inline-flex items-center gap-1.5 text-[13px] text-mute hover:text-ink transition-ui"
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  d="M19 12H5M11 18l-6-6 6-6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              返回列表
            </button>
          )}

          {!selectedId && detailPhase !== 'loading' && (
            <EmptyState
              title="选择一条记录查看详情"
              description="点击左侧任意批改，查看原文与完整的结构化批阅报告。"
              className="min-h-[320px]"
            />
          )}

          {selectedId && detailPhase === 'loading' && (
            <div
              aria-busy="true"
              aria-label="加载批改详情中"
              className="rounded-lg border border-line bg-paper p-5 space-y-3"
            >
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-24" />
              <div className="pt-3 border-t border-line space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
                <Skeleton className="h-3 w-2/3" />
              </div>
              <div className="pt-3 border-t border-line space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          )}

          {selectedId && detailPhase === 'error' && (
            <div
              role="alert"
              className="rounded-lg border border-mark/30 bg-mark-soft/40 p-4"
            >
              <p className="text-[13px] text-mark leading-relaxed">
                {detailError}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => selectedId && selectItem(selectedId)}
              >
                重试
              </Button>
            </div>
          )}

          {selectedId && detailPhase === 'ready' && detail && (
            <HistoryDetailContent
              detail={detail}
              onCopy={copyToClipboard}
              onAskDelete={() =>
                setConfirm({ kind: 'single', id: detail.id })
              }
            />
          )}
        </div>
      </div>

      {/* Confirm dialogs (clear / batch / single) */}
      <ConfirmDialog
        isOpen={confirm?.kind === 'clear'}
        title="清空全部历史记录"
        message="将删除当前账号下的全部批改记录，此操作不可恢复。"
        confirmText="确认清空"
        variant="danger"
        onConfirm={handleClearAll}
        onCancel={() => !isDeleting && setConfirm(null)}
      />
      <ConfirmDialog
        isOpen={confirm?.kind === 'batch'}
        title={`删除选中的 ${selectedCount} 条记录`}
        message="选中的批改记录将被永久删除，此操作不可恢复。"
        confirmText="确认删除"
        variant="danger"
        onConfirm={handleBatchDelete}
        onCancel={() => !isDeleting && setConfirm(null)}
      />
      <ConfirmDialog
        isOpen={confirm?.kind === 'single'}
        title="删除这条记录"
        message="这条批改记录将被永久删除，此操作不可恢复。"
        confirmText="确认删除"
        variant="danger"
        onConfirm={handleSingleDelete}
        onCancel={() => !isDeleting && setConfirm(null)}
      />

      {/* Toast */}
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast((t) => ({ ...t, show: false }))}
        />
      )}
    </div>
  );
}

/**
 * Detail panel body. Shows the original essay (collapsible) + the structured
 * GradingReport for the feedback, plus copy-original and delete actions.
 * design.md §10.9: detail = 原文(request.content) + 报告(GradingReport).
 */
function HistoryDetailContent({
  detail,
  onCopy,
  onAskDelete,
}: {
  detail: HistoryDetail;
  onCopy: (text: string, successMessage: string) => void;
  onAskDelete: () => void;
}) {
  const [isOriginalExpanded, setIsOriginalExpanded] = useState(false);
  const hasOriginal = !!detail.request.content?.trim();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold tracking-tight text-ink">
            批改详情
          </h2>
          <p className="text-[12.5px] text-mute mt-0.5">
            {new Date(detail.timestamp).toLocaleString('zh-CN')}
            {detail.request.task_type && (
              <span className="ml-2 font-mono text-mute">
                {detail.request.task_type}
              </span>
            )}
            <span className="ml-2 text-faint">·</span>
            <span className="ml-2 text-mute">
              {TYPE_LABELS[detail.type] || detail.type}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="ghost" size="sm" onClick={onAskDelete}>
            删除此记录
          </Button>
        </div>
      </div>

      {/* Original essay (collapsible). design.md §10.9: 原文 = request.content. */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[11px] font-semibold tracking-[0.02em] text-oxblood">
            原文
          </h3>
          {hasOriginal && (
            <button
              type="button"
              onClick={() =>
                onCopy(detail.request.content, '原文已复制到剪贴板')
              }
              className="inline-flex items-center gap-1 text-[12px] text-mute hover:text-ink transition-ui px-1.5 py-1 rounded"
              aria-label="复制原文"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              复制原文
            </button>
          )}
        </div>
        <div className="rounded-lg border border-line bg-paper overflow-hidden">
          {hasOriginal ? (
            <>
              <div
                className={`px-4 py-3 text-[13.5px] text-ink leading-[1.85] whitespace-pre-wrap overflow-hidden ${
                  isOriginalExpanded
                    ? 'max-h-[600px] overflow-y-auto'
                    : 'max-h-[5.5rem]'
                }`}
              >
                {detail.request.content}
              </div>
              <button
                type="button"
                onClick={() => setIsOriginalExpanded((v) => !v)}
                className="w-full py-2 text-[12px] text-mute hover:text-ink hover:bg-panel transition-ui border-t border-line"
                aria-expanded={isOriginalExpanded}
              >
                {isOriginalExpanded ? '收起原文' : '展开原文'}
              </button>
            </>
          ) : (
            <p className="px-4 py-3 text-[13px] text-mute italic">
              （无原文内容）
            </p>
          )}
        </div>
      </section>

      {/* Feedback report (design.md §10.9: 报告 = GradingReport). */}
      <GradingReport
        markdown={detail.response.content || ''}
        meta={{ time: detail.timestamp }}
      />
    </div>
  );
}
