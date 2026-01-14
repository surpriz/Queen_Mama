"use client";

import { cn } from "@/lib/utils";
import { forwardRef, InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", error, ...props }, ref) => {
    return (
      <div className="relative">
        <input
          type={type}
          className={cn(
            "w-full px-4 py-3",
            "bg-[var(--qm-surface-light)]",
            "border border-[var(--qm-border-subtle)]",
            "rounded-[var(--qm-radius-md)]",
            "text-white placeholder:text-[var(--qm-text-disabled)]",
            "transition-all duration-[var(--qm-duration-quick)]",
            "focus:outline-none focus:border-[var(--qm-accent)]",
            "focus:ring-1 focus:ring-[var(--qm-accent)]",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            error && "border-[var(--qm-error)] focus:border-[var(--qm-error)] focus:ring-[var(--qm-error)]",
            className
          )}
          ref={ref}
          {...props}
        />
        {error && (
          <p className="mt-1 text-sm text-[var(--qm-error)]">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };
