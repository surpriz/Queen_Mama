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
  smartMode?: boolean;
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
    const { smartMode = false, systemPrompt, userMessage, screenshot, maxTokens } = body;

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

    // Check smart mode access
    if (smartMode && !tierConfig.smartMode) {
      return NextResponse.json(
        { error: "request_denied", message: "Smart Mode requires Enterprise subscription" },
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
    const cascade = await getModelCascade(smartMode);

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
    let enhancedSystemPrompt = systemPrompt;
    let usedAtomIds: string[] = [];

    if (plan === "ENTERPRISE") {
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

    const stream = new ReadableStream({
      async start(controller) {
        let successProvider: string | null = null;
        let successModel: string | null = null;
        const errors: string[] = [];

        // Try each model in the cascade until one succeeds
        for (const cascadeItem of cascade) {
          const { provider, model } = cascadeItem;

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
                  requestMaxTokens
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
                  smartMode
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
              const { done, value } = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value, { stream: true });
              controller.enqueue(encoder.encode(chunk));
            }

            successProvider = provider;
            successModel = model;
            console.log(`[AI Cascade] Success with ${provider}/${model}`);
            break; // Exit cascade loop on success

          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`[AI Cascade] ${provider}/${model} failed:`, errorMsg);
            errors.push(`${provider}/${model}: ${errorMsg}`);
            // Continue to next provider in cascade
          }
        }

        if (successProvider && successModel) {
          // Send completion marker with provider info
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();

          // Record usage (async, don't block stream)
          prisma.usageLog
            .create({
              data: {
                userId,
                action: "ai_request",
                provider: successProvider,
              },
            })
            .catch(console.error);

          // Record knowledge atom usage (for Context Intelligence)
          if (usedAtomIds.length > 0) {
            recordKnowledgeUsage(usedAtomIds).catch(console.error);
          }

          if (smartMode) {
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
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              error: "all_providers_failed",
              message: "All AI providers failed. Please try again.",
              details: errors
            })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Cascade-Mode": smartMode ? "smart" : "standard",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  } catch (error) {
    console.error("AI stream proxy error:", error);
    return NextResponse.json(
      { error: "server_error", message: "AI streaming request failed" },
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
  maxTokens: number
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

  // Newer OpenAI models (gpt-5-*, gpt-4.1-*, o4-*) require max_completion_tokens
  const useNewTokenParam = model.startsWith("gpt-5") || model.startsWith("gpt-4.1") || model.startsWith("o4-");

  const requestBody: Record<string, unknown> = {
    model,
    messages,
    temperature: 0.7,
    stream: true,
  };

  if (useNewTokenParam) {
    requestBody.max_completion_tokens = maxTokens;
  } else {
    requestBody.max_tokens = maxTokens;
  }

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

  // Transform the stream to extract content
  const reader = response.body.getReader();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  return new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n").filter((line) => line.startsWith("data: "));

      for (const line of lines) {
        const jsonStr = line.slice(6);
        if (jsonStr === "[DONE]") continue;

        try {
          const data = JSON.parse(jsonStr);
          const content = data.choices?.[0]?.delta?.content;
          if (content) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
          }
        } catch {
          // Ignore parse errors
        }
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
  smartMode: boolean
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

  const body: Record<string, unknown> = {
    model,
    system: systemPrompt,
    messages,
    max_tokens: maxTokens,
    stream: true,
  };

  if (smartMode) {
    body.thinking = {
      type: "enabled",
      budget_tokens: Math.min(maxTokens * 2, 10000),
    };
  }

  const startTime = Date.now();
  console.log(`[Anthropic] Calling API with model: ${model}, screenshot: ${!!screenshot}, maxTokens: ${maxTokens}`);

  const response = await fetch(PROVIDER_URLS.anthropic, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      ...(smartMode && { "anthropic-beta": "interleaved-thinking-2025-05-14" }),
    },
    body: JSON.stringify(body),
  });

  console.log(`[Anthropic] Response in ${Date.now() - startTime}ms, status: ${response.status}`);

  if (!response.ok || !response.body) {
    const errorText = await response.text().catch(() => "Failed to read error body");
    throw new Error(`Anthropic error ${response.status}: ${errorText}`);
  }

  const reader = response.body.getReader();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  return new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n").filter((line) => line.startsWith("data: "));

      for (const line of lines) {
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
        } catch {
          // Ignore parse errors
        }
      }
    },
  });
}
