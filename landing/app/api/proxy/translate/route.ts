import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/device-auth";
import {
  getProviderApiKey,
  TIER_LIMITS,
  type PlanTier,
} from "@/lib/ai-providers";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const MAX_TEXT_LENGTH = 5000; // DeepL hard limit is 128KB but no single transcript chunk should exceed 5K chars

interface DeepLTranslation {
  detected_source_language?: string;
  text: string;
}

interface DeepLResponse {
  translations: DeepLTranslation[];
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

/**
 * POST /api/proxy/translate
 * Translate text via DeepL Pro. Backend holds the API key, applies per-user
 * monthly quota, and records usage.
 *
 * Body: { text: string, target_lang: string, source_lang?: string }
 * Response: { translated_text: string, detected_source_lang?: string, target_lang: string }
 */
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "unauthorized", message: "Missing authorization header" },
        { status: 401, headers: corsHeaders }
      );
    }

    const accessToken = authHeader.slice(7);

    let tokenPayload;
    try {
      tokenPayload = await verifyAccessToken(accessToken);
    } catch {
      return NextResponse.json(
        { error: "invalid_token", message: "Invalid or expired token" },
        { status: 401, headers: corsHeaders }
      );
    }

    let body: { text?: string; target_lang?: string; source_lang?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "invalid_body", message: "Body must be valid JSON" },
        { status: 400, headers: corsHeaders }
      );
    }

    const text = body.text?.trim();
    const targetLang = body.target_lang?.toUpperCase();
    const sourceLang = body.source_lang?.toUpperCase();

    if (!text) {
      return NextResponse.json(
        { error: "missing_text", message: "text is required" },
        { status: 400, headers: corsHeaders }
      );
    }
    if (!targetLang) {
      return NextResponse.json(
        { error: "missing_target_lang", message: "target_lang is required" },
        { status: 400, headers: corsHeaders }
      );
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json(
        { error: "text_too_long", message: `text exceeds ${MAX_TEXT_LENGTH} chars` },
        { status: 400, headers: corsHeaders }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: tokenPayload.sub },
      include: { subscription: true },
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

    const plan = (user.subscription?.plan || "FREE") as PlanTier;
    const tierConfig = TIER_LIMITS[plan];

    if (!tierConfig.translation) {
      return NextResponse.json(
        { error: "translation_not_available", message: "Translation requires PRO subscription" },
        { status: 403, headers: corsHeaders }
      );
    }

    // Monthly quota check
    if (tierConfig.monthlyTranslationChars !== null) {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const usage = await prisma.usageLog.aggregate({
        where: {
          userId: user.id,
          action: "translation",
          createdAt: { gte: monthStart },
        },
        _sum: {
          tokensUsed: true, // chars billed stored in tokensUsed
        },
      });

      const used = usage._sum.tokensUsed ?? 0;
      if (used + text.length > tierConfig.monthlyTranslationChars) {
        return NextResponse.json(
          {
            error: "quota_exceeded",
            message: "Monthly translation quota exceeded",
            used,
            limit: tierConfig.monthlyTranslationChars,
          },
          { status: 402, headers: corsHeaders }
        );
      }
    }

    const apiKey = await getProviderApiKey("deepl");
    if (!apiKey) {
      return NextResponse.json(
        { error: "provider_not_configured", message: "DeepL is not configured" },
        { status: 503, headers: corsHeaders }
      );
    }

    const endpoint = apiKey.endsWith(":fx")
      ? "https://api-free.deepl.com/v2/translate"
      : "https://api.deepl.com/v2/translate";

    const params = new URLSearchParams();
    params.append("text", text);
    params.append("target_lang", targetLang);
    if (sourceLang && sourceLang !== "AUTO") {
      params.append("source_lang", sourceLang);
    }
    params.append("preserve_formatting", "1");

    const deepLResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (deepLResponse.status === 429) {
      return NextResponse.json(
        { error: "rate_limited", message: "DeepL rate limit reached, retry later" },
        { status: 429, headers: corsHeaders }
      );
    }

    if (deepLResponse.status === 456) {
      // DeepL-specific quota exceeded code
      return NextResponse.json(
        { error: "quota_exceeded", message: "DeepL account quota exhausted" },
        { status: 402, headers: corsHeaders }
      );
    }

    if (!deepLResponse.ok) {
      const errorText = await deepLResponse.text();
      console.error(`[Translate] DeepL ${deepLResponse.status}:`, errorText);
      return NextResponse.json(
        { error: "translation_failed", message: `DeepL returned ${deepLResponse.status}` },
        { status: 502, headers: corsHeaders }
      );
    }

    const data = (await deepLResponse.json()) as DeepLResponse;
    const translation = data.translations?.[0];

    if (!translation) {
      return NextResponse.json(
        { error: "empty_response", message: "DeepL returned no translation" },
        { status: 502, headers: corsHeaders }
      );
    }

    // Record usage (best-effort, don't fail the request if it errors)
    prisma.usageLog
      .create({
        data: {
          userId: user.id,
          action: "translation",
          provider: "deepl",
          tokensUsed: text.length,
          metadata: {
            sourceLang: sourceLang ?? "auto",
            targetLang,
            detectedSourceLang: translation.detected_source_language ?? null,
          },
        },
      })
      .catch((err) => {
        console.error("[Translate] Failed to log usage:", err);
      });

    return NextResponse.json(
      {
        translated_text: translation.text,
        detected_source_lang: translation.detected_source_language ?? null,
        target_lang: targetLang,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("[Translate] Unexpected error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Translation failed" },
      { status: 500, headers: corsHeaders }
    );
  }
}
