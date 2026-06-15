import type { ReactNode } from 'react';

/**
 * Pin — vermilion (mark) mono label for sequences / completion marks /
 * relative-time stamps in feeds. design.md §10.2.
 *
 * Used for: 改进建议编号 (1..n), 阶段完成 ✓, feed 相对时间 (2h / 1d).
 * Default tone is vermilion (mark); `ok` is for positive states (亮点时间),
 * `ink` for neutral.
 */
type PinTone = 'mark' | 'ok' | 'ink';

interface PinProps {
  children: ReactNode;
  tone?: PinTone;
  className?: string;
}

const TONE_CLASSES: Record<PinTone, string> = {
  mark: 'bg-mark text-white',
  ok: 'bg-ok text-white',
  ink: 'bg-ink text-white',
};

export function Pin({ children, tone = 'mark', className = '' }: PinProps) {
  return (
    <span
      className={[
        'inline-grid place-items-center',
        'h-5 min-w-[1.25rem] px-[5px]',
        'font-mono text-[11px] font-bold leading-none',
        'rounded',
        TONE_CLASSES[tone],
        className,
      ].join(' ')}
    >
      {children}
    </span>
  );
}

export default Pin;
