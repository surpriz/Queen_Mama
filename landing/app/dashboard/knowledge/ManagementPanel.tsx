"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui";

interface ManagementStats {
  total: number;
  limit: number;
  lowQualityCount: number;
  staleCount: number;
  duplicateEstimate: number;
  healthScore: number;
}

interface ManagementResponse {
  stats: ManagementStats;
  limits: {
    MAX_ATOMS_PER_USER: number;
    PURGE_MIN_USES: number;
    PURGE_MIN_HELPFUL_RATIO: number;
    STALE_DAYS: number;
  };
  recommendations: string[];
}

export function ManagementPanel() {
  const [data, setData] = useState<ManagementResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const router = useRouter();

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/knowledge/manage");
      if (response.ok) {
        const json = await response.json();
        setData(json);
      }
    } catch (error) {
      console.error("Failed to fetch management stats:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const executeAction = async (action: "purge" | "consolidate" | "full_maintenance") => {
    setActionLoading(action);
    setLastResult(null);

    try {
      const response = await fetch("/api/knowledge/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (response.ok) {
        const json = await response.json();
        setData((prev) => (prev ? { ...prev, stats: json.updatedStats } : prev));

        // Format result message
        if (action === "purge") {
          setLastResult(`Removed ${json.result.purgedCount} atoms (${json.result.lowQualityCount} low quality, ${json.result.staleCount} stale)`);
        } else if (action === "consolidate") {
          setLastResult(`Merged ${json.result.atomsMerged} duplicate atoms from ${json.result.groupsFound} groups`);
        } else {
          setLastResult(`Purged ${json.result.purge.purgedCount} atoms, merged ${json.result.consolidation?.atomsMerged ?? 0}`);
        }

        router.refresh();
      } else {
        setLastResult("Action failed. Please try again.");
      }
    } catch (error) {
      console.error("Action failed:", error);
      setLastResult("Action failed. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <GlassCard padding="md">
        <div className="animate-pulse">
          <div className="h-4 bg-[var(--qm-surface-hover)] rounded w-1/3 mb-4"></div>
          <div className="h-2 bg-[var(--qm-surface-hover)] rounded w-full mb-2"></div>
          <div className="h-2 bg-[var(--qm-surface-hover)] rounded w-2/3"></div>
        </div>
      </GlassCard>
    );
  }

  if (!data) return null;

  const { stats, recommendations } = data;
  const usagePercent = (stats.total / stats.limit) * 100;

  return (
    <GlassCard padding="md">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium text-white">Knowledge Management</h2>
        <div
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            stats.healthScore >= 80
              ? "bg-green-500/20 text-green-400"
              : stats.healthScore >= 60
                ? "bg-yellow-500/20 text-yellow-400"
                : "bg-red-500/20 text-red-400"
          }`}
        >
          Health: {stats.healthScore}%
        </div>
      </div>

      {/* Usage Meter */}
      <div className="mb-6">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-[var(--qm-text-secondary)]">Storage Used</span>
          <span className="text-white">
            {stats.total} / {stats.limit} atoms
          </span>
        </div>
        <div className="h-2 bg-[var(--qm-surface-hover)] rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              usagePercent > 90
                ? "bg-red-500"
                : usagePercent > 70
                  ? "bg-yellow-500"
                  : "bg-[var(--qm-accent)]"
            }`}
            style={{ width: `${Math.min(100, usagePercent)}%` }}
          />
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center">
          <p className="text-2xl font-semibold text-red-400">{stats.lowQualityCount}</p>
          <p className="text-xs text-[var(--qm-text-tertiary)]">Low Quality</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-semibold text-yellow-400">{stats.staleCount}</p>
          <p className="text-xs text-[var(--qm-text-tertiary)]">Stale (90+ days)</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-semibold text-blue-400">~{stats.duplicateEstimate}</p>
          <p className="text-xs text-[var(--qm-text-tertiary)]">Est. Duplicates</p>
        </div>
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="mb-6 p-3 rounded-lg bg-[var(--qm-surface-hover)] border border-[var(--qm-border)]">
          <p className="text-xs font-medium text-[var(--qm-text-secondary)] mb-2">Recommendations</p>
          <ul className="space-y-1">
            {recommendations.slice(0, 3).map((rec, i) => (
              <li key={i} className="text-xs text-[var(--qm-text-tertiary)] flex items-start gap-2">
                <span className="text-[var(--qm-accent)]">•</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => executeAction("purge")}
          disabled={actionLoading !== null || (stats.lowQualityCount === 0 && stats.staleCount === 0)}
          className="flex-1 px-3 py-2 text-sm font-medium rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {actionLoading === "purge" ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Purging...
            </span>
          ) : (
            "Purge Low Quality"
          )}
        </button>

        <button
          onClick={() => executeAction("consolidate")}
          disabled={actionLoading !== null || stats.duplicateEstimate === 0}
          className="flex-1 px-3 py-2 text-sm font-medium rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {actionLoading === "consolidate" ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Merging...
            </span>
          ) : (
            "Merge Duplicates"
          )}
        </button>

        <button
          onClick={() => executeAction("full_maintenance")}
          disabled={actionLoading !== null}
          className="w-full px-3 py-2 text-sm font-medium rounded-lg bg-[var(--qm-accent)]/20 text-[var(--qm-accent)] hover:bg-[var(--qm-accent)]/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {actionLoading === "full_maintenance" ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Running...
            </span>
          ) : (
            "Full Maintenance"
          )}
        </button>
      </div>

      {/* Result Message */}
      {lastResult && (
        <div className="mt-4 p-2 rounded-lg bg-green-500/10 border border-green-500/30">
          <p className="text-xs text-green-400">{lastResult}</p>
        </div>
      )}
    </GlassCard>
  );
}
