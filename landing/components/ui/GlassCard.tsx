"use client";

import { cn } from "@/lib/utils";
import { motion, HTMLMotionProps } from "framer-motion";
import { forwardRef } from "react";

interface GlassCardProps extends Omit<HTMLMotionProps<"div">, "ref"> {
  hover?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
  children: React.ReactNode;
}

const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, hover = true, padding = "md", children, ...props }, ref) => {
    const paddingClasses = {
      none: "",
      sm: "p-4",
      md: "p-6",
      lg: "p-8",
    };

    return (
      <motion.div
        ref={ref}
        className={cn(
          "relative overflow-hidden",
          "bg-[var(--qm-surface-medium)]",
          "backdrop-blur-xl",
          "border border-[var(--qm-border-subtle)]",
          "rounded-[var(--qm-radius-lg)]",
          "shadow-[var(--qm-shadow-md)]",
          hover && "transition-all duration-[var(--qm-duration-standard)]",
          hover && "hover:bg-[var(--qm-surface-hover)]",
          hover && "hover:border-[var(--qm-border-medium)]",
          hover && "hover:shadow-[var(--qm-shadow-lg)]",
          paddingClasses[padding],
          className
        )}
        whileHover={hover ? { y: -4 } : undefined}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

GlassCard.displayName = "GlassCard";

export { GlassCard };
