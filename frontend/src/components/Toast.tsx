'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  durationMs: number;
}

interface ToastContextValue {
  show: (message: string, type?: ToastType, durationMs?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const show = useCallback(
    (message: string, type: ToastType = 'info', durationMs = 3000) => {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const item: ToastItem = { id, type, message, durationMs };
      setToasts(prev =>
        prev.some(toast => toast.message === message && toast.type === type)
          ? prev
          : [...prev, item]
      );
      window.setTimeout(() => remove(id), durationMs);
    },
    [remove]
  );

  const value = useMemo<ToastContextValue>(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className='fixed bottom-6 left-4 right-4 z-50 space-y-2 sm:left-auto sm:w-[min(24rem,calc(100vw-2rem))]'>
        {toasts.map(t => (
          <div
            key={t.id}
            className={`rounded-md border px-4 py-3 text-sm font-semibold shadow-sm transition-opacity
              ${
                t.type === 'success'
                  ? 'border-emerald-700/30 bg-emerald-50 text-emerald-800'
                  : ''
              }
              ${
                t.type === 'info'
                  ? 'border-ink-light/30 bg-paper-rice text-ink'
                  : ''
              }
              ${
                t.type === 'warning'
                  ? 'border-amber-700/30 bg-amber-50 text-amber-800'
                  : ''
              }
              ${
                t.type === 'error'
                  ? 'border-seal-red/30 bg-seal-red/10 text-seal-red'
                  : ''
              }
            `}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
