import type { LineItem } from "@/lib/quotes/types";

// Builds the labor line item appended to a quote's line items when the
// tradesperson opts in (checkbox on invoice creation, issue #195) to
// reconcile logged time entries into the invoice. Never automatic: this is
// only ever called from the Server Action path gated by an explicit
// user-checked checkbox (see app/(app)/quotes/[id]/actions.ts's createInvoice).
//
// unitPriceCents is deliberately 0 -- this repo has no concept of an hourly
// billing rate yet (out of scope per the design spec), so the line item
// exists to make the logged hours visible/auditable on the invoice; the
// tradesperson is expected to adjust the price manually if they want the
// hours to add revenue. A follow-up issue can add a configurable rate.

export type TimeEntryForBilling = { hours: number };

/** Sums hours across a job's time entries. Returns 0 for an empty list. */
export function sumHours(entries: TimeEntryForBilling[]): number {
  const total = entries.reduce((sum, entry) => sum + entry.hours, 0);
  // Guard against floating point noise (e.g. 0.1 + 0.2), keep 2 decimal places
  // to match the numeric(5,2) column these hours are read from.
  return Math.round(total * 100) / 100;
}

export function formatHoursLabel(totalHours: number): string {
  return totalHours.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Builds the "Arbeitszeit: X Std." labor line item for a given total hours
 * figure. Returns null when there are no hours to bill (checkbox should be
 * disabled/hidden in that case, but this is a defensive backstop).
 */
export function buildLaborLineItem(totalHours: number): LineItem | null {
  if (!Number.isFinite(totalHours) || totalHours <= 0) {
    return null;
  }
  return {
    description: `Arbeitszeit: ${formatHoursLabel(totalHours)} Std.`,
    quantity: totalHours,
    unit: "Std.",
    unitPriceCents: 0,
  };
}
