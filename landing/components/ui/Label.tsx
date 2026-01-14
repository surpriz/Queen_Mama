"use client";

import { cn } from "@/lib/utils";
import { forwardRef, LabelHTMLAttributes } from "react";

interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, children, required, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn(
          "block text-sm font-medium text-[var(--qm-text-secondary)] mb-2",
          className
        )}
        {...props}
      >
        {children}
        {required && <span className="text-[var(--qm-error)] ml-1">*</span>}
      </label>
    );
  }
);

Label.displayName = "Label";

export { Label };
