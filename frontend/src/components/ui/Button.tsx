import type { ButtonHTMLAttributes, ReactElement } from 'react';
import { Children, cloneElement, isValidElement } from 'react';
import { cn } from '@/lib/utils';

const variantClasses = {
  default: 'border-ink bg-ink text-paper shadow-sm hover:bg-ink-light',
  primary: 'border-ink bg-ink text-paper shadow-sm hover:bg-ink-light',
  destructive: 'border-seal-red bg-seal-red text-paper shadow-sm hover:bg-seal',
  outline:
    'border-ink-light/20 bg-paper text-ink shadow-sm hover:border-ink hover:bg-paper-ivory',
  secondary:
    'border-ink-light/20 bg-paper-rice text-ink shadow-sm hover:border-ink hover:bg-paper',
  ghost:
    'border-transparent bg-transparent text-ink shadow-none hover:border-ink-light/15 hover:bg-paper-ivory/80',
  link: 'border-transparent bg-transparent text-ink shadow-none underline-offset-4 hover:underline',
} as const;

const sizeClasses = {
  default: 'h-11 px-5 py-2',
  sm: 'h-9 px-4 text-xs',
  lg: 'h-12 px-8 text-base',
  icon: 'h-11 w-11 p-0',
} as const;

type ButtonVariant = keyof typeof variantClasses;
type ButtonSize = keyof typeof sizeClasses;

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  asChild?: boolean;
  children: ReactElement | ReactElement[] | string;
}

const Button = ({
  variant = 'default',
  size = 'default',
  fullWidth,
  asChild,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) => {
  const classes = cn(
    'ink-hover inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[6px] border font-kaishu text-sm transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seal focus-visible:ring-offset-2 focus-visible:ring-offset-paper hover:-translate-y-[1px] active:translate-x-[1px] active:translate-y-[1px] disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-50',
    variantClasses[variant],
    sizeClasses[size],
    fullWidth && 'w-full',
    className
  );

  if (
    asChild &&
    Children.count(children) === 1 &&
    isValidElement<{ className?: string }>(children)
  ) {
    return cloneElement(children, {
      className: cn(children.props.className, classes),
    });
  }

  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
};

export default Button;
