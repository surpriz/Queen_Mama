"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface DeleteSessionButtonProps {
  sessionId: string;
  sessionTitle: string;
}

export function DeleteSessionButton({ sessionId, sessionTitle }: DeleteSessionButtonProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/sync/sessions/${sessionId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to delete session");
      }

      router.refresh();
    } catch (error) {
      console.error("Delete failed:", error);
      alert(error instanceof Error ? error.message : "Failed to delete session");
    } finally {
      setIsDeleting(false);
      setShowConfirm(false);
    }
  };

  if (showConfirm) {
    return (
      <div className="flex items-center gap-2" onClick={(e) => e.preventDefault()}>
        <span className="text-xs text-[var(--qm-text-tertiary)]">Delete?</span>
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
          title="Confirm delete"
        >
          {isDeleting ? (
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
        <button
          onClick={(e) => {
            e.preventDefault();
            setShowConfirm(false);
          }}
          className="p-1.5 rounded-lg bg-[var(--qm-surface-hover)] text-[var(--qm-text-secondary)] hover:bg-[var(--qm-surface-light)] transition-colors"
          title="Cancel"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        setShowConfirm(true);
      }}
      className="p-1.5 rounded-lg text-[var(--qm-text-tertiary)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
      title={`Delete "${sessionTitle}"`}
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
        />
      </svg>
    </button>
  );
}
