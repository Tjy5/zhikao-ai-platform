import { cn } from '@/lib/utils';

export interface LoadingProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

export function Loading({ className, size = 'md', text }: LoadingProps) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-2',
    lg: 'w-12 h-12 border-4',
  };

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3',
        className
      )}
    >
      <div
        className={cn(
          'animate-spin rounded-full border-ink-light border-t-ink',
          sizeClasses[size]
        )}
      />
      {text && <p className='text-sm text-muted-foreground'>{text}</p>}
    </div>
  );
}

export default Loading;
