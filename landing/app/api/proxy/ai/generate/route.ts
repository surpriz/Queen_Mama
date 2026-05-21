import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/device-auth";
import {
  getProviderApiKey,
  validateAIRequest,
  getModelForProvider,
  USER_SELECTABLE_MODELS,
  isUserSelectableModel,
  PROVIDER_URLS,
  type PlanTier,
  type AIProviderType,
} from "@/lib/ai-providers";
import { checkRateLimit, getIdentifier, rateLimitResponse, rateLimitConfigs, addRateLimitHeaders } from "@/lib/rate-limit";
import {
  retrieveRelevantChunks,
  formatChunksForPrompt,
  uniqueFilenames,
  userHasReadyDocuments,
} from "@/lib/document-retrieval";

interface AIRequestBody {
  provider: AIProviderType;
  smartMode?: boolean;
  model?: string; // Optional user-selected model (whitelisted; only honored when smartMode is false)
  systemPrompt: string;
  userMessage: string;
  screenshot?: string; // base64 encoded
  maxTokens?: number;
}

/**
 * POST /api/proxy/ai/generate
 * Proxy for non-streaming AI requests
 * Routes requests to the appropriate AI provider with admin API keys
 */
export async function POST(request: Request) {
  // Apply rate limiting - initial check based on IP
  const ipIdentifier = getIdentifier(request);
  const initialRateLimit = checkRateLimit(ipIdentifier, rateLimitConfigs.aiProxy);

  if (!initialRateLimit.success) {
    return rateLimitResponse(initialRateLimit);
  }

  try {
    // Get access token from Authorization header
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "unauthorized", message: "Missing authorization header" },
        { status: 401 }
      );
    }

    const accessToken = authHeader.slice(7);

    let tokenPayload;
    try {
      tokenPayload = await verifyAccessToken(accessToken);
    } catch {
      return NextResponse.json(
        { error: "invalid_token", message: "Invalid or expired token" },
        { status: 401 }
      );
    }

    // Parse request body
    const body: AIRequestBody = await request.json();
    const { provider, smartMode = false, model: userModel, systemPrompt, userMessage, screenshot, maxTokens } = body;

    // Honor user-selected model only when smartMode is false (standard mode).
    const userOverride = !smartMode && isUserSelectableModel(userModel)
      ? USER_SELECTABLE_MODELS[userModel]
      : null;

    if (!provider || !systemPrompt || !userMessage) {
      return NextResponse.json(
        { error: "invalid_request", message: "Missing required fields: provider, systemPrompt, userMessage" },
        { status: 400 }
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
        { status: 404 }
      );
    }

    if (user.role === "BLOCKED") {
      return NextResponse.json(
        { error: "account_blocked", message: "Account has been blocked" },
        { status: 403 }
      );
    }

    // Get plan and check limits
    const plan = (user.subscription?.plan || "FREE") as PlanTier;

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

    // Validate request (async - checks DB for configured providers)
    const validation = await validateAIRequest({
      tier: plan,
      provider,
      smartMode,
      dailyRequestCount,
    });

    if (!validation.valid) {
      return NextResponse.json(
        { error: "request_denied", message: validation.error },
        { status: 403 }
      );
    }

    // Get admin API key from database
    const adminApiKey = await getProviderApiKey(provider);
    if (!adminApiKey) {
      return NextResponse.json(
        { error: "provider_not_configured", message: `${provider} is not configured by admin` },
        { status: 503 }
      );
    }

    // Calculate tokens
    // Smart mode uses thinking which consumes part of max_tokens — enforce minimum
    const rawMaxTokens = Math.min(maxTokens || validation.maxTokens, validation.maxTokens);
    const requestMaxTokens = smartMode ? Math.max(rawMaxTokens, 4000) : rawMaxTokens;

    // ============================================
    // DOCUMENT RAG: Inject excerpts from user's uploaded PDFs (Enterprise)
    // ============================================
    const DOCUMENT_RAG_ENABLED = process.env.DOCUMENT_RAG_ENABLED !== "false";
    let enhancedSystemPrompt = systemPrompt;
    let documentsUsed: string[] = [];

    if (DOCUMENT_RAG_ENABLED && plan === "ENTERPRISE") {
      try {
        const hasDocs = await userHasReadyDocuments(user.id);
        if (hasDocs) {
          const queryText = userMessage.slice(-2000);
          const chunks = await retrieveRelevantChunks(user.id, queryText, {
            topK: 5,
            minSimilarity: 0.5,
            maxTotalTokens: 3000,
          });

          if (chunks.length > 0) {
            enhancedSystemPrompt += formatChunksForPrompt(chunks);
            documentsUsed = uniqueFilenames(chunks);
            console.log(
              `[DocumentRAG] (generate) Injected ${chunks.length} chunks from ${documentsUsed.length} doc(s) for user ${user.id}`
            );
          }
        }
      } catch (error) {
        console.error("[DocumentRAG] (generate) Retrieval error:", error);
      }
    }

    // Make request to provider
    // Smart mode always routes to Anthropic (cascade primary for smart = Sonnet 4.6 + thinking)
    // User-selected model (non-smart only) overrides provider/model/apiKey.
    let effectiveProvider: AIProviderType;
    let effectiveApiKey: string;
    let effectiveModel: string;
    if (smartMode) {
      effectiveProvider = "anthropic";
      effectiveApiKey = (await getProviderApiKey("anthropic")) || adminApiKey;
      effectiveModel = "claude-sonnet-4-6";
    } else if (userOverride) {
      const overrideKey = await getProviderApiKey(userOverride.provider);
      if (!overrideKey) {
        return NextResponse.json(
          { error: "provider_not_configured", message: `${userOverride.provider} (required for selected model) is not configured by admin` },
          { status: 503 }
        );
      }
      effectiveProvider = userOverride.provider;
      effectiveApiKey = overrideKey;
      effectiveModel = userOverride.model;
    } else {
      effectiveProvider = provider;
      effectiveApiKey = adminApiKey;
      effectiveModel = validation.model;
    }

    const startTime = Date.now();
    let aiResponse: { content: string; tokensUsed?: number };

    try {
      switch (effectiveProvider) {
        case "openai":
        case "grok":
          aiResponse = await callOpenAICompatible(
            effectiveProvider,
            effectiveApiKey,
            effectiveModel,
            enhancedSystemPrompt,
            userMessage,
            screenshot,
            requestMaxTokens
          );
          break;
        case "anthropic":
          aiResponse = await callAnthropic(
            effectiveApiKey,
            effectiveModel,
            enhancedSystemPrompt,
            userMessage,
            screenshot,
            requestMaxTokens,
            smartMode
          );
          break;
        case "gemini":
          aiResponse = await callGemini(
            adminApiKey,
            validation.model,
            enhancedSystemPrompt,
            userMessage,
            screenshot,
            requestMaxTokens
          );
          break;
        default:
          return NextResponse.json(
            { error: "unsupported_provider", message: `Provider ${provider} is not supported` },
            { status: 400 }
          );
      }
    } catch (error) {
      console.error(`AI provider ${provider} error:`, error);
      return NextResponse.json(
        { error: "provider_error", message: `${provider} request failed` },
        { status: 502 }
      );
    }

    const latencyMs = Date.now() - startTime;

    // Record usage
    await prisma.usageLog.create({
      data: {
        userId: user.id,
        action: "ai_request",
        provider,
        tokensUsed: aiResponse.tokensUsed,
      },
    });

    if (smartMode) {
      await prisma.usageLog.create({
        data: {
          userId: user.id,
          action: "smart_mode",
          provider,
        },
      });
    }

    const response = NextResponse.json({
      content: aiResponse.content,
      provider: effectiveProvider,
      model: effectiveModel,
      latencyMs,
      tokensUsed: aiResponse.tokensUsed,
    });
    return addRateLimitHeaders(response, initialRateLimit, rateLimitConfigs.aiProxy.maxRequests);
  } catch (error) {
    console.error("AI proxy error:", error);
    return NextResponse.json(
      { error: "server_error", message: "AI request failed" },
      { status: 500 }
    );
  }
}

