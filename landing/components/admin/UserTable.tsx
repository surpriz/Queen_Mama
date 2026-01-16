"use client";

import { useState } from "react";
import type { UserRole } from "@prisma/client";
import { GlassCard } from "@/components/ui";

interface User {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
  createdAt: Date;
  subscription: {
    plan: string;
    status: string;
  } | null;
}

interface UserTableProps {
  users: User[];
  onRoleChange: (userId: string, role: UserRole) => Promise<void>;
  onDelete: (userId: string) => Promise<void>;
}

function getRoleBadgeColor(role: UserRole) {
  switch (role) {
    case "ADMIN":
      return "bg-purple-500/20 text-purple-300";
    case "BLOCKED":
      return "bg-red-500/20 text-red-300";
    default:
      return "bg-blue-500/20 text-blue-300";
  }
}

export function UserTable({ users, onRoleChange, onDelete }: UserTableProps) {
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>(
    {}
  );

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    setLoadingStates((prev) => ({ ...prev, [userId]: true }));
    try {
      await onRoleChange(userId, newRole);
    } finally {
      setLoadingStates((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const handleDelete = async (userId: string, userEmail: string) => {
    if (
      !confirm(
        `Are you sure you want to delete user "${userEmail}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    setLoadingStates((prev) => ({ ...prev, [userId]: true }));
    try {
      await onDelete(userId);
    } finally {
      setLoadingStates((prev) => ({ ...prev, [userId]: false }));
    }
  };

  return (
    <GlassCard className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[var(--qm-border-subtle)]">
          <thead className="bg-[var(--qm-surface-light)]">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-[var(--qm-text-secondary)] uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[var(--qm-text-secondary)] uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[var(--qm-text-secondary)] uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[var(--qm-text-secondary)] uppercase tracking-wider">
                Plan
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[var(--qm-text-secondary)] uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-[var(--qm-text-secondary)] uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--qm-border-subtle)]">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-[var(--qm-surface-light)]">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium">{user.name || "—"}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-[var(--qm-text-secondary)]">
                    {user.email}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <select
                    value={user.role}
                    onChange={(e) =>
                      handleRoleChange(user.id, e.target.value as UserRole)
                    }
                    disabled={loadingStates[user.id]}
                    className={`px-3 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(
                      user.role
                    )} bg-transparent border border-current cursor-pointer hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <option value="USER">USER</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="BLOCKED">BLOCKED</option>
                  </select>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-[var(--qm-text-secondary)]">
                    {user.subscription?.plan || "FREE"}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-[var(--qm-text-secondary)]">
                    {new Date(user.createdAt).toLocaleDateString("fr-FR")}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => handleDelete(user.id, user.email)}
                    disabled={loadingStates[user.id]}
                    className="text-red-400 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}
