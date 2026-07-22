import { describe, it, expect } from "vitest";
import { computeProfitability } from "./profitability";

describe("computeProfitability", () => {
  it("computes revenue, cost, and margin when every item has cost data", () => {
    const result = computeProfitability([
      { lineTotalCents: 10000, costCents: 4000 },
      { lineTotalCents: 20000, costCents: 5000 },
    ]);
    expect(result.revenueCents).toBe(30000);
    expect(result.costCents).toBe(9000);
    expect(result.marginCents).toBe(21000);
    expect(result.marginPercent).toBeCloseTo(0.7);
    expect(result.hasIncompleteData).toBe(false);
    expect(result.itemCount).toBe(2);
    expect(result.itemsWithCostCount).toBe(2);
  });

  it("flags incomplete data and excludes items missing cost from the totals, never treating missing cost as zero", () => {
    const result = computeProfitability([
      { lineTotalCents: 10000, costCents: 4000 },
      { lineTotalCents: 50000, costCents: null },
    ]);
    // Only the first item (which has cost data) contributes to the figures.
    expect(result.revenueCents).toBe(10000);
    expect(result.costCents).toBe(4000);
    expect(result.marginCents).toBe(6000);
    expect(result.marginPercent).toBeCloseTo(0.6);
    expect(result.hasIncompleteData).toBe(true);
    expect(result.itemCount).toBe(2);
    expect(result.itemsWithCostCount).toBe(1);
  });

  it("returns null margin percent and no crash for an empty list", () => {
    const result = computeProfitability([]);
    expect(result).toEqual({
      revenueCents: 0,
      costCents: 0,
      marginCents: 0,
      marginPercent: null,
      hasIncompleteData: false,
      itemCount: 0,
      itemsWithCostCount: 0,
    });
  });

  it("treats a list where no item has cost data as fully incomplete with zero figures", () => {
    const result = computeProfitability([
      { lineTotalCents: 10000, costCents: null },
      { lineTotalCents: 20000, costCents: null },
    ]);
    expect(result.revenueCents).toBe(0);
    expect(result.costCents).toBe(0);
    expect(result.marginPercent).toBeNull();
    expect(result.hasIncompleteData).toBe(true);
  });

  it("handles a zero-cost line item as complete data, distinct from missing data", () => {
    const result = computeProfitability([{ lineTotalCents: 10000, costCents: 0 }]);
    expect(result.hasIncompleteData).toBe(false);
    expect(result.costCents).toBe(0);
    expect(result.marginCents).toBe(10000);
    expect(result.marginPercent).toBe(1);
  });
});
