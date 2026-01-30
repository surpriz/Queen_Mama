/**
 * Comprehensive Multi-Provider Model Benchmark
 * Tests OpenAI, Anthropic, Grok, and Moonshot models with detailed performance metrics
 *
 * Run with: npx tsx landing/scripts/benchmark-models.ts
 *
 * Providers:
 * - OpenAI (7 models: gpt-5, gpt-4.1, gpt-4o, o4-mini, o1-mini)
 * - Anthropic (8 models: Claude 4.5, 4.1, 4, 3.7, 3 families)
 * - Grok (6 models: grok-4, grok-3, grok-code families)
 * - Moonshot (3 models: Kimi K2.5, K2 Turbo, K2 Standard)
 *
 * Metrics measured:
 * - TTFB (Time to First Byte): Latency before first token
 * - Total time: Complete generation time
 * - Tokens/sec: Generation speed
 * - Vision support: Tests with image input
 */

import { config } from "dotenv";
config();

import { prisma } from "../lib/prisma";
import { decryptApiKey } from "../lib/encryption";
import { ApiKeyProvider } from "@prisma/client";

// ============================================================================
// MODEL DEFINITIONS
// ============================================================================

// OpenAI models to test
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

// Anthropic models to test
const ANTHROPIC_MODELS = {
  latest: [
    "claude-opus-4-5-20251101",     // Premium - max intelligence
    "claude-sonnet-4-5-20250929",   // Best for agents/coding
    "claude-haiku-4-5-20251001",    // Fastest with near-frontier intelligence
  ],
  legacy: [
    "claude-opus-4-1-20250805",     // Opus 4.1
    "claude-sonnet-4-20250514",     // Sonnet 4
    "claude-3-7-sonnet-20250219",   // Sonnet 3.7
    "claude-opus-4-20250514",       // Opus 4
    "claude-3-haiku-20240307",      // Haiku 3 - Fastest legacy
  ],
} as const;

// Grok models to test (xAI)
const GROK_MODELS = {
  latest: [
    "grok-4-1-fast-reasoning",      // Frontier model with reasoning (2M context)
    "grok-4-1-fast-non-reasoning",  // Fast instant responses (2M context)
    "grok-4",                        // Standard Grok 4 (256K context)
  ],
  specialized: [
    "grok-code-fast-1",             // Coding-optimized (256K context)
    "grok-3-beta",                  // Grok 3 (131K context)
    "grok-3-mini-beta",             // Lightweight Grok 3 (131K context)
  ],
} as const;

// Moonshot models to test (Kimi)
const MOONSHOT_MODELS = {
  k2_latest: [
    "kimi-k2.5",                    // K2.5 - Flagship 1T params (262K context)
    "kimi-k2-0905-Preview",         // K2 Preview - Sept 2024 release
    "kimi-k2-turbo-preview",        // K2 Turbo - Speed-optimized
  ],
  k2_thinking: [
    "kimi-k2-thinking",             // K2 Thinking - Reasoning-focused
    "kimi-k2-thinking-turbo",       // K2 Thinking Turbo - Fast reasoning
  ],
  v1_legacy: [
    "moonshot-v1-8k",               // V1 8K - General purpose, 8K context
    "moonshot-v1-32k",              // V1 32K - Extended context, 32K tokens
    "moonshot-v1-128k",             // V1 128K - Long context, 128K tokens
  ],
} as const;

// API endpoints
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const GROK_API_URL = "https://api.x.ai/v1/chat/completions";
const MOONSHOT_API_URL = "https://api.moonshot.ai/v1/chat/completions";

// Test prompts
const TEST_PROMPT = "Explain quantum computing in one short sentence.";
const TEST_PROMPT_VISION = "Describe what you see in this image in one short sentence.";

// Simple 1x1 red pixel PNG as base64 (for vision testing)
const TEST_IMAGE_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==";

