import { cn } from "@/lib/utils";

interface KeyboardShortcutProps {
  shortcut: string;
  size?: "sm" | "md";
  className?: string;
}

const keyMappings: Record<string, string> = {
  cmd: "\u2318",
  command: "\u2318",
  shift: "\u21E7",
  option: "\u2325",
  opt: "\u2325",
  alt: "\u2325",
  ctrl: "\u2303",
  control: "\u2303",
  enter: "\u21A9",
  return: "\u21A9",
  esc: "\u238B",
  escape: "\u238B",
  tab: "\u21E5",
  space: "\u2423",
  delete: "\u232B",
  backspace: "\u232B",
  up: "\u2191",
  down: "\u2193",
  left: "\u2190",
  right: "\u2192",
  "\\": "\\",
};

function parseShortcut(shortcut: string): string[] {
  return shortcut.split("+").map((key) => {
    const trimmed = key.trim().toLowerCase();
    return keyMappings[trimmed] || key.toUpperCase();
  });
}

export function KeyboardShortcut({
  shortcut,
  size = "md",
  className,
}: KeyboardShortcutProps) {
  const keys = parseShortcut(shortcut);

  const sizeClasses = {
    sm: "px-1 py-0.5 text-[10px] min-w-[18px]",
    md: "px-1.5 py-0.5 text-xs min-w-[22px]",
  };

  return (
    <span className={cn("inline-flex gap-0.5", className)}>
      {keys.map((key, index) => (
        <kbd
          key={index}
          className={cn(
            "inline-flex items-center justify-center",
            "font-mono font-medium",
            "bg-[var(--qm-surface-medium)]",
            "text-[var(--qm-text-tertiary)]",
            "border border-[var(--qm-border-subtle)]",
            "rounded-[var(--qm-radius-xs)]",
            sizeClasses[size]
          )}
        >
          {key}
        </kbd>
      ))}
    </span>
  );
}
