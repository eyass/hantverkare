export type MatchablePriceListItem = {
  id: string;
  label: string;
  unit: string;
  unit_price_cents: number;
};

export type MatchableLineItem = {
  description: string;
  unit: string;
  unitPriceCents: number;
};

/**
 * Best-effort match of a freshly-generated quote line item back to the price
 * list item it was (probably) priced from.
 *
 * Quote line items are produced either by the AI (which is only instructed to
 * draw quantities/prices from the price list, and writes its own free-text
 * description -- see lib/quotes/generateLineItems.ts) or copied from a saved
 * quote template (which also doesn't keep a price list reference -- see
 * lib/quoteTemplates/templateBuilder.ts). Neither path guarantees an exact
 * label match, so this is intentionally conservative: it only returns a match
 * when it can do so with reasonable confidence, and returns null (never a
 * guess) otherwise. A null result is expected and fine -- it just means this
 * line item won't participate in stock decrement/restock.
 *
 * Confidence rule: unit + unit_price_cents must match exactly (both are
 * copied verbatim by the AI when it uses a price list entry). If more than
 * one price list item shares that same (unit, price) pair, we only resolve
 * the ambiguity when exactly one of them also has a case-insensitive exact
 * label match -- otherwise we bail out rather than risk decrementing the
 * wrong material.
 */
export function matchPriceListItemId(
  lineItem: MatchableLineItem,
  priceList: MatchablePriceListItem[],
): string | null {
  const candidates = priceList.filter(
    (p) => p.unit === lineItem.unit && p.unit_price_cents === lineItem.unitPriceCents,
  );

  if (candidates.length === 1) {
    return candidates[0].id;
  }

  if (candidates.length > 1) {
    const normalizedDescription = lineItem.description.trim().toLowerCase();
    const exactLabelMatches = candidates.filter(
      (p) => p.label.trim().toLowerCase() === normalizedDescription,
    );
    if (exactLabelMatches.length === 1) {
      return exactLabelMatches[0].id;
    }
  }

  return null;
}
