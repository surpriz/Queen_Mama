// Queen Mama LITE - Card Component

import { forwardRef, HTMLAttributes } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'bordered';
  hoverable?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className,
      variant = 'default',
      hoverable = false,
      padding = 'md',
      children,
      ...props
    },
    ref
  ) => {
    const variants = {
      default: 'bg-qm-surface-medium border-transparent',
      elevated: 'bg-qm-bg-elevated shadow-qm-md border-transparent',
      bordered: 'bg-qm-surface-light border-qm-border-subtle',
    };

    const paddings = {
      none: 'p-0',
      sm: 'p-3',
      md: 'p-4',
      lg: 'p-6',
    };

    return (
      <div
        ref={ref}
        className={twMerge(
          clsx(
            'rounded-qm-lg border transition-all duration-150 ease-in-out',
            variants[variant],
            paddings[padding],
            hoverable && 'hover:bg-qm-surface-hover cursor-pointer',
            className
          )
        )}
        {...props}
      >
        {children}
      </div>
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
