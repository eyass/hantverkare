import { describe, it, expect } from "vitest";
import { buildPastQuotesContext, MAX_PAST_QUOTES, type PastQuote } from "./pastQuotesContext";

describe("buildPastQuotesContext (issue #202)", () => {
  it("returns undefined when there are no past quotes (cold start -- graceful degradation)", () => {
    expect(buildPastQuotesContext([])).toBeUndefined();
    expect(buildPastQuotesContext(null)).toBeUndefined();
    expect(buildPastQuotesContext(undefined)).toBeUndefined();
  });

  it("formats a single past quote's description and line items", () => {
    const pastQuotes: PastQuote[] = [
      {
        customer_description: "Badezimmer neu fliesen, 10 m²",
        quote_line_items: [
          { description: "Fliesen verlegen", quantity: 10, unit: "m²", unit_price_cents: 4500 },
        ],
      },
    ];
    const result = buildPastQuotesContext(pastQuotes);
    expect(result).toContain("Badezimmer neu fliesen, 10 m²");
    expect(result).toContain("Fliesen verlegen: 10 m² à 45.00 EUR");
    expect(result).toContain("Beispiel 1");
  });

  it("caps the number of past quotes at MAX_PAST_QUOTES even when more are given", () => {
    const pastQuotes: PastQuote[] = Array.from({ length: 6 }, (_, i) => ({
      customer_description: `Auftrag ${i}`,
      quote_line_items: [],
    }));
    const result = buildPastQuotesContext(pastQuotes);
    expect(result).toBeDefined();
    const exampleCount = (result as string).match(/Beispiel \d+/g)?.length;
    expect(exampleCount).toBe(MAX_PAST_QUOTES);
    expect(result).not.toContain("Auftrag 5");
  });

  it("caps the number of line items echoed per past quote so one huge quote can't blow up the prompt", () => {
    const manyItems = Array.from({ length: 20 }, (_, i) => ({
      description: `Position ${i}`,
      quantity: 1,
      unit: "Stück",
      unit_price_cents: 100,
    }));
    const pastQuotes: PastQuote[] = [
      { customer_description: "Großes Projekt", quote_line_items: manyItems },
    ];
    const result = buildPastQuotesContext(pastQuotes) as string;
    expect(result).toContain("Position 0");
    expect(result).not.toContain("Position 19");
  });

  it("handles a past quote with no line items", () => {
    const pastQuotes: PastQuote[] = [{ customer_description: "Leeres Angebot", quote_line_items: [] }];
    const result = buildPastQuotesContext(pastQuotes);
    expect(result).toContain("keine Positionen");
  });

  it("handles quote_line_items being null (e.g. a joined query returning null instead of [])", () => {
    const pastQuotes: PastQuote[] = [{ customer_description: "Ohne Positionen", quote_line_items: null }];
    const result = buildPastQuotesContext(pastQuotes);
    expect(result).toContain("keine Positionen");
  });
});
