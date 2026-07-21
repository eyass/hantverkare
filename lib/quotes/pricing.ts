import type { LineItem, PricedLineItem, QuoteTotals } from "./types";

const VAT_RATE = 0.19;

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
