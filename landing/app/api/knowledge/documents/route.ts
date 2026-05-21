import { NextResponse, after } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadDocumentBlob, validateUpload } from "@/lib/document-blob";
import { processDocument } from "@/lib/document-processing";

async function requireEnterpriseUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { subscription: true },
  });
  if (user?.subscription?.plan !== "ENTERPRISE") {
    return NextResponse.json(
      {
        error: "enterprise_required",
        message: "Knowledge Base requires Enterprise subscription",
      },
      { status: 403 }
    );
  }
  return null;
}

/**
 * GET /api/knowledge/documents — list current user's documents.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const gate = await requireEnterpriseUser(session.user.id);
  if (gate) return gate;

  const documents = await prisma.document.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      filename: true,
      sizeBytes: true,
      status: true,
      errorMessage: true,
      pageCount: true,
      chunkCount: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ documents });
}

/**
 * POST /api/knowledge/documents — multipart upload, store blob, create
 * Document row, kick off background processing, return 202.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const gate = await requireEnterpriseUser(session.user.id);
  if (gate) return gate;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "invalid_request", message: "Expected multipart/form-data" },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "invalid_request", message: "Missing file field" },
      { status: 400 }
    );
  }

  const validationError = validateUpload({ type: file.type, size: file.size });
  if (validationError) {
    return NextResponse.json(
      { error: "invalid_file", message: validationError },
      { status: 400 }
    );
  }

  let blob;
  try {
    blob = await uploadDocumentBlob(session.user.id, file.name, file);
  } catch (err) {
    console.error("[Documents] Blob upload failed:", err);
    return NextResponse.json(
      { error: "upload_failed", message: "Failed to store file" },
      { status: 500 }
    );
  }

  const document = await prisma.document.create({
    data: {
      userId: session.user.id,
      filename: file.name,
      blobUrl: blob.blobUrl,
      blobPathname: blob.pathname,
      sizeBytes: file.size,
      mimeType: file.type,
      status: "PROCESSING",
    },
    select: {
      id: true,
      filename: true,
      sizeBytes: true,
      status: true,
      createdAt: true,
    },
  });

  // Kick off async pipeline; do not block the response.
  after(async () => {
    try {
      await processDocument(document.id);
    } catch (err) {
      console.error("[Documents] Background processing crashed:", err);
    }
  });

  return NextResponse.json({ document }, { status: 202 });
}
