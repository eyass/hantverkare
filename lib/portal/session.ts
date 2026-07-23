// Short-lived signed browser-session cookie for the customer portal
// (issue #154), set the first time a /portal/[token] magic link is visited so
// the customer isn't forced to re-request a link on every navigation within
// the portal. This is deliberately NOT Supabase Auth -- customers aren't
// auth.users rows in this app's model (see public.customers,
// 0005_customers.sql) -- so there is no session to hand off to; instead this
// is a small self-contained HMAC-signed cookie, the same "the token/signature
// IS the access control" spirit as quotes.share_token, just carried in a
// cookie instead of a URL for the lifetime of the session.
//
// The cookie payload is `${customerId}.${organizationId}.${expiresAtMs}`,
// signed with an HMAC-SHA256 tag over a server-only secret so the browser
// can't forge or extend it. It intentionally does NOT re-embed the raw
// magic-link token: the portal token row is single-use (consumed_at is
// stamped on first validation in app/portal/[token]/page.tsx), so nothing
// about the cookie can be used to look up or replay the original email link.
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const PORTAL_SESSION_COOKIE = "portal_session";

// A customer portal browser session lasts 24h from first link visit --
// matches the magic-link expiry window itself (see
// app/portal/request/actions.ts), so nothing about "how long can a customer
// stay in without a fresh email" changes just because a cookie is involved.
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

type PortalSessionPayload = {
  customerId: string;
  organizationId: string;
};

function getSecret(): string {
  // Falls back to the Supabase service-role key so this works out of the box
  // without a brand-new required env var -- that secret is already
  // server-only (never shipped to the browser, see lib/supabase/admin.ts) and
  // rotates along with the rest of the Supabase project's secrets. A
  // dedicated PORTAL_SESSION_SECRET env var is honored first if set.
  const secret = process.env.PORTAL_SESSION_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error("Cannot sign portal session cookie: no PORTAL_SESSION_SECRET or SUPABASE_SERVICE_ROLE_KEY set");
  }
  return secret;
}

function sign(value: string): string {
  return createHmac("sha256", getSecret()).update(value).digest("hex");
}

export function buildPortalSessionCookieValue(payload: PortalSessionPayload): { value: string; expiresAt: Date } {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const raw = `${payload.customerId}.${payload.organizationId}.${expiresAt.getTime()}`;
  const signature = sign(raw);
  return { value: `${raw}.${signature}`, expiresAt };
}

export async function setPortalSessionCookie(payload: PortalSessionPayload): Promise<void> {
  const { value, expiresAt } = buildPortalSessionCookieValue(payload);
  const cookieStore = await cookies();
  cookieStore.set(PORTAL_SESSION_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/portal",
    expires: expiresAt,
  });
}

/**
 * Verifies and decodes a portal session cookie value. Returns null if the
 * cookie is missing, malformed, has a bad signature, or has expired -- any
 * of these cases means the caller must fall back to the token in the URL (or
 * ask the customer to request a fresh magic link).
 */
export function verifyPortalSessionCookieValue(cookieValue: string | undefined): PortalSessionPayload | null {
  if (!cookieValue) return null;

  const parts = cookieValue.split(".");
  if (parts.length !== 4) return null;
  const [customerId, organizationId, expiresAtMsStr, signature] = parts;

  const raw = `${customerId}.${organizationId}.${expiresAtMsStr}`;
  const expectedSignature = sign(raw);

  const sigBuf = Buffer.from(signature, "hex");
  const expectedBuf = Buffer.from(expectedSignature, "hex");
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  const expiresAtMs = Number(expiresAtMsStr);
  if (!Number.isFinite(expiresAtMs) || Date.now() > expiresAtMs) {
    return null;
  }

  return { customerId, organizationId };
}

export async function getPortalSession(): Promise<PortalSessionPayload | null> {
  const cookieStore = await cookies();
  return verifyPortalSessionCookieValue(cookieStore.get(PORTAL_SESSION_COOKIE)?.value);
}
