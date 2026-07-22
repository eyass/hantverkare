export type ProfitabilityLineItem = {
  lineTotalCents: number;
  costCents: number | null;
};

export type ProfitabilityResult = {
  /** Revenue (line totals) summed only across items that have cost data. */
  revenueCents: number;
  /** Cost summed only across items that have cost data. */
  costCents: number;
  /** revenueCents - costCents. */
  marginCents: number;
  /** marginCents / revenueCents, or null when revenue is zero/unknown. */
  marginPercent: number | null;
  /** True when at least one line item exists but is missing cost data. */
  hasIncompleteData: boolean;
  /** Total number of line items considered. */
  itemCount: number;
  /** Number of line items that had cost data present. */
  itemsWithCostCount: number;
};

/**
 * Computes revenue/cost/margin from a set of line items, counting only the
 * items that actually have cost data entered. Missing cost data is NEVER
 * treated as zero cost — that would fabricate a profitability number and
 * overstate margin. Instead, items without cost are excluded from the
 * revenue/cost/margin figures and `hasIncompleteData` is set so callers can
 * warn that the numbers don't cover every line item.
 */
export function computeProfitability(items: ProfitabilityLineItem[]): ProfitabilityResult {
  const itemsWithCost = items.filter(
    (item) => item.costCents !== null && item.costCents !== undefined,
  );

  const revenueCents = itemsWithCost.reduce((sum, item) => sum + item.lineTotalCents, 0);
  const costCents = itemsWithCost.reduce((sum, item) => sum + (item.costCents as number), 0);
  const marginCents = revenueCents - costCents;
  const marginPercent = revenueCents === 0 ? null : marginCents / revenueCents;

  return {
    revenueCents,
    costCents,
    marginCents,
    marginPercent,
    hasIncompleteData: itemsWithCost.length < items.length,
    itemCount: items.length,
    itemsWithCostCount: itemsWithCost.length,
  };
}
