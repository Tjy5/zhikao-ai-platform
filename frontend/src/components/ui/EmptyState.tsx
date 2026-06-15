import type { ReactNode } from 'react';

interface EmptyStateProps {
  /** One clear sentence describing the empty situation (user-facing). */
  title: string;
  /** Optional longer explanation / recovery hint. */
  description?: string;
  /** A single concrete action that gets the user unstuck. */
  action?: ReactNode;
  className?: string;
}

/**
 * EmptyState — design.md §10.12. No icon clutter, no bare "暂无数据".
 * One sentence + one action that moves the user forward.
 */
export function EmptyState({
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={[
        'flex flex-col items-center justify-center text-center',
        'rounded-lg border border-dashed border-line',
        'bg-paper px-6 py-12',
        className,
      ].join(' ')}
    >
      <p className="text-[15px] font-medium text-ink">{title}</p>
      {description && (
        <p className="mt-1.5 text-[13px] text-mute leading-relaxed max-w-[52ch]">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export default EmptyState;
