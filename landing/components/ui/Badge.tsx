import { cn } from "@/lib/utils";

interface BadgeProps {
  variant?: "default" | "success" | "warning" | "accent" | "auto-answer";
  size?: "sm" | "md";
  children: React.ReactNode;
  className?: string;
}

const variantClasses = {
  default: "bg-[var(--qm-surface-medium)] text-[var(--qm-text-secondary)]",
  success: "bg-[var(--qm-success-light)] text-[var(--qm-success)]",
  warning: "bg-[var(--qm-warning-light)] text-[var(--qm-warning)]",
  accent: "bg-[rgba(139,92,246,0.2)] text-[var(--qm-accent-light)]",
  "auto-answer": "bg-[var(--qm-auto-answer-light)] text-[var(--qm-auto-answer)]",
};

const sizeClasses = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-3 py-1 text-sm",
};

export function Badge({
  variant = "default",
  size = "md",
  children,
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5",
        "font-medium rounded-full",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {children}
    </span>
  );
}
