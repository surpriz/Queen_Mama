/**
 * Document Blob Storage
 *
 * Wraps Vercel Blob ops for user-uploaded PDF documents.
 */

import { put, del, get } from "@vercel/blob";

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB
const ALLOWED_MIME = ["application/pdf"];

export interface BlobPutResult {
  blobUrl: string;
  pathname: string;
}

export function validateUpload(file: { type: string; size: number }): string | null {
  if (!ALLOWED_MIME.includes(file.type)) {
    return `Unsupported file type: ${file.type}. Only PDF accepted.`;
  }
  if (file.size > MAX_BYTES) {
    return `File too large: ${file.size} bytes. Max 50 MB.`;
  }
  if (file.size <= 0) {
    return "Empty file.";
  }
  return null;
}

export async function uploadDocumentBlob(
  userId: string,
  filename: string,
  file: Blob | ArrayBuffer | Buffer
): Promise<BlobPutResult> {
  const safeName = filename.replace(/[^\w.-]+/g, "_");
  const pathname = `documents/${userId}/${Date.now()}-${safeName}`;

  const result = await put(pathname, file, {
    access: "private",
    contentType: "application/pdf",
  });

  return {
    blobUrl: result.url,
    pathname: result.pathname,
  };
}

export async function deleteDocumentBlob(pathnameOrUrl: string): Promise<void> {
  try {
    await del(pathnameOrUrl);
  } catch (err) {
    console.error("[DocumentBlob] Delete failed", pathnameOrUrl, err);
  }
}

/**
 * Fetches a private blob's bytes via the Vercel SDK (signed-stream).
 * Plain HTTP fetch on the URL would fail because private blobs require auth.
 */
export async function fetchDocumentBlob(pathname: string): Promise<Buffer> {
  const result = await get(pathname, { access: "private" });
  const chunks: Uint8Array[] = [];
  const reader = result.stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.length;
  }
  return Buffer.from(merged);
}
