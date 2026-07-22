import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeCostEstimationSuggestion,
  type CostEstimationSuggestion,
  type HistoricalCostDataPoint,
} from "./costEstimation";

export type LineItemForSuggestion = {
  id: string;
  price_list_item_id: string | null;
  unit_price_cents: number;
};

/**
 * Looks up the org's historical (quoted vs. actual-cost) line items for each
 * price-list item referenced by the given quote's line items, and computes a
 * per-line-item suggestion where there's enough history (see
 * MIN_HISTORICAL_DATA_POINTS in ./costEstimation).
 *
 * Read-only: this never writes anything and never touches the price list.
 * Scoped to the org (never trusts a client-supplied org id — call with the
 * value from getCurrentOrg()) and excludes the quote currently being edited
 * so a quote can't "learn" from its own not-yet-finished line items.
 *
 * Returns a map keyed by the CURRENT quote's line item id (not the
 * price_list_item_id) so callers can look suggestions up directly while
 * rendering line items. Line items with no price_list_item_id, or without
 * enough matching history, are simply absent from the result.
 */
export async function getCostEstimationSuggestions(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    quoteId: string;
    lineItems: LineItemForSuggestion[];
  },
): Promise<Record<string, CostEstimationSuggestion>> {
  const priceListItemIds = Array.from(
    new Set(
      params.lineItems
        .map((item) => item.price_list_item_id)
        .filter((id): id is string => id !== null),
    ),
  );
  if (priceListItemIds.length === 0) return {};

  const { data: historyRows, error } = await supabase
    .from("quote_line_items")
    .select("price_list_item_id, quantity, unit_price_cents, cost_cents")
    .eq("organization_id", params.organizationId)
    .in("price_list_item_id", priceListItemIds)
    .not("cost_cents", "is", null)
    .neq("quote_id", params.quoteId);

  if (error) {
    // Suggestions are a soft, non-critical affordance -- never break the
    // quote page over this. Log and just show nothing.
    console.error("Failed to load historical cost data for suggestions:", error);
    return {};
  }

  const historyByPriceListItem = new Map<string, HistoricalCostDataPoint[]>();
  for (const row of historyRows ?? []) {
    if (row.price_list_item_id === null || row.cost_cents === null) continue;
    const points = historyByPriceListItem.get(row.price_list_item_id) ?? [];
    points.push({
      quantity: row.quantity,
      unitPriceCents: row.unit_price_cents,
      costCents: row.cost_cents,
    });
    historyByPriceListItem.set(row.price_list_item_id, points);
  }

  const suggestions: Record<string, CostEstimationSuggestion> = {};
  for (const item of params.lineItems) {
    if (item.price_list_item_id === null) continue;
    const history = historyByPriceListItem.get(item.price_list_item_id);
    if (!history) continue;
    const suggestion = computeCostEstimationSuggestion(history, item.unit_price_cents);
    if (suggestion) suggestions[item.id] = suggestion;
  }

  return suggestions;
}
