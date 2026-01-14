"use client";

import { cn } from "@/lib/utils";
import { motion, HTMLMotionProps } from "framer-motion";
import { forwardRef } from "react";

interface GradientButtonProps extends Omit<HTMLMotionProps<"button">, "ref"> {
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "secondary" | "ghost";
  children: React.ReactNode;
}

const GradientButton = forwardRef<HTMLButtonElement, GradientButtonProps>(
  ({ className, size = "md", variant = "primary", children, ...props }, ref) => {
    const sizeClasses = {
      sm: "px-4 py-2 text-sm",
      md: "px-6 py-3 text-base",
      lg: "px-8 py-4 text-lg",
    };

    const variantClasses = {
      primary: "gradient-bg text-white shadow-[var(--qm-shadow-glow)]",
      secondary:
        "bg-[var(--qm-surface-medium)] text-white border border-[var(--qm-border-subtle)] hover:bg-[var(--qm-surface-hover)]",
      ghost:
        "bg-transparent text-[var(--qm-text-secondary)] hover:text-white hover:bg-[var(--qm-surface-light)]",
    };

    return (
      <motion.button
        ref={ref}
        className={cn(
          "relative inline-flex items-center justify-center gap-2",
          "font-medium rounded-full",
          "transition-all duration-[var(--qm-duration-quick)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--qm-accent)]",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          sizeClasses[size],
          variantClasses[variant],
          className
        )}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.98 }}
        {...props}
      >
        {children}
      </motion.button>
    );
  }
);

GradientButton.displayName = "GradientButton";

export { GradientButton };
