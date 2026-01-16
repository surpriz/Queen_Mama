"use client";

import { useState, useRef, useEffect } from "react";

interface DeviceAuthFormProps {
  userName: string;
}

type AuthStatus = "idle" | "loading" | "success" | "error";

export function DeviceAuthForm({ userName }: DeviceAuthFormProps) {
  const [code, setCode] = useState(["", "", "", "", "", "", "", ""]);
  const [status, setStatus] = useState<AuthStatus>("idle");
  const [message, setMessage] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleInputChange = (index: number, value: string) => {
    // Handle paste
    if (value.length > 1) {
      const pastedCode = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
      const newCode = [...code];
      for (let i = 0; i < pastedCode.length && index + i < 8; i++) {
        newCode[index + i] = pastedCode[i];
      }
      setCode(newCode);

      // Focus the next empty input or last input
      const nextIndex = Math.min(index + pastedCode.length, 7);
      inputRefs.current[nextIndex]?.focus();
      return;
    }

    // Single character input
    const char = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (char || value === "") {
      const newCode = [...code];
      newCode[index] = char;
      setCode(newCode);

      // Auto-advance to next input
      if (char && index < 7) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowRight" && index < 7) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const formatCode = () => {
    return `${code.slice(0, 4).join("")}-${code.slice(4).join("")}`;
  };

  const isCodeComplete = code.every((c) => c.length === 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCodeComplete) return;

    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/auth/device/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userCode: formatCode() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus("error");
        setMessage(data.message || data.error || "Authorization failed");
        return;
      }

      setStatus("success");
      setDeviceName(data.deviceName || "your device");
      setMessage("Device authorized successfully!");
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  };

  const handleReset = () => {
    setCode(["", "", "", "", "", "", "", ""]);
    setStatus("idle");
    setMessage("");
    setDeviceName("");
    inputRefs.current[0]?.focus();
  };

  if (status === "success") {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
          <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">Device Authorized</h3>
        <p className="text-[var(--qm-text-secondary)] mb-4">
          {deviceName} is now connected to your account.
        </p>
        <p className="text-[var(--qm-text-tertiary)] text-sm mb-6">
          You can close this page and return to your Mac.
        </p>
        <button
          onClick={handleReset}
          className="text-[var(--qm-accent)] hover:text-[var(--qm-accent-light)] transition-colors text-sm"
        >
          Authorize another device
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <p className="text-center text-[var(--qm-text-secondary)] mb-6">
        Hi {userName}, enter the 8-character code from your Mac
      </p>

      <div className="flex justify-center items-center gap-1 mb-6">
        {code.map((char, index) => (
          <div key={index} className="flex items-center">
            <input
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              type="text"
              value={char}
              onChange={(e) => handleInputChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              maxLength={8}
              className={`w-10 h-12 text-center text-xl font-mono font-bold uppercase
                bg-[var(--qm-surface-dark)] border rounded-lg
                text-white placeholder-[var(--qm-text-tertiary)]
                focus:outline-none focus:ring-2 focus:ring-[var(--qm-accent)]/50 focus:border-[var(--qm-accent)]
                transition-all
                ${status === "error" ? "border-red-500" : "border-[var(--qm-border-subtle)]"}`}
              placeholder="-"
              autoComplete="off"
              autoCapitalize="characters"
            />
            {index === 3 && (
              <span className="mx-1 text-[var(--qm-text-tertiary)] text-xl font-bold">-</span>
            )}
          </div>
        ))}
      </div>

      {message && (
        <p className={`text-center text-sm mb-4 ${status === "error" ? "text-red-400" : "text-[var(--qm-text-secondary)]"}`}>
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={!isCodeComplete || status === "loading"}
        className={`w-full py-3 px-4 rounded-xl font-medium transition-all
          ${isCodeComplete && status !== "loading"
            ? "gradient-bg text-white hover:opacity-90"
            : "bg-[var(--qm-surface-light)] text-[var(--qm-text-tertiary)] cursor-not-allowed"
          }`}
      >
        {status === "loading" ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Authorizing...
          </span>
        ) : (
          "Authorize Device"
        )}
      </button>

      <p className="mt-4 text-center text-xs text-[var(--qm-text-tertiary)]">
        Code format: ABCD-1234
      </p>
    </form>
  );
}
