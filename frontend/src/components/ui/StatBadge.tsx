import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type StatTone = 'blue' | 'green' | 'red' | 'amber' | 'purple';
type StatTrend = 'up' | 'down' | 'neutral';

const toneClasses: Record<StatTone, string> = {
  blue: 'border-ink-light/15 bg-paper/75 text-ink',
  green: 'border-landscape-green/25 bg-landscape-green/10 text-landscape-green',
  red: 'border-seal-red/25 bg-seal-red/10 text-seal-red',
  amber: 'border-gold-accent/25 bg-gold-accent/12 text-ink-dark',
  purple: 'border-ink-light/15 bg-paper-rice/85 text-ink',
};

const trendLabel: Record<StatTrend, string> = {
  up: '↑',
  down: '↓',
  neutral: '—',
};

const trendClasses: Record<StatTrend, string> = {
  up: 'text-landscape-green',
  down: 'text-seal-red',
  neutral: 'text-ink-wash',
};

export interface StatBadgeProps {
  label: string;
  value: string | number;
  tone?: StatTone;
  trend?: StatTrend;
  trendValue?: string;
  icon?: ReactNode;
  badgeText?: string;
  className?: string;
}

const StatBadge = ({
  label,
  value,
  tone = 'blue',
  trend,
  trendValue,
  icon,
  badgeText,
  className,
}: StatBadgeProps) => (
  <div
    className={cn(
      'retained-surface-soft rounded-[10px] border p-4 transition-transform duration-150 hover:-translate-y-0.5',
      className
    )}
  >
    <div className='flex items-center justify-between gap-3'>
      <span className='font-kaishu text-sm text-muted-foreground'>{label}</span>
      {icon && <span className='text-lg text-muted-foreground'>{icon}</span>}
    </div>
    <div className='mt-3 flex items-baseline gap-2'>
      <span className='font-running-script text-4xl font-normal text-card-foreground'>
        {value}
      </span>
      {trend && (
        <span className={cn('text-sm font-medium', trendClasses[trend])}>
          {trendLabel[trend]} {trendValue}
        </span>
      )}
    </div>
    {badgeText && (
      <div
        className={cn(
          'mt-4 inline-flex items-center gap-2 rounded-[6px] border px-3 py-1 font-kaishu text-xs',
          toneClasses[tone]
        )}
      >
        <span>{badgeText}</span>
      </div>
    )}
  </div>
);

export default StatBadge;
