// Queen Mama LITE - Input Component

import { forwardRef, InputHTMLAttributes } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, leftIcon, rightIcon, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-qm-body-sm text-qm-text-secondary mb-1.5"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-qm-text-tertiary">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={twMerge(
              clsx(
                'w-full bg-qm-surface-light border border-qm-border-subtle rounded-qm-md px-3 py-2',
                'text-qm-body-md text-qm-text-primary placeholder:text-qm-text-tertiary',
                'transition-all duration-150 ease-in-out',
                'focus:outline-none focus:border-qm-accent focus:ring-2 focus:ring-qm-accent/20',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                leftIcon && 'pl-10',
                rightIcon && 'pr-10',
                error && 'border-qm-error focus:border-qm-error focus:ring-qm-error/20',
                className
              )
            )}
            {...props}
          />
          {rightIcon && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-qm-text-tertiary">
              {rightIcon}
            </span>
          )}
        </div>
        {error && (
          <p className="mt-1 text-qm-caption text-qm-error">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

// TextArea variant
export interface TextAreaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-qm-body-sm text-qm-text-secondary mb-1.5"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={twMerge(
            clsx(
              'w-full bg-qm-surface-light border border-qm-border-subtle rounded-qm-md px-3 py-2',
              'text-qm-body-md text-qm-text-primary placeholder:text-qm-text-tertiary',
              'transition-all duration-150 ease-in-out resize-none',
              'focus:outline-none focus:border-qm-accent focus:ring-2 focus:ring-qm-accent/20',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              error && 'border-qm-error focus:border-qm-error focus:ring-qm-error/20',
              className
            )
          )}
          {...props}
        />
        {error && (
          <p className="mt-1 text-qm-caption text-qm-error">{error}</p>
        )}
      </div>
    );
  }
);

TextArea.displayName = 'TextArea';

export default Input;
