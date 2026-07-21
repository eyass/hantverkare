import { describe, it, expect } from "vitest";
import { priceLineItem, computeTotals } from "./pricing";

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
