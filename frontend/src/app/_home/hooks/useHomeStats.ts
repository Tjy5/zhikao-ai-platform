'use client';

import { useEffect, useState } from 'react';

import { historyApi } from '../../../utils/apiClient';
import { debugLog } from '../../../utils/logger';

export interface HomeStats {
  totalWritings: number;
  averageScore: number;
  loading: boolean;
}

interface WritingHistoryItem {
  score?: unknown;
}

interface WritingHistoryResponse {
  items?: WritingHistoryItem[];
}

export const useHomeStats = () => {
  const [realStats, setRealStats] = useState<HomeStats>({
    totalWritings: 0,
    averageScore: 0,
    loading: true,
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = (await historyApi.list(50)) as WritingHistoryResponse;
        const items = Array.isArray(data.items) ? data.items : [];
        const scores = items
          .map((item: { score?: unknown }) => Number(item.score))
          .filter((score: number) => Number.isFinite(score));
        const averageScore =
          scores.length > 0
            ? Math.round(
                scores.reduce((sum, score) => sum + score, 0) / scores.length
              )
            : 0;
        setRealStats({
          totalWritings: items.length,
          averageScore,
          loading: false,
        });
      } catch (error) {
        debugLog('获取统计数据失败:', error);
        setRealStats({
          totalWritings: 0,
          averageScore: 0,
          loading: false,
        });
      }
    };

    fetchStats();
  }, []);

  return realStats;
};
