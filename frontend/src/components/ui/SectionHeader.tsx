import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SectionHeaderProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  align?: 'left' | 'center';
  action?: ReactNode;
  className?: string;
}

const SectionHeader = ({
  title,
  description,
  icon,
  align = 'left',
  action,
  className,
}: SectionHeaderProps) => {
  const isCenter = align === 'center';

  return (
    <div className={cn('w-full', className)}>
      <div
        className={cn(
          'flex flex-col gap-3',
          isCenter ? 'items-center text-center' : 'items-start text-left'
        )}
      >
        <div
          className={cn(
            'flex w-full items-center gap-3',
            isCenter && 'justify-center'
          )}
        >
          {icon && (
            <div className='retained-icon-badge flex h-12 w-12 items-center justify-center rounded-[8px] text-ink'>
              {icon}
            </div>
          )}
          <h2 className='font-running-script text-3xl font-normal text-ink sm:text-4xl'>
            {title}
          </h2>
          {!isCenter && action && <div className='ml-auto'>{action}</div>}
        </div>
        {description && (
          <p className='max-w-2xl font-kaishu text-sm leading-7 text-muted-foreground sm:text-base'>
            {description}
          </p>
        )}
        {isCenter && action && <div>{action}</div>}
      </div>
    </div>
  );
};

export type { SectionHeaderProps };
export default SectionHeader;