// OpenAI and Grok compatible API
async function callOpenAICompatible(
  provider: "openai" | "grok",
  apiKey: string,
  model: string,
  systemPrompt: string,
  userMessage: string,
  screenshot: string | undefined,
  maxTokens: number
): Promise<{ content: string; tokensUsed?: number }> {
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

  // OpenAI's newer models require max_completion_tokens instead of max_tokens
  // This includes: gpt-4o, gpt-5-*, o1-*, o3-*, o4-*
  const useNewTokenParam = provider === "openai" && (
    model.startsWith("gpt-4o") ||
    model.startsWith("gpt-5") ||
    model.startsWith("o1-") ||
    model.startsWith("o3-") ||
    model.startsWith("o4-")
  );

  // GPT-5 and o-series models only support temperature=1 (default), so omit for those
  const supportsTemperature = !model.startsWith("gpt-5") &&
    !model.startsWith("o1-") &&
    !model.startsWith("o3-") &&
    !model.startsWith("o4-");

  const requestBody: Record<string, unknown> = {
    model,
    messages,
    stream: false,
  };

  if (useNewTokenParam) {
    requestBody.max_completion_tokens = maxTokens;
  } else {
    requestBody.max_tokens = maxTokens;
  }

  if (supportsTemperature) {
    requestBody.temperature = 0.7;
  }

  const response = await fetch(PROVIDER_URLS[provider], {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${provider} API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content || "",
    tokensUsed: data.usage?.total_tokens,
  };
}

// Anthropic API
async function callAnthropic(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userMessage: string,
  screenshot: string | undefined,
  maxTokens: number,
  smartMode: boolean
): Promise<{ content: string; tokensUsed?: number }> {
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
  };

  if (smartMode) {
    // A4: Adaptive thinking for smart mode (effort and thinking are mutually exclusive)
    body.thinking = {
      type: "adaptive",
    };
  } else {
    // A1: effort parameter — only when thinking is disabled
    body.output_config = { effort: "low" };
  }

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

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  // Extract text from content blocks
  let content = "";
  for (const block of data.content || []) {
    if (block.type === "text") {
      content += block.text;
    }
  }

  return {
    content,
    tokensUsed: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
  };
}

// Gemini API
async function callGemini(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userMessage: string,
  screenshot: string | undefined,
  maxTokens: number
): Promise<{ content: string; tokensUsed?: number }> {
  const url = `${PROVIDER_URLS.gemini}/${model}:generateContent?key=${apiKey}`;

  const parts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }> = [];

  // Add system prompt and user message as text
  parts.push({ text: `${systemPrompt}\n\n${userMessage}` });

  // Add screenshot if present
  if (screenshot) {
    parts.push({
      inline_data: {
        mime_type: "image/jpeg",
        data: screenshot,
      },
    });
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts,
        },
      ],
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: 0.7,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const tokensUsed = data.usageMetadata?.totalTokenCount;

  return { content, tokensUsed };
}
