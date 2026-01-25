// Queen Mama LITE - Badge Component

import { forwardRef, HTMLAttributes } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'accent' | 'success' | 'warning' | 'error' | 'auto' | 'hidden';
  size?: 'sm' | 'md';
  dot?: boolean;
  pulsing?: boolean;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', size = 'md', dot = false, pulsing = false, children, ...props }, ref) => {
    const variants = {
      default: 'bg-qm-surface-medium text-qm-text-secondary',
      accent: 'bg-qm-accent/20 text-qm-accent',
      success: 'bg-qm-success/15 text-qm-success',
      warning: 'bg-qm-warning/15 text-qm-warning',
      error: 'bg-qm-error/15 text-qm-error',
      auto: 'bg-qm-auto-answer/20 text-qm-auto-answer',
      hidden: 'bg-qm-surface-light text-qm-text-tertiary',
    };

    const sizes = {
      sm: 'px-1.5 py-0.5 text-[10px]',
      md: 'px-2 py-1 text-[11px]',
    };

    const dotColors = {
      default: 'bg-qm-text-tertiary',
      accent: 'bg-qm-accent',
      success: 'bg-qm-success',
      warning: 'bg-qm-warning',
      error: 'bg-qm-error',
      auto: 'bg-qm-auto-answer',
      hidden: 'bg-qm-text-tertiary',
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
              dotColors[variant],
              pulsing && 'animate-pulse'
            )}
          />
        )}
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

// Status Badge with pulsing dot and ring animation
export interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  status: 'idle' | 'active' | 'processing' | 'error' | 'live';
  label?: string;
  showRing?: boolean;
}

export const StatusBadge = forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ className, status, label, showRing = false, ...props }, ref) => {
    const statusStyles = {
      idle: {
        dot: 'bg-qm-text-tertiary',
        badge: 'bg-qm-surface-medium text-qm-text-secondary',
        ring: '',
      },
      active: {
        dot: 'bg-qm-success',
        badge: 'bg-qm-success/15 text-qm-success',
        ring: 'ring-qm-success/30',
      },
      processing: {
        dot: 'bg-qm-accent',
        badge: 'bg-qm-accent/20 text-qm-accent',
        ring: 'ring-qm-accent/30',
      },
      error: {
        dot: 'bg-qm-error',
        badge: 'bg-qm-error/15 text-qm-error',
        ring: '',
      },
      live: {
        dot: 'bg-qm-error',
        badge: 'bg-qm-error/15 text-qm-error',
        ring: 'ring-qm-error/30',
      },
    };

    const styles = statusStyles[status];
    const shouldPulse = status === 'active' || status === 'processing' || status === 'live';

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
        <span className="relative flex items-center justify-center">
          {/* Pulse ring animation */}
          {shouldPulse && showRing && (
            <span
              className={clsx(
                'absolute w-3 h-3 rounded-full animate-ping opacity-75',
                status === 'active' && 'bg-qm-success/50',
                status === 'processing' && 'bg-qm-accent/50',
                status === 'live' && 'bg-qm-error/50'
              )}
            />
          )}
          {/* Main dot */}
          <span
            className={clsx(
              'relative w-1.5 h-1.5 rounded-full',
              styles.dot,
              shouldPulse && 'animate-pulse'
            )}
          />
        </span>
        {label || status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  }
);

StatusBadge.displayName = 'StatusBadge';

export default Badge;
