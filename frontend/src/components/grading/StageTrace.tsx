import { Pin } from '../ui/Pin';

/**
 * StageTrace — the three-step grading trace. design.md §10.5.
 *
 *   分析题意 → 多维评价 → 生成报告
 *
 * Each step shows a Pin (✓ done / spinner active / number pending) with a
 * vermilion (mark) connector line between steps. The backend's SSE only emits
 * a final stage-2 event, so the active step is driven CLIENT-SIDE by the
 * GradingConsole (timers) — the trace communicates "AI is working through
 * stages", not literal per-stage server events.
 *
 * Pass `complete` to mark all three done (used at the top of GradingReport).
 */
interface Stage {
  label: string;
}

const STAGES: Stage[] = [
  { label: '分析题意' },
  { label: '多维评价' },
  { label: '生成报告' },
];

interface StageTraceProps {
  /** Currently-active step (0-indexed). Ignored when `complete` is true. */
  activeStep: number;
  /** Mark every step complete (report-complete / header use). */
  complete?: boolean;
  className?: string;
}

function CheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      aria-hidden="true"
    >
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SpinnerIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export function StageTrace({
  activeStep,
  complete = false,
  className = '',
}: StageTraceProps) {
  return (
    <div
      className={[
        'flex items-center gap-2 text-[12px] sm:text-[12.5px]',
        className,
      ].join(' ')}
      role="list"
    >
      {STAGES.map((stage, i) => {
        const isDone = complete || i < activeStep;
        const isActive = !complete && i === activeStep;

        return (
          <div key={stage.label} className="flex items-center gap-2 min-w-0">
            <div
              className={[
                'inline-flex items-center gap-1.5 font-medium shrink-0',
                isDone || isActive ? 'text-ink' : 'text-faint',
              ].join(' ')}
              role="listitem"
              aria-current={isActive ? 'step' : undefined}
            >
              {isDone ? (
                <Pin tone="mark">
                  <CheckIcon className="w-3 h-3" />
                </Pin>
              ) : isActive ? (
                <Pin tone="mark">
                  <SpinnerIcon className="w-3 h-3 text-white" />
                </Pin>
              ) : (
                <span
                  className={[
                    'inline-grid place-items-center h-5 min-w-[1.25rem] px-[5px]',
                    'font-mono text-[11px] font-bold leading-none rounded',
                    'bg-line text-faint',
                  ].join(' ')}
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
              )}
              <span>{stage.label}</span>
            </div>

            {/* Connector line after every step except the last. */}
            {i < STAGES.length - 1 && (
              <span
                className={[
                  'flex-1 h-[2px] rounded-full transition-ui min-w-[12px]',
                  isDone ? 'bg-mark' : 'bg-line',
                ].join(' ')}
                aria-hidden="true"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default StageTrace;
