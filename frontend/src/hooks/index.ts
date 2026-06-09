/**
 * 共享Hooks
 * 包含应用中可复用的业务逻辑
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { API_BASE_URL } from '../config/api';

/**
 * 进度条管理Hook
 * 用于处理加载进度的显示和控制
 */
export const useProgress = () => {
  const [progress, setProgress] = useState<number>(0);
  const [statusText, setStatusText] = useState<string>('');
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startProgress = useCallback(() => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    setProgress(0);
    let current = 0;
    progressTimerRef.current = setInterval(() => {
      const inc =
        current < 60 ? 3 : current < 85 ? 1.5 : current < 95 ? 0.5 : 0.2;
      current = Math.min(99, current + inc);
      setProgress(current);
    }, 200);
  }, []);

  const finishProgress = useCallback(() => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    setProgress(100);
  }, []);

  const stopProgress = useCallback(() => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  return {
    progress,
    statusText,
    setStatusText,
    startProgress,
    finishProgress,
    stopProgress,
  };
};

/**
 * 手风琴组件状态管理Hook
 * 用于管理可折叠内容区域的展开/收起状态
 */
export const useAccordion = (initialState: { [key: string]: boolean }) => {
  const [accordionState, setAccordionState] = useState(initialState);

  const toggleAccordion = useCallback((section: string) => {
    setAccordionState(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  }, []);

  return { accordionState, toggleAccordion };
};

/**
 * API请求Hook
 * 用于处理通用的API请求逻辑
 */
export const useApiRequest = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const makeRequest = useCallback(
    async <T>(url: string, options?: RequestInit): Promise<T | null> => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE_URL}${url}`, {
          headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
          },
          ...options,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { makeRequest, loading, error };
};

/**
 * 键盘事件Hook
 * 用于处理键盘快捷键
 */
export const useKeyboardNavigation = (
  onPrevious?: () => void,
  onNext?: () => void,
  onSubmit?: () => void
) => {
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' && onPrevious) {
        onPrevious();
      } else if (event.key === 'ArrowRight' && onNext) {
        onNext();
      } else if (event.key === 'Enter' && onSubmit) {
        event.preventDefault();
        onSubmit();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [onPrevious, onNext, onSubmit]);
};

/**
 * 滚动到顶部Hook
 * 用于处理页面滚动行为
 */
export const useScrollToTop = () => {
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return { showBackToTop, scrollToTop };
};
