// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock, resetPrismaMock } from "@/tests/helpers/prisma-mock";

vi.mock("@/lib/embeddings", () => ({
  generateEmbedding: vi.fn(),
  cosineSimilarity: vi.fn(),
}));

import {
  retrieveRelevantChunks,
  formatChunksForPrompt,
  uniqueFilenames,
  userHasReadyDocuments,
  type RetrievedChunk,
} from "@/lib/document-retrieval";
import { generateEmbedding, cosineSimilarity } from "@/lib/embeddings";

const mockedGenerateEmbedding = vi.mocked(generateEmbedding);
const mockedCosineSimilarity = vi.mocked(cosineSimilarity);

describe("document-retrieval", () => {
  beforeEach(() => {
    resetPrismaMock();
    vi.clearAllMocks();
  });

  describe("userHasReadyDocuments", () => {
    it("returns true when user has READY documents", async () => {
      prismaMock.document.count.mockResolvedValue(3);
      expect(await userHasReadyDocuments("user-1")).toBe(true);
      expect(prismaMock.document.count).toHaveBeenCalledWith({
        where: { userId: "user-1", status: "READY" },
      });
    });

    it("returns false when user has no READY documents", async () => {
      prismaMock.document.count.mockResolvedValue(0);
      expect(await userHasReadyDocuments("user-1")).toBe(false);
    });
  });

  describe("retrieveRelevantChunks", () => {
    const baseChunk = (
      override: Partial<{
        id: string;
        documentId: string;
        content: string;
        pageNumber: number | null;
        tokenCount: number;
        filename: string;
      }> = {}
    ) => ({
      id: override.id ?? "chunk-1",
      documentId: override.documentId ?? "doc-1",
      content: override.content ?? "default content",
      embedding: [0.1, 0.2, 0.3],
      pageNumber: override.pageNumber ?? 1,
      tokenCount: override.tokenCount ?? 100,
      document: { filename: override.filename ?? "doc.pdf" },
    });

    it("returns [] when query is too short", async () => {
      const result = await retrieveRelevantChunks("user-1", "hi");
      expect(result).toEqual([]);
      expect(mockedGenerateEmbedding).not.toHaveBeenCalled();
    });

    it("returns [] when embedding generation fails", async () => {
      mockedGenerateEmbedding.mockRejectedValue(new Error("embed boom"));
      const result = await retrieveRelevantChunks("user-1", "what is the microscope X200 resolution");
      expect(result).toEqual([]);
    });

    it("filters by minSimilarity and returns topK sorted desc", async () => {
      mockedGenerateEmbedding.mockResolvedValue({
        embedding: [1, 0, 0],
        model: "text-embedding-3-small",
        tokensUsed: 5,
      });

      prismaMock.documentChunk.findMany.mockResolvedValue([
        baseChunk({ id: "high", content: "high sim" }),
        baseChunk({ id: "low", content: "low sim" }),
        baseChunk({ id: "mid", content: "mid sim" }),
      ] as never);

      // Map cosine results in call order
      mockedCosineSimilarity
        .mockReturnValueOnce(0.9) // high
        .mockReturnValueOnce(0.5) // low — below 0.7 threshold
        .mockReturnValueOnce(0.75); // mid

      const result = await retrieveRelevantChunks("user-1", "query text long enough", {
        topK: 2,
        minSimilarity: 0.7,
      });

      expect(result.map((c) => c.chunkId)).toEqual(["high", "mid"]);
      expect(result[0].similarity).toBeGreaterThan(result[1].similarity);
    });

    it("respects total token budget", async () => {
      mockedGenerateEmbedding.mockResolvedValue({
        embedding: [1, 0, 0],
        model: "text-embedding-3-small",
        tokensUsed: 5,
      });

      prismaMock.documentChunk.findMany.mockResolvedValue([
        baseChunk({ id: "a", tokenCount: 1500 }),
        baseChunk({ id: "b", tokenCount: 1500 }),
        baseChunk({ id: "c", tokenCount: 1500 }),
      ] as never);

      mockedCosineSimilarity.mockReturnValue(0.9);

      const result = await retrieveRelevantChunks("user-1", "query text long enough", {
        topK: 10,
        minSimilarity: 0.7,
        maxTotalTokens: 3000,
      });

      // Only 2 fit within 3000-token budget
      expect(result).toHaveLength(2);
    });

    it("only queries chunks belonging to READY documents", async () => {
      mockedGenerateEmbedding.mockResolvedValue({
        embedding: [1, 0, 0],
        model: "text-embedding-3-small",
        tokensUsed: 5,
      });
      prismaMock.documentChunk.findMany.mockResolvedValue([] as never);

      await retrieveRelevantChunks("user-7", "query text long enough");

      expect(prismaMock.documentChunk.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: "user-7",
            document: { status: "READY" },
          }),
        })
      );
    });
  });

  describe("formatChunksForPrompt", () => {
    it("returns empty string when no chunks", () => {
      expect(formatChunksForPrompt([])).toBe("");
    });

    it("includes filename + page in each source header", () => {
      const chunks: RetrievedChunk[] = [
        {
          chunkId: "1",
          documentId: "d1",
          filename: "specs.pdf",
          pageNumber: 4,
          content: "Resolution: 1.5 nm",
          similarity: 0.9,
        },
        {
          chunkId: "2",
          documentId: "d2",
          filename: "catalog.pdf",
          pageNumber: null,
          content: "List of products",
          similarity: 0.8,
        },
      ];

      const out = formatChunksForPrompt(chunks);
      expect(out).toContain("## Reference Documents");
      expect(out).toContain("[Source: specs.pdf, page 4]");
      expect(out).toContain("Resolution: 1.5 nm");
      expect(out).toContain("[Source: catalog.pdf]");
      expect(out).toContain("List of products");
    });
  });

  describe("uniqueFilenames", () => {
    it("dedupes filenames across chunks", () => {
      const chunks: RetrievedChunk[] = [
        { chunkId: "1", documentId: "d1", filename: "a.pdf", pageNumber: 1, content: "", similarity: 0.9 },
        { chunkId: "2", documentId: "d1", filename: "a.pdf", pageNumber: 2, content: "", similarity: 0.85 },
        { chunkId: "3", documentId: "d2", filename: "b.pdf", pageNumber: 1, content: "", similarity: 0.8 },
      ];
      expect(uniqueFilenames(chunks)).toEqual(["a.pdf", "b.pdf"]);
    });
  });
});
