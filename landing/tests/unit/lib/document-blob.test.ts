// @vitest-environment node
import { describe, it, expect } from "vitest";
import { validateUpload } from "@/lib/document-blob";

describe("document-blob.validateUpload", () => {
  it("accepts a normal-sized PDF", () => {
    expect(validateUpload({ type: "application/pdf", size: 1024 * 1024 })).toBeNull();
  });

  it("rejects non-PDF mime types", () => {
    expect(validateUpload({ type: "image/png", size: 1024 })).toMatch(/Unsupported/);
    expect(validateUpload({ type: "application/msword", size: 1024 })).toMatch(/Unsupported/);
  });

  it("rejects files above 50 MB", () => {
    const over = 50 * 1024 * 1024 + 1;
    expect(validateUpload({ type: "application/pdf", size: over })).toMatch(/too large/);
  });

  it("rejects empty files", () => {
    expect(validateUpload({ type: "application/pdf", size: 0 })).toMatch(/Empty/);
  });

  it("accepts exactly 50 MB", () => {
    expect(validateUpload({ type: "application/pdf", size: 50 * 1024 * 1024 })).toBeNull();
  });
});
