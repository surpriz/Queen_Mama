// Queen Mama LITE - Badge Component
// Enhanced with glow auras and refined animations

import { forwardRef, HTMLAttributes } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'accent' | 'success' | 'warning' | 'error' | 'auto' | 'hidden';
  size?: 'sm' | 'md';
  dot?: boolean;
  pulsing?: boolean;
  glow?: boolean;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', size = 'md', dot = false, pulsing = false, glow = false, children, ...props }, ref) => {
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

    // Subtle glow classes per variant
    const glowClasses = {
      default: '',
      accent: 'shadow-qm-glow-subtle',
      success: 'shadow-qm-glow-success',
      warning: '',
      error: 'shadow-qm-glow-error',
      auto: 'shadow-qm-glow-auto',
      hidden: '',
    };

    return (
      <span
        ref={ref}
        className={twMerge(
          clsx(
            'inline-flex items-center gap-1 font-medium rounded-qm-pill transition-shadow duration-200',
            variants[variant],
            sizes[size],
            glow && glowClasses[variant],
            className
          )
        )}
        {...props}
      >
        {dot && (
          <span
            className={clsx(
              'w-1.5 h-1.5 rounded-full transition-opacity',
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

// Status Badge with enhanced glow aura and refined animations
export interface StatusBadgeProps {
  status: 'idle' | 'active' | 'processing' | 'error' | 'live';
  label?: string;
  showRing?: boolean;
  className?: string;
}

export const StatusBadge = forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ className, status, label, showRing = false }, ref) => {
    const statusStyles = {
      idle: {
        dot: 'bg-qm-text-tertiary',
        badge: 'bg-qm-surface-medium text-qm-text-secondary',
        glow: '',
        ringColor: 'rgba(128, 128, 128, 0.3)',
      },
      active: {
        dot: 'bg-qm-success',
        badge: 'bg-qm-success/15 text-qm-success',
        glow: 'shadow-qm-glow-success',
        ringColor: 'rgba(16, 185, 129, 0.4)',
      },
      processing: {
        dot: 'bg-qm-accent',
        badge: 'bg-qm-accent/20 text-qm-accent',
        glow: 'shadow-qm-glow-subtle',
        ringColor: 'rgba(139, 92, 246, 0.4)',
      },
      error: {
        dot: 'bg-qm-error',
        badge: 'bg-qm-error/15 text-qm-error',
        glow: 'shadow-qm-glow-error',
        ringColor: 'rgba(239, 68, 68, 0.4)',
      },
      live: {
        dot: 'bg-qm-error',
        badge: 'bg-qm-error/15 text-qm-error',
        glow: 'shadow-qm-glow-error',
        ringColor: 'rgba(239, 68, 68, 0.4)',
      },
    };

    const styles = statusStyles[status];
    const shouldPulse = status === 'active' || status === 'processing' || status === 'live';

    return (
      <motion.span
        ref={ref}
        className={twMerge(
          clsx(
            'inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium rounded-qm-pill transition-shadow duration-300',
            styles.badge,
            shouldPulse && styles.glow,
            className
          )
        )}
        initial={false}
        animate={shouldPulse ? {
          boxShadow: [
            `0 0 0 0 ${styles.ringColor}`,
            `0 0 8px 0 ${styles.ringColor}`,
            `0 0 0 0 ${styles.ringColor}`,
          ],
        } : undefined}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        <span className="relative flex items-center justify-center">
          {/* Subtle outer ring pulse */}
          <AnimatePresence>
            {shouldPulse && showRing && (
              <motion.span
                className="absolute rounded-full"
                style={{ backgroundColor: styles.ringColor }}
                initial={{ width: 6, height: 6, opacity: 0.6 }}
                animate={{
                  width: [6, 14, 6],
                  height: [6, 14, 6],
                  opacity: [0.6, 0, 0.6],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            )}
          </AnimatePresence>
          {/* Main dot with subtle pulse */}
          <motion.span
            className={clsx(
              'relative w-1.5 h-1.5 rounded-full',
              styles.dot
            )}
            animate={shouldPulse ? {
              scale: [1, 1.15, 1],
              opacity: [1, 0.8, 1],
            } : undefined}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        </span>
        {label || status.charAt(0).toUpperCase() + status.slice(1)}
      </motion.span>
    );
  }
);

StatusBadge.displayName = 'StatusBadge';

export default Badge;
