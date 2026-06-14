import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { writingService } from '../../services/writingService';
import { Button } from '../../components/ui/Button';
import { Toast, type ToastType } from '../../components/ui/Toast';
import { MarkdownRenderer } from '../../components/ui/MarkdownRenderer';
import { formatRelativeTime } from '../../utils/formatRelativeTime';
import type {
  HistorySummary,
  HistoryDetail,
  HistoryClearResponse,
} from '../../types/api';

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

// Strip common markdown symbols to produce a readable one-line excerpt.
function makeExcerpt(markdown: string, max = 50): string {
  if (!markdown) return '';
  const stripped = markdown
    .replace(/^#{1,6}\s+/gm, '') // headings
    .replace(/\*\*(.+?)\*\*/g, '$1') // bold
    .replace(/\*(.+?)\*/g, '$1') // italic
    .replace(/__(.+?)__/g, '$1') // bold underscore
    .replace(/_(.+?)_/g, '$1') // italic underscore
    .replace(/`([^`]+)`/g, '$1') // inline code
    .replace(/^>\s?/gm, '') // blockquote markers
    .replace(/^\s*[-+*]\s+/gm, '') // list bullets
    .replace(/^\s*\d+\.\s+/gm, '') // numbered lists
    .replace(/\[(.+?)\]\(.+?\)/g, '$1') // links -> text
    .replace(/\n+/g, ' ')
    .trim();
  if (stripped.length <= max) return stripped;
  return stripped.slice(0, max) + '…';
}

export default function HistoryPage() {
  const navigate = useNavigate();

  // List state
  const [items, setItems] = useState<HistorySummary[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  // Detail state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<HistoryDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Controls
  const [searchInput, setSearchInput] = useState(''); // raw input (immediate)
  const [searchTerm, setSearchTerm] = useState(''); // debounced term used for filtering
  const [timeRange, setTimeRange] = useState<TimeRangeFilter>('all');

  // Clear-all confirmation flow
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Multi-select + batch/single delete
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBatchDeleteConfirmOpen, setIsBatchDeleteConfirmOpen] = useState(false);
  const [isSingleDeleteConfirmOpen, setIsSingleDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Toast
  const [toast, setToast] = useState<ToastState>({ show: false, message: '', type: 'info' });

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    setToast({ show: true, message, type });
  }, []);

  // ----- Data loading -----
  // loadList fetches the history list. The caller is responsible for the
  // loading flag: the initial `isLoadingList` state is `true`, and the retry
  // button sets it before calling. loadList only clears it in `finally`.
  const loadList = useCallback(async () => {
    try {
      const response = await writingService.getHistory();
      setItems(response.items);
      setListError(null);
    } catch (error) {
      setListError(error instanceof Error ? error.message : '加载历史记录失败');
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  useEffect(() => {
    // Initial mount-time data fetch. The setState calls inside loadList run
    // after the first await, but react-hooks/set-state-in-effect flags any
    // setState reachable from an effect. Mount-time fetching is a sanctioned
    // pattern (https://react.dev/learn/you-might-not-need-an-effect), so we
    // disable the rule for this specific call.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadList();
  }, [loadList]);

  // ----- Debounced search (300ms) -----
  useEffect(() => {
    const handle = setTimeout(() => {
      setSearchTerm(searchInput.trim());
    }, 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  // ----- Derived filtered list -----
  const filteredItems = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    // "本周" interpreted as rolling 7-day window to match the weekly practice semantics
    const weekStart = new Date(sevenDaysAgo);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    return items.filter((item) => {
      // Time range filter
      if (timeRange !== 'all') {
        const ts = new Date(item.timestamp).getTime();
        if (timeRange === 'today' && ts < startOfToday.getTime()) return false;
        if (timeRange === 'week' && ts < weekStart.getTime()) return false;
        if (timeRange === 'month' && ts < monthStart.getTime()) return false;
      }
      // Content search (client-side, substring on feedback content)
      if (searchTerm) {
        const haystack = item.content || '';
        if (!haystack.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      }
      return true;
    });
  }, [items, timeRange, searchTerm]);

  // ----- Detail fetching with stale-guard -----
  const detailRequestIdRef = useRef(0);

  const selectItem = useCallback((id: string) => {
    // Always (re)fetch on selection. Re-selecting the same id (e.g. via the
    // detail-error retry button) re-fetches by design.
    setSelectedId(id);
    setDetailError(null);

    const requestId = ++detailRequestIdRef.current;
    setIsLoadingDetail(true);
    setDetail(null);

    writingService
      .getHistoryDetail(id)
      .then((data) => {
        // Stale guard: a newer selection has been made, ignore this result
        if (requestId !== detailRequestIdRef.current) return;
        setDetail(data);
      })
      .catch((error) => {
        if (requestId !== detailRequestIdRef.current) return;
        setDetailError(error instanceof Error ? error.message : '加载详情失败');
      })
      .finally(() => {
        if (requestId !== detailRequestIdRef.current) return;
        setIsLoadingDetail(false);
      });
  }, []);

  // ----- Copy actions -----
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

  // ----- Clear all history -----
  const handleClearAll = useCallback(async () => {
    try {
      setIsClearing(true);
      const result = await writingService.clearHistory();
      // Reset local state
      setItems([]);
      setSelectedId(null);
      setDetail(null);
      setDetailError(null);
      setSelectedIds(new Set());
      setIsClearConfirmOpen(false);
      showToast(`已清空 ${result.deleted} 条记录`, 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '清空历史记录失败', 'error');
    } finally {
      setIsClearing(false);
    }
  }, [showToast]);

  // ----- Multi-select helpers -----
  const toggleRowSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const allFilteredSelected =
    filteredItems.length > 0 &&
    filteredItems.every((item) => selectedIds.has(item.id));
  const someFilteredSelected =
    filteredItems.some((item) => selectedIds.has(item.id));

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      // If everything (currently filtered) is selected, deselect only those;
      // otherwise add all filtered ids to the existing selection.
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
    setIsBatchDeleteConfirmOpen(false);
  }, []);

  // ----- Batch delete (selected ids) -----
  // Uses Promise.allSettled instead of Promise.all so that a single rejected
  // delete (e.g. transient 5xx or network blip) does not discard the results
  // of the already-succeeded deletes. We then reconcile list + detail against
  // the server and report an accurate per-batch outcome.
  const handleBatchDelete = useCallback(async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) {
      setIsBatchDeleteConfirmOpen(false);
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
      const failed = outcomes.length - succeeded;

      // If the currently-viewed detail was among the (at least partially)
      // deleted ids, clear the detail panel: the record no longer exists
      // server-side and the next loadList() will drop it from the list.
      if (selectedId && ids.includes(selectedId)) {
        setSelectedId(null);
        setDetail(null);
        setDetailError(null);
      }
      setSelectedIds(new Set());
      setIsBatchDeleteConfirmOpen(false);
      // Reload to reconcile the list with the backend.
      await loadList();

      if (failed === 0) {
        showToast(`已删除 ${succeeded} 条记录`, 'success');
      } else if (succeeded === 0) {
        showToast(
          `删除失败，请重试（${failed} 条记录）`,
          'error'
        );
      } else {
        showToast(
          `已删除 ${succeeded} 条记录，${failed} 条失败请重试`,
          'warning'
        );
      }
    } catch (error) {
      // Defensive: Promise.allSettled never throws on rejection, but a
      // synchronous error (e.g. in setSelectedIds) should still reconcile.
      showToast(error instanceof Error ? error.message : '删除记录失败', 'error');
      setSelectedIds(new Set());
      setIsBatchDeleteConfirmOpen(false);
      await loadList();
    } finally {
      setIsDeleting(false);
    }
  }, [selectedIds, selectedId, loadList, showToast]);

  // ----- Single delete (from detail panel) -----
  const handleSingleDelete = useCallback(async () => {
    const id = selectedId;
    if (!id) {
      setIsSingleDeleteConfirmOpen(false);
      return;
    }
    try {
      setIsDeleting(true);
      await writingService.deleteHistoryItem(id);
      // Remove from selection set if present.
      setSelectedIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      // Clear the detail panel: the viewed record is gone.
      setSelectedId(null);
      setDetail(null);
      setDetailError(null);
      setIsSingleDeleteConfirmOpen(false);
      await loadList();
      showToast('已删除该记录', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '删除记录失败', 'error');
      setIsSingleDeleteConfirmOpen(false);
      await loadList();
    } finally {
      setIsDeleting(false);
    }
  }, [selectedId, loadList, showToast]);

  const hasAnyRecords = items.length > 0;
  const hasFilterResults = filteredItems.length > 0;
  const selectedCount = selectedIds.size;

  return (
    <div className="min-h-screen bg-paper-white">
      <div className="max-w-content mx-auto px-4 py-8">
        {/* Sticky header */}
        <div className="mb-6 sticky top-0 bg-paper-white z-10 pb-4 -mx-4 px-4 border-b border-slate-gray/10">
          <h1 className="text-3xl font-display text-deep-ink mb-2">历史记录</h1>
          <p className="text-slate-gray text-sm">查看您的写作批改记录与反馈</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          {/* ===== List Panel (left, ~40%) ===== */}
          <div className="md:col-span-2">
            {/* Controls bar */}
            <div className="bg-card-cream rounded-lg p-4 border border-slate-gray/20 mb-4 space-y-3">
              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="搜索批改内容..."
                  aria-label="搜索历史记录"
                  className="w-full pl-9 pr-8 py-2 rounded-md border border-slate-gray/30 bg-paper-white text-deep-ink text-sm placeholder:text-slate-gray/50 focus:outline-none focus:ring-2 focus:ring-vermilion focus:border-vermilion"
                />
                {/* Search icon */}
                <svg
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-gray"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {/* Clear search button */}
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput('');
                      setSearchTerm('');
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-slate-gray hover:text-deep-ink transition-smooth"
                    aria-label="清除搜索"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Time-range segmented control */}
              <div className="flex items-center gap-1 flex-wrap" role="group" aria-label="时间范围筛选">
                {(Object.keys(TIME_RANGE_LABELS) as TimeRangeFilter[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTimeRange(key)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-smooth min-h-[36px] ${
                      timeRange === key
                        ? 'bg-vermilion text-paper-white'
                        : 'bg-paper-white text-slate-gray hover:text-deep-ink border border-slate-gray/20'
                    }`}
                    aria-pressed={timeRange === key}
                  >
                    {TIME_RANGE_LABELS[key]}
                  </button>
                ))}
              </div>

              {/* Select-all (only when there are filtered results) */}
              {hasFilterResults && (
                <label className="flex items-center gap-2 text-sm text-slate-gray cursor-pointer select-none min-h-[36px]">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = !allFilteredSelected && someFilteredSelected;
                    }}
                    onChange={toggleSelectAll}
                    aria-label="全选当前筛选结果"
                    className="w-4 h-4 rounded border-slate-gray/40 text-vermilion focus:ring-vermilion cursor-pointer"
                  />
                  全选
                </label>
              )}

              {/* Clear-all action */}
              {hasAnyRecords && !isClearConfirmOpen && (
                <div className="pt-2 border-t border-slate-gray/20">
                  <button
                    type="button"
                    onClick={() => setIsClearConfirmOpen(true)}
                    className="w-full px-3 py-2 text-sm font-medium text-error-crimson hover:bg-error-crimson/5 rounded-md border border-error-crimson/20 transition-smooth min-h-[40px]"
                  >
                    清空全部历史
                  </button>
                </div>
              )}

              {/* Double confirmation for clear-all */}
              {isClearConfirmOpen && (
                <div className="pt-2 border-t border-slate-gray/20">
                  <div className="p-3 rounded-md bg-error-crimson/5 border border-error-crimson/30">
                    <p className="text-sm text-deep-ink mb-3">
                      确定要清空全部历史记录吗？此操作不可恢复。
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="primary"
                        className="bg-error-crimson hover:bg-error-crimson/90 focus:ring-error-crimson flex-1"
                        onClick={handleClearAll}
                        isLoading={isClearing}
                      >
                        确认清空
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        className="flex-1"
                        onClick={() => setIsClearConfirmOpen(false)}
                        disabled={isClearing}
                      >
                        取消
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Selection toolbar (only when items are selected) */}
            {selectedCount > 0 && (
              <div className="bg-card-cream rounded-lg p-3 border border-vermilion/30 mb-4">
                {!isBatchDeleteConfirmOpen ? (
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-sm text-deep-ink font-medium">
                      已选 {selectedCount} 项
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={clearSelection}
                        className="text-sm text-slate-gray hover:text-deep-ink transition-smooth min-h-[36px] px-2"
                      >
                        取消选择
                      </button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="text-error-crimson border-error-crimson/30 hover:bg-error-crimson/5 focus:ring-error-crimson min-h-[40px]"
                        onClick={() => setIsBatchDeleteConfirmOpen(true)}
                      >
                        删除选中
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-md bg-error-crimson/5 border border-error-crimson/30">
                    <p className="text-sm text-deep-ink mb-3">
                      确定要删除选中的 {selectedCount} 条记录吗？此操作不可恢复。
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="primary"
                        className="bg-error-crimson hover:bg-error-crimson/90 focus:ring-error-crimson flex-1"
                        onClick={handleBatchDelete}
                        isLoading={isDeleting}
                      >
                        确认删除
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        className="flex-1"
                        onClick={() => setIsBatchDeleteConfirmOpen(false)}
                        disabled={isDeleting}
                      >
                        取消
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* List body */}
            <div className="space-y-2">
              {/* Loading skeleton */}
              {isLoadingList && (
                <>
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="p-4 rounded-lg border border-slate-gray/20 bg-card-cream animate-pulse"
                      aria-hidden="true"
                    >
                      <div className="h-3 w-20 bg-slate-gray/20 rounded mb-2" />
                      <div className="h-4 w-full bg-slate-gray/20 rounded mb-1" />
                      <div className="h-3 w-12 bg-slate-gray/20 rounded" />
                    </div>
                  ))}
                </>
              )}

              {/* List error */}
              {!isLoadingList && listError && (
                <div className="p-6 rounded-lg border border-slate-gray/20 bg-card-cream text-center">
                  <p className="text-sm text-error-crimson mb-3">{listError}</p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setIsLoadingList(true);
                      loadList();
                    }}
                  >
                    重试
                  </Button>
                </div>
              )}

              {/* Empty state: no records at all */}
              {!isLoadingList && !listError && !hasAnyRecords && (
                <div className="p-8 rounded-lg border border-slate-gray/20 bg-card-cream text-center">
                  <svg
                    className="w-12 h-12 text-slate-gray/40 mx-auto mb-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-deep-ink font-medium mb-1">还没有批改记录</p>
                  <p className="text-sm text-slate-gray mb-4">完成第一次写作批改后，记录将显示在这里</p>
                  <Button type="button" onClick={() => navigate('/app/writing')}>
                    去写作
                  </Button>
                </div>
              )}

              {/* Empty-after-filter state */}
              {!isLoadingList && !listError && hasAnyRecords && !hasFilterResults && (
                <div className="p-8 rounded-lg border border-slate-gray/20 bg-card-cream text-center">
                  <p className="text-deep-ink font-medium mb-1">没有匹配的记录</p>
                  <p className="text-sm text-slate-gray mb-3">尝试调整筛选条件或搜索关键词</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput('');
                      setSearchTerm('');
                      setTimeRange('all');
                    }}
                    className="text-sm text-vermilion hover:text-vermilion/80 transition-smooth"
                  >
                    清除所有筛选
                  </button>
                </div>
              )}

              {/* List items */}
              {!isLoadingList && !listError && hasFilterResults && (
                <>
                  {filteredItems.map((item) => {
                    const isActive = item.id === selectedId;
                    const isSelected = selectedIds.has(item.id);
                    const excerpt = makeExcerpt(item.content);
                    return (
                      <div
                        key={item.id}
                        className={`relative rounded-lg border transition-smooth min-h-[80px] ${
                          isActive
                            ? 'border-vermilion bg-vermilion/5'
                            : 'border-slate-gray/20 bg-card-cream hover:border-vermilion/40 hover:bg-vermilion/5'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => selectItem(item.id)}
                          aria-current={isActive ? 'true' : undefined}
                          className="w-full text-left p-4 pl-12"
                        >
                          <div className="flex items-center justify-between mb-1.5 gap-2">
                            <span className="text-xs text-slate-gray">
                              {formatRelativeTime(item.timestamp)}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {item.taskType && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-deep-ink/5 text-deep-ink">
                                  {item.taskType}
                                </span>
                              )}
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-gray/10 text-slate-gray">
                                {TYPE_LABELS[item.type] || item.type}
                              </span>
                            </div>
                          </div>
                          <p className="text-sm text-deep-ink line-clamp-2 leading-snug">
                            {excerpt || '(无批改内容)'}
                          </p>
                        </button>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRowSelection(item.id)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`选择记录 ${excerpt}`}
                          className="absolute left-3 top-4 w-4 h-4 rounded border-slate-gray/40 text-vermilion focus:ring-vermilion cursor-pointer"
                        />
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>

          {/* ===== Detail Panel (right, ~60%) ===== */}
          <div className="md:col-span-3">
            <div className="bg-card-cream rounded-lg border border-slate-gray/20 min-h-[400px] sticky top-32">
              {/* No selection placeholder */}
              {!selectedId && !isLoadingDetail && (
                <div className="p-12 text-center">
                  <svg
                    className="w-12 h-12 text-slate-gray/40 mx-auto mb-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-slate-gray">从左侧选择一条记录查看详情</p>
                </div>
              )}

              {/* Detail loading */}
              {selectedId && isLoadingDetail && (
                <div className="p-6 animate-pulse" aria-hidden="true" aria-busy="true">
                  <div className="h-5 w-40 bg-slate-gray/20 rounded mb-4" />
                  <div className="h-3 w-32 bg-slate-gray/20 rounded mb-6" />
                  <div className="h-4 w-24 bg-slate-gray/20 rounded mb-2" />
                  <div className="h-3 w-full bg-slate-gray/20 rounded mb-1" />
                  <div className="h-3 w-full bg-slate-gray/20 rounded mb-1" />
                  <div className="h-3 w-2/3 bg-slate-gray/20 rounded mb-6" />
                  <div className="h-4 w-24 bg-slate-gray/20 rounded mb-2" />
                  <div className="h-3 w-full bg-slate-gray/20 rounded mb-1" />
                  <div className="h-3 w-full bg-slate-gray/20 rounded mb-1" />
                  <div className="h-3 w-1/2 bg-slate-gray/20 rounded" />
                </div>
              )}

              {/* Detail error */}
              {selectedId && !isLoadingDetail && detailError && (
                <div className="p-6">
                  <div className="p-4 rounded-md bg-error-crimson/10 border border-error-crimson/30 mb-4">
                    <p className="text-sm text-error-crimson mb-3">{detailError}</p>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => selectedId && selectItem(selectedId)}
                    >
                      重试
                    </Button>
                  </div>
                </div>
              )}

              {/* Detail content */}
              {selectedId && !isLoadingDetail && detail && (
                <HistoryDetailContent
                  detail={detail}
                  onCopy={copyToClipboard}
                  onDelete={handleSingleDelete}
                  isDeleteConfirmOpen={isSingleDeleteConfirmOpen}
                  onOpenDeleteConfirm={() => setIsSingleDeleteConfirmOpen(true)}
                  onCancelDeleteConfirm={() => setIsSingleDeleteConfirmOpen(false)}
                  isDeleting={isDeleting}
                />
              )}
            </div>
          </div>
        </div>

        {/* Toast */}
        {toast.show && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast({ ...toast, show: false })}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Detail panel body. Extracted as a sub-component to keep the main page
 * component readable and to encapsulate the collapsible-original-content
 * state locally.
 */
function HistoryDetailContent({
  detail,
  onCopy,
  onDelete,
  isDeleteConfirmOpen,
  onOpenDeleteConfirm,
  onCancelDeleteConfirm,
  isDeleting,
}: {
  detail: HistoryDetail;
  onCopy: (text: string, successMessage: string) => void;
  onDelete: () => void;
  isDeleteConfirmOpen: boolean;
  onOpenDeleteConfirm: () => void;
  onCancelDeleteConfirm: () => void;
  isDeleting: boolean;
}) {
  const [isOriginalExpanded, setIsOriginalExpanded] = useState(false);

  return (
    <div className="p-6 space-y-6">
      {/* Header: full timestamp + type badge + delete action */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-display font-semibold text-deep-ink mb-1">
            批改详情
          </h2>
          <p className="text-sm text-slate-gray">
            {new Date(detail.timestamp).toLocaleString('zh-CN')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-slate-gray/10 text-slate-gray">
            {TYPE_LABELS[detail.type] || detail.type}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-error-crimson hover:bg-error-crimson/10 focus:ring-error-crimson min-h-[40px]"
            onClick={onOpenDeleteConfirm}
            disabled={isDeleteConfirmOpen || isDeleting}
            aria-label="删除此记录"
          >
            删除此记录
          </Button>
        </div>
      </div>

      {/* Single-delete double confirmation */}
      {isDeleteConfirmOpen && (
        <div className="p-3 rounded-md bg-error-crimson/5 border border-error-crimson/30">
          <p className="text-sm text-deep-ink mb-3">
            确定要删除这条记录吗？此操作不可恢复。
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="primary"
              className="bg-error-crimson hover:bg-error-crimson/90 focus:ring-error-crimson flex-1"
              onClick={onDelete}
              isLoading={isDeleting}
            >
              确认删除
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={onCancelDeleteConfirm}
              disabled={isDeleting}
            >
              取消
            </Button>
          </div>
        </div>
      )}

      {/* Original writing (collapsible) */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-deep-ink">原文</h3>
          <button
            type="button"
            onClick={() => onCopy(detail.request.content, '原文已复制到剪贴板')}
            className="inline-flex items-center gap-1 text-xs text-vermilion hover:text-vermilion/80 transition-smooth min-h-[32px] px-2"
            aria-label="复制原文"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            复制原文
          </button>
        </div>
        <div className="bg-paper-white rounded-md border border-slate-gray/20">
          <div
            className={`p-4 text-sm text-deep-ink leading-relaxed whitespace-pre-wrap overflow-hidden ${
              isOriginalExpanded ? 'max-h-[600px] overflow-y-auto' : 'max-h-[4.5rem]'
            }`}
          >
            {detail.request.content || '(无原文内容)'}
          </div>
          {detail.request.content && (
            <button
              type="button"
              onClick={() => setIsOriginalExpanded((v) => !v)}
              className="w-full py-2 text-xs text-vermilion hover:bg-vermilion/5 transition-smooth border-t border-slate-gray/20"
              aria-expanded={isOriginalExpanded}
            >
              {isOriginalExpanded ? '收起' : '展开'}
            </button>
          )}
        </div>
      </section>

      {/* Grading feedback (markdown) */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-deep-ink">批改反馈</h3>
          <button
            type="button"
            onClick={() => onCopy(detail.response.content, '批改反馈已复制到剪贴板')}
            className="inline-flex items-center gap-1 text-xs text-vermilion hover:text-vermilion/80 transition-smooth min-h-[32px] px-2"
            aria-label="复制批改反馈"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            复制批改
          </button>
        </div>
        <div className="bg-paper-white rounded-md border border-slate-gray/20 p-4 max-h-[600px] overflow-y-auto">
          {detail.response.content ? (
            <MarkdownRenderer>{detail.response.content}</MarkdownRenderer>
          ) : (
            <p className="text-sm text-slate-gray italic">(无批改内容)</p>
          )}
        </div>
      </section>

      {/* Extra metadata (if present) */}
      {detail.extra && Object.keys(detail.extra).length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-deep-ink mb-2">附加信息</h3>
          <pre className="p-4 rounded-md bg-deep-ink/5 border border-slate-gray/20 text-xs text-slate-gray font-mono overflow-x-auto">
            {JSON.stringify(detail.extra, null, 2)}
          </pre>
        </section>
      )}
    </div>
  );
}
