import { GlassCard } from "@/components/ui";

export interface UserProfitabilityRow {
  userId: string;
  name: string | null;
  email: string;
  plan: "PRO" | "ENTERPRISE";
  revenue: number;
  aiCost: number;
  transcriptionCost: number;
  totalCost: number;
  margin: number;
  aiRequestCount: number;
  transcriptionTokenCount: number;
}

function formatCurrency(dollars: number): string {
  if (dollars === 0) return "$0.00";
  const abs = Math.abs(dollars);
  const sign = dollars < 0 ? "-" : "";
  if (abs < 0.01) return `${sign}$${abs.toFixed(4)}`;
  return `${sign}$${abs.toFixed(2)}`;
}

function getPlanBadgeColor(plan: string) {
  switch (plan) {
    case "ENTERPRISE":
      return "bg-amber-500/20 text-amber-300";
    case "PRO":
      return "bg-green-500/20 text-green-300";
    default:
      return "bg-gray-500/20 text-gray-300";
  }
}

function getMarginColor(margin: number) {
  return margin >= 0 ? "text-green-400" : "text-red-400";
}

export function ProfitabilityTable({ users }: { users: UserProfitabilityRow[] }) {
  if (users.length === 0) {
    return (
      <GlassCard className="p-12 text-center">
        <div className="text-[var(--qm-text-secondary)]">
          No paid users with activity for this period
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[var(--qm-border-subtle)]">
          <thead className="bg-[var(--qm-surface-light)]">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-[var(--qm-text-secondary)] uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[var(--qm-text-secondary)] uppercase tracking-wider">
                Plan
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-[var(--qm-text-secondary)] uppercase tracking-wider">
                Revenue
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-[var(--qm-text-secondary)] uppercase tracking-wider">
                AI Cost
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-[var(--qm-text-secondary)] uppercase tracking-wider">
                Transcription
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-[var(--qm-text-secondary)] uppercase tracking-wider">
                Total Cost
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-[var(--qm-text-secondary)] uppercase tracking-wider">
                Margin
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-[var(--qm-text-secondary)] uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--qm-border-subtle)]">
            {users.map((user) => (
              <tr key={user.userId} className="hover:bg-[var(--qm-surface-light)]">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium">{user.name || "—"}</div>
                  <div className="text-xs text-[var(--qm-text-secondary)]">
                    {user.email}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${getPlanBadgeColor(
                      user.plan
                    )}`}
                  >
                    {user.plan}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                  {formatCurrency(user.revenue)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-[var(--qm-text-secondary)]">
                  <div>{formatCurrency(user.aiCost)}</div>
                  <div className="text-xs text-[var(--qm-text-tertiary)]">
                    {user.aiRequestCount} req
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-[var(--qm-text-secondary)]">
                  <div>{formatCurrency(user.transcriptionCost)}</div>
                  <div className="text-xs text-[var(--qm-text-tertiary)]">
                    {user.transcriptionTokenCount} sessions
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  {formatCurrency(user.totalCost)}
                </td>
                <td
                  className={`px-6 py-4 whitespace-nowrap text-right text-sm font-bold ${getMarginColor(
                    user.margin
                  )}`}
                >
                  {user.margin >= 0 ? "+" : ""}
                  {formatCurrency(user.margin)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      user.margin >= 0
                        ? "bg-green-500/20 text-green-300"
                        : "bg-red-500/20 text-red-300"
                    }`}
                  >
                    {user.margin >= 0 ? "Profitable" : "Unprofitable"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}
