import { describe, it, expect } from "vitest";
import { validatePhotoFile, buildPhotoStoragePath, MAX_PHOTO_BYTES } from "./photoValidation";

describe("validatePhotoFile", () => {
  it("accepts a normal jpeg", () => {
    expect(validatePhotoFile({ type: "image/jpeg", size: 1024 })).toEqual({ ok: true });
  });

  it("accepts png, webp, heic, heif", () => {
    for (const type of ["image/png", "image/webp", "image/heic", "image/heif"]) {
      expect(validatePhotoFile({ type, size: 1024 })).toEqual({ ok: true });
    }
  });

  it("rejects an unsupported mime type", () => {
    const result = validatePhotoFile({ type: "application/pdf", size: 1024 });
    expect(result.ok).toBe(false);
  });

  it("rejects an empty file", () => {
    const result = validatePhotoFile({ type: "image/jpeg", size: 0 });
    expect(result.ok).toBe(false);
  });

  it("rejects a file over the 10 MB limit", () => {
    const result = validatePhotoFile({ type: "image/jpeg", size: MAX_PHOTO_BYTES + 1 });
    expect(result.ok).toBe(false);
  });

  it("accepts a file exactly at the limit", () => {
    expect(validatePhotoFile({ type: "image/jpeg", size: MAX_PHOTO_BYTES })).toEqual({ ok: true });
  });
});

describe("buildPhotoStoragePath", () => {
  it("prefixes the path with organization_id then quote_id", () => {
    const path = buildPhotoStoragePath(
      "org-1",
      "quote-1",
      "vorher.jpg",
      new Date("2026-01-01T00:00:00Z"),
      "abc123",
    );
    expect(path).toBe("org-1/quote-1/1767225600000-abc123-vorher.jpg");
  });

  it("sanitizes unsafe characters in the filename", () => {
    const path = buildPhotoStoragePath(
      "org-1",
      "quote-1",
      "foto mit ä ü ö/../../evil.jpg",
      new Date("2026-01-01T00:00:00Z"),
      "abc123",
    );
    expect(path).not.toContain("/../");
    expect(path).not.toContain(" ");
    expect(path.startsWith("org-1/quote-1/1767225600000-abc123-")).toBe(true);
  });

  it("falls back to a default name when sanitization empties the filename", () => {
    const path = buildPhotoStoragePath("org-1", "quote-1", "üöä", new Date("2026-01-01T00:00:00Z"), "abc123");
    expect(path).toBe("org-1/quote-1/1767225600000-abc123-foto");
  });
});
