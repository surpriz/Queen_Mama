// Queen Mama LITE - Button Component

import { forwardRef, ButtonHTMLAttributes } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'secondary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 ease-in-out cursor-pointer border-none rounded-qm-md focus:outline-none focus:ring-2 focus:ring-qm-accent focus:ring-offset-2 focus:ring-offset-qm-bg-primary disabled:opacity-50 disabled:cursor-not-allowed';

    const variants = {
      primary:
        'bg-qm-gradient text-white hover:shadow-qm-glow hover:scale-[1.02] active:scale-[0.98]',
      secondary:
        'bg-qm-surface-medium text-qm-text-primary hover:bg-qm-surface-hover active:bg-qm-surface-pressed',
      ghost:
        'bg-transparent text-qm-text-secondary hover:bg-qm-surface-light hover:text-qm-text-primary',
      danger:
        'bg-qm-error/15 text-qm-error hover:bg-qm-error/25 active:bg-qm-error/30',
    };

    const sizes = {
      sm: 'h-7 px-3 text-xs',
      md: 'h-9 px-4 text-sm',
      lg: 'h-11 px-5 text-base',
    };

    return (
      <button
        ref={ref}
        className={twMerge(
          clsx(baseStyles, variants[variant], sizes[size], className)
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
        ) : leftIcon ? (
          <span className="flex-shrink-0">{leftIcon}</span>
        ) : null}
        {children}
        {rightIcon && !isLoading && (
          <span className="flex-shrink-0">{rightIcon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

// Icon Button variant
export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  'aria-label': string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant = 'ghost', size = 'md', children, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center rounded-full transition-all duration-150 ease-in-out cursor-pointer border-none focus:outline-none focus:ring-2 focus:ring-qm-accent focus:ring-offset-2 focus:ring-offset-qm-bg-primary disabled:opacity-50 disabled:cursor-not-allowed';

    const variants = {
      primary: 'bg-qm-gradient text-white hover:shadow-qm-glow',
      secondary: 'bg-qm-surface-medium text-qm-text-primary hover:bg-qm-surface-hover',
      ghost: 'bg-transparent text-qm-text-secondary hover:bg-qm-surface-light hover:text-qm-text-primary',
      danger: 'bg-qm-error/15 text-qm-error hover:bg-qm-error/25',
    };

    const sizes = {
      sm: 'h-7 w-7 text-sm',
      md: 'h-8 w-8 text-base',
      lg: 'h-10 w-10 text-lg',
    };

    return (
      <button
        ref={ref}
        className={twMerge(clsx(baseStyles, variants[variant], sizes[size], className))}
        {...props}
      >
        {children}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';

export default Button;
