import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const variantClasses = {
  subtle: 'bg-paper text-ink border-ink hover:bg-paper-ivory',
  outline: 'bg-transparent text-ink border-ink hover:bg-paper-ivory',
} as const;

const sizeClasses = {
  sm: 'px-3 py-1 text-xs rounded-full',
  md: 'px-4 py-2 text-sm rounded-full',
} as const;

type TagVariant = keyof typeof variantClasses;
type TagSize = keyof typeof sizeClasses;

export interface TagProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: TagVariant;
  size?: TagSize;
  selected?: boolean;
}

const Tag = ({
  variant = 'subtle',
  size = 'md',
  selected = false,
  className,
  type = 'button',
  children,
  ...rest
}: TagProps) => {
  const classes = cn(
    'inline-flex items-center justify-center border font-semibold shadow-sm transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-seal/30 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none disabled:opacity-60',
    sizeClasses[size],
    selected
      ? 'bg-ink text-paper border-ink hover:bg-ink-light'
      : variantClasses[variant],
    className
  );

  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
};

export default Tag;
