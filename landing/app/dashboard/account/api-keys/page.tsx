"use client";

import { useState, useEffect } from "react";
import { GlassCard, GradientButton, Input, Label, Badge } from "@/components/ui";

interface ApiKey {
  id: string;
  provider: string;
  keyPrefix: string;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

const providers = [
  { id: "OPENAI", name: "OpenAI", description: "GPT-4, GPT-4o models" },
  { id: "ANTHROPIC", name: "Anthropic", description: "Claude models" },
  { id: "GEMINI", name: "Google Gemini", description: "Gemini models" },
  { id: "DEEPGRAM", name: "Deepgram", description: "Speech-to-text" },
  { id: "GROK", name: "Grok", description: "xAI models" },
];

export default function ApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState("");
  const [newApiKey, setNewApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);

  const fetchApiKeys = async () => {
    try {
      const response = await fetch("/api/user/api-keys");
      if (response.ok) {
        const data = await response.json();
        setApiKeys(data);
      }
    } catch {
      console.error("Failed to fetch API keys");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const handleAddKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedProvider || !newApiKey) {
      setError("Please select a provider and enter an API key");
      return;
    }

    setIsAdding(true);

    try {
      const response = await fetch("/api/user/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: selectedProvider, apiKey: newApiKey }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to add API key");
      }

      await fetchApiKeys();
      setSelectedProvider("");
      setNewApiKey("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteKey = async (id: string) => {
    if (!confirm("Are you sure you want to delete this API key?")) return;

    try {
      const response = await fetch(`/api/user/api-keys/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setApiKeys(apiKeys.filter((key) => key.id !== id));
      }
    } catch {
      console.error("Failed to delete API key");
    }
  };

  const configuredProviders = apiKeys.map((k) => k.provider);
  const availableProviders = providers.filter(
    (p) => !configuredProviders.includes(p.id)
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">API Keys</h1>
        <p className="mt-1 text-[var(--qm-text-secondary)]">
          Manage your AI provider API keys for Queen Mama
        </p>
      </div>

      <div className="max-w-3xl space-y-6">
        <GlassCard hover={false} padding="lg">
          <h2 className="text-lg font-semibold text-white mb-4">Your API Keys</h2>
          <p className="text-sm text-[var(--qm-text-secondary)] mb-6">
            Your keys are encrypted and stored securely. We never display the full key after saving.
          </p>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-[var(--qm-surface-light)] rounded-[var(--qm-radius-md)] animate-pulse" />
              ))}
            </div>
          ) : apiKeys.length > 0 ? (
            <div className="space-y-3">
              {apiKeys.map((key) => {
                const provider = providers.find((p) => p.id === key.provider);
                return (
                  <div
                    key={key.id}
                    className="flex items-center justify-between p-4 rounded-[var(--qm-radius-md)] bg-[var(--qm-surface-light)]"
                  >
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-white">
                            {provider?.name || key.provider}
                          </p>
                          <Badge variant={key.isActive ? "success" : "default"} size="sm">
                            {key.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <p className="text-xs text-[var(--qm-text-tertiary)] mt-1">
                          {key.keyPrefix}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteKey(key.id)}
                      className="p-2 text-[var(--qm-text-tertiary)] hover:text-[var(--qm-error)] transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <svg className="w-12 h-12 mx-auto text-[var(--qm-text-tertiary)] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              <p className="text-[var(--qm-text-secondary)]">No API keys configured</p>
              <p className="text-sm text-[var(--qm-text-tertiary)] mt-1">
                Add your first API key to get started
              </p>
            </div>
          )}
        </GlassCard>

        {availableProviders.length > 0 && (
          <GlassCard hover={false} padding="lg">
            <h2 className="text-lg font-semibold text-white mb-4">Add New API Key</h2>

            {error && (
              <div className="p-3 rounded-[var(--qm-radius-md)] bg-[var(--qm-error)]/10 border border-[var(--qm-error)]/20 mb-4">
                <p className="text-sm text-[var(--qm-error)]">{error}</p>
              </div>
            )}

            <form onSubmit={handleAddKey} className="space-y-4">
              <div>
                <Label htmlFor="provider">Provider</Label>
                <select
                  id="provider"
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value)}
                  className="w-full px-4 py-3 bg-[var(--qm-surface-light)] border border-[var(--qm-border-subtle)] rounded-[var(--qm-radius-md)] text-white focus:outline-none focus:border-[var(--qm-accent)] focus:ring-1 focus:ring-[var(--qm-accent)]"
                >
                  <option value="">Select a provider</option>
                  {availableProviders.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name} - {provider.description}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="apiKey">API Key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="Enter your API key"
                  value={newApiKey}
                  onChange={(e) => setNewApiKey(e.target.value)}
                />
              </div>

              <GradientButton type="submit" disabled={isAdding}>
                {isAdding ? "Adding..." : "Add API Key"}
              </GradientButton>
            </form>
          </GlassCard>
        )}
      </div>
    </div>
  );
}
