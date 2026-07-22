// Pure validation + path-building logic for job-site photo attachments
// (issue #72). Kept free of any Supabase/env dependency so it can be unit
// tested directly -- see photoValidation.test.ts -- and shared between the
// client upload flow and any future voice-capture upload entry point.

// Storage bucket name for job-site photos. Lives here (not in actions.ts)
// because a "use server" file may only export async functions -- a plain
// const export there breaks Next.js's server-action module boundary.
export const QUOTE_PHOTOS_BUCKET = "quote-photos";

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export type PhotoValidationResult = { ok: true } | { ok: false; error: string };

/**
 * Validates a file's MIME type and size before it is uploaded to Storage.
 * This is a client-side UX check only -- it is NOT a security boundary (a
 * malicious client can send any bytes/headers it likes), so it deliberately
 * does not replace server-side or Storage-level checks. Its purpose is to
 * give the tradesperson immediate, German-language feedback instead of a
 * failed network request.
 */
export function validatePhotoFile(file: { type: string; size: number }): PhotoValidationResult {
  if (!ALLOWED_PHOTO_TYPES.includes(file.type as (typeof ALLOWED_PHOTO_TYPES)[number])) {
    return { ok: false, error: "Nur Fotos im Format JPEG, PNG, WEBP oder HEIC sind erlaubt." };
  }
  if (file.size <= 0) {
    return { ok: false, error: "Die Datei ist leer." };
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return { ok: false, error: "Das Foto darf maximal 10 MB groß sein." };
  }
  return { ok: true };
}

/** Strips anything that isn't a safe filename character, collapsing the rest to "_". */
function sanitizeFilename(name: string): string {
  const trimmed = name.trim().slice(-120); // keep it bounded; extension survives from the tail
  // Drop (rather than replace) anything outside a safe ASCII allowlist, so
  // accented characters, path separators, and traversal sequences ("../")
  // all disappear instead of turning into "_" placeholders that would still
  // pile up in the path.
  const cleaned = trimmed.replace(/[^a-zA-Z0-9._-]/g, "");
  return cleaned.length > 0 ? cleaned : "foto";
}

/**
 * Builds the storage object path for an uploaded photo. The path is always
 * `{organization_id}/{quote_id}/{timestamp}-{random}-{filename}` -- the
 * leading organization_id segment is what the storage.objects RLS policies
 * check against `is_org_member`, so it must always come from the
 * server-resolved organization (getCurrentOrg), never from client input, and
 * the quote_id must be the quote the photo is actually attached to. A
 * timestamp + random suffix avoids collisions between two uploads of a file
 * with the same original name.
 */
export function buildPhotoStoragePath(
  organizationId: string,
  quoteId: string,
  originalFilename: string,
  now: Date = new Date(),
  random: string = Math.random().toString(36).slice(2, 8),
): string {
  const safeName = sanitizeFilename(originalFilename);
  return `${organizationId}/${quoteId}/${now.getTime()}-${random}-${safeName}`;
}
