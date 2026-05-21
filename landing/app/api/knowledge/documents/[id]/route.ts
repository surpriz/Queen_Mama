import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteDocumentBlob } from "@/lib/document-blob";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/knowledge/documents/[id] — detail for status polling.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const document = await prisma.document.findFirst({
    where: { id, userId: session.user.id },
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

  if (!document) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ document });
}

/**
 * DELETE /api/knowledge/documents/[id] — remove blob, chunks (cascade), row.
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const document = await prisma.document.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, blobPathname: true },
  });

  if (!document) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await deleteDocumentBlob(document.blobPathname);
  await prisma.document.delete({ where: { id: document.id } });

  return NextResponse.json({ success: true, deleted: document.id });
}
