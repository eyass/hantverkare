/**
 * Pure co-occurrence logic for "commonly paired" price-list item suggestions
 * (issue #159). Given the org's own historical quote line items (grouped by
 * quote) and the price-list item ids already on the quote being built, this
 * computes which OTHER price-list items most often show up alongside them
 * across past quotes.
 *
 * Deliberately NOT a static per-trade mapping: guessing which items "usually"
 * go together for an arbitrary trade would be fabricating business specifics
 * no agent should assume. Instead this only ever reflects what the org itself
 * has actually quoted before.
 *
 * Deliberately silent (returns []) when there isn't enough history to compute
 * anything meaningful -- surfacing a suggestion built from 1-2 past quotes
 * would be noise dressed up as insight, not a real signal.
 */

/** Minimum number of historical quotes (with at least one priced line item)
 * required before suggestions are computed at all. Below this, co-occurrence
 * counts are too small to mean anything. */
export const MIN_QUOTES_FOR_SUGGESTIONS = 5;

/** A quote's price-list item ids are deduplicated per quote before counting,
 * so a quote with the same item listed twice doesn't inflate its pairing
 * strength with other items. */
export type HistoricalQuote = {
  quoteId: string;
  priceListItemIds: string[];
};

export type PriceListItemInfo = {
  id: string;
  label: string;
  unit: string;
  unitPriceCents: number;
};

export type UpsellSuggestion = {
  priceListItemId: string;
  label: string;
  unit: string;
  unitPriceCents: number;
  /** Number of past quotes that contained this item alongside at least one
   * of the current quote's items. */
  coOccurrenceCount: number;
};

/**
 * Computes up to `limit` suggested price-list items to add to the quote
 * currently being built, ranked by how often they co-occurred (across the
 * org's past quotes) with items already on this quote.
 *
 * - Returns [] if fewer than MIN_QUOTES_FOR_SUGGESTIONS historical quotes have
 *   any priced (price-list-linked) line items -- not enough signal.
 * - Returns [] if the current quote has no price-list-linked items yet -- there
 *   is nothing to pair against (a free-text/AI-only line item with no
 *   price_list_item_id match can't anchor a co-occurrence lookup).
 * - Never suggests an item already on the current quote.
 */
export function computeUpsellSuggestions(
  historicalQuotes: HistoricalQuote[],
  currentPriceListItemIds: string[],
  priceListItems: PriceListItemInfo[],
  limit = 3,
): UpsellSuggestion[] {
  const quotesWithItems = historicalQuotes.filter((q) => q.priceListItemIds.length > 0);
  if (quotesWithItems.length < MIN_QUOTES_FOR_SUGGESTIONS) {
    return [];
  }

  const currentIds = new Set(currentPriceListItemIds);
  if (currentIds.size === 0) {
    return [];
  }

  const priceListById = new Map(priceListItems.map((p) => [p.id, p]));

  const coOccurrenceCounts = new Map<string, number>();
  for (const quote of quotesWithItems) {
    const itemsOnQuote = new Set(quote.priceListItemIds);
    const hasOverlap = [...currentIds].some((id) => itemsOnQuote.has(id));
    if (!hasOverlap) continue;

    for (const itemId of itemsOnQuote) {
      if (currentIds.has(itemId)) continue; // never suggest what's already added
      if (!priceListById.has(itemId)) continue; // item may have since been deleted
      coOccurrenceCounts.set(itemId, (coOccurrenceCounts.get(itemId) ?? 0) + 1);
    }
  }

  return [...coOccurrenceCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([priceListItemId, coOccurrenceCount]) => {
      const info = priceListById.get(priceListItemId)!;
      return {
        priceListItemId,
        label: info.label,
        unit: info.unit,
        unitPriceCents: info.unitPriceCents,
        coOccurrenceCount,
      };
    });
}