interface BenchmarkResult {
  provider: "openai" | "anthropic" | "grok" | "moonshot";
  model: string;
  category: "standard" | "smart" | "latest" | "legacy" | "specialized";
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

// ============================================================================
// API KEY MANAGEMENT
// ============================================================================

// Get OpenAI API key from database
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

// Get Anthropic API key from database
async function getAnthropicKey(): Promise<string | null> {
  try {
    const adminKey = await prisma.adminApiKey.findUnique({
      where: { provider: "ANTHROPIC" as ApiKeyProvider },
      select: { encryptedKey: true, isActive: true },
    });

    if (!adminKey || !adminKey.isActive) {
      console.error("❌ No active Anthropic API key in database");
      return null;
    }

    return decryptApiKey(adminKey.encryptedKey);
  } catch (error) {
    console.error("Error fetching Anthropic key:", error);
    return null;
  }
}

// Get Grok API key from database
async function getGrokKey(): Promise<string | null> {
  try {
    const adminKey = await prisma.adminApiKey.findUnique({
      where: { provider: "GROK" as ApiKeyProvider },
      select: { encryptedKey: true, isActive: true },
    });

    if (!adminKey || !adminKey.isActive) {
      console.error("❌ No active Grok API key in database");
      return null;
    }

    return decryptApiKey(adminKey.encryptedKey);
  } catch (error) {
    console.error("Error fetching Grok key:", error);
    return null;
  }
}

// Get Moonshot API key from database
async function getMoonshotKey(): Promise<string | null> {
  try {
    const adminKey = await prisma.adminApiKey.findUnique({
      where: { provider: "MOONSHOT" as ApiKeyProvider },
      select: { encryptedKey: true, isActive: true },
    });

    if (!adminKey || !adminKey.isActive) {
      console.error("❌ No active Moonshot API key in database");
      return null;
    }

    return decryptApiKey(adminKey.encryptedKey);
  } catch (error) {
    console.error("Error fetching Moonshot key:", error);
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

// ============================================================================
// ANTHROPIC-SPECIFIC FUNCTIONS
// ============================================================================

// Build request body for Anthropic API
function buildAnthropicRequestBody(model: string, withVision: boolean) {
  const body: Record<string, unknown> = {
    model,
    max_tokens: 1024,
    stream: true, // Use streaming to measure TTFB
  };

  if (withVision) {
    body.messages = [
      {
        role: "user",
        content: [
          { type: "text", text: TEST_PROMPT_VISION },
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/png",
              data: TEST_IMAGE_BASE64,
            },
          },
        ],
      },
    ];
  } else {
    body.messages = [
      {
        role: "user",
        content: TEST_PROMPT,
      },
    ];
  }

  return body;
}

// Test an Anthropic model with streaming to measure TTFB
async function testAnthropicModel(
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
    const body = buildAnthropicRequestBody(model, withVision);

    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
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

        try {
          const data = JSON.parse(jsonStr);

          // Anthropic streams different event types
          if (data.type === "content_block_delta" && data.delta?.text) {
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

// ============================================================================
// GROK-SPECIFIC FUNCTIONS
// ============================================================================

// Test a Grok model (uses same API format as OpenAI)
async function testGrokModel(
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
    const body: Record<string, unknown> = {
      model,
      stream: true,
      max_tokens: 100,
      temperature: 0.7,
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

    const response = await fetch(GROK_API_URL, {
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

    // Process streaming response (same format as OpenAI)
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();

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

// ============================================================================
// MOONSHOT-SPECIFIC FUNCTIONS
// ============================================================================

// Test a Moonshot model (uses OpenAI-compatible API)
async function testMoonshotModel(
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
    const body: Record<string, unknown> = {
      model,
      stream: true,
      max_tokens: 100,
      temperature: 0.7,
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

    const response = await fetch(MOONSHOT_API_URL, {
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

    // Process streaming response (OpenAI-compatible format)
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();

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

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Format duration for display
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

async function main() {
  console.log("🔬 Multi-Provider Model Benchmark");
  console.log("   OpenAI + Anthropic + Grok + Moonshot Comprehensive Testing");
  console.log("=".repeat(80));
  console.log("");

  // Get OpenAI API key
  console.log("🔑 Loading OpenAI API key from database...");
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
      provider: "openai",
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
      provider: "openai",
      model,
      category: "smart",
      textOnly: textResult,
      withVision: visionResult,
    });

    console.log("");
  }

  // ============================================================================
  // ANTHROPIC BENCHMARKS
  // ============================================================================

  console.log("\n" + "=".repeat(80));
  console.log("🔑 Loading Anthropic API key from database...");
  const anthropicKey = await getAnthropicKey();

  if (anthropicKey) {
    console.log("✅ Anthropic API key loaded\n");

    // Test Anthropic latest models (Claude 4.5)
    console.log("🌟 Testing ANTHROPIC LATEST models (Claude 4.5)...\n");
    for (const model of ANTHROPIC_MODELS.latest) {
      console.log(`   Testing ${model}...`);

      process.stdout.write("      • Text only:  ");
      const textResult = await testAnthropicModel(anthropicKey, model, false);
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
      const visionResult = await testAnthropicModel(anthropicKey, model, true);
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
        provider: "anthropic",
        model,
        category: "latest",
        textOnly: textResult,
        withVision: visionResult,
      });

      console.log("");
    }

    // Test Anthropic legacy models
    console.log("\n📚 Testing ANTHROPIC LEGACY models...\n");
    for (const model of ANTHROPIC_MODELS.legacy) {
      console.log(`   Testing ${model}...`);

      process.stdout.write("      • Text only:  ");
      const textResult = await testAnthropicModel(anthropicKey, model, false);
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
      const visionResult = await testAnthropicModel(anthropicKey, model, true);
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
        provider: "anthropic",
        model,
        category: "legacy",
        textOnly: textResult,
        withVision: visionResult,
      });

      console.log("");
    }
  } else {
    console.log("⚠️  Skipping Anthropic tests (no API key)\n");
  }

  // ============================================================================
  // GROK BENCHMARKS
  // ============================================================================

  console.log("\n" + "=".repeat(80));
  console.log("🔑 Loading Grok API key from database...");
  const grokKey = await getGrokKey();

  if (grokKey) {
    console.log("✅ Grok API key loaded\n");

    // Test Grok latest models (Grok 4)
    console.log("⚡ Testing GROK LATEST models (Grok 4)...\n");
    for (const model of GROK_MODELS.latest) {
      console.log(`   Testing ${model}...`);

      process.stdout.write("      • Text only:  ");
      const textResult = await testGrokModel(grokKey, model, false);
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
      const visionResult = await testGrokModel(grokKey, model, true);
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
        provider: "grok",
        model,
        category: "latest",
        textOnly: textResult,
        withVision: visionResult,
      });

      console.log("");
    }

    // Test Grok specialized models
    console.log("\n🎯 Testing GROK SPECIALIZED models...\n");
    for (const model of GROK_MODELS.specialized) {
      console.log(`   Testing ${model}...`);

      process.stdout.write("      • Text only:  ");
      const textResult = await testGrokModel(grokKey, model, false);
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
      const visionResult = await testGrokModel(grokKey, model, true);
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
        provider: "grok",
        model,
        category: "specialized",
        textOnly: textResult,
        withVision: visionResult,
      });

      console.log("");
    }
  } else {
    console.log("⚠️  Skipping Grok tests (no API key)\n");
  }

  // ============================================================================
  // MOONSHOT (Kimi) TESTING
  // ============================================================================

  console.log("\n" + "=".repeat(80));
  console.log("🌙 MOONSHOT (Kimi) MODELS");
  console.log("=".repeat(80) + "\n");

  const moonshotKey = await getMoonshotKey();

  if (moonshotKey) {
    console.log("✅ Moonshot API key loaded\n");

    // Test K2.5 and K2 latest models
    console.log("🚀 Testing MOONSHOT K2 LATEST models...\n");
    for (const model of MOONSHOT_MODELS.k2_latest) {
      console.log(`   Testing ${model}...`);

      process.stdout.write("      • Text only:  ");
      const textResult = await testMoonshotModel(moonshotKey, model, false);
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
      const visionResult = await testMoonshotModel(moonshotKey, model, true);
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
        provider: "moonshot",
        model,
        category: "latest",
        textOnly: textResult,
        withVision: visionResult,
      });

      console.log("");
    }

