import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}

const EmptyState = ({
  title,
  description,
  icon,
  action,
  compact = false,
  className,
}: EmptyStateProps) => (
  <div
    className={cn(
      'retained-empty-state flex flex-col items-center justify-center rounded-[10px] text-center',
      compact ? 'p-8' : 'p-12',
      className
    )}
  >
    {icon && <div className='mb-4 text-4xl text-muted-foreground'>{icon}</div>}
    <h3 className='font-running-script text-2xl font-normal text-card-foreground sm:text-3xl'>
      {title}
    </h3>
    {description && (
      <p className='mt-3 max-w-xl font-kaishu text-sm leading-7 text-muted-foreground sm:text-base'>
        {description}
      </p>
    )}
    {action && <div className='mt-6'>{action}</div>}
  </div>
);

export default EmptyState;
