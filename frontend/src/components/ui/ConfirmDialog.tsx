import { useEffect, useRef } from 'react';
import Button from './Button';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  /**
   * `danger` uses the destructive (vermilion) confirm button — for delete/clear.
   * `warning` / `info` use the primary (oxblood) confirm button.
   */
  variant?: 'danger' | 'warning' | 'info';
}

/**
 * ConfirmDialog — design.md §10.12. Second-step confirmation for destructive
 * actions (delete / clear). Consequence copy must be specific.
 */
export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = '确定',
  cancelText = '取消',
  onConfirm,
  onCancel,
  variant = 'warning',
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const focusableSelector =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
        return;
      }
      if (e.key !== 'Tab') return;

      const focusable = dialogRef.current?.querySelectorAll(focusableSelector);
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0] as HTMLElement;
      const last = focusable[focusable.length - 1] as HTMLElement;

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    // Focus the confirm button by default so Enter confirms; escape/cancel still
    // reachable. The confirm button is the last focusable element in the dialog
    // (cancel precedes it in DOM order).
    const focusable = dialogRef.current?.querySelectorAll(focusableSelector);
    (focusable?.[focusable.length - 1] as HTMLElement | undefined)?.focus();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const accentText =
    variant === 'danger' ? 'text-mark' : variant === 'warning' ? 'text-warn' : 'text-ink';

  const confirmVariant = variant === 'danger' ? 'destructive' : 'primary';

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-ink/50 backdrop-blur-sm px-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div
        ref={dialogRef}
        className="bg-paper rounded-lg shadow-[0_10px_30px_-12px_oklch(0.24_0.02_262/0.30)] max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          id="confirm-dialog-title"
          className={`text-lg font-semibold mb-2 ${accentText}`}
        >
          {title}
        </h3>
        <p className="text-sm text-mute leading-relaxed">{message}</p>

        <div className="flex items-center justify-end gap-3 mt-6">
          <Button onClick={onCancel} variant="ghost" size="sm">
            {cancelText}
          </Button>
          <Button onClick={onConfirm} variant={confirmVariant} size="sm">
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
