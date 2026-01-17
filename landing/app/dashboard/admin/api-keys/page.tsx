"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { GlassCard } from "@/components/ui";

interface ApiKeyInfo {
  id: string | null;
  provider: string;
  keyPrefix: string | null;
  isActive: boolean;
  lastUsedAt: string | null;
  usageCount: number;
  createdAt: string | null;
  hasKey: boolean;
}

const PROVIDER_INFO: Record<
  string,
  { name: string; description: string; icon: string; color: string }
> = {
  OPENAI: {
    name: "OpenAI",
    description: "GPT-4o, GPT-4o-mini, o3",
    icon: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
    color: "text-green-500",
  },
  ANTHROPIC: {
    name: "Anthropic",
    description: "Claude Sonnet 4, Claude Opus 4",
    icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
    color: "text-orange-500",
  },
  GEMINI: {
    name: "Google Gemini",
    description: "Gemini 2.0 Flash, Gemini 2.0 Flash Thinking",
    icon: "M13 10V3L4 14h7v7l9-11h-7z",
    color: "text-blue-500",
  },
  GROK: {
    name: "xAI Grok",
    description: "Grok 3, Grok 3 Fast",
    icon: "M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z",
    color: "text-purple-500",
  },
  DEEPGRAM: {
    name: "Deepgram",
    description: "Nova-3 real-time transcription",
    icon: "M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z",
    color: "text-teal-500",
  },
  ASSEMBLYAI: {
    name: "AssemblyAI",
    description: "Fallback transcription",
    icon: "M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z",
    color: "text-pink-500",
  },
};

