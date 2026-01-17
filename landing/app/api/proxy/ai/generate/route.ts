import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/device-auth";
import {
  getProviderApiKey,
  validateAIRequest,
  getModelForProvider,
  PROVIDER_URLS,
  type PlanTier,
  type AIProviderType,
} from "@/lib/ai-providers";

interface AIRequestBody {
  provider: AIProviderType;
  smartMode?: boolean;
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
    const { provider, smartMode = false, systemPrompt, userMessage, screenshot, maxTokens } = body;

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
    const requestMaxTokens = Math.min(maxTokens || validation.maxTokens, validation.maxTokens);

    // Make request to provider
    const startTime = Date.now();
    let aiResponse: { content: string; tokensUsed?: number };

    try {
      switch (provider) {
        case "openai":
        case "grok":
          aiResponse = await callOpenAICompatible(
            provider,
            adminApiKey,
            validation.model,
            systemPrompt,
            userMessage,
            screenshot,
            requestMaxTokens
          );
          break;
        case "anthropic":
          aiResponse = await callAnthropic(
            adminApiKey,
            validation.model,
            systemPrompt,
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
            systemPrompt,
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

    return NextResponse.json({
      content: aiResponse.content,
      provider,
      model: validation.model,
      latencyMs,
      tokensUsed: aiResponse.tokensUsed,
    });
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

  const response = await fetch(PROVIDER_URLS[provider], {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature: 0.7,
      stream: false,
    }),
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

  // Add extended thinking for smart mode
  if (smartMode) {
    body.thinking = {
      type: "enabled",
      budget_tokens: Math.min(maxTokens * 2, 10000),
    };
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
