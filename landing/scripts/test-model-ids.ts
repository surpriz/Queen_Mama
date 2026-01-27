/**
 * Test script to verify model IDs work with their respective APIs
 * Run with: npx tsx scripts/test-model-ids.ts
 */

import { config } from "dotenv";
config();

import { prisma } from "../lib/prisma";
import { decryptApiKey } from "../lib/encryption";
import { ApiKeyProvider } from "@prisma/client";

const MODEL_TESTS = {
  openai: {
    url: "https://api.openai.com/v1/chat/completions",
    models: ["gpt-5-mini", "gpt-4.1-mini", "o4-mini", "gpt-5"],
    dbProvider: "OPENAI" as ApiKeyProvider,
    getHeaders: (apiKey: string) => ({
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    }),
    getBody: (model: string) => {
      // Newer models (gpt-5-*, gpt-4.1-*, o4-*) require max_completion_tokens
      const useNewTokenParam = model.startsWith("gpt-5") || model.startsWith("gpt-4.1") || model.startsWith("o4-");
      const body: Record<string, unknown> = {
        model,
        messages: [{ role: "user", content: "Say 'test ok' in 2 words" }],
      };
      if (useNewTokenParam) {
        body.max_completion_tokens = 10;
      } else {
        body.max_tokens = 10;
      }
      return body;
    },
  },
  grok: {
    url: "https://api.x.ai/v1/chat/completions",
    models: ["grok-4-1-fast-non-reasoning", "grok-4-1-fast-reasoning"],
    dbProvider: "GROK" as ApiKeyProvider,
    getHeaders: (apiKey: string) => ({
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    }),
    getBody: (model: string) => ({
      model,
      messages: [{ role: "user", content: "Say 'test ok' in 2 words" }],
      max_tokens: 10,
    }),
  },
  anthropic: {
    url: "https://api.anthropic.com/v1/messages",
    models: ["claude-haiku-4-5-20251001", "claude-sonnet-4-5-20250929"],
    dbProvider: "ANTHROPIC" as ApiKeyProvider,
    getHeaders: (apiKey: string) => ({
      "x-api-key": apiKey,
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
    }),
    getBody: (model: string) => ({
      model,
      messages: [{ role: "user", content: "Say 'test ok' in 2 words" }],
      max_tokens: 10,
    }),
  },
};

// Get API key from database
async function getApiKeyFromDb(provider: ApiKeyProvider): Promise<string | null> {
  try {
    const adminKey = await prisma.adminApiKey.findUnique({
      where: { provider },
      select: { encryptedKey: true, isActive: true },
    });

    if (!adminKey || !adminKey.isActive) {
      return null;
    }

    return decryptApiKey(adminKey.encryptedKey);
  } catch (error) {
    console.error(`Error fetching ${provider} key:`, error);
    return null;
  }
}

async function testModel(
  provider: string,
  model: string,
  url: string,
  headers: Record<string, string>,
  body: object
): Promise<{ success: boolean; latency: number; error?: string }> {
  const start = Date.now();

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const latency = Date.now() - start;

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        latency,
        error: `HTTP ${response.status}: ${errorText.substring(0, 200)}`,
      };
    }

    return { success: true, latency };
  } catch (error) {
    return {
      success: false,
      latency: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  console.log("🧪 Testing Model IDs...\n");

  const results: Array<{
    provider: string;
    model: string;
    success: boolean;
    latency: number;
    error?: string;
  }> = [];

  // Get API keys from database
  console.log("📦 Loading API keys from database...\n");

  for (const [provider, config] of Object.entries(MODEL_TESTS)) {
    const apiKey = await getApiKeyFromDb(config.dbProvider);

    if (!apiKey) {
      console.log(`⚠️  ${provider.toUpperCase()}: No API key in database, skipping`);
      for (const model of config.models) {
        results.push({
          provider,
          model,
          success: false,
          latency: 0,
          error: "No API key in database",
        });
      }
      continue;
    }

    console.log(`\n📡 Testing ${provider.toUpperCase()}...`);

    for (const model of config.models) {
      process.stdout.write(`   ${model}... `);

      const result = await testModel(
        provider,
        model,
        config.url,
        config.getHeaders(apiKey),
        config.getBody(model)
      );

      results.push({ provider, model, ...result });

      if (result.success) {
        console.log(`✅ OK (${result.latency}ms)`);
      } else {
        console.log(`❌ FAILED: ${result.error}`);
      }
    }
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 SUMMARY\n");

  const grouped = results.reduce(
    (acc, r) => {
      if (!acc[r.provider]) acc[r.provider] = [];
      acc[r.provider].push(r);
      return acc;
    },
    {} as Record<string, typeof results>
  );

  for (const [provider, models] of Object.entries(grouped)) {
    const passed = models.filter((m) => m.success).length;
    const total = models.length;
    const status = passed === total ? "✅" : passed > 0 ? "⚠️" : "❌";

    console.log(`${status} ${provider.toUpperCase()}: ${passed}/${total} models working`);

    for (const m of models) {
      const icon = m.success ? "  ✓" : "  ✗";
      console.log(`   ${icon} ${m.model}`);
    }
  }

  const totalPassed = results.filter((r) => r.success).length;
  const totalModels = results.length;

  console.log(`\n🎯 Total: ${totalPassed}/${totalModels} models verified`);

  if (totalPassed < totalModels) {
    console.log("\n⚠️  Some models failed. Check:");
    console.log("   - API keys are set in .env");
    console.log("   - Model IDs are correct");
    console.log("   - Account has access to these models");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
