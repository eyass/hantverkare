import type { LineItem, PricedLineItem, QuoteTotals } from "./types";

// Exported so callers that need to freeze a total from raw line totals
// without going through computeTotals' full recompute (e.g. the contract-
// renewal cron duplicating a signed quote's amounts, app/api/cron/contract-renewal/route.ts)
// can use the same rate instead of hardcoding a second copy of it.
export const VAT_RATE = 0.19;

export function priceLineItem(item: LineItem): PricedLineItem {
  return {
    ...item,
    lineTotalCents: Math.round(item.quantity * item.unitPriceCents),
  };
}

export function computeTotals(items: PricedLineItem[]): QuoteTotals {
  const subtotalCents = items.reduce((sum, item) => sum + item.lineTotalCents, 0);
  const vatCents = Math.round(subtotalCents * VAT_RATE);
  const totalCents = subtotalCents + vatCents;
  return { subtotalCents, vatCents, totalCents };
}

// Guard rails for bulk price adjustment (issue: bulk price adjustment) --
// -90% floors a price near zero without hitting it (a price can never go to
// or below 0, since every line item must have a positive unit price), and
// +200% is generous enough for legitimate re-pricing (e.g. doubling or
// tripling an old price list) while still catching an obvious fat-finger
// entry like "2000" meant as "20".
export const MIN_BULK_ADJUST_PERCENT = -90;
export const MAX_BULK_ADJUST_PERCENT = 200;

export function isValidBulkAdjustPercent(percent: number): boolean {
  return (
    Number.isFinite(percent) &&
    percent !== 0 &&
    percent >= MIN_BULK_ADJUST_PERCENT &&
    percent <= MAX_BULK_ADJUST_PERCENT
  );
}

/**
 * Applies a bulk percentage adjustment to a single unit price, rounding the
 * result to the nearest cent. Positive percent increases the price, negative
 * decreases it. The result is always at least 1 cent -- a bulk decrease can
 * never zero out or invert a price.
 */
export function adjustUnitPriceCents(unitPriceCents: number, percent: number): number {
  const adjusted = Math.round(unitPriceCents * (1 + percent / 100));
  return Math.max(1, adjusted);
}
