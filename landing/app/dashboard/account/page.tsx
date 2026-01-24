"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { GlassCard, GradientButton, Input, Label, Avatar } from "@/components/ui";

export default function AccountPage() {
  const { data: session, update } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [formData, setFormData] = useState({
    name: session?.user?.name || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update profile");
      }

      await update({ name: formData.name });
      setMessage({ type: "success", text: "Profile updated successfully" });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Something went wrong" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Account Settings</h1>
        <p className="mt-1 text-[var(--qm-text-secondary)]">
          Manage your profile and account preferences
        </p>
      </div>

      <div className="max-w-2xl space-y-6">
        <GlassCard hover={false} padding="lg">
          <h2 className="text-lg font-semibold text-white mb-6">Profile Information</h2>

          {message && (
            <div className={`p-3 rounded-[var(--qm-radius-md)] mb-4 ${
              message.type === "success"
                ? "bg-[var(--qm-success)]/10 border border-[var(--qm-success)]/20 text-[var(--qm-success)]"
                : "bg-[var(--qm-error)]/10 border border-[var(--qm-error)]/20 text-[var(--qm-error)]"
            }`}>
              <p className="text-sm">{message.text}</p>
            </div>
          )}

          <div className="flex items-center gap-6 mb-6">
            <Avatar
              src={session?.user?.image}
              fallback={session?.user?.name || session?.user?.email || "U"}
              size="lg"
            />
            <div>
              <p className="text-sm text-[var(--qm-text-secondary)]">Profile Picture</p>
              <p className="text-xs text-[var(--qm-text-tertiary)] mt-1">
                Managed by your OAuth provider
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={isLoading}
              />
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={session?.user?.email || ""}
                disabled
                className="opacity-50"
              />
              <p className="mt-1 text-xs text-[var(--qm-text-tertiary)]">
                Email cannot be changed
              </p>
            </div>

            <GradientButton type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : "Save Changes"}
            </GradientButton>
          </form>
        </GlassCard>
      </div>
    </div>
  );
}
