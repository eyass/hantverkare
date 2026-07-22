// Pure date/money math for automated Mahnwesen (issue #122). Kept free of any
// Supabase/env dependency so it can be unit tested directly -- see
// dunning.test.ts -- and reused identically by the dunning cron
// (app/api/cron/invoice-dunning/route.ts) and, eventually, any invoice-detail
// UI that wants to preview "what would the next reminder say".

export const DEFAULT_DUE_DAYS = 14;

export type DunningStage = "reminder" | "mahnung" | "escalation";

export type DunningThresholds = {
  reminderDays: number;
  mahnungDays: number;
  escalationDays: number;
};

/** Whole days elapsed since `dueDate`. Negative/zero while not yet overdue. */
export function daysOverdue(dueDate: Date, now: Date = new Date()): number {
  return Math.floor((now.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000));
}

export type StageSentStamps = {
  paymentReminderSentAt: Date | null;
  mahnungSentAt: Date | null;
  escalationSentAt: Date | null;
};

/**
 * Decides the single next dunning stage due to be sent for an invoice, or
 * null if nothing is due yet (or every stage has already been sent).
 *
 * Stages are strictly sequential and each fires at most once: escalation is
 * only ever considered once mahnung has already gone out, matching the
 * "friendly reminder -> formal Mahnung -> escalation" sequence from the
 * issue. This mirrors quotes' single expiry_reminder_sent_at gate, just with
 * three ordered stages instead of one.
 */
export function nextDunningStage(
  overdueDays: number,
  thresholds: DunningThresholds,
  stamps: StageSentStamps,
): DunningStage | null {
  if (
    overdueDays >= thresholds.escalationDays &&
    stamps.mahnungSentAt !== null &&
    stamps.escalationSentAt === null
  ) {
    return "escalation";
  }
  if (overdueDays >= thresholds.mahnungDays && stamps.mahnungSentAt === null) {
    return "mahnung";
  }
  if (overdueDays >= thresholds.reminderDays && stamps.paymentReminderSentAt === null) {
    return "reminder";
  }
  return null;
}

// Statutory default interest rate for consumer (B2C) debts under German law:
// Basiszinssatz (base rate published semi-annually by the Bundesbank, SS 247
// BGB) plus a fixed 5 percentage points (SS 288 (1) BGB). The Basiszinssatz
// itself is NOT a compile-time constant in reality -- it changes twice a
// year -- so this value is a snapshot that must be updated by hand when the
// Bundesbank publishes a new rate (see
// https://www.bundesbank.de/de/aufgaben/geldpolitik/zinssaetze/basiszinssatz).
// Tracked here rather than per-organization config since it's a law, not a
// business choice.
export const BASISZINSSATZ = 0.0337; // snapshot as of 2026-07; update twice yearly
export const VERZUGSZINS_AUFSCHLAG_B2C = 0.05; // SS 288 (1) BGB, consumer debts
export const STATUTORY_DEFAULT_INTEREST_RATE = BASISZINSSATZ + VERZUGSZINS_AUFSCHLAG_B2C;

/**
 * Verzugszinsen (statutory default interest) accrued so far, in cents,
 * using simple daily interest: principal * annualRate * days / 365. Rounded
 * to the nearest cent. Returns 0 for non-positive inputs (not yet overdue,
 * or a zero/negative invoice total) rather than a negative or NaN amount.
 */
export function calculateVerzugszinsenCents(
  totalCents: number,
  overdueDays: number,
  annualRate: number = STATUTORY_DEFAULT_INTEREST_RATE,
): number {
  if (totalCents <= 0 || overdueDays <= 0) return 0;
  return Math.round((totalCents * annualRate * overdueDays) / 365);
}
