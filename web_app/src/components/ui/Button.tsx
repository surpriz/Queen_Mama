// Queen Mama LITE - Button Component
// Enhanced with Framer Motion spring physics and premium micro-interactions

import { forwardRef, useState, useCallback } from 'react';
import { motion, HTMLMotionProps, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Spring physics for premium feel
const springTransition = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 25,
};

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'ref' | 'children'> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children?: React.ReactNode;
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
      onClick,
      ...props
    },
    ref
  ) => {
    const [ripple, setRipple] = useState<{ x: number; y: number; key: number } | null>(null);

    // Handle ripple effect on click
    const handleClick = useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        if (disabled || isLoading) return;

        // Create ripple at click position
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setRipple({ x, y, key: Date.now() });

        // Clear ripple after animation
        setTimeout(() => setRipple(null), 500);

        // Call original onClick
        onClick?.(e);
      },
      [disabled, isLoading, onClick]
    );

    const baseStyles =
      'relative inline-flex items-center justify-center gap-2 font-medium cursor-pointer border-none rounded-qm-md disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden';

    const variants = {
      primary:
        'bg-qm-gradient text-white',
      secondary:
        'bg-qm-surface-medium text-qm-text-primary',
      ghost:
        'bg-transparent text-qm-text-secondary',
      danger:
        'bg-qm-error/15 text-qm-error',
    };

    const sizes = {
      sm: 'h-7 px-3 text-xs',
      md: 'h-9 px-4 text-sm',
      lg: 'h-11 px-5 text-base',
    };

    // Hover and tap animations per variant
    const hoverVariants = {
      primary: {
        scale: 1.02,
        boxShadow: '0 0 16px rgba(139, 92, 246, 0.35)',
      },
      secondary: {
        scale: 1.01,
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
      },
      ghost: {
        scale: 1.01,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
      },
      danger: {
        scale: 1.01,
        backgroundColor: 'rgba(239, 68, 68, 0.25)',
      },
    };

    const tapVariants = {
      primary: { scale: 0.98 },
      secondary: { scale: 0.98, backgroundColor: 'rgba(255, 255, 255, 0.15)' },
      ghost: { scale: 0.98 },
      danger: { scale: 0.98, backgroundColor: 'rgba(239, 68, 68, 0.30)' },
    };

    return (
      <motion.button
        ref={ref}
        className={twMerge(
          clsx(baseStyles, variants[variant], sizes[size], className)
        )}
        disabled={disabled || isLoading}
        onClick={handleClick}
        whileHover={!disabled && !isLoading ? hoverVariants[variant] : undefined}
        whileTap={!disabled && !isLoading ? tapVariants[variant] : undefined}
        transition={springTransition}
        {...props}
      >
        {/* Ripple effect */}
        <AnimatePresence>
          {ripple && (
            <motion.span
              key={ripple.key}
              className="absolute rounded-full bg-white/15 pointer-events-none"
              initial={{
                width: 0,
                height: 0,
                x: ripple.x,
                y: ripple.y,
                opacity: 0.6,
              }}
              animate={{
                width: 200,
                height: 200,
                x: ripple.x - 100,
                y: ripple.y - 100,
                opacity: 0,
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          )}
        </AnimatePresence>

        {/* Loading state with staggered dots */}
        {isLoading ? (
          <span className="flex items-center gap-1">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-current"
                animate={{
                  scale: [0.8, 1.2, 0.8],
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 0.8,
                  repeat: Infinity,
                  delay: i * 0.15,
                  ease: 'easeInOut',
                }}
              />
            ))}
          </span>
        ) : leftIcon ? (
          <span className="flex-shrink-0 relative z-10">{leftIcon}</span>
        ) : null}
        <span className="relative z-10">{children}</span>
        {rightIcon && !isLoading && (
          <span className="flex-shrink-0 relative z-10">{rightIcon}</span>
        )}
      </motion.button>
    );
  }
);

Button.displayName = 'Button';

// Icon Button variant with spring animations
export interface IconButtonProps extends Omit<HTMLMotionProps<'button'>, 'ref' | 'children'> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  'aria-label': string;
  children?: React.ReactNode;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant = 'ghost', size = 'md', disabled, children, ...props }, ref) => {
    const baseStyles =
      'relative inline-flex items-center justify-center rounded-full cursor-pointer border-none disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden';

    const variants = {
      primary: 'bg-qm-gradient text-white',
      secondary: 'bg-qm-surface-medium text-qm-text-primary',
      ghost: 'bg-transparent text-qm-text-secondary',
      danger: 'bg-qm-error/15 text-qm-error',
    };

    const sizes = {
      sm: 'h-7 w-7 text-sm',
      md: 'h-8 w-8 text-base',
      lg: 'h-10 w-10 text-lg',
    };

    const hoverVariants = {
      primary: { scale: 1.08, boxShadow: '0 0 12px rgba(139, 92, 246, 0.3)' },
      secondary: { scale: 1.05, backgroundColor: 'rgba(255, 255, 255, 0.12)' },
      ghost: { scale: 1.05, backgroundColor: 'rgba(255, 255, 255, 0.08)' },
      danger: { scale: 1.05, backgroundColor: 'rgba(239, 68, 68, 0.25)' },
    };

    return (
      <motion.button
        ref={ref}
        className={twMerge(clsx(baseStyles, variants[variant], sizes[size], className))}
        whileHover={!disabled ? hoverVariants[variant] : undefined}
        whileTap={!disabled ? { scale: 0.92 } : undefined}
        transition={springTransition}
        {...props}
      >
        {children}
      </motion.button>
    );
  }
);

IconButton.displayName = 'IconButton';

export default Button;
