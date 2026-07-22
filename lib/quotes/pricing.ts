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
