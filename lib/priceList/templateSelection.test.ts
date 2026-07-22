import { describe, it, expect } from "vitest";
import { buildRowsToInsert, type TemplateItemRow, type Selection } from "./templateSelection";

const templateItems: TemplateItemRow[] = [
  { id: "item-1", template_id: "tpl-1", label: "Wände streichen", unit: "m²", category: "Malerarbeiten" },
  { id: "item-2", template_id: "tpl-1", label: "Decke streichen", unit: "m²", category: "Malerarbeiten" },
  { id: "item-3", template_id: "tpl-2", label: "Steckdose setzen", unit: "Stück", category: "Elektroinstallation" },
];

describe("buildRowsToInsert", () => {
  it("builds rows for a valid selection from the given template", () => {
    const selections: Selection[] = [
      { templateItemId: "item-1", unitPriceCents: 1200 },
      { templateItemId: "item-2", unitPriceCents: 1400 },
    ];
    const result = buildRowsToInsert("tpl-1", templateItems, selections);
    expect(result.error).toBeNull();
    expect(result.rows).toEqual([
      { label: "Wände streichen", unit: "m²", unit_price_cents: 1200, category: "Malerarbeiten" },
      { label: "Decke streichen", unit: "m²", unit_price_cents: 1400, category: "Malerarbeiten" },
    ]);
  });

  it("rejects a templateItemId that does not belong to the given template", () => {
    const selections: Selection[] = [{ templateItemId: "item-3", unitPriceCents: 4500 }];
    const result = buildRowsToInsert("tpl-1", templateItems, selections);
    expect(result.error).not.toBeNull();
    expect(result.rows).toBeUndefined();
  });

  it("rejects a templateItemId that does not exist at all", () => {
    const selections: Selection[] = [{ templateItemId: "does-not-exist", unitPriceCents: 4500 }];
    const result = buildRowsToInsert("tpl-1", templateItems, selections);
    expect(result.error).not.toBeNull();
  });

  it("rejects a non-positive edited price", () => {
    const selections: Selection[] = [{ templateItemId: "item-1", unitPriceCents: 0 }];
    const result = buildRowsToInsert("tpl-1", templateItems, selections);
    expect(result.error).not.toBeNull();
  });

  it("rejects a non-integer edited price", () => {
    const selections: Selection[] = [{ templateItemId: "item-1", unitPriceCents: 12.5 }];
    const result = buildRowsToInsert("tpl-1", templateItems, selections);
    expect(result.error).not.toBeNull();
  });

  it("returns an empty row list for an empty selection (no-op)", () => {
    const result = buildRowsToInsert("tpl-1", templateItems, []);
    expect(result.error).toBeNull();
    expect(result.rows).toEqual([]);
  });
});
