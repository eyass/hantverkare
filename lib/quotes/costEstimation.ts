/**
 * Learned cost-estimation suggestions (issue #160).
 *
 * Compares what a tradesperson historically quoted vs. what a job actually
 * cost them, for the same price-list item, across the org's past quotes.
 * This is READ-ONLY: it only ever produces a suggestion for a human to
 * consider. It never changes a price automatically and never touches the
 * price list itself.
 *
 * Requires a minimum number of historical data points before suggesting
 * anything — with too little history the average is noise, not a signal,
 * so we stay silent rather than show a suggestion built on 1-2 jobs.
 */

export type HistoricalCostDataPoint = {
  /** Quantity billed on that historical line item. */
  quantity: number;
  /** What the customer was quoted per unit, in cents. */
  unitPriceCents: number;
  /** What the job actually cost the tradesperson for that line item, in cents (not null — filter upstream). */
  costCents: number;
};

export type CostEstimationSuggestion = {
  /** How many historical line items the averages are based on. */
  sampleSize: number;
  /** Average per-unit price historically quoted to customers, in cents. */
  avgQuotedUnitCents: number;
  /** Average per-unit actual cost historically incurred, in cents. */
  avgActualCostUnitCents: number;
  /** The per-unit price on the current (new) line item, in cents. */
  currentQuotedUnitCents: number;
  /** (avgActualCostUnitCents - avgQuotedUnitCents) / avgQuotedUnitCents. Positive means past jobs cost more than quoted (margin was thinner than intended). */
  diffPercent: number;
};

/** Below this many historical data points, we say nothing rather than suggest off noise. */
export const MIN_HISTORICAL_DATA_POINTS = 3;

/**
 * Computes a suggestion from historical (quoted vs. actual-cost) line items
 * for the same price-list item. Returns null when there isn't enough history
 * to say anything meaningful — callers should treat null as "show nothing".
 */
export function computeCostEstimationSuggestion(
  history: HistoricalCostDataPoint[],
  currentQuotedUnitCents: number,
): CostEstimationSuggestion | null {
  const valid = history.filter(
    (point) => point.quantity > 0 && Number.isFinite(point.costCents) && Number.isFinite(point.unitPriceCents),
  );

  if (valid.length < MIN_HISTORICAL_DATA_POINTS) return null;

  const avgQuotedUnitCents = valid.reduce((sum, point) => sum + point.unitPriceCents, 0) / valid.length;
  const avgActualCostUnitCents =
    valid.reduce((sum, point) => sum + point.costCents / point.quantity, 0) / valid.length;

  const diffPercent = avgQuotedUnitCents === 0 ? 0 : (avgActualCostUnitCents - avgQuotedUnitCents) / avgQuotedUnitCents;

  return {
    sampleSize: valid.length,
    avgQuotedUnitCents: Math.round(avgQuotedUnitCents),
    avgActualCostUnitCents: Math.round(avgActualCostUnitCents),
    currentQuotedUnitCents,
    diffPercent,
  };
}
