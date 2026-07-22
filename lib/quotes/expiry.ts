// Pure date-math for quote expiry (issue #49). Kept free of any Supabase/env
// dependency so it can be unit tested directly -- see expiry.test.ts -- and
// reused identically by the finalize action, the cron route, and the quotes
// list UI badge.

export const DEFAULT_EXPIRY_DAYS = 14;
export const REMINDER_WINDOW_DAYS = 3;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Computes the expiry timestamp for a quote finalized at `from` (defaults to now). */
export function computeExpiryDate(from: Date = new Date(), days: number = DEFAULT_EXPIRY_DAYS): Date {
  return new Date(from.getTime() + days * MS_PER_DAY);
}

/**
 * Whole days remaining until `expiresAt`, relative to `now`. Rounds up so
 * "23 hours left" still reads as "1 day left" rather than "0 days left".
 * Negative once expired.
 */
export function daysUntilExpiry(expiresAt: Date, now: Date = new Date()): number {
  return Math.ceil((expiresAt.getTime() - now.getTime()) / MS_PER_DAY);
}

/** A quote is expired once its expiry timestamp is in the past. */
export function isExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}

/**
 * True when a quote is within the "send a reminder" window: not yet expired,
 * but due to expire within REMINDER_WINDOW_DAYS. Used both by the cron
 * query's date bounds and (redundantly, defensively) as an in-process check.
 */
export function isInReminderWindow(
  expiresAt: Date,
  now: Date = new Date(),
  windowDays: number = REMINDER_WINDOW_DAYS,
): boolean {
  if (isExpired(expiresAt, now)) {
    return false;
  }
  const windowEnd = new Date(now.getTime() + windowDays * MS_PER_DAY);
  return expiresAt.getTime() <= windowEnd.getTime();
}

export type ExpiryBadge = {
  label: string;
  tone: "neutral" | "warning" | "expired";
};

/**
 * German-language badge copy for the quotes list (finalized-but-unsigned
 * quotes only -- callers should only invoke this for status === 'final').
 */
export function formatExpiryBadge(expiresAt: Date, now: Date = new Date()): ExpiryBadge {
  if (isExpired(expiresAt, now)) {
    return { label: "Abgelaufen", tone: "expired" };
  }
  // Whole days elapsed so far (floor, not ceil) decides "heute" vs "morgen" --
  // these read as calendar-relative, so "30 minutes from now" should say
  // "heute", not round up to "morgen" the way daysUntilExpiry's ceil does.
  const wholeDaysRemaining = Math.floor((expiresAt.getTime() - now.getTime()) / MS_PER_DAY);
  if (wholeDaysRemaining === 0) {
    return { label: "Läuft heute ab", tone: "warning" };
  }
  if (wholeDaysRemaining === 1) {
    return { label: "Läuft morgen ab", tone: "warning" };
  }
  const days = daysUntilExpiry(expiresAt, now);
  const tone = days <= REMINDER_WINDOW_DAYS ? "warning" : "neutral";
  return { label: `Läuft in ${days} Tagen ab`, tone };
}
