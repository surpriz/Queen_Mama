"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui";
import {
  ProfitabilityTable,
  type UserProfitabilityRow,
} from "@/components/admin/ProfitabilityTable";

interface ProfitabilitySummary {
  totalRevenue: number;
  totalCosts: number;
  totalMargin: number;
  userCount: number;
}

interface ProfitabilityResponse {
  month: string;
  summary: ProfitabilitySummary;
  users: UserProfitabilityRow[];
}

interface TopConsumer {
  userId: string;
  name: string | null;
  email: string;
  plan: "PRO" | "ENTERPRISE";
  aiCost: number;
  transcriptionCost: number;
  totalCost: number;
  aiRequestCount: number;
  transcriptionTokenCount: number;
}

function generateMonthOptions() {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 13; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("fr-FR", {
      year: "numeric",
      month: "long",
    });
    options.push({ value, label });
  }
  return options;
}

function formatCurrency(dollars: number): string {
  if (dollars === 0) return "$0.00";
  const abs = Math.abs(dollars);
  const sign = dollars < 0 ? "-" : "";
  if (abs < 0.01) return `${sign}$${abs.toFixed(4)}`;
  return `${sign}$${abs.toFixed(2)}`;
}

const RANK_COLORS = [
  "text-yellow-400",   // #1 gold
  "text-gray-300",     // #2 silver
  "text-amber-600",    // #3 bronze
  "text-[var(--qm-text-secondary)]",
  "text-[var(--qm-text-secondary)]",
];

export default function ProfitabilityPage() {
  const monthOptions = generateMonthOptions();
  const [month, setMonth] = useState(monthOptions[0].value);
  const [data, setData] = useState<ProfitabilityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [topConsumers, setTopConsumers] = useState<TopConsumer[]>([]);

  // Fetch top 5 once on mount — independent of month filter
  useEffect(() => {
    fetch("/api/admin/profitability/top-consumers")
      .then((r) => r.json())
      .then((d) => setTopConsumers(d.users ?? []))
      .catch(() => {});
  }, []);

  const fetchProfitability = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/profitability?month=${month}`);
      if (!res.ok) throw new Error("Failed to fetch profitability data");
      const json: ProfitabilityResponse = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfitability();
  }, [month]);

  return (
    <div className="space-y-6">
      {/* Top 5 Biggest Consumers — always visible, all-time */}
      {topConsumers.length > 0 && (
        <div>
          <p className="text-xs font-medium text-[var(--qm-text-secondary)] uppercase tracking-wider mb-3">
            Top 5 biggest consumers (all-time)
          </p>
          <div className="grid gap-4 sm:grid-cols-5">
            {topConsumers.map((user, i) => (
              <GlassCard key={user.userId} className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <span className={`text-lg font-bold ${RANK_COLORS[i]}`}>
                    #{i + 1}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      user.plan === "ENTERPRISE"
                        ? "bg-amber-500/20 text-amber-300"
                        : "bg-green-500/20 text-green-300"
                    }`}
                  >
                    {user.plan}
                  </span>
                </div>
                <p className="text-sm font-medium truncate">{user.name || "—"}</p>
                <p className="text-xs text-[var(--qm-text-secondary)] truncate mb-3">
                  {user.email}
                </p>
                <p className="text-xl font-bold text-red-400">
                  {formatCurrency(user.totalCost)}
                </p>
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between text-xs text-[var(--qm-text-tertiary)]">
                    <span>AI</span>
                    <span>{formatCurrency(user.aiCost)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-[var(--qm-text-tertiary)]">
                    <span>Transcription</span>
                    <span>{formatCurrency(user.transcriptionCost)}</span>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      )}

      {/* Header + Month Selector */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Profitability</h1>
          <p className="text-[var(--qm-text-secondary)] mt-2">
            Revenue vs. AI and transcription costs per user
          </p>
        </div>
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="px-4 py-2 rounded-[var(--qm-radius-md)] bg-[var(--qm-surface-light)] border border-[var(--qm-border-subtle)] text-white focus:outline-none focus:border-[var(--qm-accent)]"
        >
          {monthOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Loading */}
      {loading && (
        <GlassCard className="p-12 text-center">
          <div className="text-[var(--qm-text-secondary)]">Loading...</div>
        </GlassCard>
      )}

      {/* Error */}
      {error && !loading && (
        <GlassCard className="p-12 text-center">
          <div className="text-red-400">{error}</div>
        </GlassCard>
      )}

      {/* Summary Cards */}
      {data && !loading && !error && (
        <>
          <div className="grid gap-6 sm:grid-cols-4">
            <GlassCard className="p-6">
              <div>
                <p className="text-sm text-[var(--qm-text-secondary)]">
                  Total Revenue
                </p>
                <p className="text-3xl font-bold mt-2">
                  {formatCurrency(data.summary.totalRevenue)}
                </p>
              </div>
            </GlassCard>

            <GlassCard className="p-6">
              <div>
                <p className="text-sm text-[var(--qm-text-secondary)]">
                  Total Costs
                </p>
                <p className="text-3xl font-bold mt-2">
                  {formatCurrency(data.summary.totalCosts)}
                </p>
              </div>
            </GlassCard>

            <GlassCard className="p-6">
              <div>
                <p className="text-sm text-[var(--qm-text-secondary)]">
                  Net Margin
                </p>
                <p
                  className={`text-3xl font-bold mt-2 ${
                    data.summary.totalMargin >= 0
                      ? "text-green-400"
                      : "text-red-400"
                  }`}
                >
                  {data.summary.totalMargin >= 0 ? "+" : ""}
                  {formatCurrency(data.summary.totalMargin)}
                </p>
              </div>
            </GlassCard>

            <GlassCard className="p-6">
              <div>
                <p className="text-sm text-[var(--qm-text-secondary)]">
                  Paid Users
                </p>
                <p className="text-3xl font-bold mt-2">
                  {data.summary.userCount}
                </p>
              </div>
            </GlassCard>
          </div>

          {/* Profitability Table */}
          <ProfitabilityTable users={data.users} />
        </>
      )}
    </div>
  );
}
