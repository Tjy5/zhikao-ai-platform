interface SkeletonProps {
  className?: string;
}

/**
 * Skeleton — design.md §10.12. Loading placeholder for lists / detail / report
 * surfaces (preferred over a centered spinner so layout doesn't jump).
 *
 * `pulse` is the only motion; it is silenced by the global prefers-reduced-motion
 * rule in globals.css.
 */
export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={[
        'rounded-md bg-panel',
        'animate-pulse',
        className,
      ].join(' ')}
      aria-hidden="true"
    />
  );
}

/**
 * Renders N stacked skeleton rows for list / feed loading states.
 */
export function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-lg border border-line bg-paper overflow-hidden divide-y divide-line">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 px-4 md:px-5 py-3.5">
          <Skeleton className="h-5 w-8 shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default Skeleton;
