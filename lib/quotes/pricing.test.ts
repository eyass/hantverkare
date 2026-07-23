import { describe, it, expect } from "vitest";
import {
  priceLineItem,
  computeTotals,
  adjustUnitPriceCents,
  isValidBulkAdjustPercent,
  MIN_BULK_ADJUST_PERCENT,
  MAX_BULK_ADJUST_PERCENT,
} from "./pricing";

describe("priceLineItem", () => {
  it("multiplies quantity by unit price", () => {
    const result = priceLineItem({
      description: "Wasserhahn montieren",
      quantity: 2,
      unit: "Stunde",
      unitPriceCents: 5000,
    });
    expect(result.lineTotalCents).toBe(10000);
  });

  it("rounds fractional cents to the nearest integer", () => {
    const result = priceLineItem({
      description: "Rohrverlegung",
      quantity: 1.5,
      unit: "Meter",
      unitPriceCents: 3333,
    });
    expect(result.lineTotalCents).toBe(5000); // 1.5 * 3333 = 4999.5 -> 5000
  });
});

describe("computeTotals", () => {
  it("computes subtotal, 19% VAT, and total across line items", () => {
    const items = [
      priceLineItem({ description: "A", quantity: 1, unit: "Stück", unitPriceCents: 10000 }),
      priceLineItem({ description: "B", quantity: 2, unit: "Stunde", unitPriceCents: 5000 }),
    ];
    const totals = computeTotals(items);
    expect(totals.subtotalCents).toBe(20000); // 10000 + (2 * 5000)
    expect(totals.vatCents).toBe(3800); // 19% of 20000
    expect(totals.totalCents).toBe(23800);
  });

  it("returns zeros for an empty list", () => {
    const totals = computeTotals([]);
    expect(totals).toEqual({ subtotalCents: 0, vatCents: 0, totalCents: 0 });
  });
});

describe("adjustUnitPriceCents", () => {
  it("increases a price by a positive percent", () => {
    expect(adjustUnitPriceCents(1000, 10)).toBe(1100);
  });

  it("decreases a price by a negative percent", () => {
    expect(adjustUnitPriceCents(1000, -10)).toBe(900);
  });

  it("rounds a fractional cent result to the nearest cent", () => {
    // 999 * 1.10 = 1098.9 -> rounds to 1099
    expect(adjustUnitPriceCents(999, 10)).toBe(1099);
    // 333 * 0.85 = 283.05 -> rounds to 283
    expect(adjustUnitPriceCents(333, -15)).toBe(283);
  });

  it("never drops a price to zero or below, even at -90%", () => {
    expect(adjustUnitPriceCents(1, -90)).toBe(1);
    expect(adjustUnitPriceCents(5, -90)).toBeGreaterThan(0);
  });
});

describe("isValidBulkAdjustPercent", () => {
  it("accepts values within the allowed bounds", () => {
    expect(isValidBulkAdjustPercent(10)).toBe(true);
    expect(isValidBulkAdjustPercent(-50)).toBe(true);
    expect(isValidBulkAdjustPercent(MIN_BULK_ADJUST_PERCENT)).toBe(true);
    expect(isValidBulkAdjustPercent(MAX_BULK_ADJUST_PERCENT)).toBe(true);
  });

  it("rejects zero", () => {
    expect(isValidBulkAdjustPercent(0)).toBe(false);
  });

  it("rejects values outside the bounds", () => {
    expect(isValidBulkAdjustPercent(MIN_BULK_ADJUST_PERCENT - 1)).toBe(false);
    expect(isValidBulkAdjustPercent(MAX_BULK_ADJUST_PERCENT + 1)).toBe(false);
  });

  it("rejects NaN and Infinity", () => {
    expect(isValidBulkAdjustPercent(NaN)).toBe(false);
    expect(isValidBulkAdjustPercent(Infinity)).toBe(false);
  });
});
