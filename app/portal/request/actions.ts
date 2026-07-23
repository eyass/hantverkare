"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { generatePortalToken, hashPortalToken, PORTAL_TOKEN_TTL_MS } from "@/lib/portal/token";
import { sendPortalMagicLinkEmail } from "@/lib/notifications/sendPortalMagicLinkEmail";

// Generic message shown regardless of whether the email matched a customer
// record, to avoid enumeration (confirming/denying which emails are on file
// as a real customer). Always returned -- there is no error branch for "no
// match found".
const GENERIC_RESULT_MESSAGE =
  "Wenn diese E-Mail-Adresse bei uns hinterlegt ist, haben wir Ihnen soeben einen Zugangslink gesendet.";

// Simple in-memory best-effort rate limit: at most a handful of requests per
// email per window, per server instance. This is intentionally lightweight
// (no new table/Redis dependency) -- it only needs to blunt naive scripted
// abuse of the request form, not withstand a determined attacker; the real
// anti-enumeration protection is the generic response message above, which
// holds regardless of this limiter's state.
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX_REQUESTS = 3;
const requestTimestampsByEmail = new Map<string, number[]>();

function isRateLimited(normalizedEmail: string): boolean {
  const now = Date.now();
  const recent = (requestTimestampsByEmail.get(normalizedEmail) ?? []).filter(
    (ts) => now - ts < RATE_LIMIT_WINDOW_MS,
  );
  recent.push(now);
  requestTimestampsByEmail.set(normalizedEmail, recent);
  return recent.length > RATE_LIMIT_MAX_REQUESTS;
}

export async function requestPortalAccess(email: string): Promise<{ message: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    // Even basic input validation returns the same generic message -- an
    // attacker learning "that wasn't a validly-formed email" isn't a real
    // information leak, but keeping one exit path is simplest and safest.
    return { message: GENERIC_RESULT_MESSAGE };
  }

  if (isRateLimited(normalizedEmail)) {
    return { message: GENERIC_RESULT_MESSAGE };
  }

  const supabase = createAdminClient();

  // Case-insensitive match against every customer record with this email,
  // across every organization -- a customer's email can plausibly appear as
  // a customer of more than one tradesperson, and each such match should get
  // its own portal link scoped to that specific (customer_id,
  // organization_id) pair.
  const { data: customers, error } = await supabase
    .from("customers")
    .select("id, organization_id, email")
    .ilike("email", normalizedEmail);

  if (error) {
    console.error("Failed to look up customers for portal access request", error);
    return { message: GENERIC_RESULT_MESSAGE };
  }

  if (customers && customers.length > 0) {
    let siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    try {
      const headerList = await headers();
      const host = headerList.get("host");
      if (host && !process.env.NEXT_PUBLIC_SITE_URL) {
        const proto = headerList.get("x-forwarded-proto") ?? "https";
        siteUrl = `${proto}://${host}`;
      }
    } catch {
      // Best effort only -- fall back to the env default above.
    }

    for (const customer of customers) {
      const rawToken = generatePortalToken();
      const tokenHash = hashPortalToken(rawToken);
      const expiresAt = new Date(Date.now() + PORTAL_TOKEN_TTL_MS).toISOString();

      const { error: insertError } = await supabase.from("customer_portal_tokens").insert({
        customer_id: customer.id,
        organization_id: customer.organization_id,
        token_hash: tokenHash,
        expires_at: expiresAt,
      });

      if (insertError) {
        console.error("Failed to create portal token", insertError);
        continue;
      }

      const portalUrl = `${siteUrl}/portal/${rawToken}`;
      // Best-effort, never throws -- see sendPortalMagicLinkEmail.
      await sendPortalMagicLinkEmail({ toEmail: normalizedEmail, portalUrl });
    }
  }

  // Same message whether or not any customer matched -- see
  // GENERIC_RESULT_MESSAGE above.
  return { message: GENERIC_RESULT_MESSAGE };
}
