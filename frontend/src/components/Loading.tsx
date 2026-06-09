import { cn } from '@/lib/utils';

export function Loading({
  message = '加载中...',
  className,
}: {
  message?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-center min-h-[240px]',
        className
      )}
    >
      <div className='text-center'>
        <div className='mx-auto mb-3 h-16 w-16 animate-spin rounded-full border-4 border-border border-t-primary' />
        <div className='font-semibold text-muted-foreground'>{message}</div>
      </div>
    </div>
  );
}

export default Loading;
