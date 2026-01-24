"use client";

import { useEffect, useState } from "react";
import { getLastAuthMethod, type AuthMethod } from "./OAuthButtons";
import { cn } from "@/lib/utils";

export function EmailDivider() {
  const [lastMethod, setLastMethod] = useState<AuthMethod | null>(null);

  useEffect(() => {
    setLastMethod(getLastAuthMethod());
  }, []);

  const isLastUsed = lastMethod === "email";

  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-[var(--qm-border-subtle)]" />
      </div>
      <div className="relative flex justify-center text-sm">
        <span
          className={cn(
            "px-4 bg-[var(--qm-surface-medium)]",
            isLastUsed
              ? "text-[var(--qm-accent)] font-medium"
              : "text-[var(--qm-text-tertiary)]"
          )}
        >
          {isLastUsed ? "✓ Last used: email" : "or continue with email"}
        </span>
      </div>
    </div>
  );
}
