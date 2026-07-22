import { describe, it, expect } from "vitest";
import {
  buildLineItemsFromTemplate,
  buildTemplateFromLineItems,
  type QuoteTemplateItemRow,
  type QuoteLineItemSource,
} from "./templateBuilder";

const templateItems: QuoteTemplateItemRow[] = [
  { id: "item-1", template_id: "tpl-1", label: "Fliesen legen", unit: "m²", quantity: 12, unit_price_cents: 4500 },
  { id: "item-2", template_id: "tpl-1", label: "Anfahrt", unit: "Pauschale", quantity: 1, unit_price_cents: 4500 },
];

describe("buildLineItemsFromTemplate", () => {
  it("builds quote_line_items rows from a template's items", () => {
    const result = buildLineItemsFromTemplate("tpl-1", templateItems, 0);
    expect(result.error).toBeNull();
    expect(result.rows).toEqual([
      { description: "Fliesen legen", quantity: 12, unit: "m²", unit_price_cents: 4500, line_total_cents: 54000, position: 0 },
      { description: "Anfahrt", quantity: 1, unit: "Pauschale", unit_price_cents: 4500, line_total_cents: 4500, position: 1 },
    ]);
  });

  it("offsets positions by startPosition, for appending onto an existing quote", () => {
    const result = buildLineItemsFromTemplate("tpl-1", templateItems, 3);
    expect(result.error).toBeNull();
    expect(result.rows?.map((r) => r.position)).toEqual([3, 4]);
  });

  it("rejects items that do not belong to the given template id", () => {
    const mismatched: QuoteTemplateItemRow[] = [
      { id: "item-9", template_id: "tpl-2", label: "Fremd", unit: "Stück", quantity: 1, unit_price_cents: 1000 },
    ];
    const result = buildLineItemsFromTemplate("tpl-1", mismatched, 0);
    expect(result.error).not.toBeNull();
    expect(result.rows).toBeUndefined();
  });

  it("returns an empty row list for a template with no items", () => {
    const result = buildLineItemsFromTemplate("tpl-1", [], 0);
    expect(result.error).toBeNull();
    expect(result.rows).toEqual([]);
  });
});

describe("buildTemplateFromLineItems", () => {
  const lineItems: QuoteLineItemSource[] = [
    { description: "Wände streichen", quantity: 20, unit: "m²", unit_price_cents: 1200 },
    { description: "Anfahrt", quantity: 1, unit: "Pauschale", unit_price_cents: 4500 },
  ];

  it("builds template items and trims the name", () => {
    const result = buildTemplateFromLineItems("  Badezimmer Standard  ", lineItems);
    expect(result.error).toBeNull();
    expect(result.name).toBe("Badezimmer Standard");
    expect(result.items).toEqual([
      { label: "Wände streichen", unit: "m²", quantity: 20, unit_price_cents: 1200, sort_order: 0 },
      { label: "Anfahrt", unit: "Pauschale", quantity: 1, unit_price_cents: 4500, sort_order: 1 },
    ]);
  });

  it("rejects an empty name", () => {
    const result = buildTemplateFromLineItems("   ", lineItems);
    expect(result.error).not.toBeNull();
  });

  it("rejects a name over 200 characters", () => {
    const result = buildTemplateFromLineItems("a".repeat(201), lineItems);
    expect(result.error).not.toBeNull();
  });

  it("rejects a quote with no line items", () => {
    const result = buildTemplateFromLineItems("Leer", []);
    expect(result.error).not.toBeNull();
  });
});
