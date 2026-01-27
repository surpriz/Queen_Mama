/**
 * Knowledge Extraction Service
 *
 * Analyzes session transcripts to extract knowledge atoms (patterns, arguments,
 * questions, techniques) using LLM analysis and generates embeddings for semantic search.
 */

import { prisma } from "@/lib/prisma";
import { getProviderApiKey, PROVIDER_URLS } from "@/lib/ai-providers";
import { generateEmbedding } from "@/lib/embeddings";
import { KnowledgeType } from "@prisma/client";
import { checkAtomLimit, makeRoomForNewAtoms, LIMITS } from "@/lib/knowledge-management";

// Use GPT-4o-mini for cost-effective extraction
const EXTRACTION_MODEL = "gpt-4o-mini";

export interface ExtractedKnowledge {
  type: KnowledgeType;
  content: string;
  context?: string;
  confidence: number;
}

export interface ExtractionResult {
  sessionId: string;
  atomsCreated: number;
  errors: string[];
}

const EXTRACTION_PROMPT = `You are an expert at analyzing sales and meeting conversations to extract valuable patterns and knowledge.

Analyze the following transcript and extract knowledge atoms in these categories:

1. OBJECTION_RESPONSE: How the speaker handles objections or pushback
   - Look for patterns like "but...", "the problem is...", followed by responses
   - Extract the objection and the effective response

2. TALKING_POINT: Effective arguments or selling points
   - Recurring themes that seem to work well
   - Value propositions that resonate

3. QUESTION: Pertinent questions the speaker asks
   - Discovery questions that lead to good responses
   - Questions that advance the conversation

4. CLOSING_TECHNIQUE: Closing or commitment-getting techniques
   - How the speaker asks for commitments
   - Trial close techniques

5. TOPIC_EXPERTISE: Areas where the speaker demonstrates expertise
   - Technical knowledge shared
   - Industry insights provided

For each extracted knowledge atom, provide:
- type: One of OBJECTION_RESPONSE, TALKING_POINT, QUESTION, CLOSING_TECHNIQUE, TOPIC_EXPERTISE
- content: The actual knowledge (concise but complete, 1-3 sentences)
- context: Brief context about when this was used
- confidence: How confident you are this is valuable (0.0-1.0)

Only extract high-quality, actionable knowledge (confidence >= 0.6).
Respond in JSON format as an array of objects.

TRANSCRIPT:
`;

/**
 * Extract knowledge atoms from a session transcript
 */
