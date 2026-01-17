import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/device-auth";
import {
  getProviderApiKey,
  validateAIRequest,
  PROVIDER_URLS,
  type PlanTier,
  type AIProviderType,
} from "@/lib/ai-providers";

interface AIStreamRequestBody {
  provider: AIProviderType;
  smartMode?: boolean;
  systemPrompt: string;
  userMessage: string;
  screenshot?: string; // base64 encoded
  maxTokens?: number;
}

/**
 * POST /api/proxy/ai/stream
 * Proxy for streaming AI requests (Server-Sent Events)
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
    const body: AIStreamRequestBody = await request.json();
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

    // Create SSE stream
    const encoder = new TextEncoder();
    const userId = user.id;

    const stream = new ReadableStream({
      async start(controller) {
        try {
          let providerStream: ReadableStream<Uint8Array>;

          switch (provider) {
            case "openai":
            case "grok":
              providerStream = await streamOpenAICompatible(
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
              providerStream = await streamAnthropic(
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
              providerStream = await streamGemini(
                adminApiKey,
                validation.model,
                systemPrompt,
                userMessage,
                screenshot,
                requestMaxTokens
              );
              break;
            default:
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "unsupported_provider" })}\n\n`));
              controller.close();
              return;
          }

          const reader = providerStream.getReader();
          const decoder = new TextDecoder();

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            controller.enqueue(encoder.encode(chunk));
          }

          // Send completion marker
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();

          // Record usage (async, don't block stream)
          prisma.usageLog
            .create({
              data: {
                userId,
                action: "ai_request",
                provider,
              },
            })
            .catch(console.error);

          if (smartMode) {
            prisma.usageLog
              .create({
                data: {
                  userId,
                  action: "smart_mode",
                  provider,
                },
              })
              .catch(console.error);
          }
        } catch (error) {
          console.error("Stream error:", error);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: "stream_error", message: String(error) })}\n\n`)
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
        "X-Provider": provider,
        "X-Model": validation.model,
      },
    });
  } catch (error) {
    console.error("AI stream proxy error:", error);
    return NextResponse.json(
      { error: "server_error", message: "AI streaming request failed" },
      { status: 500 }
    );
  }
}

// OpenAI and Grok streaming
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
      stream: true,
    }),
  });

  if (!response.ok || !response.body) {
    throw new Error(`${provider} streaming error: ${response.status}`);
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

  if (!response.ok || !response.body) {
    throw new Error(`Anthropic streaming error: ${response.status}`);
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

// Gemini streaming
async function streamGemini(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userMessage: string,
  screenshot: string | undefined,
  maxTokens: number
): Promise<ReadableStream<Uint8Array>> {
  const url = `${PROVIDER_URLS.gemini}/${model}:streamGenerateContent?key=${apiKey}&alt=sse`;

  const parts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }> = [];
  parts.push({ text: `${systemPrompt}\n\n${userMessage}` });

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

  if (!response.ok || !response.body) {
    throw new Error(`Gemini streaming error: ${response.status}`);
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
          const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
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
