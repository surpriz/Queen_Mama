/**
 * Benchmark script for OpenAI models
 * Tests all OpenAI models with detailed performance metrics
 *
 * Run with: npx tsx scripts/benchmark-openai.ts
 *
 * Metrics measured:
 * - TTFB (Time to First Byte): Latency before first token
 * - Total time: Complete generation time
 * - Tokens/sec: Generation speed
 * - Vision support: Tests with screenshots
 */

import { config } from "dotenv";
config();

import { prisma } from "../lib/prisma";
import { decryptApiKey } from "../lib/encryption";
import { ApiKeyProvider } from "@prisma/client";

// All OpenAI models to test
const OPENAI_MODELS = {
  standard: [
    "gpt-5-mini",       // Standard mode primary
    "gpt-4.1-mini",     // Standard mode fallback
    "gpt-4o",           // Legacy model
    "gpt-4o-mini",      // Legacy mini
  ],
  smart: [
    "o4-mini",          // Smart mode primary
    "gpt-5",            // Smart mode fallback
    "o1-mini",          // Legacy reasoning
  ],
} as const;

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

// Test prompts
const TEST_PROMPT = "Explain quantum computing in one short sentence.";
const TEST_PROMPT_VISION = "Describe what you see in this image in one short sentence.";

// Simple 1x1 red pixel PNG as base64 (for vision testing)
const TEST_IMAGE_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==";

interface BenchmarkResult {
  model: string;
  category: "standard" | "smart";
  textOnly: {
    success: boolean;
    ttfb?: number; // Time to first byte (ms)
    totalTime?: number; // Total generation time (ms)
    tokenCount?: number;
    tokensPerSec?: number;
    error?: string;
  };
  withVision: {
    success: boolean;
    ttfb?: number;
    totalTime?: number;
    tokenCount?: number;
    tokensPerSec?: number;
    error?: string;
  };
}

// Get API key from database
async function getOpenAIKey(): Promise<string | null> {
  try {
    const adminKey = await prisma.adminApiKey.findUnique({
      where: { provider: "OPENAI" as ApiKeyProvider },
      select: { encryptedKey: true, isActive: true },
    });

    if (!adminKey || !adminKey.isActive) {
      console.error("❌ No active OpenAI API key in database");
      return null;
    }

    return decryptApiKey(adminKey.encryptedKey);
  } catch (error) {
    console.error("Error fetching OpenAI key:", error);
    return null;
  }
}

// Build request body for OpenAI API
function buildRequestBody(model: string, withVision: boolean) {
  const useNewTokenParam =
    model.startsWith("gpt-5") ||
    model.startsWith("gpt-4.1") ||
    model.startsWith("o4-") ||
    model.startsWith("o1-");

  const supportsTemperature =
    !model.startsWith("gpt-5") &&
    !model.startsWith("o1-") &&
    !model.startsWith("o4-");

  const body: Record<string, unknown> = {
    model,
    stream: true, // Use streaming to measure TTFB
  };

  if (withVision) {
    body.messages = [
      {
        role: "user",
        content: [
          { type: "text", text: TEST_PROMPT_VISION },
          {
            type: "image_url",
            image_url: { url: `data:image/png;base64,${TEST_IMAGE_BASE64}` },
          },
        ],
      },
    ];
  } else {
    body.messages = [{ role: "user", content: TEST_PROMPT }];
  }

  if (supportsTemperature) {
    body.temperature = 0.7;
  }

  if (useNewTokenParam) {
    body.max_completion_tokens = 100;
  } else {
    body.max_tokens = 100;
  }

  return body;
}

