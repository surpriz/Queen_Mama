"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GlassCard } from "@/components/ui";

interface DocumentRow {
  id: string;
  filename: string;
  sizeBytes: number;
  status: "UPLOADING" | "PROCESSING" | "READY" | "FAILED";
  errorMessage: string | null;
  pageCount: number | null;
  chunkCount: number | null;
  createdAt: string;
  updatedAt: string;
}

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const POLL_INTERVAL_MS = 3000;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusLabel(status: DocumentRow["status"]): string {
  switch (status) {
    case "UPLOADING":
      return "Uploading…";
    case "PROCESSING":
      return "Processing…";
    case "READY":
      return "Ready";
    case "FAILED":
      return "Failed";
  }
}

function statusColor(status: DocumentRow["status"]): string {
  switch (status) {
    case "READY":
      return "bg-green-500/20 text-green-400";
    case "FAILED":
      return "bg-red-500/20 text-red-400";
    case "UPLOADING":
    case "PROCESSING":
      return "bg-blue-500/20 text-blue-400";
  }
}

export function DocumentsPanel() {
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch("/api/knowledge/documents", { cache: "no-store" });
      if (!res.ok) return;
      const data: { documents: DocumentRow[] } = await res.json();
      setDocuments(data.documents);
    } catch (err) {
      console.error("Failed to fetch documents", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const hasPending = useMemo(
    () => documents.some((d) => d.status === "UPLOADING" || d.status === "PROCESSING"),
    [documents]
  );

  useEffect(() => {
    if (!hasPending) return;
    const id = setInterval(fetchDocuments, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [hasPending, fetchDocuments]);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];

      setUploadError(null);

      if (file.type !== "application/pdf") {
        setUploadError("Only PDF files are supported.");
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        setUploadError("File too large (max 50 MB).");
        return;
      }

      const formData = new FormData();
      formData.append("file", file);

      setUploading(true);
      try {
        const res = await fetch("/api/knowledge/documents", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setUploadError(body.message || "Upload failed");
          return;
        }
        await fetchDocuments();
      } catch (err) {
        console.error(err);
        setUploadError("Upload failed");
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [fetchDocuments]
  );

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this document? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/knowledge/documents/${id}`, { method: "DELETE" });
      if (res.ok) {
        setDocuments((prev) => prev.filter((d) => d.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <GlassCard padding="md">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-medium text-white">Reference Documents</h2>
          <p className="text-sm text-[var(--qm-text-secondary)] mt-1">
            Upload PDFs (catalogs, datasheets, technical specs) so Queen Mama can ground its
            answers in your source material during sessions.
          </p>
        </div>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
          dragOver
            ? "border-[var(--qm-accent)] bg-[var(--qm-accent)]/10"
            : "border-white/10 hover:border-white/20"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={uploading}
        />
        <p className="text-white text-sm mb-2">
          Drop a PDF here, or{" "}
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="text-[var(--qm-accent)] underline hover:no-underline disabled:opacity-50"
          >
            choose a file
          </button>
        </p>
        <p className="text-xs text-[var(--qm-text-tertiary)]">PDF · up to 50 MB</p>
        {uploading && (
          <p className="text-xs text-blue-400 mt-2">Uploading…</p>
        )}
        {uploadError && (
          <p className="text-xs text-red-400 mt-2">{uploadError}</p>
        )}
      </div>

      <div className="mt-6 space-y-2">
        {loading ? (
          <p className="text-sm text-[var(--qm-text-tertiary)]">Loading documents…</p>
        ) : documents.length === 0 ? (
          <p className="text-sm text-[var(--qm-text-tertiary)]">
            No documents yet. Upload your first PDF to get started.
          </p>
        ) : (
          documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between gap-4 rounded-lg bg-white/5 px-4 py-3 hover:bg-white/10 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="text-white truncate" title={doc.filename}>
                  {doc.filename}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[var(--qm-text-tertiary)]">
                  <span className={`px-2 py-0.5 rounded-full ${statusColor(doc.status)}`}>
                    {statusLabel(doc.status)}
                  </span>
                  <span>{formatBytes(doc.sizeBytes)}</span>
                  {doc.pageCount !== null && <span>{doc.pageCount} pages</span>}
                  {doc.chunkCount !== null && <span>{doc.chunkCount} chunks</span>}
                </div>
                {doc.status === "FAILED" && doc.errorMessage && (
                  <p className="mt-1 text-xs text-red-400">{doc.errorMessage}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleDelete(doc.id)}
                className="text-sm text-[var(--qm-text-secondary)] hover:text-red-400 transition-colors"
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>
    </GlassCard>
  );
}
