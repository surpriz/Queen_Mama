// Queen Mama LITE - Input Component
// Enhanced with focus glow animation and floating labels

import { forwardRef, InputHTMLAttributes, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Spring transition for focus animations
const springTransition = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 30,
};

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  floatingLabel?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, leftIcon, rightIcon, id, floatingLabel = false, value, placeholder, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    const [isFocused, setIsFocused] = useState(false);
    const hasValue = value !== undefined && value !== '';

    // For floating label: show label above when focused or has value
    const showFloatingLabel = floatingLabel && (isFocused || hasValue);

    return (
      <div className="w-full">
        {/* Static label (non-floating) */}
        {label && !floatingLabel && (
          <label
            htmlFor={inputId}
            className="block text-qm-body-sm text-qm-text-secondary mb-1.5"
          >
            {label}
          </label>
        )}

        {/* Input wrapper with relative positioning for floating label */}
        <div className="relative">
          {/* Floating label */}
          {label && floatingLabel && (
            <AnimatePresence>
              <motion.label
                htmlFor={inputId}
                className={clsx(
                  'absolute left-3 pointer-events-none transition-colors',
                  showFloatingLabel
                    ? 'text-qm-caption text-qm-accent'
                    : 'text-qm-body-md text-qm-text-tertiary'
                )}
                initial={false}
                animate={{
                  y: showFloatingLabel ? -24 : 0,
                  scale: showFloatingLabel ? 0.85 : 1,
                }}
                transition={springTransition}
                style={{
                  top: '50%',
                  transform: 'translateY(-50%)',
                  transformOrigin: 'left center',
                }}
              >
                {label}
              </motion.label>
            </AnimatePresence>
          )}

          {leftIcon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-qm-text-tertiary">
              {leftIcon}
            </span>
          )}

          {/* Focus glow ring */}
          <motion.div
            className="absolute inset-0 rounded-qm-md pointer-events-none"
            initial={false}
            animate={{
              boxShadow: isFocused && !error
                ? '0 0 0 3px rgba(139, 92, 246, 0.15), 0 0 12px rgba(139, 92, 246, 0.1)'
                : isFocused && error
                ? '0 0 0 3px rgba(239, 68, 68, 0.15), 0 0 12px rgba(239, 68, 68, 0.1)'
                : '0 0 0 0 transparent',
            }}
            transition={{ duration: 0.2 }}
          />

          <input
            ref={ref}
            id={inputId}
            value={value}
            placeholder={floatingLabel && !showFloatingLabel ? undefined : placeholder}
            onFocus={(e) => {
              setIsFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              props.onBlur?.(e);
            }}
            className={twMerge(
              clsx(
                'w-full bg-qm-surface-light border border-qm-border-subtle rounded-qm-md px-3 py-2',
                'text-qm-body-md text-qm-text-primary placeholder:text-qm-text-tertiary',
                'transition-colors duration-150 ease-in-out',
                'focus:outline-none focus:border-qm-accent',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                leftIcon && 'pl-10',
                rightIcon && 'pr-10',
                floatingLabel && 'pt-4 pb-2',
                error && 'border-qm-error focus:border-qm-error',
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

        {/* Error message with animation */}
        <AnimatePresence>
          {error && (
            <motion.p
              className="mt-1 text-qm-caption text-qm-error"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    );
  }
);

Input.displayName = 'Input';

// TextArea variant with focus glow
export interface TextAreaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    const [isFocused, setIsFocused] = useState(false);

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
          {/* Focus glow ring */}
          <motion.div
            className="absolute inset-0 rounded-qm-md pointer-events-none"
            initial={false}
            animate={{
              boxShadow: isFocused && !error
                ? '0 0 0 3px rgba(139, 92, 246, 0.15), 0 0 12px rgba(139, 92, 246, 0.1)'
                : isFocused && error
                ? '0 0 0 3px rgba(239, 68, 68, 0.15), 0 0 12px rgba(239, 68, 68, 0.1)'
                : '0 0 0 0 transparent',
            }}
            transition={{ duration: 0.2 }}
          />

          <textarea
            ref={ref}
            id={inputId}
            onFocus={(e) => {
              setIsFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              props.onBlur?.(e);
            }}
            className={twMerge(
              clsx(
                'w-full bg-qm-surface-light border border-qm-border-subtle rounded-qm-md px-3 py-2',
                'text-qm-body-md text-qm-text-primary placeholder:text-qm-text-tertiary',
                'transition-colors duration-150 ease-in-out resize-none',
                'focus:outline-none focus:border-qm-accent',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                error && 'border-qm-error focus:border-qm-error',
                className
              )
            )}
            {...props}
          />
        </div>

        {/* Error message with animation */}
        <AnimatePresence>
          {error && (
            <motion.p
              className="mt-1 text-qm-caption text-qm-error"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    );
  }
);

TextArea.displayName = 'TextArea';

export default Input;