export default function AdminApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<ApiKeyInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [newKeyValue, setNewKeyValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchApiKeys();
  }, []);

  async function fetchApiKeys() {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/api-keys");
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("Access denied. Admin privileges required.");
        }
        throw new Error("Failed to fetch API keys");
      }
      const data = await response.json();
      setApiKeys(data.apiKeys);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  async function saveApiKey(provider: string) {
    if (!newKeyValue.trim()) return;

    try {
      setSaving(true);
      const response = await fetch("/api/admin/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey: newKeyValue }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save API key");
      }

      setEditingProvider(null);
      setNewKeyValue("");
      await fetchApiKeys();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function toggleApiKey(provider: string, isActive: boolean) {
    try {
      const response = await fetch("/api/admin/api-keys", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, isActive }),
      });

      if (!response.ok) {
        throw new Error("Failed to update API key");
      }

      await fetchApiKeys();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update");
    }
  }

  async function deleteApiKey(provider: string) {
    if (!confirm(`Are you sure you want to delete the ${provider} API key?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/api-keys?provider=${provider}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete API key");
      }

      await fetchApiKeys();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--qm-accent)]"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500">
          {error}
        </div>
        <Link href="/dashboard/admin">
          <button className="text-[var(--qm-accent)] hover:underline">
            &larr; Back to Admin
          </button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/dashboard/admin"
            className="text-sm text-[var(--qm-text-secondary)] hover:text-[var(--qm-accent)] mb-2 inline-block"
          >
            &larr; Back to Admin
          </Link>
          <h1 className="text-3xl font-bold gradient-text">API Keys Management</h1>
          <p className="text-[var(--qm-text-secondary)] mt-2">
            Configure API keys for all providers. These keys are used by the proxy service.
          </p>
        </div>
      </div>

      {/* Info Banner */}
      <div className="p-4 bg-[var(--qm-accent)]/10 border border-[var(--qm-accent)]/20 rounded-lg">
        <p className="text-sm">
          <strong>Security:</strong> API keys are encrypted using AES-256-GCM before storage.
          Only the key prefix is visible. Keys are never exposed to end users.
        </p>
      </div>

      {/* API Keys Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {apiKeys.map((keyInfo) => {
          const provider = PROVIDER_INFO[keyInfo.provider] || {
            name: keyInfo.provider,
            description: "",
            icon: "M12 6v6m0 0v6m0-6h6m-6 0H6",
            color: "text-gray-500",
          };

          return (
            <GlassCard key={keyInfo.provider} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className={`w-12 h-12 rounded-full bg-current/10 flex items-center justify-center ${provider.color}`}
                  >
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d={provider.icon}
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{provider.name}</h3>
                    <p className="text-sm text-[var(--qm-text-secondary)]">
                      {provider.description}
                    </p>
                  </div>
                </div>

                {/* Status Badge */}
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                    keyInfo.hasKey && keyInfo.isActive
                      ? "bg-green-500/10 text-green-500"
                      : keyInfo.hasKey
                        ? "bg-yellow-500/10 text-yellow-500"
                        : "bg-gray-500/10 text-gray-500"
                  }`}
                >
                  {keyInfo.hasKey
                    ? keyInfo.isActive
                      ? "Active"
                      : "Disabled"
                    : "Not configured"}
                </span>
              </div>

              {/* Key Info */}
              {keyInfo.hasKey && (
                <div className="mt-4 p-3 bg-[var(--qm-surface-light)]/50 rounded-lg">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--qm-text-secondary)]">Key:</span>
                    <code className="font-mono">{keyInfo.keyPrefix}</code>
                  </div>
                  {keyInfo.lastUsedAt && (
                    <div className="flex items-center justify-between text-sm mt-1">
                      <span className="text-[var(--qm-text-secondary)]">
                        Last used:
                      </span>
                      <span>
                        {new Date(keyInfo.lastUsedAt).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm mt-1">
                    <span className="text-[var(--qm-text-secondary)]">
                      Usage count:
                    </span>
                    <span>{keyInfo.usageCount.toLocaleString()}</span>
                  </div>
                </div>
              )}

              {/* Edit Form */}
              {editingProvider === keyInfo.provider ? (
                <div className="mt-4 space-y-3">
                  <input
                    type="password"
                    placeholder="Enter API key..."
                    value={newKeyValue}
                    onChange={(e) => setNewKeyValue(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--qm-surface-light)] border border-[var(--qm-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--qm-accent)]"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveApiKey(keyInfo.provider)}
                      disabled={saving || !newKeyValue.trim()}
                      className="flex-1 px-4 py-2 bg-[var(--qm-accent)] hover:bg-[var(--qm-accent-hover)] text-white rounded-lg disabled:opacity-50 transition-colors"
                    >
                      {saving ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={() => {
                        setEditingProvider(null);
                        setNewKeyValue("");
                      }}
                      className="px-4 py-2 border border-[var(--qm-border)] rounded-lg hover:bg-[var(--qm-surface-light)] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => setEditingProvider(keyInfo.provider)}
                    className="flex-1 px-4 py-2 bg-[var(--qm-accent)] hover:bg-[var(--qm-accent-hover)] text-white rounded-lg transition-colors"
                  >
                    {keyInfo.hasKey ? "Update Key" : "Add Key"}
                  </button>
                  {keyInfo.hasKey && (
                    <>
                      <button
                        onClick={() =>
                          toggleApiKey(keyInfo.provider, !keyInfo.isActive)
                        }
                        className={`px-4 py-2 border rounded-lg transition-colors ${
                          keyInfo.isActive
                            ? "border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/10"
                            : "border-green-500/50 text-green-500 hover:bg-green-500/10"
                        }`}
                      >
                        {keyInfo.isActive ? "Disable" : "Enable"}
                      </button>
                      <button
                        onClick={() => deleteApiKey(keyInfo.provider)}
                        className="px-4 py-2 border border-red-500/50 text-red-500 rounded-lg hover:bg-red-500/10 transition-colors"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              )}
            </GlassCard>
          );
        })}
      </div>

      {/* Help Section */}
      <GlassCard className="p-6">
        <h2 className="text-xl font-semibold mb-4">How to get API Keys</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <a
            href="https://platform.openai.com/api-keys"
            target="_blank"
            rel="noopener noreferrer"
            className="p-3 bg-[var(--qm-surface-light)]/50 rounded-lg hover:bg-[var(--qm-surface-light)] transition-colors"
          >
            <strong className="text-green-500">OpenAI</strong>
            <p className="text-sm text-[var(--qm-text-secondary)] mt-1">
              platform.openai.com/api-keys
            </p>
          </a>
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="p-3 bg-[var(--qm-surface-light)]/50 rounded-lg hover:bg-[var(--qm-surface-light)] transition-colors"
          >
            <strong className="text-orange-500">Anthropic</strong>
            <p className="text-sm text-[var(--qm-text-secondary)] mt-1">
              console.anthropic.com/settings/keys
            </p>
          </a>
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="p-3 bg-[var(--qm-surface-light)]/50 rounded-lg hover:bg-[var(--qm-surface-light)] transition-colors"
          >
            <strong className="text-blue-500">Google Gemini</strong>
            <p className="text-sm text-[var(--qm-text-secondary)] mt-1">
              aistudio.google.com/apikey
            </p>
          </a>
          <a
            href="https://console.x.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="p-3 bg-[var(--qm-surface-light)]/50 rounded-lg hover:bg-[var(--qm-surface-light)] transition-colors"
          >
            <strong className="text-purple-500">xAI Grok</strong>
            <p className="text-sm text-[var(--qm-text-secondary)] mt-1">
              console.x.ai
            </p>
          </a>
          <a
            href="https://console.deepgram.com"
            target="_blank"
            rel="noopener noreferrer"
            className="p-3 bg-[var(--qm-surface-light)]/50 rounded-lg hover:bg-[var(--qm-surface-light)] transition-colors"
          >
            <strong className="text-teal-500">Deepgram</strong>
            <p className="text-sm text-[var(--qm-text-secondary)] mt-1">
              console.deepgram.com
            </p>
          </a>
          <a
            href="https://www.assemblyai.com/app"
            target="_blank"
            rel="noopener noreferrer"
            className="p-3 bg-[var(--qm-surface-light)]/50 rounded-lg hover:bg-[var(--qm-surface-light)] transition-colors"
          >
            <strong className="text-pink-500">AssemblyAI</strong>
            <p className="text-sm text-[var(--qm-text-secondary)] mt-1">
              assemblyai.com/app
            </p>
          </a>
        </div>
      </GlassCard>
    </div>
  );
}
