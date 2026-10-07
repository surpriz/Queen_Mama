import { GlassCard, Badge } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { getConfiguredProviders, toApiKeyProvider } from "@/lib/admin-keys";
import {
  MODEL_CASCADE,
  MODEL_SPECS,
  USER_SELECTABLE_MODELS,
  getOpenAIReasoningEffort,
  type CascadeMode,
  type CascadeModel,
} from "@/lib/ai-providers";
import { EXTRACTION_MODEL } from "@/lib/knowledge-extraction";
import { EMBEDDING_MODEL } from "@/lib/embeddings";

const MODES: Array<{ mode: CascadeMode; title: string; subtitle: string }> = [
  { mode: "standard", title: "Assist (standard)", subtitle: "Real-time, all plans" },
  { mode: "smart", title: "Smart", subtitle: "Enterprise" },
  { mode: "recap", title: "Recap", subtitle: "Meeting summaries" },
];

const USAGE_WINDOW_DAYS = 7;

// Mirrors the request config in /api/proxy/ai/stream so the panel shows what is actually sent
function describeEffort(item: CascadeModel, mode: CascadeMode): string {
  if (item.provider === "anthropic") {
    if (mode === "recap") return "thinking 16k";
    if (mode === "smart") return "adaptive thinking";
    return "no thinking";
  }
  const effort = getOpenAIReasoningEffort(item.model, mode);
  return effort ? `reasoning ${effort}` : "default";
}

function formatPrice(model: string): string {
  const spec = MODEL_SPECS[model];
  if (!spec) return "price unknown";
  return `$${spec.input} / $${spec.output}`;
}

function labelFor(model: string): string {
  return MODEL_SPECS[model]?.label ?? model;
}

async function getServedModels() {
  try {
    return await prisma.$queryRaw<Array<{ model: string | null; requests: number; cost: number | null }>>`
      SELECT metadata->>'model' AS model,
             COUNT(*)::int AS requests,
             SUM(cost)::float AS cost
      FROM "UsageLog"
      WHERE action = 'ai_request'
        AND "createdAt" >= NOW() - (${USAGE_WINDOW_DAYS} * INTERVAL '1 day')
      GROUP BY 1
      ORDER BY requests DESC
    `;
  } catch (error) {
    console.error("[Admin] Failed to load served models:", error);
    return [];
  }
}

export async function ModelsOverview() {
  const [configuredProviders, served] = await Promise.all([
    getConfiguredProviders(),
    getServedModels(),
  ]);

  const isConfigured = (item: CascadeModel) => {
    const prismaProvider = toApiKeyProvider(item.provider);
    return prismaProvider !== null && configuredProviders.includes(prismaProvider);
  };

  const totalServed = served.reduce((sum, row) => sum + row.requests, 0);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">AI models in use</h2>
        <p className="text-sm text-[var(--qm-text-secondary)] mt-1">
          Cascade order per mode. The first model with a configured key serves the request; the next ones only kick in on failure. Prices are USD per 1M tokens (input / output).
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {MODES.map(({ mode, title, subtitle }) => {
          const cascade = MODEL_CASCADE[mode];
          const activeIndex = cascade.findIndex(isConfigured);

          return (
            <GlassCard key={mode} className="p-6">
              <div className="flex items-baseline justify-between mb-4">
                <h3 className="font-semibold">{title}</h3>
                <span className="text-xs text-[var(--qm-text-secondary)]">{subtitle}</span>
              </div>

              <ol className="space-y-3">
                {cascade.map((item, index) => {
                  const configured = isConfigured(item);
                  const active = index === activeIndex;
                  return (
                    <li
                      key={`${item.provider}-${item.model}`}
                      className={`rounded-[var(--qm-radius-md)] p-3 border ${
                        active
                          ? "border-[var(--qm-accent)] bg-[var(--qm-accent)]/10"
                          : "border-transparent bg-[var(--qm-surface-medium)]/40"
                      } ${configured ? "" : "opacity-50"}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">
                          {index + 1}. {labelFor(item.model)}
                        </span>
                        {active && <Badge variant="accent" size="sm">Active</Badge>}
                        {!configured && <Badge variant="warning" size="sm">No API key</Badge>}
                      </div>
                      <div className="mt-1 font-mono text-xs text-[var(--qm-text-secondary)] break-all">
                        {item.provider}/{item.model}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--qm-text-secondary)]">
                        <span>{describeEffort(item, mode)}</span>
                        <span>·</span>
                        <span>{formatPrice(item.model)}</span>
                      </div>
                    </li>
                  );
                })}
              </ol>

              {mode === "standard" && (
                <p className="mt-4 text-xs text-[var(--qm-text-secondary)]">
                  Users can override the head of this cascade with:{" "}
                  {Object.values(USER_SELECTABLE_MODELS).map((m) => labelFor(m.model)).join(", ")}
                </p>
              )}
            </GlassCard>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <GlassCard className="p-6 lg:col-span-2">
          <h3 className="font-semibold mb-1">Actually served (last {USAGE_WINDOW_DAYS} days)</h3>
          <p className="text-xs text-[var(--qm-text-secondary)] mb-4">
            If a fallback shows up here a lot, the primary model is failing.
          </p>
          {served.length === 0 ? (
            <p className="text-sm text-[var(--qm-text-secondary)]">No AI requests logged.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--qm-text-secondary)]">
                  <th className="pb-2 font-normal">Model</th>
                  <th className="pb-2 font-normal text-right">Requests</th>
                  <th className="pb-2 font-normal text-right">Share</th>
                  <th className="pb-2 font-normal text-right">Cost</th>
                </tr>
              </thead>
              <tbody>
                {served.map((row) => (
                  <tr key={row.model ?? "unknown"} className="border-t border-[var(--qm-surface-medium)]">
                    <td className="py-2">
                      {row.model ? labelFor(row.model) : "Unknown (old log)"}
                      {row.model && (
                        <span className="ml-2 font-mono text-xs text-[var(--qm-text-secondary)]">{row.model}</span>
                      )}
                    </td>
                    <td className="py-2 text-right">{row.requests}</td>
                    <td className="py-2 text-right">
                      {totalServed > 0 ? Math.round((row.requests / totalServed) * 100) : 0}%
                    </td>
                    <td className="py-2 text-right">${(row.cost ?? 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </GlassCard>

        <GlassCard className="p-6">
          <h3 className="font-semibold mb-4">Other models</h3>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-[var(--qm-text-secondary)]">Knowledge extraction</dt>
              <dd className="font-mono text-xs mt-0.5">openai/{EXTRACTION_MODEL}</dd>
            </div>
            <div>
              <dt className="text-[var(--qm-text-secondary)]">Embeddings (knowledge + documents)</dt>
              <dd className="font-mono text-xs mt-0.5">openai/{EMBEDDING_MODEL}</dd>
            </div>
          </dl>
        </GlassCard>
      </div>
    </section>
  );
}