// Test a model with streaming to measure TTFB and total time
async function testModel(
  apiKey: string,
  model: string,
  withVision: boolean
): Promise<{
  success: boolean;
  ttfb?: number;
  totalTime?: number;
  tokenCount?: number;
  tokensPerSec?: number;
  error?: string;
}> {
  const startTime = Date.now();
  let firstByteTime: number | undefined;
  let tokenCount = 0;

  try {
    const body = buildRequestBody(model, withVision);

    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText.substring(0, 200)}`,
      };
    }

    if (!response.body) {
      return {
        success: false,
        error: "No response body",
      };
    }

    // Process streaming response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();

      // Record TTFB on first chunk
      if (!firstByteTime && value) {
        firstByteTime = Date.now() - startTime;
      }

      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n").filter((line) => line.startsWith("data: "));

      for (const line of lines) {
        const jsonStr = line.slice(6);
        if (jsonStr === "[DONE]") continue;

        try {
          const data = JSON.parse(jsonStr);
          if (data.choices?.[0]?.delta?.content) {
            tokenCount++;
          }
        } catch {
          // Ignore parse errors
        }
      }
    }

    const totalTime = Date.now() - startTime;
    const tokensPerSec = tokenCount > 0 ? (tokenCount / totalTime) * 1000 : 0;

    return {
      success: true,
      ttfb: firstByteTime,
      totalTime,
      tokenCount,
      tokensPerSec: Math.round(tokensPerSec * 10) / 10,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Format duration for display
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

async function main() {
  console.log("🔬 OpenAI Model Benchmark");
  console.log("=".repeat(80));
  console.log("");

  // Get API key
  console.log("🔑 Loading API key from database...");
  const apiKey = await getOpenAIKey();

  if (!apiKey) {
    console.error("\n❌ Cannot proceed without OpenAI API key");
    console.error("   Please add your OpenAI API key to the database");
    process.exit(1);
  }

  console.log("✅ API key loaded\n");

  const results: BenchmarkResult[] = [];

  // Test standard models
  console.log("📊 Testing STANDARD MODE models...\n");
  for (const model of OPENAI_MODELS.standard) {
    console.log(`   Testing ${model}...`);

    process.stdout.write("      • Text only:  ");
    const textResult = await testModel(apiKey, model, false);
    if (textResult.success) {
      console.log(
        `✅ TTFB: ${formatDuration(textResult.ttfb!)} | Total: ${formatDuration(
          textResult.totalTime!
        )} | ${textResult.tokensPerSec} tok/s`
      );
    } else {
      console.log(`❌ ${textResult.error}`);
    }

    process.stdout.write("      • With vision: ");
    const visionResult = await testModel(apiKey, model, true);
    if (visionResult.success) {
      console.log(
        `✅ TTFB: ${formatDuration(visionResult.ttfb!)} | Total: ${formatDuration(
          visionResult.totalTime!
        )} | ${visionResult.tokensPerSec} tok/s`
      );
    } else {
      console.log(`❌ ${visionResult.error}`);
    }

    results.push({
      model,
      category: "standard",
      textOnly: textResult,
      withVision: visionResult,
    });

    console.log("");
  }

  // Test smart models
  console.log("\n🧠 Testing SMART MODE models...\n");
  for (const model of OPENAI_MODELS.smart) {
    console.log(`   Testing ${model}...`);

    process.stdout.write("      • Text only:  ");
    const textResult = await testModel(apiKey, model, false);
    if (textResult.success) {
      console.log(
        `✅ TTFB: ${formatDuration(textResult.ttfb!)} | Total: ${formatDuration(
          textResult.totalTime!
        )} | ${textResult.tokensPerSec} tok/s`
      );
    } else {
      console.log(`❌ ${textResult.error}`);
    }

    process.stdout.write("      • With vision: ");
    const visionResult = await testModel(apiKey, model, true);
    if (visionResult.success) {
      console.log(
        `✅ TTFB: ${formatDuration(visionResult.ttfb!)} | Total: ${formatDuration(
          visionResult.totalTime!
        )} | ${visionResult.tokensPerSec} tok/s`
      );
    } else {
      console.log(`❌ ${visionResult.error}`);
    }

    results.push({
      model,
      category: "smart",
      textOnly: textResult,
      withVision: visionResult,
    });

    console.log("");
  }

  // Summary
  console.log("\n" + "=".repeat(80));
  console.log("📈 BENCHMARK SUMMARY\n");

  // Standard mode summary
  console.log("📊 STANDARD MODE:");
  const standardResults = results.filter((r) => r.category === "standard");
  const standardSuccess = standardResults.filter(
    (r) => r.textOnly.success || r.withVision.success
  );
  console.log(
    `   ${standardSuccess.length}/${standardResults.length} models working\n`
  );

  const standardBySpeed = standardResults
    .filter((r) => r.textOnly.success)
    .sort((a, b) => (a.textOnly.ttfb || 0) - (b.textOnly.ttfb || 0));

  if (standardBySpeed.length > 0) {
    console.log("   Fastest (by TTFB):");
    for (const r of standardBySpeed.slice(0, 3)) {
      console.log(
        `      ${r.model.padEnd(20)} ${formatDuration(r.textOnly.ttfb!).padStart(
          8
        )} | ${r.textOnly.tokensPerSec} tok/s`
      );
    }
  }

  // Smart mode summary
  console.log("\n🧠 SMART MODE:");
  const smartResults = results.filter((r) => r.category === "smart");
  const smartSuccess = smartResults.filter(
    (r) => r.textOnly.success || r.withVision.success
  );
  console.log(`   ${smartSuccess.length}/${smartResults.length} models working\n`);

  const smartBySpeed = smartResults
    .filter((r) => r.textOnly.success)
    .sort((a, b) => (a.textOnly.ttfb || 0) - (b.textOnly.ttfb || 0));

  if (smartBySpeed.length > 0) {
    console.log("   Fastest (by TTFB):");
    for (const r of smartBySpeed.slice(0, 3)) {
      console.log(
        `      ${r.model.padEnd(20)} ${formatDuration(r.textOnly.ttfb!).padStart(
          8
        )} | ${r.textOnly.tokensPerSec} tok/s`
      );
    }
  }

  // Vision support summary
  console.log("\n👁️  VISION SUPPORT:");
  const visionWorking = results.filter((r) => r.withVision.success);
  const visionFailed = results.filter((r) => !r.withVision.success);

  console.log(`   ✅ ${visionWorking.length} models support vision`);
  for (const r of visionWorking) {
    console.log(`      • ${r.model}`);
  }

  if (visionFailed.length > 0) {
    console.log(`\n   ❌ ${visionFailed.length} models don't support vision`);
    for (const r of visionFailed) {
      console.log(`      • ${r.model}`);
    }
  }

  // Overall statistics
  const totalTests = results.length * 2; // text + vision
  const successfulTests = results.reduce(
    (sum, r) =>
      sum + (r.textOnly.success ? 1 : 0) + (r.withVision.success ? 1 : 0),
    0
  );

  console.log("\n" + "=".repeat(80));
  console.log(`🎯 Total: ${successfulTests}/${totalTests} tests passed`);

  if (successfulTests < totalTests) {
    console.log("\n⚠️  Some tests failed. Common reasons:");
    console.log("   - Model not available in your OpenAI account");
    console.log("   - Model ID has changed");
    console.log("   - API rate limits");
    console.log("   - Vision not supported for this model");
  }

  console.log("");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