    // Test K2 Thinking models
    console.log("\n🧠 Testing MOONSHOT K2 THINKING models...\n");
    for (const model of MOONSHOT_MODELS.k2_thinking) {
      console.log(`   Testing ${model}...`);

      process.stdout.write("      • Text only:  ");
      const textResult = await testMoonshotModel(moonshotKey, model, false);
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
      const visionResult = await testMoonshotModel(moonshotKey, model, true);
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
        provider: "moonshot",
        model,
        category: "smart",
        textOnly: textResult,
        withVision: visionResult,
      });

      console.log("");
    }

    // Test V1 Legacy models
    console.log("\n📚 Testing MOONSHOT V1 LEGACY models...\n");
    for (const model of MOONSHOT_MODELS.v1_legacy) {
      console.log(`   Testing ${model}...`);

      process.stdout.write("      • Text only:  ");
      const textResult = await testMoonshotModel(moonshotKey, model, false);
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
      const visionResult = await testMoonshotModel(moonshotKey, model, true);
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
        provider: "moonshot",
        model,
        category: "legacy",
        textOnly: textResult,
        withVision: visionResult,
      });

      console.log("");
    }
  } else {
    console.log("⚠️  Skipping Moonshot tests (no API key)\n");
  }

  // Summary
  console.log("\n" + "=".repeat(80));
  console.log("📈 BENCHMARK SUMMARY\n");

  // OpenAI summary
  const openaiResults = results.filter((r) => r.provider === "openai");
  if (openaiResults.length > 0) {
    console.log("📊 OPENAI:");
    const openaiSuccess = openaiResults.filter(
      (r) => r.textOnly.success || r.withVision.success
    );
    console.log(`   ${openaiSuccess.length}/${openaiResults.length} models working\n`);

    const openaiBySpeed = openaiResults
      .filter((r) => r.textOnly.success)
      .sort((a, b) => (a.textOnly.ttfb || 0) - (b.textOnly.ttfb || 0));

    if (openaiBySpeed.length > 0) {
      console.log("   Fastest (by TTFB):");
      for (const r of openaiBySpeed.slice(0, 3)) {
        console.log(
          `      ${r.model.padEnd(25)} ${formatDuration(r.textOnly.ttfb!).padStart(
            8
          )} | ${r.textOnly.tokensPerSec} tok/s`
        );
      }
    }
    console.log("");
  }

  // Anthropic summary
  const anthropicResults = results.filter((r) => r.provider === "anthropic");
  if (anthropicResults.length > 0) {
    console.log("🤖 ANTHROPIC:");
    const anthropicSuccess = anthropicResults.filter(
      (r) => r.textOnly.success || r.withVision.success
    );
    console.log(
      `   ${anthropicSuccess.length}/${anthropicResults.length} models working\n`
    );

    const anthropicBySpeed = anthropicResults
      .filter((r) => r.textOnly.success)
      .sort((a, b) => (a.textOnly.ttfb || 0) - (b.textOnly.ttfb || 0));

    if (anthropicBySpeed.length > 0) {
      console.log("   Fastest (by TTFB):");
      for (const r of anthropicBySpeed.slice(0, 3)) {
        console.log(
          `      ${r.model.padEnd(30)} ${formatDuration(r.textOnly.ttfb!).padStart(
            8
          )} | ${r.textOnly.tokensPerSec} tok/s`
        );
      }
    }
    console.log("");
  }

  // Grok summary
  const grokResults = results.filter((r) => r.provider === "grok");
  if (grokResults.length > 0) {
    console.log("⚡ GROK:");
    const grokSuccess = grokResults.filter(
      (r) => r.textOnly.success || r.withVision.success
    );
    console.log(`   ${grokSuccess.length}/${grokResults.length} models working\n`);

    const grokBySpeed = grokResults
      .filter((r) => r.textOnly.success)
      .sort((a, b) => (a.textOnly.ttfb || 0) - (b.textOnly.ttfb || 0));

    if (grokBySpeed.length > 0) {
      console.log("   Fastest (by TTFB):");
      for (const r of grokBySpeed.slice(0, 3)) {
        console.log(
          `      ${r.model.padEnd(30)} ${formatDuration(r.textOnly.ttfb!).padStart(
            8
          )} | ${r.textOnly.tokensPerSec} tok/s`
        );
      }
    }
    console.log("");
  }

  // Moonshot summary
  const moonshotResults = results.filter((r) => r.provider === "moonshot");
  if (moonshotResults.length > 0) {
    console.log("🌙 MOONSHOT:");
    const moonshotSuccess = moonshotResults.filter(
      (r) => r.textOnly.success || r.withVision.success
    );
    console.log(`   ${moonshotSuccess.length}/${moonshotResults.length} models working\n`);

    const moonshotBySpeed = moonshotResults
      .filter((r) => r.textOnly.success)
      .sort((a, b) => (a.textOnly.ttfb || 0) - (b.textOnly.ttfb || 0));

    if (moonshotBySpeed.length > 0) {
      console.log("   Fastest (by TTFB):");
      for (const r of moonshotBySpeed.slice(0, 3)) {
        console.log(
          `      ${r.model.padEnd(30)} ${formatDuration(r.textOnly.ttfb!).padStart(
            8
          )} | ${r.textOnly.tokensPerSec} tok/s`
        );
      }
    }
    console.log("");
  }

  // Vision support summary
  console.log("👁️  VISION SUPPORT:");
  const visionWorking = results.filter((r) => r.withVision.success);
  const visionFailed = results.filter((r) => !r.withVision.success);

  console.log(`   ✅ ${visionWorking.length} models support vision`);
  for (const r of visionWorking) {
    console.log(`      • [${r.provider.toUpperCase()}] ${r.model}`);
  }

  if (visionFailed.length > 0) {
    console.log(`\n   ❌ ${visionFailed.length} models don't support vision`);
    for (const r of visionFailed) {
      console.log(`      • [${r.provider.toUpperCase()}] ${r.model}`);
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
  console.log(
    `   OpenAI: ${openaiResults.length * 2} tests | Anthropic: ${
      anthropicResults.length * 2
    } tests | Grok: ${grokResults.length * 2} tests | Moonshot: ${
      moonshotResults.length * 2
    } tests`
  );

  if (successfulTests < totalTests) {
    console.log("\n⚠️  Some tests failed. Common reasons:");
    console.log("   - Model not available in your account");
    console.log("   - Model ID has changed");
    console.log("   - API rate limits");
    console.log("   - Vision not supported for this model");
  }

  console.log("");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
