import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/device-auth";
import {
  getProviderApiKey,
  getModelCascade,
  PROVIDER_URLS,
  TIER_LIMITS,
  type PlanTier,
  type AIProviderType,
  type CascadeModel,
} from "@/lib/ai-providers";
import {
  retrieveRelevantKnowledge,
  formatKnowledgeForPrompt,
  recordKnowledgeUsage,
} from "@/lib/knowledge-retrieval";

// Token usage tracking for cost calculation
interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

// Cost per million tokens (USD)
const TOKEN_COSTS: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-6":          { input: 3.00,  output: 15.00 },
  "claude-sonnet-4-5-20250929": { input: 3.00,  output: 15.00 },
  "gpt-4.1":                    { input: 2.00,  output: 8.00  },
  "gpt-4o":                     { input: 2.50,  output: 10.00 }, // kept for legacy logs
  "o4-mini":                    { input: 1.10,  output: 4.40  },
  "grok-4-1-fast-non-reasoning": { input: 3.00,  output: 15.00 },
  "grok-4-1-fast-reasoning":     { input: 3.00,  output: 15.00 },
};

function calculateCost(model: string, usage: TokenUsage): number {
  const rates = TOKEN_COSTS[model];
  if (!rates) return 0;
  return (usage.inputTokens / 1_000_000) * rates.input
       + (usage.outputTokens / 1_000_000) * rates.output;
}

// CORS headers for desktop app requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/**
 * OPTIONS /api/proxy/ai/stream
 * Handle preflight CORS requests
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

interface AIStreamRequestBody {
  provider?: AIProviderType; // Optional - backend uses cascade if not specified
  smartMode?: boolean; // Deprecated in favor of cascadeMode, kept for backward compatibility
  cascadeMode?: "standard" | "smart" | "recap"; // New: explicit cascade mode selection
  systemPrompt: string;
  userMessage: string;
  screenshot?: string; // base64 encoded
  maxTokens?: number;
}

/**
 * POST /api/proxy/ai/stream
 * Proxy for streaming AI requests with automatic cascade fallback
 * Tries multiple providers in order for maximum resilience
 */
