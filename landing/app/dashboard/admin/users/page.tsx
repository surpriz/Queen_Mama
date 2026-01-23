"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { UserTable } from "@/components/admin/UserTable";
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

interface UsersResponse {
  users: User[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export default function AdminUsersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [roleFilter, setRoleFilter] = useState<UserRole | "">(
    (searchParams.get("role") as UserRole) || ""
  );

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", searchParams.get("page") || "1");
      params.set("limit", "20");
      if (search) params.set("search", search);
      if (roleFilter) params.set("role", roleFilter);

      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch users");

      const data: UsersResponse = await res.json();
      setUsers(data.users);
      setPagination(data.pagination);
    } catch (error) {
      console.error("Error fetching users:", error);
      alert("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [searchParams]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (roleFilter) params.set("role", roleFilter);
    params.set("page", "1");
    router.push(`/dashboard/admin/users?${params.toString()}`);
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update role");
      }

      // Refresh users list
      await fetchUsers();
    } catch (error) {
      console.error("Error updating role:", error);
      alert(
        error instanceof Error ? error.message : "Failed to update user role"
      );
    }
  };

  const handlePlanChange = async (userId: string, newPlan: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/plan`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: newPlan }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update plan");
      }

      // Refresh users list
      await fetchUsers();
    } catch (error) {
      console.error("Error updating plan:", error);
      alert(
        error instanceof Error ? error.message : "Failed to update user plan"
      );
    }
  };

  const handleDelete = async (userId: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete user");
      }

      // Refresh users list
      await fetchUsers();
    } catch (error) {
      console.error("Error deleting user:", error);
      alert(error instanceof Error ? error.message : "Failed to delete user");
    }
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    router.push(`/dashboard/admin/users?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold gradient-text">User Management</h1>
        <p className="text-[var(--qm-text-secondary)] mt-2">
          Manage user accounts, roles, and permissions
        </p>
      </div>

      {/* Filters */}
      <GlassCard className="p-6">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-4 py-2 rounded-[var(--qm-radius-md)] bg-[var(--qm-surface-light)] border border-[var(--qm-border-subtle)] text-white placeholder-[var(--qm-text-tertiary)] focus:outline-none focus:border-[var(--qm-accent)]"
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as UserRole | "")}
            className="px-4 py-2 rounded-[var(--qm-radius-md)] bg-[var(--qm-surface-light)] border border-[var(--qm-border-subtle)] text-white focus:outline-none focus:border-[var(--qm-accent)]"
          >
            <option value="">All Roles</option>
            <option value="USER">USER</option>
            <option value="ADMIN">ADMIN</option>
            <option value="BLOCKED">BLOCKED</option>
          </select>
          <button
            type="submit"
            className="px-6 py-2 rounded-[var(--qm-radius-md)] bg-[var(--qm-accent)] hover:bg-[var(--qm-accent-hover)] text-white font-medium transition-colors"
          >
            Search
          </button>
        </form>
      </GlassCard>

      {/* Users Table */}
      {loading ? (
        <GlassCard className="p-12 text-center">
          <div className="text-[var(--qm-text-secondary)]">Loading...</div>
        </GlassCard>
      ) : users.length === 0 ? (
        <GlassCard className="p-12 text-center">
          <div className="text-[var(--qm-text-secondary)]">No users found</div>
        </GlassCard>
      ) : (
        <>
          <UserTable
            users={users}
            onRoleChange={handleRoleChange}
            onPlanChange={handlePlanChange}
            onDelete={handleDelete}
          />

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-[var(--qm-text-secondary)]">
              Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
              {pagination.total} users
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="px-4 py-2 rounded-[var(--qm-radius-md)] bg-[var(--qm-surface-light)] hover:bg-[var(--qm-surface-hover)] text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-[var(--qm-text-secondary)]">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                className="px-4 py-2 rounded-[var(--qm-radius-md)] bg-[var(--qm-surface-light)] hover:bg-[var(--qm-surface-hover)] text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