export async function extractKnowledgeFromSession(
  sessionId: string,
  userId: string,
  transcript: string
): Promise<ExtractionResult> {
  const result: ExtractionResult = {
    sessionId,
    atomsCreated: 0,
    errors: [],
  };

  if (!transcript || transcript.trim().length < 100) {
    result.errors.push("Transcript too short for meaningful extraction");
    return result;
  }

  try {
    // 1. Extract knowledge using LLM
    let extractedKnowledge = await analyzeTranscript(transcript);

    if (extractedKnowledge.length === 0) {
      return result;
    }

    // 2. Check atom limit and make room if necessary
    const limitStatus = await checkAtomLimit(userId);
    console.log(
      `[KnowledgeExtraction] Atom limit status: ${limitStatus.current}/${limitStatus.limit} (${limitStatus.remaining} remaining)`
    );

    if (limitStatus.remaining < extractedKnowledge.length) {
      // Try to free space by purging low-quality atoms
      const freed = await makeRoomForNewAtoms(userId, extractedKnowledge.length);
      console.log(`[KnowledgeExtraction] Freed ${freed} slots for new atoms`);

      if (freed < extractedKnowledge.length) {
        // Still not enough space, prioritize by confidence and limit
        extractedKnowledge = extractedKnowledge
          .sort((a, b) => b.confidence - a.confidence)
          .slice(0, freed);
        console.log(
          `[KnowledgeExtraction] Limited extraction to ${extractedKnowledge.length} highest confidence atoms`
        );

        if (extractedKnowledge.length === 0) {
          result.errors.push(
            `Knowledge limit reached (${LIMITS.MAX_ATOMS_PER_USER}). Delete or wait for auto-cleanup.`
          );
          return result;
        }
      }
    }

    // 3. Generate embeddings and store atoms
    for (const knowledge of extractedKnowledge) {
      try {
        // Generate embedding for the content
        const embeddingResult = await generateEmbedding(knowledge.content);

        // Store in database
        await prisma.knowledgeAtom.create({
          data: {
            userId,
            sessionId,
            type: knowledge.type,
            content: knowledge.content,
            embedding: embeddingResult.embedding,
            metadata: {
              context: knowledge.context,
              confidence: knowledge.confidence,
              extractedAt: new Date().toISOString(),
            },
          },
        });

        result.atomsCreated++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.errors.push(`Failed to store atom: ${errorMsg}`);
      }
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    result.errors.push(`Extraction failed: ${errorMsg}`);
  }

  return result;
}

/**
 * Analyze transcript using LLM to extract knowledge
 */
async function analyzeTranscript(transcript: string): Promise<ExtractedKnowledge[]> {
  const apiKey = await getProviderApiKey("openai");

  if (!apiKey) {
    throw new Error("OpenAI API key not configured for extraction");
  }

  // Truncate transcript if too long (keep ~6000 chars for context)
  const maxTranscriptLength = 6000;
  const truncatedTranscript = transcript.length > maxTranscriptLength
    ? transcript.slice(-maxTranscriptLength)
    : transcript;

  console.log("[KnowledgeExtraction] Calling OpenAI with model:", EXTRACTION_MODEL);
  console.log("[KnowledgeExtraction] Transcript length:", truncatedTranscript.length, "chars");

  const response = await fetch(PROVIDER_URLS.openai, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EXTRACTION_MODEL,
      messages: [
        {
          role: "system",
          content: "You are an expert conversation analyst. Always respond with valid JSON containing an 'atoms' array.",
        },
        {
          role: "user",
          content: EXTRACTION_PROMPT + truncatedTranscript,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("[KnowledgeExtraction] OpenAI API error:", response.status, error);
    throw new Error(`LLM extraction failed: ${error}`);
  }

  const data = await response.json();
  console.log("[KnowledgeExtraction] OpenAI response status:", response.status);

  const content = data.choices[0]?.message?.content;

  if (!content) {
    return [];
  }

  try {
    console.log("[KnowledgeExtraction] Raw LLM response:", content);

    const parsed = JSON.parse(content);
    console.log("[KnowledgeExtraction] Parsed JSON:", JSON.stringify(parsed, null, 2));

    const atoms = parsed.atoms || parsed.knowledge || parsed.extracted || parsed.results || (Array.isArray(parsed) ? parsed : []);

    if (!Array.isArray(atoms)) {
      console.log("[KnowledgeExtraction] No array found in response, keys:", Object.keys(parsed));
      return [];
    }

    console.log("[KnowledgeExtraction] Found", atoms.length, "potential atoms");

    // Validate and filter results - lowered threshold to 0.4 for better extraction
    const filtered = atoms
      .filter((atom: Record<string, unknown>) => {
        const isValid = atom.type && atom.content && typeof atom.confidence === "number" && atom.confidence >= 0.4;
        if (!isValid) {
          console.log("[KnowledgeExtraction] Filtered out atom:", { type: atom.type, confidence: atom.confidence, hasContent: !!atom.content });
        }
        return isValid;
      })
      .map((atom: Record<string, unknown>) => ({
        type: mapKnowledgeType(atom.type as string),
        content: String(atom.content).slice(0, 1000),
        context: atom.context ? String(atom.context).slice(0, 500) : undefined,
        confidence: Number(atom.confidence),
      }));

    console.log("[KnowledgeExtraction] After filtering:", filtered.length, "atoms");
    return filtered;
  } catch (e) {
    console.error("[KnowledgeExtraction] Failed to parse LLM response:", e, "Content:", content);
    return [];
  }
}

/**
 * Map string type to KnowledgeType enum
 */
function mapKnowledgeType(typeStr: string): KnowledgeType {
  const normalized = typeStr.toUpperCase().replace(/[^A-Z_]/g, "");

  switch (normalized) {
    case "OBJECTION_RESPONSE":
    case "OBJECTIONRESPONSE":
      return "OBJECTION_RESPONSE";
    case "TALKING_POINT":
    case "TALKINGPOINT":
      return "TALKING_POINT";
    case "QUESTION":
      return "QUESTION";
    case "CLOSING_TECHNIQUE":
    case "CLOSINGTECHNIQUE":
      return "CLOSING_TECHNIQUE";
    case "TOPIC_EXPERTISE":
    case "TOPICEXPERTISE":
      return "TOPIC_EXPERTISE";
    default:
      return "TALKING_POINT"; // Default fallback
  }
}

/**
 * Queue extraction for a session (to be processed in background)
 */
export async function queueExtractionForSession(
  sessionId: string,
  userId: string
): Promise<void> {
  // For now, we'll trigger extraction synchronously
  // In production, this could use a job queue (Bull, etc.)
  console.log(`[KnowledgeExtraction] Queuing extraction for session ${sessionId}`);

  // Fetch session transcript
  const session = await prisma.syncedSession.findUnique({
    where: { id: sessionId },
    select: { transcript: true },
  });

  if (!session?.transcript) {
    console.log(`[KnowledgeExtraction] No transcript for session ${sessionId}`);
    return;
  }

  // Run extraction in background (fire and forget)
  extractKnowledgeFromSession(sessionId, userId, session.transcript)
    .then((result) => {
      console.log(
        `[KnowledgeExtraction] Completed for session ${sessionId}: ${result.atomsCreated} atoms created`
      );
      if (result.errors.length > 0) {
        console.error(`[KnowledgeExtraction] Errors:`, result.errors);
      }
    })
    .catch((error) => {
      console.error(`[KnowledgeExtraction] Failed for session ${sessionId}:`, error);
    });
}

/**
 * Get extraction stats for a user
 */
export async function getExtractionStats(userId: string) {
  const [totalAtoms, byType] = await Promise.all([
    prisma.knowledgeAtom.count({ where: { userId } }),
    prisma.knowledgeAtom.groupBy({
      by: ["type"],
      where: { userId },
      _count: { id: true },
    }),
  ]);

  return {
    totalAtoms,
    byType: byType.reduce(
      (acc, item) => {
        acc[item.type] = item._count.id;
        return acc;
      },
      {} as Record<string, number>
    ),
  };
}
