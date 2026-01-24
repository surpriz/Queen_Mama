// Queen Mama LITE - Badge Component

import { forwardRef, HTMLAttributes } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'accent' | 'success' | 'warning' | 'error' | 'auto';
  size?: 'sm' | 'md';
  dot?: boolean;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', size = 'md', dot = false, children, ...props }, ref) => {
    const variants = {
      default: 'bg-qm-surface-medium text-qm-text-secondary',
      accent: 'bg-qm-accent/20 text-qm-accent',
      success: 'bg-qm-success/15 text-qm-success',
      warning: 'bg-qm-warning/15 text-qm-warning',
      error: 'bg-qm-error/15 text-qm-error',
      auto: 'bg-qm-auto-answer/20 text-qm-auto-answer',
    };

    const sizes = {
      sm: 'px-1.5 py-0.5 text-[10px]',
      md: 'px-2 py-1 text-[11px]',
    };

    return (
      <span
        ref={ref}
        className={twMerge(
          clsx(
            'inline-flex items-center gap-1 font-medium rounded-qm-pill',
            variants[variant],
            sizes[size],
            className
          )
        )}
        {...props}
      >
        {dot && (
          <span
            className={clsx(
              'w-1.5 h-1.5 rounded-full',
              variant === 'default' && 'bg-qm-text-tertiary',
              variant === 'accent' && 'bg-qm-accent',
              variant === 'success' && 'bg-qm-success',
              variant === 'warning' && 'bg-qm-warning',
              variant === 'error' && 'bg-qm-error',
              variant === 'auto' && 'bg-qm-auto-answer'
            )}
          />
        )}
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

// Status Badge with pulsing dot
export interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  status: 'idle' | 'active' | 'processing' | 'error';
  label?: string;
}

export const StatusBadge = forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ className, status, label, ...props }, ref) => {
    const statusStyles = {
      idle: { dot: 'bg-qm-text-tertiary', badge: 'bg-qm-surface-medium text-qm-text-secondary' },
      active: { dot: 'bg-qm-success animate-pulse', badge: 'bg-qm-success/15 text-qm-success' },
      processing: { dot: 'bg-qm-accent animate-pulse', badge: 'bg-qm-accent/20 text-qm-accent' },
      error: { dot: 'bg-qm-error', badge: 'bg-qm-error/15 text-qm-error' },
    };

    const styles = statusStyles[status];

    return (
      <span
        ref={ref}
        className={twMerge(
          clsx(
            'inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium rounded-qm-pill',
            styles.badge,
            className
          )
        )}
        {...props}
      >
        <span className={clsx('w-1.5 h-1.5 rounded-full', styles.dot)} />
        {label || status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  }
);

StatusBadge.displayName = 'StatusBadge';

export default Badge;
