import type { InputHTMLAttributes, ReactNode } from 'react';
import { forwardRef, useId } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  /** Optional trailing affordance (show/hide toggle, copy button, etc.). */
  trailing?: ReactNode;
}

/**
 * Form Input — design.md §10 (inputs): large enough for study workflows,
 * visible focus ring (vermilion via :focus-visible), inline validation with
 * recovery instructions. API key fields use `trailing` for show/hide.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, helperText, trailing, className = '', id, ...props },
  ref
) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const helperId = `${inputId}-helper`;
  const errorId = `${inputId}-error`;

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-ink mb-1.5"
        >
          {label}
        </label>
      )}
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          className={[
            'w-full h-11 px-3.5 rounded-md border bg-paper text-ink',
            'placeholder:text-faint',
            'transition-ui',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            trailing ? 'pr-11' : '',
            error
              ? 'border-mark focus:border-mark'
              : 'border-line focus:border-ink',
            className,
          ].join(' ')}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={
            error ? errorId : helperText ? helperId : undefined
          }
          {...props}
        />
        {trailing && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-2">
            {trailing}
          </div>
        )}
      </div>
      {error ? (
        <p id={errorId} className="mt-1.5 text-[13px] text-mark leading-relaxed">
          {error}
        </p>
      ) : helperText ? (
        <p id={helperId} className="mt-1.5 text-[13px] text-mute leading-relaxed">
          {helperText}
        </p>
      ) : null}
    </div>
  );
});

export default Input;
