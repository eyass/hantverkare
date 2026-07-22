// Pure date-math for stalled-quote follow-up nudges (issue #158). A quote is
// "stalled" once it has been sent (status = 'final') but the customer has
// neither signed nor declined it after FOLLOWUP_THRESHOLD_DAYS have passed
// since it was finalized. Mirrors lib/quotes/expiry.ts's shape/conventions so
// it can be unit tested directly (see followup.test.ts) and reused
// identically by the /quotes list UI and the follow-up server actions.
//
// This deliberately does NOT track "already nudged" state (no new column):
// the follow-up send is a manual, tradesperson-initiated action rather than
// an automated cron, so there is no spam risk from a missing dedupe flag --
// the worst case is the tradesperson can send another nudge if they want to.

export const FOLLOWUP_THRESHOLD_DAYS = 5;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Whole days elapsed since `finalizedAt`, relative to `now`. */
export function daysSinceFinalized(finalizedAt: Date, now: Date = new Date()): number {
  return Math.floor((now.getTime() - finalizedAt.getTime()) / MS_PER_DAY);
}

export type StalledQuoteInput = {
  status: string;
  declinedAt: string | Date | null | undefined;
  signedAt?: string | Date | null | undefined;
  finalizedAt: string | Date | null | undefined;
};

/**
 * True when a quote is "final" (sent, per lib/quotes/status.ts's display
 * status model), still neither signed nor declined, and has been sitting
 * that way for at least FOLLOWUP_THRESHOLD_DAYS.
 */
export function isStalledQuote(
  input: StalledQuoteInput,
  now: Date = new Date(),
  thresholdDays: number = FOLLOWUP_THRESHOLD_DAYS,
): boolean {
  if (input.status !== "final") {
    return false;
  }
  if (input.declinedAt || input.signedAt) {
    return false;
  }
  if (!input.finalizedAt) {
    return false;
  }
  const finalizedAt = input.finalizedAt instanceof Date ? input.finalizedAt : new Date(input.finalizedAt);
  return daysSinceFinalized(finalizedAt, now) >= thresholdDays;
}
