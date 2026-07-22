// Pure date math for the automated review-request follow-up (issue #157).
// Kept free of any Supabase/env dependency, mirroring lib/invoices/dunning.ts,
// so it can be unit tested directly and reused identically by the
// review-request cron (app/api/cron/review-requests/route.ts).

/** Whole days elapsed since `paidAt`. Negative/zero if not yet reached. */
export function daysSincePaid(paidAt: Date, now: Date = new Date()): number {
  return Math.floor((now.getTime() - paidAt.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * Decides whether the one-time review-request email is due for a paid
 * invoice. Unlike dunning's three sequential stages, this is a single send:
 * true once `daysSincePaid(paidAt) >= reviewRequestDays` and it hasn't
 * already been sent (reviewRequestSentAt is null). Never re-fires once sent.
 */
export function isReviewRequestDue(
  daysElapsed: number,
  reviewRequestDays: number,
  reviewRequestSentAt: Date | null,
): boolean {
  if (reviewRequestSentAt !== null) return false;
  return daysElapsed >= reviewRequestDays;
}
