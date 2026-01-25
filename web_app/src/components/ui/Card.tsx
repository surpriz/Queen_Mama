// Queen Mama LITE - Card Component
// Enhanced with depth levels, glass variant, and hover animations

import { forwardRef, HTMLAttributes } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Spring transition for hover animations
const springTransition = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 25,
};

export interface CardProps extends Omit<HTMLMotionProps<'div'>, 'ref'> {
  variant?: 'default' | 'elevated' | 'bordered' | 'glass';
  depth?: 1 | 2 | 3 | 4 | 'floating';
  hoverable?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className,
      variant = 'default',
      depth,
      hoverable = false,
      padding = 'md',
      children,
      ...props
    },
    ref
  ) => {
    const variants = {
      default: 'bg-qm-surface-medium border-transparent',
      elevated: 'bg-qm-bg-elevated border-transparent',
      bordered: 'bg-qm-surface-light border-qm-border-subtle',
      glass: 'glass-liquid border-qm-border-subtle',
    };

    const paddings = {
      none: 'p-0',
      sm: 'p-3',
      md: 'p-4',
      lg: 'p-6',
    };

    // Depth shadow classes
    const depthClasses = {
      1: 'shadow-qm-depth-1',
      2: 'shadow-qm-depth-2',
      3: 'shadow-qm-depth-3',
      4: 'shadow-qm-depth-4',
      floating: 'shadow-qm-depth-floating',
    };

    // Hover animation variants
    const hoverAnimation = hoverable
      ? {
          y: -2,
          boxShadow: '0 12px 28px rgba(0, 0, 0, 0.25), 0 6px 12px rgba(0, 0, 0, 0.15)',
        }
      : undefined;

    return (
      <motion.div
        ref={ref}
        className={twMerge(
          clsx(
            'rounded-qm-lg border',
            variants[variant],
            paddings[padding],
            depth && depthClasses[depth],
            hoverable && 'cursor-pointer',
            className
          )
        )}
        whileHover={hoverAnimation}
        transition={springTransition}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

Card.displayName = 'Card';

// Card Header
export const CardHeader = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={twMerge('flex items-center gap-3 mb-3', className)}
    {...props}
  />
));

CardHeader.displayName = 'CardHeader';

// Card Title
export const CardTitle = forwardRef<
  HTMLHeadingElement,
  HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={twMerge('text-qm-headline text-qm-text-primary', className)}
    {...props}
  />
));

CardTitle.displayName = 'CardTitle';

// Card Description
export const CardDescription = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={twMerge('text-qm-body-sm text-qm-text-secondary', className)}
    {...props}
  />
));

CardDescription.displayName = 'CardDescription';

// Card Content
export const CardContent = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={twMerge('', className)} {...props} />
));

CardContent.displayName = 'CardContent';

// Card Footer
export const CardFooter = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={twMerge('flex items-center gap-3 mt-4 pt-4 border-t border-qm-border-subtle', className)}
    {...props}
  />
));

CardFooter.displayName = 'CardFooter';

export default Card;
