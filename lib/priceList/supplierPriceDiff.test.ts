import { describe, it, expect } from "vitest";
import { buildSupplierPriceDiff } from "./supplierPriceDiff";
import type { ParsedPriceListRow } from "./importPriceList";

function row(overrides: Partial<ParsedPriceListRow> = {}): ParsedPriceListRow {
  return {
    rowNumber: 2,
    label: "Fliesen verlegen",
    unit: "m²",
    unitPriceCents: 4550,
    category: "Boden",
    ...overrides,
  };
}

describe("buildSupplierPriceDiff", () => {
  it("matches an existing item by label (case-insensitive) and reports old/new price", () => {
    const diff = buildSupplierPriceDiff(
      [{ id: "item-1", label: "fliesen verlegen", unit_price_cents: 4000 }],
      [row()],
    );
    expect(diff.creates).toEqual([]);
    expect(diff.updates).toEqual([
      {
        id: "item-1",
        label: "Fliesen verlegen",
        unit: "m²",
        category: "Boden",
        oldUnitPriceCents: 4000,
        newUnitPriceCents: 4550,
        changed: true,
      },
    ]);
  });

  it("marks a matched row as unchanged when the price is identical", () => {
    const diff = buildSupplierPriceDiff(
      [{ id: "item-1", label: "Fliesen verlegen", unit_price_cents: 4550 }],
      [row()],
    );
    expect(diff.updates).toEqual([
      expect.objectContaining({ changed: false, oldUnitPriceCents: 4550, newUnitPriceCents: 4550 }),
    ]);
  });

  it("puts rows with no matching existing item into creates", () => {
    const diff = buildSupplierPriceDiff([], [row({ label: "Neues Material" })]);
    expect(diff.updates).toEqual([]);
    expect(diff.creates).toEqual([row({ label: "Neues Material" })]);
  });

  it("handles multiple rows, some matched some new", () => {
    const diff = buildSupplierPriceDiff(
      [{ id: "item-1", label: "Wasserhahn montieren", unit_price_cents: 4500 }],
      [
        row({ rowNumber: 2, label: "Wasserhahn montieren", unitPriceCents: 4800 }),
        row({ rowNumber: 3, label: "Neues Material", unitPriceCents: 1200 }),
      ],
    );
    expect(diff.updates).toHaveLength(1);
    expect(diff.creates).toHaveLength(1);
  });
});
