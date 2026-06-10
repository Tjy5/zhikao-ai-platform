import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { HistoryDetail, HistoryItem } from '../types';
import {
  filterHistoryItems,
  getHistoryFilterOptions,
  HISTORY_LIST_LIMIT,
  jsonSanitizer,
} from '../utils';
import { historyApi } from '../../../utils/apiClient';
import { useOptionalAuth } from '../../../auth/AuthContext';
import {
  subscribeWritingHistoryRefresh,
  type WritingHistoryRefreshPayload,
} from '../../../utils/writingHistoryRefresh';

interface ToastApi {
  show: (
    message: string,
    type?: 'info' | 'success' | 'warning' | 'error',
    durationMs?: number
  ) => void;
}

export function useHistoryRecords(toast: ToastApi) {
  const auth = useOptionalAuth();
  const currentUserId = auth?.user?.id ?? null;
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<HistoryDetail | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [qtypeFilter, setQtypeFilter] = useState('all');

  const loadInFlightRef = useRef(false);
  const pendingReloadRef = useRef(false);
  const loadListRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const loadList = useCallback(async () => {
    if (loadInFlightRef.current) {
      pendingReloadRef.current = true;
      return;
    }
    loadInFlightRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const data = await historyApi.list(HISTORY_LIST_LIMIT);
      setItems((data.items || []) as HistoryItem[]);
    } catch (error: unknown) {
      const err = error as Error;
      setError(err?.message || '加载失败');
    } finally {
      setLoading(false);
      loadInFlightRef.current = false;
    }
    if (pendingReloadRef.current) {
      pendingReloadRef.current = false;
      await loadListRef.current();
    }
  }, []);

  useEffect(() => {
    loadListRef.current = loadList;
  }, [loadList]);

  const loadDetail = useCallback(async (id: string) => {
    setError(null);
    setSelected(null);
    setShowRaw(false);
    try {
      const data = await historyApi.detail(id);
      setSelected(data as unknown as HistoryDetail);
    } catch (error: unknown) {
      const err = error as Error;
      setError(err?.message || '获取详情失败');
    }
  }, []);

  const clearAll = useCallback(async () => {
    if (!confirm('确定清空所有复盘档案？该操作不可恢复')) return;
    setDeleting(true);
    setError(null);
    try {
      await historyApi.clear();
      setSelected(null);
      await loadList();
    } catch (error: unknown) {
      const err = error as Error;
      setError(err?.message || '操作失败');
    } finally {
      setDeleting(false);
    }
  }, [loadList]);

  const copyJSON = useCallback(
    async (object: unknown) => {
      try {
        await navigator.clipboard.writeText(
          JSON.stringify(object, jsonSanitizer, 2)
        );
        toast.show('已复制到剪贴板', 'success', 2000);
      } catch {
        toast.show('复制失败', 'error', 3000);
      }
    },
    [toast]
  );

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (currentUserId === null) return;
    const handle = (payload: WritingHistoryRefreshPayload) => {
      if (payload.userId !== currentUserId) return;
      void loadList();
    };
    return subscribeWritingHistoryRefresh(handle);
  }, [currentUserId, loadList]);

  const filteredItems = useMemo(
    () => filterHistoryItems(items, query, typeFilter, qtypeFilter),
    [items, query, typeFilter, qtypeFilter]
  );
  const typeOptions = useMemo(
    () => getHistoryFilterOptions(items, 'type'),
    [items]
  );
  const qtypeOptions = useMemo(
    () => getHistoryFilterOptions(items, 'taskType'),
    [items]
  );

  return {
    items,
    loading,
    error,
    selected,
    deleting,
    showRaw,
    query,
    typeFilter,
    qtypeFilter,
    filteredItems,
    typeOptions,
    qtypeOptions,
    setShowRaw,
    setQuery,
    setTypeFilter,
    setQtypeFilter,
    loadList,
    loadDetail,
    clearAll,
    copyJSON,
  };
}
