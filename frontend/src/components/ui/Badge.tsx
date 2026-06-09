import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-seal/30 focus:ring-offset-2',
        variant === 'default' &&
          'border-ink bg-ink text-paper shadow-sm hover:bg-ink-light',
        variant === 'secondary' &&
          'border-ink bg-paper-ivory text-ink shadow-sm hover:bg-paper-rice',
        variant === 'destructive' &&
          'border-seal-red bg-seal-red text-paper shadow-sm hover:bg-seal',
        variant === 'outline' && 'border-ink bg-paper text-ink',
        className
      )}
      {...props}
    />
  );
}

export { Badge };
