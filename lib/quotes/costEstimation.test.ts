import { describe, it, expect } from "vitest";
import { computeCostEstimationSuggestion, MIN_HISTORICAL_DATA_POINTS } from "./costEstimation";

describe("computeCostEstimationSuggestion", () => {
  it("returns null when there are fewer than the minimum number of data points", () => {
    const history = Array.from({ length: MIN_HISTORICAL_DATA_POINTS - 1 }, () => ({
      quantity: 1,
      unitPriceCents: 10000,
      costCents: 8000,
    }));
    expect(computeCostEstimationSuggestion(history, 10000)).toBeNull();
  });

  it("returns a suggestion once the minimum number of data points is met", () => {
    const history = [
      { quantity: 1, unitPriceCents: 10000, costCents: 8000 },
      { quantity: 1, unitPriceCents: 10000, costCents: 8000 },
      { quantity: 1, unitPriceCents: 10000, costCents: 8000 },
    ];
    const result = computeCostEstimationSuggestion(history, 10000);
    expect(result).not.toBeNull();
    expect(result?.sampleSize).toBe(3);
    expect(result?.avgQuotedUnitCents).toBe(10000);
    expect(result?.avgActualCostUnitCents).toBe(8000);
    expect(result?.diffPercent).toBeCloseTo(-0.2);
  });

  it("normalizes cost per unit for line items with quantity > 1", () => {
    const history = [
      { quantity: 2, unitPriceCents: 5000, costCents: 8000 }, // 4000/unit actual
      { quantity: 4, unitPriceCents: 5000, costCents: 16000 }, // 4000/unit actual
      { quantity: 1, unitPriceCents: 5000, costCents: 4000 }, // 4000/unit actual
    ];
    const result = computeCostEstimationSuggestion(history, 5000);
    expect(result?.avgQuotedUnitCents).toBe(5000);
    expect(result?.avgActualCostUnitCents).toBe(4000);
    expect(result?.diffPercent).toBeCloseTo(-0.2);
  });

  it("flags when past jobs cost more than quoted (positive diffPercent)", () => {
    const history = [
      { quantity: 1, unitPriceCents: 10000, costCents: 12000 },
      { quantity: 1, unitPriceCents: 10000, costCents: 12000 },
      { quantity: 1, unitPriceCents: 10000, costCents: 12000 },
    ];
    const result = computeCostEstimationSuggestion(history, 10000);
    expect(result?.diffPercent).toBeCloseTo(0.2);
  });

  it("ignores non-positive quantity data points when checking the minimum", () => {
    const history = [
      { quantity: 1, unitPriceCents: 10000, costCents: 8000 },
      { quantity: 1, unitPriceCents: 10000, costCents: 8000 },
      { quantity: 0, unitPriceCents: 10000, costCents: 8000 },
    ];
    expect(computeCostEstimationSuggestion(history, 10000)).toBeNull();
  });

  it("does not divide by zero when historical quoted price averages to zero", () => {
    const history = [
      { quantity: 1, unitPriceCents: 0, costCents: 100 },
      { quantity: 1, unitPriceCents: 0, costCents: 100 },
      { quantity: 1, unitPriceCents: 0, costCents: 100 },
    ];
    const result = computeCostEstimationSuggestion(history, 0);
    expect(result?.diffPercent).toBe(0);
  });

  it("carries through the current line item's quoted unit price unchanged", () => {
    const history = [
      { quantity: 1, unitPriceCents: 10000, costCents: 8000 },
      { quantity: 1, unitPriceCents: 10000, costCents: 8000 },
      { quantity: 1, unitPriceCents: 10000, costCents: 8000 },
    ];
    const result = computeCostEstimationSuggestion(history, 12345);
    expect(result?.currentQuotedUnitCents).toBe(12345);
  });
});
