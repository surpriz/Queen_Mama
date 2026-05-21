/**
 * Document Processing Pipeline
 *
 * Fetches a PDF blob, extracts text + per-page mapping, chunks the text,
 * generates OpenAI embeddings for each chunk, and writes DocumentChunk rows.
 * Updates Document.status throughout.
 */

import { prisma } from "@/lib/prisma";
import { generateEmbeddingsBatch } from "@/lib/embeddings";
import { fetchDocumentBlob } from "@/lib/document-blob";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { PDFParse } from "pdf-parse";

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 150;
const EMBED_BATCH_SIZE = 100;
const MIN_TEXT_LENGTH = 100;
const APPROX_CHARS_PER_TOKEN = 4;

interface PageMappedText {
  text: string;
  pages: Array<{ start: number; end: number; pageNumber: number }>;
}

/**
 * pdf-parse exposes a `pagerender` hook letting us record character offsets
 * for each page so we can later attribute chunks back to source pages.
 */
async function extractPdfTextWithPages(buffer: Buffer): Promise<PageMappedText> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    let combined = "";
    const pages: PageMappedText["pages"] = [];
    for (const page of result.pages) {
      const start = combined.length;
      const text = page.text || "";
      combined += (combined ? "\n\n" : "") + text;
      pages.push({ start, end: combined.length, pageNumber: page.num });
    }
    if (pages.length === 0 && result.text) {
      combined = result.text;
      pages.push({ start: 0, end: combined.length, pageNumber: 1 });
    }
    return { text: combined, pages };
  } finally {
    await parser.destroy();
  }
}

function pageForOffset(pages: PageMappedText["pages"], offset: number): number | null {
  const found = pages.find((p) => offset >= p.start && offset < p.end);
  return found?.pageNumber ?? pages[pages.length - 1]?.pageNumber ?? null;
}

function approxTokenCount(text: string): number {
  return Math.ceil(text.length / APPROX_CHARS_PER_TOKEN);
}

/**
 * Background pipeline. Updates Document status from PROCESSING → READY/FAILED.
 * Intended to be invoked via Next.js `after()` / `waitUntil()` from the upload route.
 */
export async function processDocument(documentId: string): Promise<void> {
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) {
    console.error("[DocumentProcessing] Document not found:", documentId);
    return;
  }

  console.log(`[DocumentProcessing] Start ${documentId} (${doc.filename}, ${doc.sizeBytes} bytes)`);
  const startedAt = Date.now();

  try {
    await prisma.document.update({
      where: { id: documentId },
      data: { status: "PROCESSING" },
    });

    // 1. Fetch + extract text (use blobPathname; private blobs cannot be fetched via plain URL)
    const buffer = await fetchDocumentBlob(doc.blobPathname);
    const { text, pages } = await extractPdfTextWithPages(buffer);

    if (text.length < MIN_TEXT_LENGTH) {
      await prisma.document.update({
        where: { id: documentId },
        data: {
          status: "FAILED",
          errorMessage:
            "PDF appears to be scanned or contains no extractable text. OCR is not supported in v1.",
        },
      });
      console.warn(`[DocumentProcessing] ${documentId} FAILED (no text extractable)`);
      return;
    }

    // 2. Chunk
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: CHUNK_SIZE * APPROX_CHARS_PER_TOKEN, // approx chars for ~1000 tokens
      chunkOverlap: CHUNK_OVERLAP * APPROX_CHARS_PER_TOKEN,
    });
    const rawChunks = await splitter.splitText(text);

    // Map each chunk back to a page using the first-occurrence offset of its first 80 chars
    const chunksWithPages = rawChunks.map((content, idx) => {
      const probe = content.slice(0, 80);
      const offset = text.indexOf(probe);
      const pageNumber = offset >= 0 ? pageForOffset(pages, offset) : null;
      return {
        chunkIndex: idx,
        content,
        pageNumber,
        tokenCount: approxTokenCount(content),
      };
    });

    console.log(`[DocumentProcessing] ${documentId} chunked into ${chunksWithPages.length} chunks`);

    // 3. Embed in batches
    const allChunks: Array<{
      chunkIndex: number;
      content: string;
      pageNumber: number | null;
      tokenCount: number;
      embedding: number[];
    }> = [];

    for (let i = 0; i < chunksWithPages.length; i += EMBED_BATCH_SIZE) {
      const batch = chunksWithPages.slice(i, i + EMBED_BATCH_SIZE);
      const embeddings = await generateEmbeddingsBatch(batch.map((c) => c.content));
      embeddings.forEach((res, k) => {
        allChunks.push({ ...batch[k], embedding: res.embedding });
      });
    }

    // 4. Persist chunks
    await prisma.documentChunk.createMany({
      data: allChunks.map((c) => ({
        documentId: doc.id,
        userId: doc.userId,
        chunkIndex: c.chunkIndex,
        content: c.content,
        embedding: c.embedding,
        pageNumber: c.pageNumber,
        tokenCount: c.tokenCount,
      })),
    });

    // 5. Mark READY
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: "READY",
        pageCount: pages.length || null,
        chunkCount: allChunks.length,
        errorMessage: null,
      },
    });

    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(`[DocumentProcessing] ${documentId} READY in ${elapsed}s — ${pages.length} pages, ${allChunks.length} chunks`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[DocumentProcessing] ${documentId} FAILED:`, message);
    await prisma.document.update({
      where: { id: documentId },
      data: { status: "FAILED", errorMessage: message.slice(0, 500) },
    });
  }
}
