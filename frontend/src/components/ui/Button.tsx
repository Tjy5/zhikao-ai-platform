import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * 成公 Button — design.md §10.1.
 *
 * Canonical variants (4): primary | outline | ghost | destructive.
 *  - primary:    oxblood background (the one most important action on a page)
 *  - outline:    ink border / ink text (secondary actions)
 *  - ghost:      transparent / ink text → panel on hover (tertiary inline)
 *  - destructive: vermilion (mark) background, for delete/clear only,
 *                 caller must gate behind a confirm dialog.
 *
 * `secondary` is kept as a LEGACY ALIAS of `outline` so existing Phase 2-8
 * pages still compile while they are migrated; new code must use the 4 above.
 */
type ButtonVariant =
  | 'primary'
  | 'outline'
  | 'ghost'
  | 'destructive'
  | 'secondary';

type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-oxblood text-white hover:bg-oxblood-ink active:bg-oxblood-ink',
  outline:
    'bg-transparent border border-ink text-ink hover:bg-panel',
  ghost:
    'bg-transparent text-ink hover:bg-panel border border-transparent',
  destructive:
    'bg-mark text-white hover:brightness-95 active:brightness-95',
  // Legacy alias — render like outline (soft panel fill) for migrated pages.
  secondary: 'bg-panel text-ink border border-line hover:bg-line',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-[13px] gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-11 px-6 text-[15px] gap-2',
};

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  children,
  className = '',
  type = 'button',
  ...props
}: ButtonProps) {
  const isDisabled = disabled || isLoading;

  return (
    <button
      type={type}
      className={[
        'inline-flex items-center justify-center font-medium rounded-md',
        'transition-ui cursor-pointer select-none',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      ].join(' ')}
      disabled={isDisabled}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center justify-center gap-2">
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
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
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>处理中…</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}

export default Button;
