// Shared token helpers for the customer portal magic-link flow (issue #154).
// Kept separate from lib/portal/session.ts (the browser-session cookie)
// because these two secrets serve different purposes and must never be
// derived from one another: this hashes the one-time emailed link token
// that gets stored (hashed) in public.customer_portal_tokens, matched
// against on /portal/[token] visits.
import { randomBytes, createHash } from "crypto";

export const PORTAL_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h, per issue #154

/** Generates a new raw, URL-safe magic-link token (32 bytes of entropy). */
export function generatePortalToken(): string {
  return randomBytes(32).toString("hex");
}

/** sha256 hash of a raw token, hex-encoded -- this is what's stored at rest. */
export function hashPortalToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}
