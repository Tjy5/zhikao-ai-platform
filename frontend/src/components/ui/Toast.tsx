import { useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose: () => void;
}

/**
 * Toast — transient confirmation only (design.md §10.12). Critical state must
 * NOT live only in a toast; surfaces a real status region too.
 */
export function Toast({
  message,
  type = 'info',
  duration = 3000,
  onClose,
}: ToastProps) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const typeStyles: Record<ToastType, string> = {
    success: 'bg-ok text-white',
    error: 'bg-mark text-white',
    info: 'bg-ink text-white',
    warning: 'bg-warn text-white',
  };

  return (
    <div
      className={[
        'fixed top-4 right-4 z-50',
        'flex items-center gap-3',
        'px-4 py-3 rounded-md',
        'shadow-[0_10px_30px_-12px_oklch(0.24_0.02_262/0.30)]',
        'min-w-[300px] max-w-md',
        'animate-slide-in-right',
        typeStyles[type],
      ].join(' ')}
      role="alert"
      aria-live="polite"
    >
      <p className="flex-1 text-sm font-medium leading-snug">{message}</p>
      <button
        type="button"
        onClick={onClose}
        className="flex-shrink-0 ml-2 opacity-80 hover:opacity-100 transition-ui"
        aria-label="关闭通知"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </div>
  );
}

export default Toast;
