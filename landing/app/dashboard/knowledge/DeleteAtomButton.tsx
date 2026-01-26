"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface DeleteAtomButtonProps {
  atomId: string;
}

export function DeleteAtomButton({ atomId }: DeleteAtomButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/knowledge?id=${atomId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        router.refresh();
      } else {
        console.error("Failed to delete atom");
      }
    } catch (error) {
      console.error("Delete error:", error);
    } finally {
      setIsDeleting(false);
      setShowConfirm(false);
    }
  };

  if (showConfirm) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="px-3 py-1 text-xs font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50"
        >
          {isDeleting ? "..." : "Delete"}
        </button>
        <button
          onClick={() => setShowConfirm(false)}
          className="px-3 py-1 text-xs font-medium text-[var(--qm-text-secondary)] bg-[var(--qm-surface-hover)] rounded-lg hover:bg-[var(--qm-surface-light)]"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      className="p-2 text-[var(--qm-text-tertiary)] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
      title="Delete knowledge atom"
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
