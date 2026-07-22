// Pure logic for deriving a quote's customer-facing display status from its
// raw lifecycle column (`status`) plus the orthogonal `declined_at` /
// `signed_at` flags added by 0006_esignature.sql and 0017_quote_decline.sql.
// Kept free of any Supabase/env dependency so it can be unit tested directly
// -- see status.test.ts -- and reused identically by the public /q/[token]
// page, the tradesperson-facing quote list, and QuoteEditor.
//
// declined_at and signed_at are mutually exclusive in practice (enforced at
// the application layer: both the sign and decline actions require
// status = 'final' AND declined_at is null before acting), but this helper
// still defends against the theoretical case where both are set by treating
// "declined" as authoritative -- a customer's explicit decline should never
// be silently overridden by a stale/racy signed_at.

export type QuoteDisplayStatus = "draft" | "final" | "signed" | "declined";

export function computeQuoteDisplayStatus(input: {
  status: string;
  declinedAt: string | Date | null | undefined;
  signedAt?: string | Date | null | undefined;
}): QuoteDisplayStatus {
  if (input.declinedAt) {
    return "declined";
  }
  if (input.status === "signed" || input.signedAt) {
    return "signed";
  }
  if (input.status === "final") {
    return "final";
  }
  return "draft";
}
