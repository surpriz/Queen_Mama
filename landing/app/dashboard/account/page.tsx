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

        <GlassCard hover={false} padding="lg">
          <h2 className="text-lg font-semibold text-white mb-4">Connected Accounts</h2>
          <p className="text-sm text-[var(--qm-text-secondary)] mb-4">
            These accounts are linked to your Queen Mama profile
          </p>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-[var(--qm-radius-md)] bg-[var(--qm-surface-light)]">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
                <span className="text-sm text-white">GitHub</span>
              </div>
              <span className="text-xs text-[var(--qm-text-tertiary)]">Not connected</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-[var(--qm-radius-md)] bg-[var(--qm-surface-light)]">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                <span className="text-sm text-white">Google</span>
              </div>
              <span className="text-xs text-[var(--qm-text-tertiary)]">Not connected</span>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
