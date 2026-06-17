"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface DeviceActionsProps {
  deviceId: string;
  deviceName: string;
  isActive: boolean;
}

export function DeviceActions({ deviceId, deviceName, isActive }: DeviceActionsProps) {
  const router = useRouter();
  const [isBusy, setIsBusy] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const deactivate = async () => {
    setIsBusy(true);
    try {
      const res = await fetch(`/api/user/devices/${deviceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to sign out device");
      }
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to sign out device");
    } finally {
      setIsBusy(false);
    }
  };

  const remove = async () => {
    setIsBusy(true);
    try {
      const res = await fetch(`/api/user/devices/${deviceId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to remove device");
      }
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to remove device");
    } finally {
      setIsBusy(false);
      setShowConfirm(false);
    }
  };

  if (showConfirm) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--qm-text-tertiary)]">Remove?</span>
        <button
          onClick={remove}
          disabled={isBusy}
          className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/30 transition-colors disabled:opacity-50"
        >
          {isBusy ? "Removing…" : "Yes, remove"}
        </button>
        <button
          onClick={() => setShowConfirm(false)}
          disabled={isBusy}
          className="px-3 py-1.5 rounded-lg bg-[var(--qm-surface-hover)] text-[var(--qm-text-secondary)] text-xs font-medium hover:bg-[var(--qm-surface-light)] transition-colors"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {isActive && (
        <button
          onClick={deactivate}
          disabled={isBusy}
          className="px-3 py-1.5 rounded-lg bg-[var(--qm-surface-hover)] text-[var(--qm-text-secondary)] text-xs font-medium hover:bg-[var(--qm-surface-light)] hover:text-white transition-colors disabled:opacity-50"
          title="Sign this device out — frees a slot, keeps it in the list"
        >
          Sign out
        </button>
      )}
      <button
        onClick={() => setShowConfirm(true)}
        disabled={isBusy}
        className="px-3 py-1.5 rounded-lg text-[var(--qm-text-tertiary)] text-xs font-medium hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
        title={`Remove "${deviceName}"`}
      >
        Remove
      </button>
    </div>
  );
}