export async function POST(request: Request) {
  try {
    // Get access token from Authorization header
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "unauthorized", message: "Missing authorization header" },
        { status: 401, headers: corsHeaders }
      );
    }

    const accessToken = authHeader.slice(7);
    console.log("[AI Stream] Received token:", accessToken?.slice(0, 30) + "...");

    let tokenPayload;
    try {
      tokenPayload = await verifyAccessToken(accessToken);
      console.log("[AI Stream] Token verified for user:", tokenPayload.sub);
    } catch (error) {
      console.error("[AI Stream] Token verification failed:", error);
      return NextResponse.json(
        { error: "invalid_token", message: "Invalid or expired token" },
        { status: 401, headers: corsHeaders }
      );
    }

    // Parse request body
    const body: AIStreamRequestBody = await request.json();
    const { smartMode = false, cascadeMode, systemPrompt, userMessage, screenshot, maxTokens } = body;

    // Determine cascade mode: cascadeMode takes precedence, otherwise use smartMode for backward compatibility
    const mode: "standard" | "smart" | "recap" = cascadeMode
      ? cascadeMode
      : (smartMode ? "smart" : "standard");

    if (!systemPrompt || !userMessage) {
      return NextResponse.json(
        { error: "invalid_request", message: "Missing required fields: systemPrompt, userMessage" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Fetch user with subscription
    const user = await prisma.user.findUnique({
      where: { id: tokenPayload.sub },
      include: {
        subscription: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "user_not_found" },
        { status: 404, headers: corsHeaders }
      );
    }

    if (user.role === "BLOCKED") {
      return NextResponse.json(
        { error: "account_blocked", message: "Account has been blocked" },
        { status: 403, headers: corsHeaders }
      );
    }

    // Get plan and check limits
    const plan = (user.subscription?.plan || "FREE") as PlanTier;
    const tierConfig = TIER_LIMITS[plan];

    // Check smart mode access (smart mode is now also used for recap)
    if (mode !== "standard" && !tierConfig.smartMode) {
      return NextResponse.json(
        { error: "request_denied", message: `${mode === "smart" ? "Smart Mode" : "Recap Mode"} requires Enterprise subscription` },
        { status: 403, headers: corsHeaders }
      );
    }

    // Get today's usage count
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dailyRequestCount = await prisma.usageLog.count({
      where: {
        userId: user.id,
        action: "ai_request",
        createdAt: { gte: today },
      },
    });

    // Check daily request limit
    if (tierConfig.dailyAiRequests !== null && dailyRequestCount >= tierConfig.dailyAiRequests) {
      return NextResponse.json(
        { error: "request_denied", message: `Daily AI request limit reached (${tierConfig.dailyAiRequests})` },
        { status: 403, headers: corsHeaders }
      );
    }

    // Get model cascade for this mode
    const cascade = await getModelCascade(mode);

    if (cascade.length === 0) {
      return NextResponse.json(
        { error: "no_providers", message: "No AI providers are configured" },
        { status: 503, headers: corsHeaders }
      );
    }

    // Calculate tokens
    const requestMaxTokens = Math.min(maxTokens || tierConfig.maxTokens, tierConfig.maxTokens);

    // ============================================
    // CONTEXT INTELLIGENCE: Inject personalized knowledge for Enterprise
    // ============================================
    // TEMPORARILY DISABLED: Knowledge injection was causing irrelevant context
    // from past conversations to appear in AI responses. Re-enable after:
    // 1. Increasing minSimilarity threshold (0.4 → 0.65)
    // 2. Adding user toggle to disable Knowledge per-session
    // 3. Running migrations on Neon Prod for KnowledgeAtom table
    // ============================================
    let enhancedSystemPrompt = systemPrompt;
    let usedAtomIds: string[] = [];

    const KNOWLEDGE_FEATURE_ENABLED = false; // Toggle to re-enable

    if (KNOWLEDGE_FEATURE_ENABLED && plan === "ENTERPRISE") {
      try {
        console.log(`[AI Stream] Context Intelligence: Searching knowledge for Enterprise user ${user.id}`);
        const relevantKnowledge = await retrieveRelevantKnowledge(
          user.id,
          userMessage,
          { maxResults: 5, minSimilarity: 0.4, boostHelpful: true }
        );

        if (relevantKnowledge.length > 0) {
          const knowledgeContext = formatKnowledgeForPrompt(relevantKnowledge);
          enhancedSystemPrompt = systemPrompt + "\n" + knowledgeContext;
          usedAtomIds = relevantKnowledge.map((k) => k.id);

          console.log(
            `[AI Stream] Injected ${relevantKnowledge.length} knowledge atoms for user ${user.id}`
          );
        }
      } catch (error) {
        // Don't fail the request if knowledge retrieval fails
        console.error("[AI Stream] Knowledge retrieval error:", error);
      }
    }

    // Create SSE stream with cascade fallback
    const encoder = new TextEncoder();
    const userId = user.id;

    // AbortController to handle client disconnections gracefully (fixes LANDING-E)
    const abortController = new AbortController();
    let streamClosed = false;

    const stream = new ReadableStream({
      async start(controller) {
        let successProvider: string | null = null;
        let successModel: string | null = null;
        let successEffort: string | null = null;
        let successTokenUsage: TokenUsage = { inputTokens: 0, outputTokens: 0 };
        const errors: string[] = [];

        // Try each model in the cascade until one succeeds
        for (const cascadeItem of cascade) {
          if (abortController.signal.aborted) break;

          const { provider, model } = cascadeItem;
          const tokenUsage: TokenUsage = { inputTokens: 0, outputTokens: 0 };

          try {
            console.log(`[AI Cascade] Trying ${provider}/${model}...`);

            const apiKey = await getProviderApiKey(provider);
            if (!apiKey) {
              console.log(`[AI Cascade] ${provider} not configured, skipping`);
              errors.push(`${provider}: not configured`);
              continue;
            }

            let providerStream: ReadableStream<Uint8Array>;

            switch (provider) {
              case "openai":
              case "grok":
                providerStream = await streamOpenAICompatible(
                  provider,
                  apiKey,
                  model,
                  enhancedSystemPrompt,
                  userMessage,
                  screenshot,
                  requestMaxTokens,
                  tokenUsage
                );
                break;
              case "anthropic":
                providerStream = await streamAnthropic(
                  apiKey,
                  model,
                  enhancedSystemPrompt,
                  userMessage,
                  screenshot,
                  requestMaxTokens,
                  mode,
                  tokenUsage
                );
                break;
              default:
                errors.push(`${provider}: unsupported provider`);
                continue;
            }

            // Stream succeeded - forward to client
            const reader = providerStream.getReader();
            const decoder = new TextDecoder();

            while (true) {
              if (abortController.signal.aborted) {
                reader.cancel();
                break;
              }

              const { done, value } = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value, { stream: true });
              if (!streamClosed) {
                controller.enqueue(encoder.encode(chunk));
              }
            }

            successProvider = provider;
            successModel = model;
            successTokenUsage = tokenUsage;
            // Capture effort for metadata (only applies to Anthropic)
            if (provider === "anthropic") {
              successEffort = mode === "recap" ? "high"
                : mode === "smart" ? "medium"
                : userMessage.length > 2000 ? "medium" : "low";
            }
            console.log(`[AI Cascade] Success with ${provider}/${model} (tokens: ${tokenUsage.inputTokens}in/${tokenUsage.outputTokens}out)`);
            break; // Exit cascade loop on success

          } catch (error) {
            // Handle abort errors silently (client disconnected)
            if (error instanceof Error && (error.name === "AbortError" || error.message.includes("aborted"))) {
              console.log(`[AI Cascade] Stream aborted by client during ${provider}/${model}`);
              break;
            }
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`[AI Cascade] ${provider}/${model} failed:`, errorMsg);
            errors.push(`${provider}/${model}: ${errorMsg}`);
            // Continue to next provider in cascade
          }
        }

        if (streamClosed) return;

        if (successProvider && successModel) {
          // Send metadata with actual provider/model/effort used before completion marker
          const metaEvent = `data: ${JSON.stringify({ provider: successProvider, model: successModel, effort: successEffort })}\n\n`;
          controller.enqueue(encoder.encode(metaEvent));
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          streamClosed = true;
          controller.close();

          // Record usage with token counts and cost (async, don't block stream)
          const cost = calculateCost(successModel, successTokenUsage);
          prisma.usageLog
            .create({
              data: {
                userId,
                action: "ai_request",
                provider: successProvider,
                tokensUsed: successTokenUsage.inputTokens + successTokenUsage.outputTokens,
                cost,
                metadata: {
                  inputTokens: successTokenUsage.inputTokens,
                  outputTokens: successTokenUsage.outputTokens,
                  model: successModel,
                },
              },
            })
            .catch(console.error);

          // Record knowledge atom usage (for Context Intelligence)
          if (usedAtomIds.length > 0) {
            recordKnowledgeUsage(usedAtomIds).catch(console.error);
          }

          if (mode === "smart") {
            prisma.usageLog
              .create({
                data: {
                  userId,
                  action: "smart_mode",
                  provider: successProvider,
                },
              })
              .catch(console.error);
          }
        } else {
          // All providers failed
          console.error("[AI Cascade] All providers failed:", errors);
          if (!streamClosed) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({
                error: "all_providers_failed",
                message: "All AI providers failed. Please try again.",
                details: errors
              })}\n\n`)
            );
            streamClosed = true;
            controller.close();
          }
        }
      },
      cancel() {
        // Client disconnected — abort upstream requests gracefully
        abortController.abort();
        streamClosed = true;
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Cascade-Mode": mode,
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  } catch (error) {
    console.error("AI stream proxy error:", error);
    const errorMessage = error instanceof Error ? error.message : "AI streaming request failed";
    return NextResponse.json(
      { error: "server_error", message: errorMessage },
      { status: 500, headers: corsHeaders }
    );
  }
}

// OpenAI and Grok streaming (OpenAI-compatible API)
async function streamOpenAICompatible(
  provider: "openai" | "grok",
  apiKey: string,
  model: string,
  systemPrompt: string,
  userMessage: string,
  screenshot: string | undefined,
  maxTokens: number,
  tokenUsage: TokenUsage
): Promise<ReadableStream<Uint8Array>> {
  const messages: Array<{ role: string; content: string | object[] }> = [
    { role: "system", content: systemPrompt },
  ];

  if (screenshot) {
    messages.push({
      role: "user",
      content: [
        { type: "text", text: userMessage },
        {
          type: "image_url",
          image_url: { url: `data:image/jpeg;base64,${screenshot}` },
        },
      ],
    });
  } else {
    messages.push({ role: "user", content: userMessage });
  }

  const startTime = Date.now();
  console.log(`[${provider}] Calling API with model: ${model}, screenshot: ${!!screenshot}, maxTokens: ${maxTokens}`);

  // Newer OpenAI models require max_completion_tokens instead of max_tokens
  // This includes: gpt-4o, gpt-4o-mini, gpt-5-*, gpt-4.1-*, o1-*, o3-*, o4-*
  const useNewTokenParam = provider === "openai" && (
    model.startsWith("gpt-4o") ||
    model.startsWith("gpt-5") ||
    model.startsWith("gpt-4.1") ||
    model.startsWith("o1-") ||
    model.startsWith("o3-") ||
    model.startsWith("o4-")
  );

  // GPT-5 and o-series models only support temperature=1 (default), so omit for those
  const supportsTemperature = !model.startsWith("gpt-5") && !model.startsWith("o1-") && !model.startsWith("o3-") && !model.startsWith("o4-");

  const requestBody: Record<string, unknown> = {
    model,
    messages,
    stream: true,
  };

  if (supportsTemperature) {
    requestBody.temperature = 0.7;
  }

  if (useNewTokenParam) {
    requestBody.max_completion_tokens = maxTokens;
  } else {
    requestBody.max_tokens = maxTokens;
  }

  // Request usage data in streaming response (sent in the final chunk)
  requestBody.stream_options = { include_usage: true };

  const response = await fetch(PROVIDER_URLS[provider], {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  console.log(`[${provider}] Response in ${Date.now() - startTime}ms, status: ${response.status}`);

  if (!response.ok || !response.body) {
    const errorText = await response.text().catch(() => "Failed to read error body");
    throw new Error(`${provider} error ${response.status}: ${errorText}`);
  }

  // Transform the stream to extract content using push-based approach
  // Using start() instead of pull() to avoid timing issues with SSE streaming
  const reader = response.body.getReader();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const MAX_CHUNKS = 50_000; // Safety guard against infinite loops
  return new ReadableStream({
    async start(controller) {
      try {
        let chunkCount = 0;
        let lineBuffer = ""; // Buffer for partial SSE lines split across TCP chunks
        while (true) {
          if (++chunkCount > MAX_CHUNKS) {
            console.warn(`[${provider}] Stream exceeded ${MAX_CHUNKS} chunks, closing`);
            break;
          }

          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          lineBuffer += chunk;
          const segments = lineBuffer.split("\n");
          lineBuffer = segments.pop() || ""; // Keep last (potentially incomplete) segment

          for (const line of segments) {
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6);
            if (jsonStr === "[DONE]") continue;

            try {
              const data = JSON.parse(jsonStr);
              const content = data.choices?.[0]?.delta?.content;
              if (content) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
              }
              // Capture usage from the final chunk (OpenAI sends usage on last data chunk)
              if (data.usage) {
                tokenUsage.inputTokens = data.usage.prompt_tokens ?? 0;
                tokenUsage.outputTokens = data.usage.completion_tokens ?? 0;
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

// Anthropic streaming
async function streamAnthropic(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userMessage: string,
  screenshot: string | undefined,
  maxTokens: number,
  mode: "standard" | "smart" | "recap",
  tokenUsage: TokenUsage
): Promise<ReadableStream<Uint8Array>> {
  const messages: Array<{ role: string; content: string | object[] }> = [];

  if (screenshot) {
    messages.push({
      role: "user",
      content: [
        { type: "text", text: userMessage },
        {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/jpeg",
            data: screenshot,
          },
        },
      ],
    });
  } else {
    messages.push({ role: "user", content: userMessage });
  }

  // B2: Dynamic effort based on mode and transcript length
  // Standard: low for short transcripts, medium for long/complex (>2000 chars)
  // Smart: always medium (user expects intelligence)
  // Recap: always high (full reasoning, user waits for quality summary)
  const effort = mode === "recap" ? "high"
    : mode === "smart" ? "medium"
    : userMessage.length > 2000 ? "medium" : "low";

  const body: Record<string, unknown> = {
    model,
    // B1: Prompt caching — system prompt as array with cache_control
    // Reduces input cost by ~90% and processing time on repeated requests
    system: [
      {
        type: "text",
        text: systemPrompt,
        cache_control: { type: "ephemeral" },
      }
    ],
    messages,
    max_tokens: maxTokens,
    stream: true,
    // A1: effort parameter — replaces implicit "high" default on Sonnet 4.6
    output_config: { effort },
  };

  // A4: Thinking configuration by mode
  // - Standard: no thinking (effort "low" naturally skips thinking for simple tasks)
  // - Smart: adaptive thinking — model decides when to reason (recommended for Sonnet 4.6)
  // - Recap: full thinking power (16000 tokens, user waits for quality summary)
  const enableThinking = mode !== "standard";

  if (mode === "recap") {
    body.thinking = {
      type: "enabled",
      budget_tokens: 16000,
    };
  } else if (mode === "smart") {
    // A4: Replace deprecated budget_tokens with adaptive thinking
    body.thinking = {
      type: "adaptive",
    };
  }

  const startTime = Date.now();
  console.log(`[Anthropic] Calling API with model: ${model}, mode: ${mode}, effort: ${effort}, thinking: ${enableThinking}, screenshot: ${!!screenshot}, maxTokens: ${maxTokens}`);

  const response = await fetch(PROVIDER_URLS.anthropic, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      // B1: prompt-caching header always present; interleaved-thinking when applicable
      "anthropic-beta": [
        "prompt-caching-2024-07-31",
        ...(enableThinking ? ["interleaved-thinking-2025-05-14"] : []),
      ].join(","),
    },
    body: JSON.stringify(body),
  });

  console.log(`[Anthropic] Response in ${Date.now() - startTime}ms, status: ${response.status}`);

  if (!response.ok || !response.body) {
    const errorText = await response.text().catch(() => "Failed to read error body");
    throw new Error(`Anthropic error ${response.status}: ${errorText}`);
  }

  // Using push-based start() instead of pull() to avoid SSE timing issues
  const reader = response.body.getReader();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const MAX_CHUNKS = 50_000; // Safety guard against infinite loops
  return new ReadableStream({
    async start(controller) {
      try {
        let chunkCount = 0;
        let lineBuffer = ""; // Buffer for partial SSE lines split across TCP chunks
        while (true) {
          if (++chunkCount > MAX_CHUNKS) {
            console.warn("[Anthropic] Stream exceeded max chunks, closing");
            break;
          }

          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          lineBuffer += chunk;
          const segments = lineBuffer.split("\n");
          lineBuffer = segments.pop() || ""; // Keep last (potentially incomplete) segment

          for (const line of segments) {
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6);
            try {
              const data = JSON.parse(jsonStr);

              // Handle content_block_delta for text
              if (data.type === "content_block_delta" && data.delta?.type === "text_delta") {
                const content = data.delta.text;
                if (content) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
                }
              }
              // Capture input_tokens from message_start event
              if (data.type === "message_start" && data.message?.usage) {
                tokenUsage.inputTokens = data.message.usage.input_tokens ?? 0;
              }
              // Capture final output_tokens from message_delta event
              if (data.type === "message_delta" && data.usage) {
                tokenUsage.outputTokens = data.usage.output_tokens ?? 0;
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}
